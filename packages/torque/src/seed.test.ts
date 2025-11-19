import { describe, expect, it } from "bun:test";
import {
  random,
  getRandomCallCount,
  resetRandomCallCount,
  withSeed,
} from "./utils";
import { generateDataset } from "./dataset";
import type { IMessageSchema, IMessageSchemaContext } from "./types";
import { user, assistant, times, generatedToolCall, tool } from "./schema";
import { between, oneOf } from "./schema-rng";
import { MockLanguageModelV2 } from "ai/test";
import z from "zod";

export const mockModel = (
  response: { type: "text"; text: string }[] = [
    {
      type: "text",
      text: "mock response",
    },
  ]
) => {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      content: response,
      finishReason: "stop",
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      warnings: [],
      rawResponse: { headers: {} },
    }),
  });
};

describe("seed tracking", () => {
  it("tracks random call count", async () => {
    await withSeed(42, async () => {
      expect(getRandomCallCount()).toBe(0);

      random();
      expect(getRandomCallCount()).toBe(1);

      random();
      random();
      expect(getRandomCallCount()).toBe(3);
    });
  });

  it("resets random call count", async () => {
    await withSeed(42, async () => {
      random();
      random();
      expect(getRandomCallCount()).toBe(2);

      resetRandomCallCount();
      expect(getRandomCallCount()).toBe(0);

      random();
      expect(getRandomCallCount()).toBe(1);
    });
  });

  it("returns undefined when no seed is set", () => {
    expect(getRandomCallCount()).toBeUndefined();
  });

  it("maintains separate counters for separate seed contexts", async () => {
    const promise1 = withSeed(42, async () => {
      random();
      random();
      return getRandomCallCount();
    });

    const promise2 = withSeed(43, async () => {
      random();
      return getRandomCallCount();
    });

    const [count1, count2] = await Promise.all([promise1, promise2]);
    expect(count1).toBe(2);
    expect(count2).toBe(1);
  });
});

describe("seed skewing detection", () => {
  it("detects seed skewing when check and generate phases differ", async () => {
    // Create a schema that consumes different numbers of random values
    // in check vs generate phase
    let checkPhaseCalls = 0;
    let generatePhaseCalls = 0;

    const skewedSchema: IMessageSchema = async (context) => {
      if (context.phase === "check") {
        // Consume 2 random values in check phase
        random();
        random();
        checkPhaseCalls += 2;
        return [user({ content: "Hello" })];
      } else {
        // Consume 3 random values in generate phase (different from check!)
        random();
        random();
        random();
        generatePhaseCalls += 3;
        return [user({ content: "Hello" })];
      }
    };

    // The error is caught by the batch processor, so it returns an empty array
    const result = await generateDataset(skewedSchema, {
      model: mockModel(),
      count: 1,
      seed: 42,
      output: "/tmp/seed-skew-test.jsonl",
    });

    // The result should be empty because the generation failed
    expect(result).toHaveLength(0);
  });

  it("detects seed skewing at specific message step", async () => {
    // Create a schema where the second message has skewing
    const skewedSchema: IMessageSchema = async (context) => {
      return [
        // First message - consistent
        user({ content: "Hello" }),
        // Second message - skewed
        async (ctx: IMessageSchemaContext) => {
          if (ctx.phase === "check") {
            random(); // 1 call in check
          } else {
            random();
            random(); // 2 calls in generate - SKEWED!
          }
          return assistant({ content: "Hi" })(ctx);
        },
      ];
    };

    // Should fail with empty result due to skewing at second message
    const result = await generateDataset(skewedSchema, {
      model: mockModel(),
      count: 1,
      seed: 42,
      output: "/tmp/seed-skew-step-test.jsonl",
    });

    expect(result).toHaveLength(0);
  });

  it("does not throw when check and generate phases match", async () => {
    // Create a schema that consumes the same number of random values
    // in both check and generate phase
    const consistentSchema: IMessageSchema = async (context) => {
      // Always consume 2 random values regardless of phase
      random();
      random();

      return [user({ content: "Hello" })];
    };

    // This should not throw
    const result = await generateDataset(consistentSchema, {
      model: mockModel(),
      count: 1,
      seed: 42,
      output: "/tmp/seed-consistent-test.jsonl",
    });

    expect(result).toHaveLength(1);
  });

  it("works correctly with oneOf which uses random", async () => {
    // oneOf uses random() internally, so this is a realistic test
    const schemaWithOneOf: IMessageSchema = async () => [
      oneOf([
        user({ content: "Hello" }),
        user({ content: "Hi" }),
        user({ content: "Hey" }),
      ]),
    ];

    // This should not throw because oneOf uses random() consistently
    const result = await generateDataset(schemaWithOneOf, {
      model: mockModel(),
      count: 1,
      seed: 42,
      output: "/tmp/seed-oneof-test.jsonl",
    });

    expect(result).toHaveLength(1);
  });
});

