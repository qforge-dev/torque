import { afterEach, describe, expect, it } from "bun:test";
import { TokenCounterPool } from "./tokenCounterPool";
import type { IDatasetMessage, IDatasetTool } from "../types";

const baseMessages: IDatasetMessage[] = [
  { role: "user", content: "Hello there", generationId: "user-1" },
  { role: "assistant", content: "General Kenobi", generationId: "assistant-1" },
];

describe("TokenCounterPool", () => {
  let pools: TokenCounterPool[] = [];

  afterEach(async () => {
    await Promise.all(pools.map((pool) => pool.destroy()));
    pools = [];
  });

  it("counts tokens for a simple conversation", async () => {
    const pool = new TokenCounterPool(1);
    pools.push(pool);

    const result = await pool.countTokens({
      messages: baseMessages,
      tools: [],
    });

    expect(result.messages).toBeGreaterThan(0);
    expect(result.total).toBe(result.messages);
  });

  it("handles multiple concurrent token counting requests", async () => {
    const pool = new TokenCounterPool(2);
    pools.push(pool);

    const payloads = Array.from({ length: 5 }).map((_, index) => ({
      messages: [
        {
          role: "user",
          content: `Message ${index}`,
          generationId: `user-${index}`,
        },
        {
          role: "assistant",
          content: `Reply ${index}`,
          generationId: `assistant-${index}`,
        },
      ] satisfies IDatasetMessage[],
      tools: [] satisfies IDatasetTool[],
    }));

    const results = await Promise.all(
      payloads.map((payload) => pool.countTokens(payload))
    );

    expect(results).toHaveLength(payloads.length);
    expect(results.every((result) => result.total > 0)).toBe(true);
  });
});
