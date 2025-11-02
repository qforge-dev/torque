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
} from "./types";
import { processBatchWithConcurrency, withSeed, countTokens } from "./utils";
import { type LanguageModel } from "ai";
import { createAiAgent, type IAiAgent } from "./ai";
import { DatasetGenerationRenderer } from "./cli-renderer";
import type { IGenerateDatasetArgs } from "./types";

export async function generateDataset(
  conversationSchemaFactory: IMessageSchema,
  {
    count,
    seed,
    output,
    model,
    concurrency = 5,
    generationContext,
    metadata,
  }: IGenerateDatasetArgs
): Promise<IDatasetRow[]> {
  // Generate default output path if not provided
  const outputPath = output || generateDefaultOutputPath();

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  await fsp.mkdir(outputDir, { recursive: true });

  // Initialize the CLI renderer
  const renderer = new DatasetGenerationRenderer();
  renderer.start({
    total: count,
    seed,
    outputFile: outputPath,
    concurrency,
  });

  const indices = Array.from({ length: count }, (_, i) => i);

  const dataset = await processBatchWithConcurrency(
    indices,
    concurrency,
    async (i) => {
      const rowSeed = seed !== undefined ? seed + i : undefined;

      const row = await generateDatasetRow(
        conversationSchemaFactory,
        model,
        rowSeed,
        outputPath,
        renderer,
        i,
        generationContext,
        metadata
      );

      // Save row immediately after generation
      await appendRowToFile(outputPath, row);

      // Mark generation as completed
      renderer.completeGeneration(i);

      return row;
    },
    {
      onProgress: (completed, inProgress, total) => {
        const failed = renderer.getFailedCount();
        renderer.updateProgress({ completed, inProgress, failed, total });
      },
      onError: (error, _item, index) => {
        renderer.failGeneration(index, error.message);
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

async function generateDatasetRow(
  conversationSchemaFactory: IMessageSchema,
  model: LanguageModel,
  seed: number | undefined,
  output: string,
  renderer: DatasetGenerationRenderer,
  generationId: number,
  generationContext?: GenerationContext,
  metadata?: JsonValue
): Promise<IDatasetRow> {
  const startTimestamp = new Date().toISOString();

  const generateFn = async () => {
    const aiAgent = createAiAgent({ model });

    // First pass: Check structure
    const structure = await checkMessageSchemaStructure(
      conversationSchemaFactory,
      aiAgent,
      { messages: [], tools: [] },
      generationContext
    );

    const totalSteps = structure.messages.length;
    const progressTracker = { current: 0 };

    // Start generation with total steps
    renderer.startGeneration(generationId, totalSteps);

    const { messages, tools } = await convertMessageSchemaToDatasetMessage(
      conversationSchemaFactory,
      aiAgent,
      { messages: [], tools: [] },
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

    return {
      messages,
      tools,
      meta: {
        seed: seed ?? 0,
        output: output,
        startTimestamp,
        tokenCount,
        metadata,
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
  structure: IMessageSchemaStructure = { messages: [], tools: [] },
  generationContext?: GenerationContext
): Promise<IMessageSchemaStructure> {
  const checkContext = {
    acc: { messages: [], tools: [] },
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
  acc: IConvertMessageSchemaToDatasetMessageAcc = { messages: [], tools: [] },
  structure: IMessageSchemaStructure = { messages: [], tools: [] },
  generationContext: GenerationContext | undefined,
  progress?: IGenerationProgress
): Promise<IConvertMessageSchemaToDatasetMessageAcc> {
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
