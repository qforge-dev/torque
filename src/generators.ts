import z from "zod";
import type { ZodTypeAny } from "zod";
import type {
  GenerationContext,
  GenerationMessageProvider,
  IMessageSchemaContext,
} from "./types";
import type { Awaitable } from "./utils";
import type { ToolCallPart, ModelMessage } from "ai";

type MessageRole = "user" | "assistant" | "system";

interface GenerateMessageOptions {
  role: MessageRole;
  prompt: string;
  context: IMessageSchemaContext;
}

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

function isEmptyObjectSchema(schema: ZodTypeAny): boolean {
  const base = resolveBaseSchema(schema);

  if (!(base instanceof z.ZodObject)) {
    return false;
  }

  return Object.keys(base.shape).length === 0;
}

export async function generateMessageFromPrompt({
  role,
  prompt,
  context,
}: GenerateMessageOptions): Promise<string> {
  const { structure, acc, ai, generationContext } = context;

  const roleSpecificInstructions = {
    user: `You are generating a user message - not an assistant or system message.`,
    assistant: `You are generating an assistant message. The assistant should be helpful, accurate, and appropriately use tools when needed. The assistant messages should be 2-5 sentences long.`,
    system: `You are generating a system message. System messages provide instructions, context, or guidelines for the conversation.`,
  };

  const systemPrompt = `You are a synthetic dataset generator. You are given a set of tools, previous messages and the structure of the whole conversation.
Take into account the structure of the conversation when generating the next message. The message you are currently generating is marked as "currentlyGenerating: true" in the structure.
Your task is to generate a new ${role} message to continue the conversation based on the prompt for the next message.
${roleSpecificInstructions[role]}

Previous messages:
${JSON.stringify(acc.messages, null, 2)}

Available tools:
${JSON.stringify(acc.tools, null, 2)}

Conversation structure:
${JSON.stringify(
  structure.messages.map((m, i) => ({
    ...m,
    currentlyGenerating: i === acc.messages.length,
  })),
  null,
  2
)}
`;

  const userPrompt = `Generate the next ${role} message based on this prompt:

${prompt}

Important: Only generate the message content, do not include any meta-commentary or explanation.`;

  const contextMessages = await resolveGenerationContextMessages(
    generationContext,
    role,
    context
  );

  const { text } = await ai.generateText([
    { role: "system", content: systemPrompt },
    ...contextMessages,
    { role: "user", content: userPrompt },
  ]);

  return text;
}

async function resolveGenerationContextMessages(
  generationContext: GenerationContext | undefined,
  role: MessageRole,
  context: IMessageSchemaContext
): Promise<Array<ModelMessage>> {
  if (!generationContext) {
    return [];
  }

  const messages: Array<ModelMessage> = [];

  // Resolve global messages
  if (generationContext.global) {
    const resolved = await resolveMessageProvider(
      generationContext.global,
      context
    );
    messages.push(...resolved);
  }

  // Resolve role-specific messages
  const roleProvider = generationContext[role];
  if (roleProvider) {
    const resolved = await resolveMessageProvider(roleProvider, context);
    messages.push(...resolved);
  }

  return messages;
}

async function resolveMessageProvider(
  provider: GenerationMessageProvider,
  context: IMessageSchemaContext
): Promise<Array<ModelMessage>> {
  if (typeof provider === "function") {
    // It's a function - call it and await the result
    const result = await provider(context);
    return result.messages;
  }

  // It's a static object with messages
  return provider.messages;
}

export function generateToolCallArgs<T extends z.ZodObject>(
  schema: T,
  id: string,
  prompt?: string
): (context: IMessageSchemaContext) => Awaitable<z.infer<T>> {
  return async (context: IMessageSchemaContext) => {
    const { ai, acc, generationContext } = context;

    const existingArgs = findExistingToolCallArgs<T>(acc.messages, id);
    if (existingArgs) {
      return existingArgs;
    }

    if (isEmptyObjectSchema(schema)) {
      return schema.parse({});
    }

    const result = await ai.generateObject(schema, [
      {
        role: "system",
        content:
          `You are a tool call arguments generator. You are given a schema and a prompt. You need to generate the arguments for the tool call.
          Generate realistic, contextually appropriate arguments (based on the conversation history) that match the tool's parameter schema in JSON format.
          Make sure the parameters match the user's latest request.
          
        ## Message History
        ${context.acc.messages
          .map((m) => `- ${m.role}: ${JSON.stringify(m.content, null, 2)}`)
          .join("\n")}

        ${prompt ?? ""}
        `.trim(),
      },
      ...contextMessages,
      {
        role: "user",
        content: `
        ## Return a message in JSON format that matches the following schema:
        ${JSON.stringify(z.toJSONSchema(schema), null, 2)}
        `,
      },
    ]);

    return result.object;
  };
}

export function generateToolResult<T extends z.ZodType>(
  schema: T,
  id: string,
  prompt?: string
): (context: IMessageSchemaContext) => Awaitable<z.infer<T>> {
  return async (context: IMessageSchemaContext): Promise<z.infer<T>> => {
    const { ai, acc, generationContext } = context;

    const existingCallArgs = findExistingToolCallArgs(acc.messages, id);

    if (!existingCallArgs) {
      throw new Error(`Tool call arguments with id "${id}" not found`);
    }

    if (isEmptyObjectSchema(schema)) {
      return schema.parse({}) as z.infer<T>;
    }

    const result = await ai.generateObject(schema, [
      {
        role: "system",
        content:
          `You are a tool result generator. You are given a schema and a tool call. You need to generate the result for the tool call.
          
        ## Message History
        ${context.acc.messages
          .map((m) => `- ${m.role}: ${JSON.stringify(m.content, null, 2)}`)
          .join("\n")}
          
        ## Tool Call
        Arguments: ${JSON.stringify(existingCallArgs, null, 2)}

        ${prompt ?? ""}
        `.trim(),
      },
      ...contextMessages,
      {
        role: "user",
        content: `
        ## Return a message in JSON format that matches the following schema:
        ${JSON.stringify(z.toJSONSchema(schema), null, 2)}
        `,
      },
    ]);

    if ("result" in (result.object as any)) {
      return (result.object as any).result;
    }
    return result.object;
  };
}

function findExistingToolCallArgs<T extends z.ZodObject>(
  messages: IMessageSchemaContext["acc"]["messages"],
  toolCallId: string
): z.infer<T> | null {
  const normalizedToolCallId = toolCallId.replace("-FINAL", "");

  const assistantMessage = messages.find(
    (m) =>
      m.role === "assistant" &&
      Array.isArray(m.content) &&
      m.content.some(
        (c) => c.type === "tool-call" && c.toolCallId === normalizedToolCallId
      )
  );

  if (assistantMessage && Array.isArray(assistantMessage.content)) {
    const toolCall = assistantMessage.content.find(
      (c) => c.type === "tool-call" && c.toolCallId === normalizedToolCallId
    ) as ToolCallPart | undefined;

    if (toolCall) {
      return toolCall.input as z.infer<T>;
    }
  }

  return null;
}
