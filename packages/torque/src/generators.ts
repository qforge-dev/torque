import z from "zod";
import type {
  GenerationContext,
  GenerationMessageProvider,
  IMessageSchemaContext,
} from "./types";
import {
  createGenerationId,
  isEmptyObjectSchema,
  type Awaitable,
} from "./utils";
import type { ToolCallPart, ModelMessage } from "ai";

type GeneratedToolCallArgs<T extends z.ZodObject> = {
  args: z.infer<T>;
  generationId: string;
};

type GeneratedToolResult<T extends z.ZodType> = {
  result: z.infer<T>;
  generationId: string;
};

type MessageRole = "user" | "assistant" | "system";

interface GenerateMessageOptions {
  role: MessageRole;
  prompt: string;
  context: IMessageSchemaContext;
}

function omitGenerationIdReplacer(key: string, value: unknown) {
  if (key === "generationId") {
    return undefined;
  }
  return value;
}

function formatMessagesAndStructure(context: IMessageSchemaContext): string {
  const { structure, acc } = context;
  return JSON.stringify(
    structure.messages.map((m, i) => {
      const messageOrSchema = acc.messages[i] ?? m.schema;
      const isCurrentlyGenerating = i === acc.messages.length;

      return isCurrentlyGenerating
        ? { ...messageOrSchema, CURRENTLY_GENERATING: true }
        : messageOrSchema;
    }),
    omitGenerationIdReplacer,
    2
  );
}

export interface GeneratedMessageResult {
  text: string;
  generationId: string;
}

interface GenerateReasoningOptions {
  prompt: string;
  context: IMessageSchemaContext;
}

export async function generateReasoningFromPrompt({
  prompt,
  context,
}: GenerateReasoningOptions): Promise<GeneratedMessageResult> {
  const { acc, ai, generationContext } = context;
  const generatedLocalId = createGenerationId("reasoning");

  const systemPrompt = `You are a synthetic dataset generator creating realistic reasoning for an assistant message.

## Your Task
Generate realistic reasoning that the assistant uses to think through their response.
This reasoning represents the assistant's internal thought process before crafting their reply.

## Understanding the Conversation Flow
Below you'll see the complete conversation flow. Each item is EITHER:
- An actual generated message (already created) - use this as concrete context
- A schema/structure definition (not yet generated) - use this to understand what's planned next

**IMPORTANT: Generate reasoning for the assistant message that will be generated next.**

Messages and structure:
${formatMessagesAndStructure(context)}

Available tools:
${JSON.stringify(acc.tools, null, 2)}
`;

  const userPrompt = `Generate reasoning for the assistant's upcoming response based on this prompt:

${prompt}

Important: 
- Maintain continuity with previous messages and align with the planned conversation flow
- Generate thoughtful, realistic reasoning that demonstrates the assistant's thinking process
- Only generate the reasoning content, do not include any meta-commentary or explanation
- Generate in first person, as it is your inner thoughts and you are the assistant thinking about the response`;

  const contextMessages = await resolveGenerationContextMessages(
    generationContext,
    "assistant",
    context
  );

  const result = await ai.generateText([
    { role: "system", content: systemPrompt },
    ...contextMessages,
    { role: "user", content: userPrompt },
  ]);

  return {
    text: result.text,
    generationId: result.response?.id ?? generatedLocalId,
  };
}

export async function generateMessageFromPrompt({
  role,
  prompt,
  context,
}: GenerateMessageOptions): Promise<GeneratedMessageResult> {
  const { acc, ai, generationContext } = context;
  const generatedLocalId = createGenerationId("msg");

  const roleSpecificInstructions = {
    user: `You are generating a user message - not an assistant or system message.`,
    assistant: `You are generating an assistant message - not a user or system message.`,
    system: `You are generating a system message - not a user or assistant message.`,
  };

  const systemPrompt = `You are a synthetic dataset generator creating realistic conversation data.

## Your Task
Generate a new ${role} message to continue the conversation naturally and contextually.
${roleSpecificInstructions[role]}

## Understanding the Conversation Flow
Below you'll see the complete conversation flow. Each item is EITHER:
- An actual generated message (already created) - use this as concrete context
- A schema/structure definition (not yet generated) - use this to understand what's planned next

**IMPORTANT: The message with "CURRENTLY_GENERATING: true" is what YOU need to generate now.**

Generate it based on:
1. All previous actual messages (for context and continuity)
2. The schema/prompt of the current message (for guidance on content)
3. Future structure definitions (to ensure the conversation flows naturally toward those goals)

Messages and structure:
${formatMessagesAndStructure(context)}

Available tools:
${JSON.stringify(acc.tools, null, 2)}
`;

  const userPrompt = `Generate the ${role} message marked with "CURRENTLY_GENERATING: true" based on this prompt:

${prompt}

Important: 
- Maintain continuity with previous messages and align with the planned conversation flow
- Only generate the message content, do not include any meta-commentary or explanation`;

  const contextMessages = await resolveGenerationContextMessages(
    generationContext,
    role,
    context
  );

  const result = await ai.generateText([
    { role: "system", content: systemPrompt },
    ...contextMessages,
    { role: "user", content: userPrompt },
  ]);

  return {
    text: result.text,
    generationId: result.response?.id ?? generatedLocalId,
  };
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
): (context: IMessageSchemaContext) => Awaitable<GeneratedToolCallArgs<T>> {
  return async (context: IMessageSchemaContext) => {
    const { ai, acc, generationContext } = context;
    const generatedLocalId = createGenerationId("tool-call");

    const existing = findExistingToolCallArgs<T>(acc.messages, id);
    if (existing) {
      return existing;
    }

    if (isEmptyObjectSchema(schema)) {
      return {
        args: schema.parse({}) as z.infer<T>,
        generationId: generatedLocalId,
      };
    }

    const contextMessages: Array<ModelMessage> = [];

    if (generationContext?.global) {
      const globalMessages = await resolveMessageProvider(
        generationContext.global,
        context
      );
      contextMessages.push(...globalMessages);
    }

    if (generationContext?.toolCall) {
      const toolCallMessages = await resolveMessageProvider(
        generationContext.toolCall as GenerationMessageProvider,
        context
      );
      contextMessages.push(...toolCallMessages);
    }

    const result = await ai.generateObject(schema, [
      {
        role: "system",
        content:
          `You are a tool call arguments generator creating realistic conversation data.

## Your Task
Generate realistic, contextually appropriate arguments that match the tool's parameter schema in JSON format.
Make sure the parameters match the user's latest request and fit naturally within the conversation flow.

## Understanding the Conversation Flow
Below you'll see the complete conversation flow. Each item is EITHER:
- An actual generated message (already created) - use this as concrete context
- A schema/structure definition (not yet generated) - use this to understand what's planned next

**IMPORTANT: The message with "CURRENTLY_GENERATING: true" is what YOU need to generate arguments for.**

Messages and structure:
${formatMessagesAndStructure(context)}

${prompt ?? ""}
        `.trim(),
      },
      ...contextMessages,
      {
        role: "user",
        content: `
        ## Generate tool call arguments for the message marked with "CURRENTLY_GENERATING: true"
        
        Keep the conversation context in mind - your arguments should flow naturally from what was said before and support what comes after.
        
        Return a JSON object that matches the following schema:
        ${JSON.stringify(z.toJSONSchema(schema), null, 2)}
        `,
      },
    ]);

    return {
      args: result.object,
      generationId: result.response?.id ?? generatedLocalId,
    };
  };
}

