import fsp from "fs/promises";
import path from "path";
import { z } from "zod";
import type {
  IConvertMessageSchemaToDatasetMessageAcc,
  IDatasetRow,
  IMessageSchema,
  IMessageSchemaStructure,
  GenerationContext,
  JsonValue,
  ISchemaWithCount,
} from "./types";
import { processBatchWithConcurrency, withSeed, countTokens } from "./utils";
import { type LanguageModel } from "ai";
import { createAiAgent, type IAiAgent } from "./ai";
import { DatasetGenerationRenderer } from "./cli-renderer";
import type {
  IGenerateDatasetArgs,
  IGenerateDatasetArgsWithCount,
  IGenerateDatasetArgsMultiSchema,
} from "./types";

// Overload 1: Array of schemas with individual counts (count not allowed in options)
export async function generateDataset(
  schemas: ISchemaWithCount[],
  options: IGenerateDatasetArgsMultiSchema
): Promise<IDatasetRow[]>;

// Overload 2: Single schema with count in options (existing API)
export async function generateDataset(
  conversationSchemaFactory: IMessageSchema,
  options: IGenerateDatasetArgsWithCount
): Promise<IDatasetRow[]>;

// Implementation
export async function generateDataset(
  schemaOrSchemas: IMessageSchema | ISchemaWithCount[],
  options: IGenerateDatasetArgs | IGenerateDatasetArgsWithCount | IGenerateDatasetArgsMultiSchema
): Promise<IDatasetRow[]> {
  const {
    seed,
    output,
    model,
    concurrency = 5,
    generationContext,
    metadata,
  } = options;

  // Normalize input to array of schema-count pairs
  const schemaEntries: Array<{ schema: IMessageSchema; count: number }> =
    Array.isArray(schemaOrSchemas)
      ? schemaOrSchemas
      : [
          {
            schema: schemaOrSchemas,
            count: (options as IGenerateDatasetArgsWithCount).count,
          },
        ];

  const totalCount = schemaEntries.reduce((sum, entry) => sum + entry.count, 0);

  // Generate default output path if not provided
  const outputPath = output || generateDefaultOutputPath();

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  await fsp.mkdir(outputDir, { recursive: true });

  // Initialize the CLI renderer
  const renderer = new DatasetGenerationRenderer();
  renderer.start({
    total: totalCount,
    seed,
    outputFile: outputPath,
    concurrency,
  });

  const generationStartTimestamp = new Date().toISOString();

  // Create task list with schema assignments
  type Task = {
    index: number;
    schema: IMessageSchema;
    seedOffset: number;
  };

  const tasks: Task[] = [];
  let currentIndex = 0;

  for (const entry of schemaEntries) {
    for (let i = 0; i < entry.count; i++) {
      tasks.push({
        index: currentIndex,
        schema: entry.schema,
        seedOffset: currentIndex,
      });
      currentIndex++;
    }
  }

  const dataset = await processBatchWithConcurrency(
    tasks,
    concurrency,
    async (task) => {
      const rowSeed = seed !== undefined ? seed + task.seedOffset : undefined;

      const row = await generateDatasetRow(
        task.schema,
        model,
        rowSeed,
        outputPath,
        renderer,
        task.index,
        generationStartTimestamp,
        generationContext,
        metadata
      );

      // Save row immediately after generation
      await appendRowToFile(outputPath, row);

      // Mark generation as completed
      renderer.completeGeneration(task.index);

      return row;
    },
    {
      onProgress: (completed, inProgress, total) => {
        const failed = renderer.getFailedCount();
        renderer.updateProgress({ completed, inProgress, failed, total });
      },
      onError: (error, task) => {
        renderer.failGeneration(task.index, error.message);
      },
    }
  );

  renderer.finish();

  // Filter out failed generations (undefined values)
  const successfulDataset = dataset.filter(
    (row): row is IDatasetRow => row !== undefined
  );

  return successfulDataset;
}

function generateDefaultOutputPath(): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace(/T/, "_")
    .split("Z")[0];
  return `data/dataset_${timestamp}.jsonl`;
}

async function appendRowToFile(
  filePath: string,
  row: IDatasetRow
): Promise<void> {
  const jsonLine = JSON.stringify(row) + "\n";
  await fsp.appendFile(filePath, jsonLine, "utf-8");
}

