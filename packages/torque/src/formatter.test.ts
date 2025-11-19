import { describe, it, expect } from "bun:test";
import { ChatTemplateFormatter } from "./formatter";
import type { IDatasetRow } from "./types";

describe("ChatTemplateFormatter", () => {
  const formatter = new ChatTemplateFormatter();

  const createMockRow = (
    overrides: Partial<IDatasetRow> = {}
  ): IDatasetRow => ({
    messages: [],
    tools: [],
    schema: {
      metadata: {},
      messages: [],
      tools: [],
    },
    meta: {},
    ...overrides,
  });

  it("should transform tools to OpenAI format", () => {
    const row = createMockRow({
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
    });

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
    const row = createMockRow({
      messages: [
        {
          role: "user",
          content: "Hello",
          generationId: "1",
        },
      ],
    });

    const result = formatter.format(row);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toEqual({
      role: "user",
      content: "Hello",
    });
  });

  it("should transform assistant messages with tool calls", () => {
    const row = createMockRow({
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
        },
      ],
    });

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

  it("should transform assistant messages with reasoning", () => {
    const row = createMockRow({
      messages: [
        {
          role: "assistant",
          content: [
            { type: "reasoning", text: "I should check the weather." },
            { type: "text", text: "Checking weather..." },
          ],
          generationId: "1",
        },
      ],
    });

    const result = formatter.format(row);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toEqual({
      role: "assistant",
      content: "Checking weather...",
      reasoning: "I should check the weather.",
    });
  });

  it("should flatten tool result messages", () => {
    const row = createMockRow({
      messages: [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_1",
              toolName: "calc",
              output: { type: "text", value: "2" }, // dataset.ts populates output
            },
            {
              type: "tool-result",
              toolCallId: "call_2",
              toolName: "calc",
              output: { type: "text", value: "4" },
            },
          ],
          generationId: "1",
        },
      ],
    });

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
