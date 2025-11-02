import { describe, expect, it } from "bun:test";
import { oneOf } from "./schema-rng";
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
