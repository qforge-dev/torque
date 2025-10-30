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
}: {
  prompt: string;
}): (context: IMessageSchemaContext) => Awaitable<IAssistantMessageSchema> {
  return async (context) => {
    const { phase } = context;

    if (phase === "check") {
      return {
        role: "assistant",
        content: prompt,
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
    };
  };
}

export function generatedToolCall<T extends z.ZodObject>(
  tool: IToolDefinition<T>,
  id: string,
  options?: { reuseArgsFrom?: string }
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
    const args = await generateToolCallArgs(parameters, effectiveId)(context);

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
  result?: z.infer<R>
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

    // If result is explicitly provided, use it
    if (result !== undefined) {
      return {
        role: "tool",
        toolCallId: id,
        toolName,
        result,
      };
    }

    // Otherwise, generate the result using AI
    const generatedResult = await generateToolResult(tool.output, id)(context);

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

export function oneOf<T>(options: T[]): () => T {
  return () => options[Math.floor(random() * options.length)] as T;
}

export function optional<T>(message: T): () => T | null {
  return () => (random() < 0.5 ? message : null);
}

export function times<T>(n: number, message: T): T extends any[] ? T : T[] {
  return Array.from({ length: n }, () => message).flat() as T extends any[]
    ? T
    : T[];
}

export function between(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}
