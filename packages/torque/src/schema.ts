import z from "zod";
import type {
  IAssistantMessageSchema,
  IMessageSchema,
  IMessageSchemaContext,
  IMessageSchemaGroup,
  JsonValue,
  ISystemMessageSchema,
  IToolCallResultSchema,
  IToolCallSchema,
  IToolFunctionSchema,
  IUserMessageSchema,
  IReasoningSchema,
} from "./types";
import { createGenerationId, type Awaitable } from "./utils";
import {
  generateMessageFromPrompt,
  generateToolCallArgs,
  generateToolResult,
  generateReasoningFromPrompt,
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
      generationId: createGenerationId("system"),
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
      generationId: createGenerationId("user"),
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
      const generatedLocalId = createGenerationId("user-check");
      return {
        role: "user",
        content: prompt,
        generationId: generatedLocalId,
      };
    }

    const { text, generationId } = await generateMessageFromPrompt({
      role: "user",
      prompt,
      context,
    });

    return {
      role: "user",
      content: text,
      generationId,
    };
  };
}

export function reasoning({
  content,
}: {
  content: string;
}): (context: IMessageSchemaContext) => Awaitable<IReasoningSchema> {
  return (_context) => ({
    text: content,
    generationId: createGenerationId("reasoning"),
  });
}

export function generatedReasoning({
  prompt,
}: {
  prompt: string;
}): (context: IMessageSchemaContext) => Awaitable<IReasoningSchema> {
  return async (context) => {
    const { phase } = context;

    if (phase === "check") {
      const generatedLocalId = createGenerationId("reasoning-check");
      return {
        text: prompt,
        generationId: generatedLocalId,
      };
    }

    const { text, generationId } = await generateReasoningFromPrompt({
      prompt,
      context,
    });

    return {
      text,
      generationId,
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
    generationId: createGenerationId("assistant"),
  });
}

export function generatedAssistant({
  prompt,
  toolCalls,
  reasoning,
}: {
  prompt: string;
  toolCalls?: Array<
    (context: IMessageSchemaContext) => Awaitable<IToolCallSchema>
  >;
  reasoning?: (context: IMessageSchemaContext) => Awaitable<IReasoningSchema>;
}): (context: IMessageSchemaContext) => Awaitable<IAssistantMessageSchema> {
  return async (context) => {
    const { phase } = context;

    let resolvedReasoning: IReasoningSchema | undefined;
    if (reasoning) {
      resolvedReasoning = await reasoning(context);
    }

    if (phase === "check") {
      return {
        role: "assistant",
        content: prompt,
        toolCalls,
        reasoning: resolvedReasoning,
        generationId: createGenerationId("assistant-check"),
      };
    }

    const { text, generationId } = await generateMessageFromPrompt({
      role: "assistant",
      prompt,
      context,
    });

    return {
      role: "assistant",
      content: text,
      toolCalls,
      reasoning: resolvedReasoning,
      generationId,
    };
  };
}

export function generatedToolCall<T extends z.ZodObject>(
  tool: IToolDefinition<T> | IToolDefinition,
  id: string,
  options?: { reuseArgsFrom?: string; prompt?: string }
): (
  context: IMessageSchemaContext
) => Awaitable<IToolCallSchema<z.infer<T> | z.infer<typeof tool.parameters>>> {
  return async (context) => {
    const { phase } = context;
    const toolInstance = tool.toolFunction()(context);

    if (phase === "check") {
      const generationId = createGenerationId("tool-call-check");
      return {
        role: "assistant",
        toolCallId: id,
        toolName: toolInstance.name,
        arguments: "{}" as z.infer<T>,
        generationId,
      };
    }

    const effectiveId = options?.reuseArgsFrom ?? id;
    const parameters = toolInstance.parameters;
    const { args, generationId } = await generateToolCallArgs(
      parameters,
      effectiveId,
      options?.prompt
    )(context);

    return {
      role: "assistant",
      toolCallId: id,
      toolName: toolInstance.name,
      arguments: args,
      generationId,
    };
  };
}