function isMetadataObject(
  value: JsonValue | undefined
): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function generateIdFromSeed(seed: number): string {
  // Create a deterministic ID from the seed
  // Using a simple hash-like approach that's consistent across runs
  const hash = Math.abs(seed * 2654435761) % 4294967296;
  return `row_${seed}_${hash.toString(36)}`;
}

function mergeRowMetadata(
  base: JsonValue | undefined,
  addition: Record<string, JsonValue>
): JsonValue | undefined {
  if (!addition || Object.keys(addition).length === 0) {
    return base;
  }

  if (base === undefined) {
    return { ...addition };
  }

  if (isMetadataObject(base)) {
    return { ...base, ...addition };
  }

  return addition;
}

async function generateDatasetRow(
  conversationSchemaFactory: IMessageSchema,
  model: LanguageModel,
  seed: number | undefined,
  output: string,
  renderer: DatasetGenerationRenderer,
  generationId: number,
  generationStartTimestamp: string,
  generationContext?: GenerationContext,
  metadata?: JsonValue
): Promise<IDatasetRow> {
  const generateFn = async () => {
    const aiAgent = createAiAgent({ model });
    const baseMetadata = isMetadataObject(metadata) ? { ...metadata } : {};

    // First pass: Check structure
    const structure = await checkMessageSchemaStructure(
      conversationSchemaFactory,
      aiAgent,
      { messages: [], tools: [], metadata: baseMetadata },
      generationContext
    );

    const totalSteps = structure.messages.length;
    const progressTracker = { current: 0 };

    // Start generation with total steps
    renderer.startGeneration(generationId, totalSteps);

    const {
      messages,
      tools,
      metadata: schemaMetadata,
    } = await convertMessageSchemaToDatasetMessage(
      conversationSchemaFactory,
      aiAgent,
      {
        messages: [],
        tools: [],
        metadata: { ...structure.metadata },
      },
      structure,
      generationContext,
      {
        totalSteps,
        progressTracker,
        onStepComplete: (current: number, total: number, stepType: string) => {
          renderer.updateStep(generationId, current, stepType);
        },
      }
    );

    // Count tokens
    const tokenCount = countTokens(messages, tools);

    // Add ID to metadata if seed is defined
    const metadataWithId =
      seed !== undefined
        ? { ...schemaMetadata, id: generateIdFromSeed(seed) }
        : schemaMetadata;

    const rowMetadata = mergeRowMetadata(metadata, metadataWithId);

    return {
      messages,
      tools,
      meta: {
        seed: seed ?? 0,
        output: output,
        startTimestamp: generationStartTimestamp,
        tokenCount,
        metadata: rowMetadata,
      },
    };
  };

  if (seed !== undefined) {
    return await withSeed(seed, generateFn);
  }

  return await generateFn();
}
async function checkMessageSchemaStructure(
  messageFactory: IMessageSchema,
  aiAgent: IAiAgent,
  structure: IMessageSchemaStructure = {
    messages: [],
    tools: [],
    metadata: {},
  },
  generationContext?: GenerationContext
): Promise<IMessageSchemaStructure> {
  if (!structure.metadata) {
    structure.metadata = {};
  }

  const checkContext = {
    acc: {
      messages: [],
      tools: [],
      metadata: { ...structure.metadata },
    },
    ai: aiAgent,
    structure,
    phase: "check" as const,
    generationContext,
  };

  const message = await messageFactory(checkContext);
  if (message === null) return structure;

  if (Array.isArray(message)) {
    for (const m of message) {
      structure = await checkMessageSchemaStructure(
        m,
        aiAgent,
        structure,
        generationContext
      );
    }
    return structure;
  }

  if (!("role" in message)) {
    if (!structure.tools.some((t) => t.name === message.name)) {
      structure.tools.push({
        name: message.name,
        description: message.description,
        parameters: z.toJSONSchema(message.parameters),
      });
    }
    return structure;
  }

  if ("content" in message) {
    if (
      message.role === "assistant" &&
      message.toolCalls &&
      message.toolCalls.length > 0
    ) {
      // In check phase, resolve tool calls to get their structure
      const toolCallStructures = await Promise.all(
        message.toolCalls.map(async (tc) => {
          const toolCall = await tc(checkContext);
          return {
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            arguments: toolCall.arguments,
          };
        })
      );

      structure.messages.push({
        role: "assistant",
        content: message.content,
        toolCalls: toolCallStructures,
      });
    } else {
      structure.messages.push({
        role: message.role,
        type: "text",
        content: message.content,
      });
    }
    return structure;
  }

  if (message.role === "assistant") {
    structure.messages.push({
      role: "assistant",
      type: "tool-call",
      toolCallId: message.toolCallId,
      toolName: message.toolName,
      arguments: message.arguments,
    });
    return structure;
  } else if (message.role === "tool") {
    structure.messages.push({
      role: "tool",
      type: "tool-result",
      toolCallId: message.toolCallId,
      toolName: message.toolName,
      result: message.result,
    });
    return structure;
  }

  return structure;
}

