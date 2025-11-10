import fsp from "fs/promises";
import path from "path";
import { z } from "zod";
import type {
  IConvertMessageSchemaToDatasetMessageAcc,
  IDatasetSchema,
  IDatasetRow,
  IMessageSchema,
  IMessageSchemaGroup,
  IMessageSchemaStructure,
  GenerationContext,
  JsonValue,
  ISchemaWithCount,
  IToolCallSchema,
  DatasetFormat,
} from "./types";
import {
  processBatchWithConcurrency,
  withSeed,
  getRandomCallCount,
  resetRandomCallCount,
} from "./utils";
import { type LanguageModel, type ModelMessage } from "ai";
import { createAiAgent, type IAiAgent } from "./ai";
import { DatasetGenerationRenderer } from "./cli-renderer";
import type {
  IGenerateDatasetArgs,
  IGenerateDatasetArgsWithCount,
  IGenerateDatasetArgsMultiSchema,
} from "./types";
import { createWriter } from "./writer";
import { TokenCounterPool } from "./token-counting/tokenCounterPool";
import { hoistSystemMessages } from "./ai-message-order";

const DEFAULT_TOKEN_COUNTER_WORKERS = 3;

function withSystemMessageHoisting(aiAgent: IAiAgent): IAiAgent {
  const orderMessages = (messages: ModelMessage[]) =>
    hoistSystemMessages(messages);

  return {
    generateText: async (messages) =>
      aiAgent.generateText(orderMessages(messages)),
    generateObject: async (schema, messages) =>
      aiAgent.generateObject(schema, orderMessages(messages)),
  };
}

export async function generateDataset(
  schemas: ISchemaWithCount[],
  options: IGenerateDatasetArgsMultiSchema
): Promise<IDatasetRow[]>;

export async function generateDataset(
  conversationSchemaFactory: IMessageSchema,
  options: IGenerateDatasetArgsWithCount
): Promise<IDatasetRow[]>;