export function generatedToolCallResult<
  T extends z.ZodObject = z.ZodObject,
  R extends z.ZodType = any
>(
  tool: IToolDefinition<T, R> | IToolDefinition,
  id: string,
  options?: {
    prompt?: string;
  }
): (
  context: IMessageSchemaContext
) => Awaitable<IToolCallResultSchema<z.infer<R>>> {
  return async (context) => {
    const { phase } = context;

    const toolInstance = tool.toolFunction()(context);
    const toolName = toolInstance.name;

    if (phase === "check") {
      const generationId = createGenerationId("tool-result-check");
      return {
        role: "tool",
        toolCallId: id,
        toolName,
        result: "" as z.infer<R>,
        generationId,
      };
    }

    const { result: generatedResult, generationId } = await generateToolResult(
      tool.output,
      id,
      options?.prompt
    )(context);

    return {
      role: "tool",
      toolCallId: id,
      toolName,
      result: generatedResult,
      generationId,
    };
  };
}

export interface IToolDefinition<
  T extends z.ZodObject = z.ZodObject,
  R extends z.ZodType = any
> {
  name: string;
  description: string;
  parameters: T;
  toolFunction: () => (
    context: IMessageSchemaContext
  ) => IToolFunctionSchema<T, R>;
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
    name,
    description,
    parameters,
    toolFunction: () => (_ctx) => ({
      name,
      description,
      parameters,
      output,
    }),
    toolCall: (id, args) => async (ctx) => {
      if (ctx.phase === "check") {
        return {
          role: "assistant",
          toolCallId: id,
          toolName: name,
          arguments: "{}" as z.infer<T>,
          generationId: createGenerationId("tool-call-check"),
        };
      }

      const generationId = createGenerationId("tool-call");
      return {
        role: "assistant",
        toolCallId: id,
        toolName: name,
        arguments:
          typeof args === "function" ? await args(parameters, id)(ctx) : args,
        generationId,
      };
    },
    toolCallResult: (id, result) => async (ctx) => {
      if (ctx.phase === "check") {
        return {
          role: "tool",
          toolCallId: id,
          toolName: name,
          result: "" as z.infer<R>,
          generationId: createGenerationId("tool-result-check"),
        };
      }

      const generationId = createGenerationId("tool-result");
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
        generationId,
      };
    },
    output,
  };
}

type MetadataArgument =
  | Record<string, JsonValue>
  | ((meta: Record<string, JsonValue>) => Record<string, JsonValue> | void);

function assertMetadataObject(
  value: Record<string, JsonValue> | void,
  fallback: Record<string, JsonValue>
): Record<string, JsonValue> {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, JsonValue>;
  }

  throw new Error(
    "metadata updater must return an object or mutate the provided metadata object"
  );
}

export function metadata(
  values: MetadataArgument
): (context: IMessageSchemaContext) => Awaitable<null> {
  return (context) => {
    if (context.phase !== "check") {
      return null;
    }

    const current =
      context.structure?.metadata && !Array.isArray(context.structure.metadata)
        ? context.structure.metadata
        : {};

    let updated: Record<string, JsonValue>;

    if (typeof values === "function") {
      const draft = { ...current };
      const result = values(draft);
      updated = assertMetadataObject(result, draft);
    } else {
      updated = { ...current, ...values };
    }

    context.structure.metadata = updated;
    context.acc.metadata = updated;

    return null;
  };
}

export type WeightedOneOfOption<T> =
  | T
  | {
      value: T;
      weight?: number;
    };

export function isWeightedOption<T>(
  option: WeightedOneOfOption<T>
): option is { value: T; weight?: number } {
  return typeof option === "object" && option !== null && "value" in option;
}

export function times(
  n: number,
  message: IMessageSchema | IMessageSchemaGroup
): IMessageSchema {
  return async () => Array.from({ length: n }, () => message);
}
