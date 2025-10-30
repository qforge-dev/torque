import { createHash } from "crypto";
import { tool, type IToolDefinition } from "./schema";
import { convertJsonSchemaToZod } from "zod-from-json-schema";
import z from "zod";
import { AsyncLocalStorage } from "async_hooks";
import { encoding_for_model } from "tiktoken";
import type { IDatasetMessage, IDatasetTool } from "./types";

function rngFromSeed(seed: number): () => number {
  let state = createHash("sha256").update(String(seed)).digest();
  return () => {
    for (let i = 0; i < state.length; i++)
      state[i]! ^= (state[(i + 13) % state.length]! + 0x9e) & 0xff;
    const n = state.readUInt32BE(0);
    return n / 0x100000000;
  };
}

const asyncLocalStorage = new AsyncLocalStorage<() => number>();

export function setSeed(seed: number): void {
  const rng = rngFromSeed(seed);
  asyncLocalStorage.enterWith(rng);
}

export function clearSeed(): void {
  asyncLocalStorage.disable();
}

export function random(): number {
  const rngContext = asyncLocalStorage.getStore();
  if (rngContext) {
    return rngContext();
  }
  return Math.random();
}

export async function withSeed<T>(
  seed: number,
  fn: () => Promise<T>
): Promise<T> {
  const rng = rngFromSeed(seed);
  return asyncLocalStorage.run(rng, fn);
}

export async function processBatchWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  processor: (item: T, index: number) => Promise<R>,
  options?: {
    onProgress?: (completed: number, inProgress: number, total: number) => void;
  }
): Promise<R[]> {
  const results: R[] = [];
  const executing: Set<Promise<void>> = new Set();
  let completed = 0;

  const reportProgress = () => {
    if (options?.onProgress) {
      options.onProgress(completed, executing.size, items.length);
    }
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const promise = processor(item, i)
      .then((result) => {
        results[i] = result;
      })
      .finally(() => {
        executing.delete(promise);
        completed++;
        reportProgress();
      });

    executing.add(promise);
    reportProgress();

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

export function randomSample<T>(n: number, array: T[]): T[] {
  return array.sort(() => random() - 0.5).slice(0, n);
}

export type Awaitable<T> = T | Promise<T>;

export function toolsToToolDefinitionArray(tools?: unknown): IToolDefinition[] {
  let toolsToUse = tools;

  if (!Array.isArray(toolsToUse)) {
    throw new Error("Tools must be an array");
  }

  return toolsToUse.reduce((acc, t) => {
    if (typeof t !== "object" || t === null) {
      console.warn("Skipping tool: ", JSON.stringify(t));
      return acc;
    }
    if (
      typeof t.name !== "string" ||
      typeof t.description !== "string" ||
      typeof t.parameters !== "object"
    ) {
      console.warn("Skipping tool: ", JSON.stringify(t));
      return acc;
    }
    return [
      ...acc,
      tool({
        name: t.name,
        description: t.description,
        // @ts-ignore
        parameters: convertJsonSchemaToZod(t.parameters),
        output: z.object({
          result: convertJsonSchemaToZod(t.output),
        }),
      }),
    ];
  }, [] as IToolDefinition[]);
}

export function countTokens(
  messages: IDatasetMessage[],
  tools: IDatasetTool[],
  model: string = "gpt-4o"
): { messages: number; tools: number; total: number } {
  const encoding = encoding_for_model(model as any);

  let messageTokens = 0;
  let toolTokens = 0;

  // Count tokens in messages
  for (const message of messages) {
    // Serialize the message to JSON for token counting
    const messageStr = JSON.stringify(message);
    messageTokens += encoding.encode(messageStr).length;
  }

  // Count tokens in tools
  for (const tool of tools) {
    // Serialize the tool to JSON for token counting
    const toolStr = JSON.stringify(tool);
    toolTokens += encoding.encode(toolStr).length;
  }

  encoding.free();

  return {
    messages: messageTokens,
    tools: toolTokens,
    total: messageTokens + toolTokens,
  };
}