export async function generateDataset(
  schemaOrSchemas: IMessageSchema | ISchemaWithCount[],
  options:
    | IGenerateDatasetArgs
    | IGenerateDatasetArgsWithCount
    | IGenerateDatasetArgsMultiSchema
): Promise<IDatasetRow[]> {
  const {
    seed,
    output,
    format = "jsonl",
    model,
    concurrency = 5,
    generationContext,
    metadata,
    tokenCounterWorkers = DEFAULT_TOKEN_COUNTER_WORKERS,
  } = options;

  // Normalize input to array of schema-count-seed tuples
  const schemaEntries: Array<{
    schema: IMessageSchema;
    count: number;
    seed?: number;
  }> = Array.isArray(schemaOrSchemas)
    ? schemaOrSchemas
    : [
        {
          schema: schemaOrSchemas,
          count: (options as IGenerateDatasetArgsWithCount).count,
          seed: seed,
        },
      ];

  const totalCount = schemaEntries.reduce((sum, entry) => sum + entry.count, 0);

  // Generate default output path if not provided
  const outputPath = output || generateDefaultOutputPath(format);

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  await fsp.mkdir(outputDir, { recursive: true });

  // Initialize the writer for the specified format
  const writer = createWriter(format, outputPath);
  await writer.init();

  // Initialize the CLI renderer
  const renderer = new DatasetGenerationRenderer();
  renderer.start({
    total: totalCount,
    seed,
    outputFile: outputPath,
    concurrency,
  });

  const generationStartTimestamp = new Date().toISOString();

  const normalizedTokenCounterWorkers =
    Number.isFinite(tokenCounterWorkers) && tokenCounterWorkers !== undefined
      ? Math.max(0, Math.floor(tokenCounterWorkers))
      : DEFAULT_TOKEN_COUNTER_WORKERS;

  const tokenCounterPool =
    normalizedTokenCounterWorkers > 0
      ? new TokenCounterPool(normalizedTokenCounterWorkers)
      : undefined;

  // Create task list with schema assignments
  type Task = {
    index: number;
    schema: IMessageSchema;
    seedBase: number | undefined;
    seedOffset: number;
  };

  const tasks: Task[] = [];
  let currentIndex = 0;

  for (const entry of schemaEntries) {
    // Use schema-specific seed if provided, otherwise fall back to global seed
    const schemaSeed = entry.seed !== undefined ? entry.seed : seed;

    for (let i = 0; i < entry.count; i++) {
      tasks.push({
        index: currentIndex,
        schema: entry.schema,
        seedBase: schemaSeed,
        seedOffset: i, // Offset relative to this schema, not global
      });
      currentIndex++;
    }
  }

  try {
    const dataset = await processBatchWithConcurrency(
      tasks,
      concurrency,
      async (task) => {
        const rowSeed =
          task.seedBase !== undefined
            ? task.seedBase + task.seedOffset
            : undefined;

        const row = await generateDatasetRow(
          task.schema,
          model,
          rowSeed,
          outputPath,
          renderer,
          task.index,
          generationStartTimestamp,
          generationContext,
          metadata,
          tokenCounterPool
        );

        // Write row immediately after generation
        // Thread-safety is handled internally by the writer
        await writer.appendRow(row);

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
  } finally {
    // Always close the writer
    await writer.close();
    await tokenCounterPool?.destroy();
  }
}

function generateDefaultOutputPath(format: DatasetFormat = "jsonl"): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace(/T/, "_")
    .split("Z")[0];
  const extension = format === "parquet" ? "parquet" : "jsonl";
  return `data/dataset_${timestamp}.${extension}`;
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

function buildSchemaColumn(structure: IMessageSchemaStructure): IDatasetSchema {
  return {
    metadata: { ...(structure.metadata ?? {}) },
    messages: structure.messages.map(({ message }) => ({ ...message })),
    tools: structure.tools.map((tool) => ({ ...tool })),
  };
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
  metadata?: JsonValue,
  tokenCounterPool?: TokenCounterPool
): Promise<IDatasetRow> {
  const generateFn = async () => {
    const aiAgent = withSystemMessageHoisting(createAiAgent({ model }));
    const baseMetadata = isMetadataObject(metadata) ? { ...metadata } : {};

    // First pass: Check structure
    const structure = await checkMessageSchemaStructure(
      conversationSchemaFactory,
      aiAgent,
      { messages: [], tools: [], metadata: baseMetadata, seedCounts: [] },
      generationContext
    );

    const totalSteps = structure.messages.length;
    const progressTracker = { current: 0 };

    // Start generation with total steps
    renderer.startGeneration(generationId, totalSteps);

    // Reset random call count before generate phase
    resetRandomCallCount();

    const {
      messages,
      tools,
      metadata: schemaMetadata,
    } = await withSeed(seed!, () =>
      convertMessageSchemaToDatasetMessage(
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
          seedCounts: structure.seedCounts,
          currentStepIndex: { value: 0 },
          seed,
          generationId,
          onStepComplete: (
            current: number,
            total: number,
            stepType: string
          ) => {
            renderer.updateStep(generationId, current, stepType);
          },
        }
      )
    );

    const tokenCount = tokenCounterPool
      ? await tokenCounterPool.countTokens({ messages, tools })
      : undefined;

    // Add ID to metadata if seed is defined
    const metadataWithId =
      seed !== undefined
        ? { ...schemaMetadata, id: generateIdFromSeed(seed) }
        : schemaMetadata;

    const rowMetadata = mergeRowMetadata(metadata, metadataWithId);
    const schemaColumn = buildSchemaColumn(structure);

    const row: IDatasetRow = {
      messages,
      tools,
      schema: schemaColumn,
      meta: {
        seed: seed ?? 0,
        model:
          typeof model === "string"
            ? model
            : `${model.provider}/${model.modelId}`,
        output: output,
        startTimestamp: generationStartTimestamp,
        metadata: rowMetadata,
      },
    };

    if (tokenCount) {
      row.meta.tokenCount = tokenCount;
    }

    return row;
  };

  if (seed !== undefined) {
    return await withSeed(seed, generateFn);
  }

  return await generateFn();
}
interface IStructureWithSeedCounts extends IMessageSchemaStructure {
  seedCounts?: number[];
}

type SchemaNode = IMessageSchema | IMessageSchemaGroup;

async function checkMessageSchemaStructure(
  messageFactory: SchemaNode,
  aiAgent: IAiAgent,
  structure: IStructureWithSeedCounts = {
    messages: [],
    tools: [],
    metadata: {},
    seedCounts: [],
  },
  generationContext?: GenerationContext
): Promise<IStructureWithSeedCounts> {
  if (Array.isArray(messageFactory)) {
    for (const schema of messageFactory) {
      structure = await checkMessageSchemaStructure(
        schema,
        aiAgent,
        structure,
        generationContext
      );
    }
    return structure;
  }

  if (!structure.metadata) {
    structure.metadata = {};
  }
  if (!structure.seedCounts) {
    structure.seedCounts = [];
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
        output: z.toJSONSchema(message.output),
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
      const toolCallStructures: {
        toolCallId: string;
        toolName: string;
        arguments: any;
        generationId: string;
      }[] = [];
      for (const tc of message.toolCalls) {
        const toolCall = await tc(checkContext);
        toolCallStructures.push({
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          arguments: toolCall.arguments,
          generationId: toolCall.generationId,
        });
      }

      const structureMessage = {
        role: "assistant" as const,
        content: message.content,
        toolCalls: toolCallStructures,
        generationId: message.generationId,
      };

      structure.messages.push({
        schema: message,
        message: structureMessage,
      });

      // Track seed count after this message
      const currentCount = getRandomCallCount();
      if (currentCount !== undefined) {
        structure.seedCounts.push(currentCount);
      }
    } else {
      const structureMessage = {
        role: message.role,
        type: "text" as const,
        content: message.content,
        generationId: message.generationId,
      };

      structure.messages.push({
        schema: message,
        message: structureMessage,
      });

      // Track seed count after this message
      const currentCount = getRandomCallCount();
      if (currentCount !== undefined) {
        structure.seedCounts.push(currentCount);
      }
    }
    return structure;
  }

  if (message.role === "assistant") {
    const structureMessage = {
      role: "assistant" as const,
      type: "tool-call" as const,
      toolCallId: message.toolCallId,
      toolName: message.toolName,
      arguments: message.arguments,
      generationId: message.generationId,
    };

    structure.messages.push({
      schema: message,
      message: structureMessage,
    });

    // Track seed count after this message
    const currentCount = getRandomCallCount();
    if (currentCount !== undefined) {
      structure.seedCounts.push(currentCount);
    }
    return structure;
  } else if (message.role === "tool") {
    const structureMessage = {
      role: "tool" as const,
      type: "tool-result" as const,
      toolCallId: message.toolCallId,
      toolName: message.toolName,
      result: message.result,
      generationId: message.generationId,
    };

    structure.messages.push({
      schema: message,
      message: structureMessage,
    });

    // Track seed count after this message
    const currentCount = getRandomCallCount();
    if (currentCount !== undefined) {
      structure.seedCounts.push(currentCount);
    }
    return structure;
  }

  return structure;
}

