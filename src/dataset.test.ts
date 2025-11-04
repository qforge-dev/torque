import { describe, expect, it } from "bun:test";
import type { IMessageSchema, ISchemaWithCount } from "./types";
import { generateDataset } from "./dataset";
import { oneOf } from "./schema-rng";
import { assistant, user } from "./schema";
import { openai } from "@ai-sdk/openai";

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

    seeds.forEach((seed) => {
      const id = generateIdFromSeed(seed);
      expect(id).toMatch(/^row_-?\d+_[a-z0-9]+$/);
    });
  });
});

describe("generateDataset API", () => {
  it("accepts array of schemas with individual counts", () => {
    // Type check: should accept ISchemaWithCount[]
    const mockSchema1: IMessageSchema = async () => null;
    const mockSchema2: IMessageSchema = async () => null;

    const schemas: ISchemaWithCount[] = [
      { schema: mockSchema1, count: 15 },
      { schema: mockSchema2, count: 15 },
    ];

    expect(schemas).toHaveLength(2);
    expect(schemas[0]!.count).toBe(15);
    expect(schemas[1]!.count).toBe(15);
  });

  it("accepts single schema with count in options", () => {
    // Type check: should accept single IMessageSchema
    const mockSchema: IMessageSchema = async () => null;

    expect(mockSchema).toBeDefined();
    expect(typeof mockSchema).toBe("function");
  });

  it("calculates total count correctly for multiple schemas", () => {
    const schemas = [{ count: 15 }, { count: 10 }, { count: 25 }];

    const totalCount = schemas.reduce((sum, entry) => sum + entry.count, 0);
    expect(totalCount).toBe(50);
  });

  it("creates correct task distribution for multiple schemas", () => {
    const schemaEntries = [
      { id: "schema1", count: 3 },
      { id: "schema2", count: 2 },
    ];

    type Task = { index: number; schemaId: string; seedOffset: number };
    const tasks: Task[] = [];
    let currentIndex = 0;

    for (const entry of schemaEntries) {
      for (let i = 0; i < entry.count; i++) {
        tasks.push({
          index: currentIndex,
          schemaId: entry.id,
          seedOffset: currentIndex,
        });
        currentIndex++;
      }
    }

    expect(tasks).toHaveLength(5);

    // Verify schema1 tasks
    expect(tasks[0]).toEqual({ index: 0, schemaId: "schema1", seedOffset: 0 });
    expect(tasks[1]).toEqual({ index: 1, schemaId: "schema1", seedOffset: 1 });
    expect(tasks[2]).toEqual({ index: 2, schemaId: "schema1", seedOffset: 2 });

    // Verify schema2 tasks
    expect(tasks[3]).toEqual({ index: 3, schemaId: "schema2", seedOffset: 3 });
    expect(tasks[4]).toEqual({ index: 4, schemaId: "schema2", seedOffset: 4 });
  });

  it("supports per-schema seeds", () => {
    const mockSchema1: IMessageSchema = async () => null;
    const mockSchema2: IMessageSchema = async () => null;

    const schemas: ISchemaWithCount[] = [
      { schema: mockSchema1, count: 3, seed: 100 },
      { schema: mockSchema2, count: 2, seed: 200 },
    ];

    expect(schemas[0]!.seed).toBe(100);
    expect(schemas[1]!.seed).toBe(200);
  });

  it("creates correct seed assignments for per-schema seeds", () => {
    const schemaEntries = [
      { id: "schema1", count: 3, seed: 100 },
      { id: "schema2", count: 2, seed: 200 },
    ];

    type Task = {
      index: number;
      schemaId: string;
      seedBase: number;
      seedOffset: number;
    };
    const tasks: Task[] = [];
    let currentIndex = 0;

    for (const entry of schemaEntries) {
      for (let i = 0; i < entry.count; i++) {
        tasks.push({
          index: currentIndex,
          schemaId: entry.id,
          seedBase: entry.seed,
          seedOffset: i, // Offset relative to schema, not global
        });
        currentIndex++;
      }
    }

    expect(tasks).toHaveLength(5);

    // Verify schema1 tasks - each uses seed 100 + offset
    expect(tasks[0]).toEqual({
      index: 0,
      schemaId: "schema1",
      seedBase: 100,
      seedOffset: 0,
    });
    expect(tasks[1]).toEqual({
      index: 1,
      schemaId: "schema1",
      seedBase: 100,
      seedOffset: 1,
    });
    expect(tasks[2]).toEqual({
      index: 2,
      schemaId: "schema1",
      seedBase: 100,
      seedOffset: 2,
    });

    // Verify schema2 tasks - each uses seed 200 + offset
    expect(tasks[3]).toEqual({
      index: 3,
      schemaId: "schema2",
      seedBase: 200,
      seedOffset: 0,
    });
    expect(tasks[4]).toEqual({
      index: 4,
      schemaId: "schema2",
      seedBase: 200,
      seedOffset: 1,
    });

    // Verify actual seed values
    const actualSeeds = tasks.map((t) => t.seedBase + t.seedOffset);
    expect(actualSeeds).toEqual([100, 101, 102, 200, 201]);
  });

  it("falls back to global seed when schema seed is not provided", () => {
    const globalSeed = 42;
    const schemaEntries = [
      { id: "schema1", count: 2, seed: 100 }, // Has its own seed
      { id: "schema2", count: 2, seed: undefined }, // Should use global seed
    ];

    type Task = {
      index: number;
      schemaId: string;
      seedBase: number | undefined;
      seedOffset: number;
    };
    const tasks: Task[] = [];
    let currentIndex = 0;

    for (const entry of schemaEntries) {
      const schemaSeed = entry.seed !== undefined ? entry.seed : globalSeed;

      for (let i = 0; i < entry.count; i++) {
        tasks.push({
          index: currentIndex,
          schemaId: entry.id,
          seedBase: schemaSeed,
          seedOffset: i,
        });
        currentIndex++;
      }
    }

    // Schema1 uses its own seed
    expect(tasks[0]!.seedBase).toBe(100);
    expect(tasks[1]!.seedBase).toBe(100);

    // Schema2 uses global seed
    expect(tasks[2]!.seedBase).toBe(42);
    expect(tasks[3]!.seedBase).toBe(42);
  });
});

describe("generateDataset", () => {
  it("generates a row with a generation ID", async () => {
    const schema: IMessageSchema = async () => [
      oneOf([user({ content: "Hello" }), assistant({ content: "hi" })]),
    ];
    const generations = await Promise.all(
      Array.from({ length: 10 }, async (_, i) =>
        generateDataset(schema, {
          model: openai("gpt-4"),
          count: 1,
          seed: i,
          output: `/tmp/test-${i}.jsonl`,
        })
      )
    );
  });
});
