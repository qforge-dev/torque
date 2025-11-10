import { createHash } from "crypto";
import { tool, type IToolDefinition } from "./schema";
import { convertJsonSchemaToZod } from "zod-from-json-schema";
import z, { type ZodTypeAny } from "zod";
import { AsyncLocalStorage } from "async_hooks";

function resolveBaseSchema(schema: ZodTypeAny): ZodTypeAny {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    const inner = (schema as any)._def.innerType as ZodTypeAny;
    return resolveBaseSchema(inner);
  }

  if (schema instanceof z.ZodDefault) {
    const inner = (schema as any)._def.innerType as ZodTypeAny;
    return resolveBaseSchema(inner);
  }

  return schema;
}

export function isEmptyObjectSchema(schema: ZodTypeAny): boolean {
  const base = resolveBaseSchema(schema);

  if (!(base instanceof z.ZodObject)) {
    return false;
  }

  return Object.keys(base.shape).length === 0;
}

function rngFromSeed(seed: number): () => number {
  let state = createHash("sha256").update(String(seed)).digest();
  return () => {
    for (let i = 0; i < state.length; i++)
      state[i]! ^= (state[(i + 13) % state.length]! + 0x9e) & 0xff;
    const n = state.readUInt32BE(0);
    return n / 0x100000000;
  };
}

type RngContext = {
  rng: () => number;
  counter: { value: number };
};

const asyncLocalStorage = new AsyncLocalStorage<RngContext>();

export function clearSeed(): void {
  asyncLocalStorage.disable();
}

export function random(): number {
  const rngContext = asyncLocalStorage.getStore();
  if (rngContext) {
    rngContext.counter.value++;
    return rngContext.rng();
  }
  return Math.random();
}

export function getRandomCallCount(): number | undefined {
  const rngContext = asyncLocalStorage.getStore();
  if (rngContext) {
    return rngContext.counter.value;
  }
  return undefined;
}

export function resetRandomCallCount(): void {
  const rngContext = asyncLocalStorage.getStore();
  if (rngContext) {
    rngContext.counter.value = 0;
  }
}

export function createGenerationId(prefix = "gen"): string {
  const randA = Math.floor(random() * Number.MAX_SAFE_INTEGER);
  const randB = Math.floor(random() * Number.MAX_SAFE_INTEGER);
  return `${prefix}_${randA.toString(36)}${randB.toString(36)}`;
}

export async function withSeed<T>(
  seed: number,
  fn: () => Promise<T>
): Promise<T> {
  const rng = rngFromSeed(seed);
  const counter = { value: 0 };
  return asyncLocalStorage.run({ rng, counter }, fn);
}

export async function processBatchWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  processor: (item: T, index: number) => Promise<R>,
  options?: {
    onProgress?: (completed: number, inProgress: number, total: number) => void;
    onError?: (error: Error, item: T, index: number) => void;
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
      .catch((error) => {
        // Handle errors gracefully - log and continue
        console.error(`\n❌ Generation #${i + 1} failed:`, error.message);
        if (options?.onError) {
          options.onError(error, item, i);
        }
        // Store undefined for failed generations
        results[i] = undefined as any;
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
