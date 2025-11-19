import { describe, expect, it } from "bun:test";
import {
  metadata,
  reasoning,
  generatedReasoning,
  generatedAssistant,
  assistant,
} from "./schema";
import { oneOf } from "./schema-rng";
import type { IMessageSchemaContext } from "./types";
import { withSeed } from "./utils";
import { MockLanguageModelV2 } from "ai/test";
import { AiAgent } from "./ai";
import { runWithUniqueSelectionScope } from "./unique-selection";

describe("oneOf", () => {
  it("spreads remaining weight across unweighted options", async () => {
    const options = [{ value: "A", weight: 0.3 }, "B", "C"] as const;

    await withSeed(100, async () => {
      expect(oneOf([...options])).toBe("A");
    });

    await withSeed(1, async () => {
      expect(oneOf([...options])).toBe("B");
    });

    await withSeed(42, async () => {
      expect(oneOf([...options])).toBe("C");
    });
  });

  it("falls back to uniform choice when total weight is zero", async () => {
    const options = [
      { value: "A", weight: 0 },
      { value: "B", weight: 0 },
    ] as const;

    await withSeed(100, async () => {
      expect(oneOf([...options])).toBe("A");
    });

    await withSeed(1, async () => {
      expect(oneOf([...options])).toBe("B");
    });
  });

  it("accepts fully weighted lists as long as total is <= 1", () => {
    expect(
      oneOf([
        { value: "left", weight: 0.7 },
        { value: "right", weight: 0.2 },
      ])
    ).toMatch(/left|right/);
  });

  it("rejects invalid weight totals", () => {
    expect(() =>
      oneOf([
        { value: "left", weight: 0.6 },
        { value: "right", weight: 0.5 },
      ])
    ).toThrow("oneOf weight values must sum to 1 or less");
  });

  it("rejects negative weights", () => {
    expect(() =>
      oneOf([{ value: "left", weight: -0.1 }, { value: "right" }])
    ).toThrow("oneOf weight values must be between 0 and 1");
  });

  it("enforces uniqueBy across calls", async () => {
    const options = [
      { value: { id: "a" } },
      { value: { id: "b" } },
      { value: { id: "c" } },
    ];

    await runWithUniqueSelectionScope(async () => {
      const picks = [
        oneOf([...options], {
          uniqueBy: { collection: "tools", itemId: "id" },
        }).id,
        oneOf([...options], {
          uniqueBy: { collection: "tools", itemId: "id" },
        }).id,
        oneOf([...options], {
          uniqueBy: { collection: "tools", itemId: "id" },
        }).id,
      ];

      expect(new Set(picks).size).toBe(3);
    });
  });

  it("throws when a unique collection is exhausted", async () => {
    const options = [
      { value: { id: "only" } },
      { value: { id: "only" } },
    ] as const;

    await runWithUniqueSelectionScope(async () => {
      oneOf([...options], {
        uniqueBy: { collection: "limited", itemId: "id" },
      });

      expect(() =>
        oneOf([...options], {
          uniqueBy: { collection: "limited", itemId: "id" },
        })
      ).toThrow('oneOf uniqueBy collection "limited" is exhausted');
    });
  });

  it("supports functional unique key extractors", async () => {
    const options = [
      { value: { tool: { name: "weather" } } },
      { value: { tool: { name: "calendar" } } },
    ];

    await runWithUniqueSelectionScope(async () => {
      const first = oneOf([...options], {
        uniqueBy: {
          collection: "tools",
          itemId: (value) => value.tool.name,
        },
      });

      expect(first.tool.name).toMatch(/weather|calendar/);

      const second = oneOf([...options], {
        uniqueBy: {
          collection: "tools",
          itemId: (value) => value.tool.name,
        },
      });

      expect(second.tool.name).not.toBe(first.tool.name);
    });
  });

  it("requires uniqueBy when unique is enabled", () => {
    expect(() =>
      oneOf([{ value: "a" }, { value: "b" }], { unique: true })
    ).toThrow("oneOf unique mode requires a uniqueBy option");
  });

  it("defaults uniqueBy itemId to 'id' when omitted", async () => {
    const options = [{ value: { id: "alpha" } }, { value: { id: "beta" } }];

    await runWithUniqueSelectionScope(async () => {
      const first = oneOf([...options], {
        uniqueBy: { collection: "tools" },
      }).id;
      const second = oneOf([...options], {
        uniqueBy: { collection: "tools" },
      }).id;

      expect(new Set([first, second]).size).toBe(2);
    });
  });
});

