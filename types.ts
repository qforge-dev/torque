import type { ModelMessage } from "ai";
import type { z } from "zod";
import type { Awaitable } from "./utils";
import type { IAiAgent } from "./ai";

export type IMessageSchemaNullableItem =
  | IUserMessageSchema
  | IAssistantMessageSchema
  | ISystemMessageSchema
  | IToolFunctionSchema
  | IToolCallSchema
  | IToolCallResultSchema
  | null;

export type IMessageSchemaStructure = {
  messages: Array<
    | {
        role: "user" | "assistant" | "system";
        type: "text";
        content: string;
      }
    | {
        role: "assistant";
        type: "tool-call";
        toolCallId: string;
        toolName: string;
        arguments: Record<string, any>;
      }
    | {
        role: "tool";
        type: "tool-result";
        toolCallId: string;
        toolName: string;
        result: any;
      }
  >;
  tools: Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
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
) => Awaitable<IMessageSchemaNullableItem | Array<IMessageSchema>>;

export interface IUserMessageSchema {
  role: "user";
  content: string;
}

export interface IAssistantMessageSchema {
  role: "assistant";
  content: string;
}

export interface ISystemMessageSchema {
  role: "system";
  content: string;
}

export interface IToolFunctionSchema<T extends z.ZodObject = any> {
  name: string;
  description: string;
  parameters: T;
}

export interface IToolCallSchema<T extends Record<string, any> = {}> {
  role: "assistant";
  toolCallId: string;
  toolName: string;
  arguments: T;
}

export interface IToolCallResultSchema<T = any> {
  role: "tool";
  toolCallId: string;
  toolName: string;
  result: T;
}

export type IDatasetMessage = ModelMessage;

export interface IDatasetTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface IDatasetRow {
  messages: IDatasetMessage[];
  tools: IDatasetTool[];
  meta: {
    seed?: number;
    output?: string;
    tokenCount?: {
      messages: number;
      tools: number;
      total: number;
    };
  };
}

export interface IConvertMessageSchemaToDatasetMessageAcc {
  messages: IDatasetMessage[];
  tools: IDatasetTool[];
}
