import type { WeightedOneOfOption } from "./schema";
import { isWeightedOption } from "./schema";
import { getCurrentMessageContext } from "./message-context";
import { hasValueBeenUsed, markValueAsUsed } from "./unique-selection";
import { random } from "./utils";

export interface OneOfUniqueBy {
  collection: string;
}

export interface OneOfOptions<T> {
  uniqueBy?: OneOfUniqueBy;
}

type NormalizedWeightedOption<T> = {
  value: T;
  weight?: number;
  id?: string | number | boolean;
  uniqueKey?: string;
};

type ResolvedUniqueBy = {
  collection: string;
};

export type OneOfOptionWithId<T> = {
  value: T;
  id: string | number | boolean;
  weight?: number;
};

export function optional<T>(message: T): T | (() => []) {
  return random() < 0.5 ? message : () => [];
}
export function between(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

export function randomSample<T>(n: number, array: T[]): T[] {
  if (n >= array.length) {
    return [...array];
  }

  if (n <= 0) {
    return [];
  }

  const copy = [...array];
  const result: T[] = [];

  // Partial Fisher-Yates shuffle - only shuffle the first n elements
  for (let i = 0; i < n; i++) {
    const randomIndex = i + Math.floor(random() * (copy.length - i));
    result.push(copy[randomIndex]!);
    // Swap to avoid picking the same element again
    [copy[randomIndex], copy[i]] = [copy[i]!, copy[randomIndex]!];
  }

  return result;
}

export function oneOf<T>(
  options: Array<OneOfOptionWithId<T>>,
  config: { uniqueBy: OneOfUniqueBy }
): T;
export function oneOf<T>(
  options: Array<WeightedOneOfOption<T>>,
  config?: { uniqueBy?: never }
): T;
export function oneOf<T>(
  options: Array<WeightedOneOfOption<T>>,
  config?: OneOfOptions<T>
): T {
  if (options.length === 0) {
    throw new Error("oneOf requires at least one option");
  }

  const uniqueBy = resolveUniqueBy(config?.uniqueBy);
  const enforceUnique = Boolean(uniqueBy);

  const normalized = options.map((option) =>
    isWeightedOption(option) ? { ...option } : { value: option }
  );

  let providedWeightTotal = 0;
  const missingWeightIndices: number[] = [];

  normalized.forEach((option, index) => {
    if (option.weight === undefined) {
      missingWeightIndices.push(index);
      return;
    }

    if (Number.isNaN(option.weight) || option.weight < 0 || option.weight > 1) {
      throw new Error("oneOf weight values must be between 0 and 1");
    }

    providedWeightTotal += option.weight;
  });

  if (providedWeightTotal > 1) {
    throw new Error("oneOf weight values must sum to 1 or less");
  }

  if (missingWeightIndices.length > 0) {
    const remainingWeight = 1 - providedWeightTotal;

    if (remainingWeight <= 0) {
      missingWeightIndices.forEach((index) => {
        const target = normalized[index];
        if (target) {
          target.weight = 0;
        }
      });
    } else {
      const distributedWeight = remainingWeight / missingWeightIndices.length;
      missingWeightIndices.forEach((index) => {
        const target = normalized[index];
        if (target) {
          target.weight = distributedWeight;
        }
      });
    }
  }

  const candidateBase = normalized.map<NormalizedWeightedOption<T>>(
    (option) => ({
      value: option.value,
      weight: option.weight,
      id: option.id,
    })
  );

  let candidateOptions = candidateBase;

  if (enforceUnique && uniqueBy) {
    candidateOptions = candidateBase
      .map((option) => ({
        ...option,
        uniqueKey: buildUniqueKey(option.id),
      }))
      .filter(
        (option) => !hasValueBeenUsed(uniqueBy.collection, option.uniqueKey!)
      );

    if (candidateOptions.length === 0) {
      throw new Error(
        `oneOf uniqueBy collection "${uniqueBy.collection}" is exhausted`
      );
    }
  }

  const totalWeight = candidateOptions.reduce(
    (sum, option) => sum + (option.weight ?? 0),
    0
  );

  if (totalWeight <= 0) {
    const fallback =
      candidateOptions[Math.floor(random() * candidateOptions.length)];
    if (!fallback) {
      throw new Error("oneOf failed to select a fallback option");
    }
    recordUniqueSelection(fallback, uniqueBy, enforceUnique);
    return fallback.value;
  }

  const needle = random() * totalWeight;
  let cumulative = 0;

  for (const option of candidateOptions) {
    cumulative += option.weight ?? 0;

    if (needle <= cumulative) {
      recordUniqueSelection(option, uniqueBy, enforceUnique);
      return option.value;
    }
  }

  const lastOption = candidateOptions[candidateOptions.length - 1];
  if (!lastOption) {
    throw new Error("oneOf failed to resolve a selection");
  }

  recordUniqueSelection(lastOption, uniqueBy, enforceUnique);
  return lastOption.value;
}

function recordUniqueSelection<T>(
  option: NormalizedWeightedOption<T>,
  uniqueBy: ResolvedUniqueBy | undefined,
  enforceUnique: boolean
): void {
  if (!enforceUnique || !uniqueBy || !option.uniqueKey) {
    return;
  }

  const phase = getCurrentMessageContext()?.phase ?? "generate";
  if (phase !== "generate") {
    return;
  }

  markValueAsUsed(uniqueBy.collection, option.uniqueKey);
}

function buildUniqueKey(id: unknown): string {
  if (
    id === undefined ||
    id === null ||
    (typeof id !== "string" &&
      typeof id !== "number" &&
      typeof id !== "boolean")
  ) {
    throw new Error(
      `oneOf uniqueBy requires options to be objects with a valid "id" property (string, number, or boolean)`
    );
  }

  const prefix = typeof id;
  return `${prefix}:${String(id)}`;
}

function resolveUniqueBy(
  uniqueBy?: OneOfUniqueBy
): ResolvedUniqueBy | undefined {
  if (!uniqueBy) {
    return undefined;
  }

  if (typeof uniqueBy.collection !== "string") {
    throw new Error("oneOf uniqueBy.collection must be a non-empty string");
  }

  const collection = uniqueBy.collection.trim();
  if (!collection) {
    throw new Error("oneOf uniqueBy.collection must be a non-empty string");
  }

  return {
    collection,
  };
}
