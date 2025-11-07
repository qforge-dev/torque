import type { LanguageModel, ModelMessage } from "ai";
import type { z } from "zod";
import type { Awaitable } from "./utils";
import type { IAiAgent } from "./ai";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

export type IMessageSchemaNullableItem =
  | IUserMessageSchema
  | IAssistantMessageSchema
  | ISystemMessageSchema
  | IToolFunctionSchema
  | IToolCallSchema
  | IToolCallResultSchema
  | null;

export type IMessageSchemaGroup = Array<IMessageSchema | IMessageSchemaGroup>;

export type IMessageSchemaReturn =
  | IMessageSchemaNullableItem
  | IMessageSchemaGroup;

export type IMessageSchemaStructureMessage =
  | {
      role: "user" | "assistant" | "system";
      type: "text";
      content: string;
      generationId: string;
    }
  | {
      role: "assistant";
      content: string;
      toolCalls: Array<{
        toolCallId: string;
        toolName: string;
        arguments: Record<string, any>;
        generationId: string;
      }>;
      generationId: string;
    }
  | {
      role: "assistant";
      type: "tool-call";
      toolCallId: string;
      toolName: string;
      arguments: Record<string, any>;
      generationId: string;
    }
  | {
      role: "tool";
      type: "tool-result";
      toolCallId: string;
      toolName: string;
      result: any;
      generationId: string;
    };

export type IMessageSchemaStructure = {
  metadata: Record<string, JsonValue>;
  messages: Array<{
    schema: IMessageSchemaNullableItem;
    message: IMessageSchemaStructureMessage;
  }>;
  tools: Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
    output: Record<string, any>;
  }>;
};

export type IMessageSchemaPhase = "check" | "generate";

export type GenerationMessageProvider =
  | {
      messages: ModelMessage[];
    }
  | ((context: IMessageSchemaContext) => Awaitable<{
      messages: ModelMessage[];
    }>);

export type GenerationContext = {
  global?: GenerationMessageProvider;
  user?: GenerationMessageProvider;
  assistant?: GenerationMessageProvider;
  system?: GenerationMessageProvider;
  toolCall?:
    | GenerationMessageProvider
    | ((
        toolName: string,
        context: IMessageSchemaContext
      ) => Awaitable<{
        messages: ModelMessage[];
        // Future: tools?: ToolSet;
      }>);
  toolResult?:
    | GenerationMessageProvider
    | ((
        toolName: string,
        context: IMessageSchemaContext
      ) => Awaitable<{
        messages: ModelMessage[];
        // Future: tools?: ToolSet;
      }>);
};

export type IMessageSchemaContext = {
  acc: IConvertMessageSchemaToDatasetMessageAcc;
  ai: IAiAgent;
  structure: IMessageSchemaStructure;
  phase: IMessageSchemaPhase;
  generationContext?: GenerationContext;
};

export type IMessageSchema = (
  context: IMessageSchemaContext
) => Awaitable<IMessageSchemaReturn>;

export interface IUserMessageSchema {
  role: "user";
  content: string;
  generationId: string;
}

export interface IAssistantMessageSchema {
  role: "assistant";
  content: string;
  toolCalls?: Array<
    (context: IMessageSchemaContext) => Awaitable<IToolCallSchema>
  >;
  generationId: string;
}

export interface ISystemMessageSchema {
  role: "system";
  content: string;
  generationId: string;
}

export interface IToolFunctionSchema<
  T extends z.ZodObject = any,
  R extends z.ZodType = any
> {
  name: string;
  description: string;
  parameters: T;
  output: R;
}

export interface IToolCallSchema<T extends Record<string, any> = {}> {
  role: "assistant";
  toolCallId: string;
  toolName: string;
  arguments: T;
  generationId: string;
}

export interface IToolCallResultSchema<T = any> {
  role: "tool";
  toolCallId: string;
  toolName: string;
  result: T;
  generationId: string;
}

export type IDatasetMessage = ModelMessage & { generationId: string };

export interface IDatasetTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  output: Record<string, any>;
}

export interface IDatasetRow {
  messages: IDatasetMessage[];
  tools: IDatasetTool[];
  meta: {
    seed?: number;
    model?: string;
    output?: string;
    startTimestamp?: string;
    tokenCount?: {
      messages: number;
      tools: number;
      total: number;
    };
    metadata?: JsonValue;
  };
}

export interface IConvertMessageSchemaToDatasetMessageAcc {
  messages: IDatasetMessage[];
  tools: IDatasetTool[];
  metadata: Record<string, JsonValue>;
}

export interface ISchemaWithCount {
  schema: IMessageSchema;
  count: number;
  seed?: number;
}

export type DatasetFormat = "jsonl" | "parquet";

interface IGenerateDatasetBaseArgs {
  seed?: number;
  output?: string;
  format?: DatasetFormat;
  model: LanguageModel;
  concurrency?: number;
  generationContext?: GenerationContext;
  metadata?: JsonValue;
}

// Options for single schema pattern (count is required)
export interface IGenerateDatasetArgsWithCount
  extends IGenerateDatasetBaseArgs {
  count: number;
}

export interface IGenerateDatasetArgsMultiSchema
  extends IGenerateDatasetBaseArgs {}

export interface IGenerateDatasetArgs extends IGenerateDatasetBaseArgs {}
