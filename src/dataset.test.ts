import { describe, expect, it } from "bun:test";

// Test the ID generation function
function generateIdFromSeed(seed: number): string {
  const hash = Math.abs(seed * 2654435761) % 4294967296;
  return `row_${seed}_${hash.toString(36)}`;
}

describe("dataset metadata ID generation", () => {
  it("generates deterministic IDs from seeds", () => {
    const seed = 42;
    const id1 = generateIdFromSeed(seed);
    const id2 = generateIdFromSeed(seed);
    
    expect(id1).toBe(id2);
    expect(id1).toBe("row_42_1w08zre");
  });

  it("generates unique IDs for different seeds", () => {
    const id1 = generateIdFromSeed(100);
    const id2 = generateIdFromSeed(101);
    const id3 = generateIdFromSeed(102);
    
    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
    
    // Verify expected values
    expect(id1).toBe("row_100_1l2dpno");
    expect(id2).toBe("row_101_txnff9");
    expect(id3).toBe("row_102_2sx56u");
  });

  it("handles large seed values", () => {
    const largeSeed = 999999;
    const id = generateIdFromSeed(largeSeed);
    
    expect(id).toContain("row_999999_");
    expect(id.length).toBeGreaterThan(11);
  });

  it("handles negative seeds by using absolute value", () => {
    const positiveSeed = 42;
    const negativeSeed = -42;
    
    const id1 = generateIdFromSeed(positiveSeed);
    const id2 = generateIdFromSeed(negativeSeed);
    
    // They should be different because the seed itself is part of the ID
    expect(id1).not.toBe(id2);
    expect(id1).toContain("row_42_");
    expect(id2).toContain("row_-42_");
  });

  it("follows consistent format", () => {
    const seeds = [0, 1, 100, 1000, 99999];
    
    seeds.forEach(seed => {
      const id = generateIdFromSeed(seed);
      expect(id).toMatch(/^row_-?\d+_[a-z0-9]+$/);
    });
  });
});

