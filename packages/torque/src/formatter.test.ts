import { describe, it, expect } from "bun:test";
import { ChatTemplateFormatter } from "./formatter";
import type { IDatasetRow } from "./types";

describe("ChatTemplateFormatter", () => {
  const formatter = new ChatTemplateFormatter();

  it("should transform tools to OpenAI format", () => {
    const row: IDatasetRow = {
      messages: [],
      tools: [
        {
          name: "calculator",
          description: "Performs math",
          parameters: {
            type: "object",
            properties: { a: { type: "number" } },
            required: ["a"],
          },
          output: {},
        },
      ],
      schema: {} as any,
      meta: {} as any,
    };

    const result = formatter.format(row);
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0]).toEqual({
      type: "function",
      function: {
        name: "calculator",
        description: "Performs math",
        parameters: {
          type: "object",
          properties: { a: { type: "number" } },
          required: ["a"],
        },
      },
    });
  });

  it("should transform user messages", () => {
    const row: IDatasetRow = {
      messages: [
        {
          role: "user",
          content: "Hello",
          generationId: "1",
        },
      ],
      tools: [],
      schema: {} as any,
      meta: {} as any,
    };

    const result = formatter.format(row);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toEqual({
      role: "user",
      content: "Hello",
    });
  });

  it("should transform assistant messages with tool calls", () => {
    const row: IDatasetRow = {
      messages: [
        {
          role: "assistant",
          content: [
            { type: "text", text: "Thinking..." },
            {
              type: "tool-call",
              toolCallId: "call_1",
              toolName: "calc",
              input: { a: 1 },
            },
          ],
          generationId: "1",
        } as any, // Casting because IDatasetMessage content type is strict in tests
      ],
      tools: [],
      schema: {} as any,
      meta: {} as any,
    };

    const result = formatter.format(row);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toEqual({
      role: "assistant",
      content: "Thinking...",
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: {
            name: "calc",
            arguments: { a: 1 },
          },
        },
      ],
    });
  });

  it("should flatten tool result messages", () => {
    const row: IDatasetRow = {
      messages: [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_1",
              toolName: "calc",
              result: 2,
              output: 2, // dataset.ts populates output
            },
            {
              type: "tool-result",
              toolCallId: "call_2",
              toolName: "calc",
              result: 4,
              output: 4,
            },
          ],
          generationId: "1",
        } as any,
      ],
      tools: [],
      schema: {} as any,
      meta: {} as any,
    };

    const result = formatter.format(row);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toEqual({
      role: "tool",
      tool_call_id: "call_1",
      name: "calc",
      content: "2",
    });
    expect(result.messages[1]).toEqual({
      role: "tool",
      tool_call_id: "call_2",
      name: "calc",
      content: "4",
    });
  });
});