describe("metadata helper", () => {
  it("applies object updates only during the check phase", () => {
    const structure = {
      messages: [],
      tools: [],
      metadata: { existing: "value" },
    };

    const checkContext: IMessageSchemaContext = {
      acc: { messages: [], tools: [], metadata: { existing: "value" } },
      ai: {} as any,
      structure,
      phase: "check",
    };

    const result = metadata({ flag: true })(checkContext);

    expect(result).toBeNull();
    expect(checkContext.structure.metadata).toEqual({
      existing: "value",
      flag: true,
    });
    expect(checkContext.acc.metadata).toEqual({
      existing: "value",
      flag: true,
    });

    const generateContext: IMessageSchemaContext = {
      ...checkContext,
      phase: "generate",
      acc: { ...checkContext.acc, metadata: { ...checkContext.acc.metadata } },
    };

    const before = { ...generateContext.acc.metadata };

    const noop = metadata({ extra: "ignored" })(generateContext);

    expect(noop).toBeNull();
    expect(generateContext.acc.metadata).toEqual(before);
    expect(generateContext.structure.metadata).toEqual({
      existing: "value",
      flag: true,
    });
  });

  it("supports functional metadata updaters", () => {
    let callCount = 0;
    const structure = { messages: [], tools: [], metadata: {} };

    const checkContext: IMessageSchemaContext = {
      acc: { messages: [], tools: [], metadata: {} },
      ai: {} as any,
      structure,
      phase: "check",
    };

    metadata((meta) => {
      callCount += 1;
      if (meta.count) {
        meta.count = (meta.count as number) + 1;
      } else {
        meta.count = 1;
      }
    })(checkContext);

    expect(checkContext.structure.metadata).toEqual({ count: 1 });

    metadata((meta) => {
      callCount += 1;
      return { ...meta, variant: "test" };
    })(checkContext);

    expect(checkContext.structure.metadata).toEqual({
      count: 1,
      variant: "test",
    });
    expect(callCount).toBe(2);

    const generateContext: IMessageSchemaContext = {
      acc: {
        messages: [],
        tools: [],
        metadata: { ...checkContext.structure.metadata },
      },
      ai: {} as any,
      structure,
      phase: "generate",
    };

    metadata(() => {
      callCount += 1;
      return {};
    })(generateContext);

    expect(callCount).toBe(2);
    expect(generateContext.acc.metadata).toEqual({
      count: 1,
      variant: "test",
    });
  });
});

describe("reasoning", () => {
  it("creates static reasoning schema", async () => {
    const reasoningSchema = reasoning({
      content: "I need to think about this carefully.",
    });
    const context: IMessageSchemaContext = {
      acc: { messages: [], tools: [], metadata: {} },
      ai: {} as any,
      structure: { messages: [], tools: [], metadata: {} },
      phase: "generate",
    };

    const result = await reasoningSchema(context);

    expect(result).toMatchObject({
      text: "I need to think about this carefully.",
    });
    expect(result.generationId).toBeDefined();
  });

  it("creates generated reasoning schema in check phase", async () => {
    const reasoningSchema = generatedReasoning({
      prompt: "Reason about the user's request",
    });
    const context: IMessageSchemaContext = {
      acc: { messages: [], tools: [], metadata: {} },
      ai: {} as any,
      structure: { messages: [], tools: [], metadata: {} },
      phase: "check",
    };

    const result = await reasoningSchema(context);

    expect(result).toMatchObject({
      text: "Reason about the user's request",
    });
    expect(result.generationId).toBeDefined();
  });

  it("generates reasoning in generate phase", async () => {
    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        content: [
          {
            type: "text",
            text: "The user is asking about the weather, so I should provide a helpful response.",
          },
        ],
        finishReason: "stop",
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        warnings: [],
        rawResponse: { headers: {} },
      }),
    });

    const aiAgent = new AiAgent({ model: mockModel });
    const reasoningSchema = generatedReasoning({
      prompt: "Reason about the weather question",
    });

    const context: IMessageSchemaContext = {
      acc: { messages: [], tools: [], metadata: {} },
      ai: aiAgent,
      structure: { messages: [], tools: [], metadata: {} },
      phase: "generate",
    };

    const result = await reasoningSchema(context);

    expect(result.text).toBe(
      "The user is asking about the weather, so I should provide a helpful response."
    );
    expect(result.generationId).toBeDefined();
  });

  it("includes reasoning in generatedAssistant", async () => {
    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        content: [
          {
            type: "text",
            text: "Generated reasoning or response",
          },
        ],
        finishReason: "stop",
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        warnings: [],
        rawResponse: { headers: {} },
      }),
    });

    const aiAgent = new AiAgent({ model: mockModel });

    const assistantSchema = generatedAssistant({
      prompt: "Respond to the user",
      reasoning: reasoning({ content: "Static reasoning content" }),
    });

    const context: IMessageSchemaContext = {
      acc: { messages: [], tools: [], metadata: {} },
      ai: aiAgent,
      structure: { messages: [], tools: [], metadata: {} },
      phase: "generate",
    };

    const result = await assistantSchema(context);

    expect(result.role).toBe("assistant");
    expect(result.content).toBe("Generated reasoning or response");
    expect(result.reasoning).toBeDefined();
    expect(result.generationId).toBeDefined();
  });

  it("reasoning is included in the assistant message result", async () => {
    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => {
        return {
          content: [
            {
              type: "text",
              text: "Response with reasoning",
            },
          ],
          finishReason: "stop",
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          warnings: [],
          rawResponse: { headers: {} },
        };
      },
    });

    const aiAgent = new AiAgent({ model: mockModel });

    const assistantSchema = generatedAssistant({
      prompt: "Respond to greeting",
      reasoning: reasoning({ content: "The user greeted me politely" }),
    });

    const context: IMessageSchemaContext = {
      acc: { messages: [], tools: [], metadata: {} },
      ai: aiAgent,
      structure: { messages: [], tools: [], metadata: {} },
      phase: "generate",
    };

    const result = await assistantSchema(context);

    expect(result.content).toBe("Response with reasoning");
    // Verify that reasoning was resolved and is part of the result
    expect(result.reasoning).toBeDefined();
    expect(result.reasoning?.text).toBe("The user greeted me politely");
  });

  it("reasoning can be used with both static and generated assistant", async () => {
    const staticAssistant = assistant({ content: "Hello there!" });
    const context: IMessageSchemaContext = {
      acc: { messages: [], tools: [], metadata: {} },
      ai: {} as any,
      structure: { messages: [], tools: [], metadata: {} },
      phase: "generate",
    };

    const result = await staticAssistant(context);

    expect(result.role).toBe("assistant");
    expect(result.content).toBe("Hello there!");
    expect(result.reasoning).toBeUndefined();
  });
});
