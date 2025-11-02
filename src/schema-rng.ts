import type { WeightedOneOfOption } from "./schema";
import { isWeightedOption } from "./schema";
import { random } from "./utils";

export function optional<T>(message: T): T | (() => []) {
  return random() < 0.5 ? message : () => [];
}
export function between(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

export function randomSample<T>(n: number, array: T[]): T[] {
  return array.sort(() => random() - 0.5).slice(0, n);
}
export function oneOf<T>(options: Array<WeightedOneOfOption<T>>): T {
  if (options.length === 0) {
    throw new Error("oneOf requires at least one option");
  }

  const normalized = options.map((option) =>
    isWeightedOption(option) ? option : { value: option }
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

  const totalWeight = normalized.reduce(
    (sum, option) => sum + (option.weight ?? 0),
    0
  );

  if (totalWeight <= 0) {
    const fallback = normalized[Math.floor(random() * normalized.length)];
    if (!fallback) {
      throw new Error("oneOf failed to select a fallback option");
    }
    return fallback.value;
  }

  const needle = random() * totalWeight;
  let cumulative = 0;

  for (const option of normalized) {
    cumulative += option.weight ?? 0;

    if (needle <= cumulative) {
      return option.value;
    }
  }

  const lastOption = normalized[normalized.length - 1];
  if (!lastOption) {
    throw new Error("oneOf failed to resolve a selection");
  }

  return lastOption.value;
}