interface IGenerationProgress {
  totalSteps: number;
  progressTracker: { current: number };
  onStepComplete: (current: number, total: number, stepType: string) => void;
}

async function convertMessageSchemaToDatasetMessage(
  messageFactory: IMessageSchema,
  aiAgent: IAiAgent,
  acc: IConvertMessageSchemaToDatasetMessageAcc = {
    messages: [],
    tools: [],
    metadata: {},
  },
  structure: IMessageSchemaStructure = {
    messages: [],
    tools: [],
    metadata: {},
  },
  generationContext: GenerationContext | undefined,
  progress?: IGenerationProgress
): Promise<IConvertMessageSchemaToDatasetMessageAcc> {
  if (
    Object.keys(acc.metadata).length === 0 &&
    Object.keys(structure.metadata).length > 0
  ) {
    acc.metadata = { ...structure.metadata };
  }

  const context = {
    acc,
    ai: aiAgent,
    structure,
    phase: "generate" as const,
    generationContext,
  };

  const message = await messageFactory(context);
  if (message === null) return acc;
  if (Array.isArray(message)) {
    for (const m of message) {
      acc = await convertMessageSchemaToDatasetMessage(
        m,
        aiAgent,
        acc,
        structure,
        generationContext,
        progress
      );
    }
    return acc;
  }
  if (!("role" in message)) {
    if (acc.tools.some((t) => t.name === message.name)) {
      return acc;
    }
    acc.tools.push({
      description: message.description,
      name: message.name,
      parameters: z.toJSONSchema(message.parameters),
    });
    return acc;
  }

  // Track progress for message steps
  const logStep = (stepType: string) => {
    if (progress) {
      progress.progressTracker.current++;
      progress.onStepComplete(
        progress.progressTracker.current,
        progress.totalSteps,
        stepType
      );
    }
  };

  if ("content" in message) {
    if (message.role === "user") {
      logStep("user message");
      acc.messages.push({
        role: "user",
        content: [{ type: "text", text: message.content }],
      });
    } else if (message.role === "assistant") {
      if (message.toolCalls && message.toolCalls.length > 0) {
        logStep("assistant message with tool calls");
        // Resolve all tool calls
        const toolCallParts = await Promise.all(
          message.toolCalls.map((tc) => tc(context))
        );

        acc.messages.push({
          role: "assistant",
          content: [
            { type: "text", text: message.content },
            ...toolCallParts.map((tc) => ({
              type: "tool-call" as const,
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              input: tc.arguments,
            })),
          ],
        });
      } else {
        logStep("assistant message");
        acc.messages.push({
          role: "assistant",
          content: [{ type: "text", text: message.content }],
        });
      }
    } else if (message.role === "system") {
      logStep("system message");
      acc.messages.push({
        role: "system",
        content: message.content,
      });
    }
    return acc;
  }
  if (message.role === "assistant") {
    logStep(`tool-call (${message.toolName})`);
    acc.messages.push({
      role: "assistant",
      content: [
        {
          type: "tool-call",
          input: message.arguments,
          toolCallId: message.toolCallId,
          toolName: message.toolName,
        },
      ],
    });
    return acc;
  } else if (message.role === "tool") {
    logStep(`tool-result (${message.toolName})`);
    acc.messages.push({
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: message.toolCallId,
          toolName: message.toolName,
          output: message.result,
        },
      ],
    });
    return acc;
  }
  return acc;
}