describe("seed does not skew", () => {
  it("does not skew when using oneOf", async () => {
    const schema: IMessageSchema = async () => [
      oneOf([user({ content: "Hello" })]),
      oneOf([assistant({ content: "Hey" })]),
      oneOf([user({ content: "Hello" })]),
    ];

    const result = await generateDataset(schema, {
      model: mockModel(),
      count: 1,
      seed: 42,
      output: "/tmp/seed-oneof-test.jsonl",
    });
    expect(result).toHaveLength(1);
  });

  it("does not skew when using times", async () => {
    const schema: IMessageSchema = async () => [
      times(2, [user({ content: "Hello" })]),
      times(2, [user({ content: "Hello" })]),
      times(2, [user({ content: "Hello" })]),
    ];

    const result = await generateDataset(schema, {
      model: mockModel(),
      count: 1,
      seed: 42,
      output: "/tmp/seed-times-test.jsonl",
    });
    expect(result).toHaveLength(1);
  });

  it("flattens nested schema arrays produced by helpers", async () => {
    const schema: IMessageSchema = async () => [
      [user({ content: "Hello" }), [assistant({ content: "Hi there" })]],
      times(2, [
        [user({ content: "Nested" }), assistant({ content: "Response" })],
      ]),
    ];

    const result = await generateDataset(schema, {
      model: mockModel(),
      count: 1,
      seed: 7,
      output: "/tmp/seed-nested-schema-test.jsonl",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.messages).toHaveLength(6);
  });

  it("does not skew when using between", async () => {
    const schema: IMessageSchema = async () => {
      between(2, 4);
      between(2, 4);
      between(2, 4);
      return [];
    };

    const result = await generateDataset(schema, {
      model: mockModel(),
      count: 1,
      seed: 42,
      output: "/tmp/seed-between-test.jsonl",
    });
    expect(result).toHaveLength(1);
  });

  it("does not skew when using mixed static and oneOf", async () => {
    const schema: IMessageSchema = async () => [
      user({ content: "Hello" }),
      oneOf([assistant({ content: "Hey" }), assistant({ content: "Hi" })]),
      user({ content: "How are you?" }),
    ];

    const result = await generateDataset(schema, {
      model: mockModel(),
      count: 1,
      seed: 42,
      output: "/tmp/seed-mixed-test.jsonl",
    });
    expect(result).toHaveLength(1);
  });
});

describe("seed does not skew", () => {
  it("does not skew when using generated messages", async () => {
    const singleAsyncNoResultYetAsk = (): IMessageSchema => {
      const tool1 = tool({
        name: "tool1",
        description: "tool1",
        parameters: z.object({
          name: z.string(),
        }),
        output: z.object({
          result: z.string(),
        }),
      });

      return () => {
        return [generatedToolCall(tool1, "t1")];
      };
    };

    const result = await generateDataset(singleAsyncNoResultYetAsk(), {
      model: mockModel([
        {
          type: "text",
          text: JSON.stringify({ name: "tool1" }),
        },
      ]),
      count: 1,
      seed: 42,
      output: "/tmp/seed-generated-tool-call-test.jsonl",
    });
    expect(result).toHaveLength(1);
  });
});