export function generateToolResult<T extends z.ZodType>(
  schema: T,
  id: string,
  prompt?: string
): (context: IMessageSchemaContext) => Awaitable<GeneratedToolResult<T>> {
  return async (
    context: IMessageSchemaContext
  ): Promise<GeneratedToolResult<T>> => {
    const { ai, acc, generationContext } = context;
    const generatedLocalId = createGenerationId("tool-result");
    const existingCallArgs = findExistingToolCallArgs(acc.messages, id);

    if (!existingCallArgs) {
      throw new Error(`Tool call arguments with id "${id}" not found`);
    }
    const { args: resolvedArgs, generationId: existingGenerationId } =
      existingCallArgs;

    if (isEmptyObjectSchema(schema)) {
      return {
        result: schema.parse({}) as z.infer<T>,
        generationId: existingGenerationId ?? generatedLocalId,
      };
    }

    const contextMessages: Array<ModelMessage> = [];

    if (generationContext?.global) {
      const globalMessages = await resolveMessageProvider(
        generationContext.global,
        context
      );
      contextMessages.push(...globalMessages);
    }

    if (generationContext?.toolResult) {
      const toolResultMessages = await resolveMessageProvider(
        generationContext.toolResult as GenerationMessageProvider,
        context
      );
      contextMessages.push(...toolResultMessages);
    }

    const result = await ai.generateObject(schema, [
      {
        role: "system",
        content:
          `You are a tool result generator creating realistic conversation data.

## Your Task
Generate a realistic result for the tool call that matches the result schema in JSON format.

## Important Note on Truth
Generated responses do not need to be real or accurate. They can be made up. Act as if you know the truth even if you don't.
The goal is to create realistic-looking data that fits the conversation flow.

## Understanding the Conversation Flow
Below you'll see the complete conversation flow. Each item is EITHER:
- An actual generated message (already created) - use this as concrete context
- A schema/structure definition (not yet generated) - use this to understand what's planned next

**IMPORTANT: The message with "CURRENTLY_GENERATING: true" is what YOU need to generate a result for.**

Messages and structure:
${formatMessagesAndStructure(context)}

## Tool Call Arguments
${JSON.stringify(resolvedArgs, null, 2)}

${prompt ?? ""}
        `.trim(),
      },
      ...contextMessages,
      {
        role: "user",
        content: `
        ## Generate tool result for the message marked with "CURRENTLY_GENERATING: true"
        
        Keep the conversation context in mind - your result should be consistent with the tool call arguments and enable the conversation to progress naturally toward planned future messages.
        
        Return a JSON object that matches the following schema:
        ${JSON.stringify(z.toJSONSchema(schema), null, 2)}
        `,
      },
    ]);

    const generatedResult = result.object as any;
    const generationId = result.response?.id ?? generatedLocalId;

    if ("result" in generatedResult) {
      return {
        result: generatedResult.result,
        generationId,
      };
    }
    return {
      result: generatedResult,
      generationId,
    };
  };
}

function findExistingToolCallArgs<T extends z.ZodObject>(
  messages: IMessageSchemaContext["acc"]["messages"],
  toolCallId: string
): GeneratedToolCallArgs<T> | null {
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
      const directGenerationId =
        typeof (toolCall as any).generationId === "string"
          ? (toolCall as any).generationId
          : undefined;
      const messageGenerationId =
        typeof (assistantMessage as any).generationId === "string"
          ? ((assistantMessage as any).generationId as string)
          : undefined;

      return {
        args: toolCall.input as z.infer<T>,
        generationId: directGenerationId ?? messageGenerationId ?? "DUPA",
      };
    }
  }

  return null;
}
