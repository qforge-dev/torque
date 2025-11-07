import { describe, expect, it } from "bun:test";
import { metadata } from "./schema";
import { oneOf } from "./schema-rng";
import type { IMessageSchemaContext } from "./types";
import { withSeed } from "./utils";

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
