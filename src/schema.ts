import z from "zod";
import type {
  IAssistantMessageSchema,
  IMessageSchemaContext,
  ISystemMessageSchema,
  IToolCallResultSchema,
  IToolCallSchema,
  IToolFunctionSchema,
  IUserMessageSchema,
} from "./types";
import { type Awaitable, random } from "./utils";
import {
  generateMessageFromPrompt,
  generateToolCallArgs,
  generateToolResult,
} from "./generators";

export function system({
  content,
}: {
  content: string;
}): (context: IMessageSchemaContext) => Awaitable<ISystemMessageSchema> {
  return (_context) => {
    return {
      role: "system",
      content,
    };
  };
}

export function user({
  content,
}: {
  content: string;
}): (context: IMessageSchemaContext) => Awaitable<IUserMessageSchema> {
  return async (_context) => {
    return {
      role: "user",
      content,
    };
  };
}

export function generatedUser({
  prompt,
}: {
  prompt: string;
}): (context: IMessageSchemaContext) => Awaitable<IUserMessageSchema> {
  return async (context) => {
    const { phase } = context;

    if (phase === "check") {
      return {
        role: "user",
        content: prompt,
      };
    }

    const text = await generateMessageFromPrompt({
      role: "user",
      prompt,
      context,
    });

    return {
      role: "user",
      content: text,
    };
  };
}

export function assistant({
  content,
}: {
  content: string;
}): (context: IMessageSchemaContext) => Awaitable<IAssistantMessageSchema> {
  return (_context) => ({
    role: "assistant",
    content,
  });
}

export function generatedAssistant({
  prompt,
  toolCalls,
}: {
  prompt: string;
  toolCalls?: Array<
    (context: IMessageSchemaContext) => Awaitable<IToolCallSchema>
  >;
}): (context: IMessageSchemaContext) => Awaitable<IAssistantMessageSchema> {
  return async (context) => {
    const { phase } = context;

    if (phase === "check") {
      return {
        role: "assistant",
        content: prompt,
        toolCalls,
      };
    }

    const text = await generateMessageFromPrompt({
      role: "assistant",
      prompt,
      context,
    });

    return {
      role: "assistant",
      content: text,
      toolCalls,
    };
  };
}

export function generatedToolCall<T extends z.ZodObject>(
  tool: IToolDefinition<T>,
  id: string,
  options?: { reuseArgsFrom?: string; prompt?: string }
): (context: IMessageSchemaContext) => Awaitable<IToolCallSchema<z.infer<T>>> {
  return async (context) => {
    const { phase } = context;

    if (phase === "check") {
      return {
        role: "assistant",
        toolCallId: id,
        toolName: tool.toolFunction()(context).name,
        arguments: "{}" as z.infer<T>,
      };
    }

    const effectiveId = options?.reuseArgsFrom ?? id;
    const parameters = tool.toolFunction()(context).parameters;
    const args = await generateToolCallArgs(
      parameters,
      effectiveId,
      options?.prompt
    )(context);

    return {
      role: "assistant",
      toolCallId: id,
      toolName: tool.toolFunction()(context).name,
      arguments: args,
    };
  };
}

export function generatedToolCallResult<
  T extends z.ZodObject = z.ZodObject,
  R extends z.ZodType = any
>(
  tool: IToolDefinition<T, R>,
  id: string,
  options?: {
    prompt?: string;
  }
): (
  context: IMessageSchemaContext
) => Awaitable<IToolCallResultSchema<z.infer<R>>> {
  return async (context) => {
    const { phase } = context;

    const toolName = tool.toolFunction()(context).name;

    if (phase === "check") {
      return {
        role: "tool",
        toolCallId: id,
        toolName,
        result: "" as z.infer<R>,
      };
    }

    const generatedResult = await generateToolResult(
      tool.output,
      id,
      options?.prompt
    )(context);

    return {
      role: "tool",
      toolCallId: id,
      toolName,
      result: generatedResult,
    };
  };
}

export interface IToolDefinition<
  T extends z.ZodObject = z.ZodObject,
  R extends z.ZodType = any
> {
  toolFunction: () => (
    context: IMessageSchemaContext
  ) => IToolFunctionSchema<T>;
  toolCall: (
    id: string,
    args:
      | z.infer<T>
      | ((
          schema: T,
          id: string
        ) => (context: IMessageSchemaContext) => Awaitable<z.infer<T>>)
  ) => (
    context: IMessageSchemaContext
  ) => Awaitable<IToolCallSchema<z.infer<T>>>;
  toolCallResult: (
    id: string,
    result:
      | z.infer<R>
      | ((
          schema: R,
          id: string
        ) => (context: IMessageSchemaContext) => Awaitable<z.infer<R>>)
  ) => (
    context: IMessageSchemaContext
  ) => Awaitable<IToolCallResultSchema<z.infer<R>>>;
  output: R;
}

export function tool<T extends z.ZodObject, R extends z.ZodType = any>({
  name,
  description,
  parameters,
  output,
}: {
  name: string;
  description: string;
  parameters: T;
  output: R;
}): IToolDefinition<T, R> {
  return {
    toolFunction: () => (_ctx) => ({
      name,
      description,
      parameters,
    }),
    toolCall: (id, args) => async (ctx) => {
      if (ctx.phase === "check") {
        return {
          role: "assistant",
          toolCallId: id,
          toolName: name,
          arguments: "{}" as z.infer<T>,
        };
      }

      return {
        role: "assistant",
        toolCallId: id,
        toolName: name,
        arguments:
          typeof args === "function" ? await args(parameters, id)(ctx) : args,
      };
    },
    toolCallResult: (id, result) => async (ctx) => {
      if (ctx.phase === "check") {
        return {
          role: "tool",
          toolCallId: id,
          toolName: name,
          result: "" as z.infer<R>,
        };
      }

      const resultValue =
        typeof result === "function"
          ? await (
              result as (
                schema: R,
                id: string
              ) => (context: IMessageSchemaContext) => Awaitable<z.infer<R>>
            )(
              output,
              id
            )(ctx)
          : result;

      return {
        role: "tool",
        toolCallId: id,
        toolName: name,
        result: resultValue,
      };
    },
    output,
  };
}

type WeightedOneOfOption<T> =
  | T
  | {
      value: T;
      weight?: number;
    };

function isWeightedOption<T>(
  option: WeightedOneOfOption<T>
): option is { value: T; weight?: number } {
  return typeof option === "object" && option !== null && "value" in option;
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

export function optional<T>(message: T): T | (() => []) {
  return random() < 0.5 ? message : () => [];
}

export function times<T>(n: number, message: T): T extends any[] ? T : T[] {
  return Array.from({ length: n }, () => message).flat() as T extends any[]
    ? T
    : T[];
}

export function between(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

export function randomSample<T>(n: number, array: T[]): T[] {
  return array.sort(() => random() - 0.5).slice(0, n);
}