interface IGenerationProgress {
  totalSteps: number;
  progressTracker: { current: number };
  onStepComplete: (current: number, total: number, stepType: string) => void;
  seedCounts?: number[];
  currentStepIndex?: { value: number };
  seed?: number;
  generationId?: number;
}

async function convertMessageSchemaToDatasetMessage(
  messageFactory: SchemaNode,
  aiAgent: IAiAgent,
  acc: IConvertMessageSchemaToDatasetMessageAcc = {
    messages: [],
    tools: [],
    metadata: {},
  },
  structure: IStructureWithSeedCounts = {
    messages: [],
    tools: [],
    metadata: {},
    seedCounts: [],
  },
  generationContext: GenerationContext | undefined,
  progress?: IGenerationProgress
): Promise<IConvertMessageSchemaToDatasetMessageAcc> {
  if (Array.isArray(messageFactory)) {
    for (const schema of messageFactory) {
      acc = await convertMessageSchemaToDatasetMessage(
        schema,
        aiAgent,
        acc,
        structure,
        generationContext,
        progress
      );
    }
    return acc;
  }

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
      output: z.toJSONSchema(message.output),
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

      // Verify seed count matches check phase
      if (progress.seedCounts && progress.currentStepIndex) {
        const currentGenerateSeedCount = getRandomCallCount();
        const expectedCheckSeedCount =
          progress.seedCounts[progress.currentStepIndex.value];

        if (
          currentGenerateSeedCount !== undefined &&
          expectedCheckSeedCount !== undefined
        ) {
          if (currentGenerateSeedCount !== expectedCheckSeedCount) {
            const messageEntry =
              structure.messages[progress.currentStepIndex.value];
            const messageInfo = messageEntry?.message;
            const messageIndex = progress.currentStepIndex.value + 1;
            const totalMessages = progress.totalSteps;

            // Build detailed error message with context
            let errorMsg = `Seed skewing detected in generation`;

            if (progress.generationId !== undefined) {
              errorMsg += ` #${progress.generationId}`;
            }

            if (progress.seed !== undefined) {
              errorMsg += ` (seed: ${progress.seed})`;
            }

            errorMsg += `:\n\n`;
            errorMsg += `  Location: Message ${messageIndex} of ${totalMessages} (${stepType})\n`;

            if (messageInfo) {
              if ("role" in messageInfo && "content" in messageInfo) {
                const contentPreview =
                  typeof messageInfo.content === "string"
                    ? messageInfo.content.substring(0, 50)
                    : "[complex content]";
                errorMsg += `  Message: ${
                  messageInfo.role
                } - "${contentPreview}${
                  messageInfo.content.length > 50 ? "..." : ""
                }"\n`;
              }
            }

            errorMsg += `\n`;
            errorMsg += `  Random calls in check phase: ${expectedCheckSeedCount}\n`;
            errorMsg += `  Random calls in generate phase: ${currentGenerateSeedCount}\n`;
            errorMsg += `  Difference: ${
              currentGenerateSeedCount - expectedCheckSeedCount
            } extra calls\n`;
            errorMsg += `\n`;
            errorMsg += `This indicates the message schema is not deterministic between phases.\n`;
            errorMsg += `Make sure your schema uses the same number of random() calls in both check and generate phases.`;

            throw new Error(errorMsg);
          }
        }

        progress.currentStepIndex.value++;
      }
    }
  };

  if ("content" in message) {
    if (message.role === "user") {
      logStep("user message");
      const datasetMessage = {
        generationId: message.generationId,
        role: "user" as const,
        content: [{ type: "text" as const, text: message.content }],
      };
      acc.messages.push(datasetMessage);
    } else if (message.role === "assistant") {
      if (message.toolCalls && message.toolCalls.length > 0) {
        const toolCallParts: IToolCallSchema<any>[] = [];
        for (const tc of message.toolCalls) {
          const toolCall = await tc(context);
          toolCallParts.push(toolCall);
        }

        logStep("assistant message with tool calls");

        const textPart = { type: "text" as const, text: message.content };
        const datasetMessage = {
          generationId: message.generationId,
          role: "assistant" as const,
          content: [
            textPart,
            ...toolCallParts.map((tc) => ({
              type: "tool-call" as const,
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              input: tc.arguments,
            })),
          ],
        };
        acc.messages.push(datasetMessage);
      } else {
        logStep("assistant message");
        const datasetMessage = {
          generationId: message.generationId,
          role: "assistant" as const,
          content: message.content,
        };
        acc.messages.push(datasetMessage);
      }
    } else if (message.role === "system") {
      logStep("system message");
      const datasetMessage = {
        generationId: message.generationId,
        role: "system" as const,
        content: message.content,
      };
      acc.messages.push(datasetMessage);
    }
    return acc;
  }

  if (message.role === "assistant") {
    logStep(`tool-call (${message.toolName})`);
    const datasetMessage = {
      generationId: message.generationId,
      role: "assistant" as const,
      content: [
        {
          type: "tool-call" as const,
          input: message.arguments,
          toolCallId: message.toolCallId,
          toolName: message.toolName,
        },
      ],
    };
    acc.messages.push(datasetMessage);
    return acc;
  } else if (message.role === "tool") {
    logStep(`tool-result (${message.toolName})`);
    const datasetMessage = {
      generationId: message.generationId,
      role: "tool" as const,
      content: [
        {
          type: "tool-result" as const,
          toolCallId: message.toolCallId,
          toolName: message.toolName,
          output: message.result,
        },
      ],
    };
    acc.messages.push(datasetMessage);
    return acc;
  }
  return acc;
}
