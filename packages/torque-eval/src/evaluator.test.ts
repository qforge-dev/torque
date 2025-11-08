import { describe, expect, it } from "bun:test";
import type { LanguageModel } from "ai";
import type { IDatasetRow } from "@qforge/torque";
import { scoreDataset, compareDatasets } from "./evaluator";

const baseSchema = {
  metadata: { scenario: "demo" },
  messages: [
    {
      role: "system",
      type: "text",
      content: "You are a helpful assistant.",
      generationId: "schema-system",
    },
  ],
  tools: [],
};

function cloneSchema(): IDatasetRow["schema"] {
  return JSON.parse(JSON.stringify(baseSchema));
}

function createRow(id: string, assistantText: string): IDatasetRow {
  return {
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: `User prompt ${id}` }],
        generationId: `${id}-user`,
      },
      {
        role: "assistant",
        content: [{ type: "text", text: assistantText }],
        generationId: `${id}-assistant`,
      },
    ],
    tools: [],
    schema: cloneSchema(),
    meta: {
      seed: Number.parseInt(id.replace(/\D/g, ""), 10) || 0,
      metadata: { id },
    },
  };
}

describe("scoreDataset", () => {
  it("samples rows and aggregates judge scores", async () => {
    const dataset = [
      createRow("row_1", "Assistant responds 1"),
      createRow("row_2", "Assistant responds 2"),
      createRow("row_3", "Assistant responds 3"),
    ];

    const mockJudge = async () =>
      JSON.stringify({
        quality: 8,
        coherence: 7.5,
        adherence: 9,
        notes: "looks good",
      });

    const result = await scoreDataset({
      dataset,
      sampleSize: 2,
      judgeModel: mockJudge,
      seed: 123,
    });

    expect(result.samples.length).toBe(2);
    expect(result.averages.quality).toBe(8);
    expect(result.averages.coherence).toBe(7.5);
    expect(result.averages.adherence).toBe(9);
    result.samples.forEach((sample) => {
      expect(sample.scores.notes).toBe("looks good");
    });
  });
});

describe("compareDatasets", () => {
  it("pairs rows by id and tallies winners", async () => {
    const datasetA = [
      createRow("row_1", "Version A answer 1"),
      createRow("row_2", "Version A answer 2"),
      createRow("row_3", "Version A answer 3"),
    ];

    const datasetB = [
      createRow("row_1", "Version B answer 1 [B_WINS]"),
      createRow("row_2", "Version B answer 2"),
      createRow("row_3", "Version B answer 3 [TIE]"),
    ];

    const mockJudge = async (prompt: string) => {
      if (prompt.includes("[B_WINS]")) {
        return `{"winner":"B","rationale":"marker indicates B"}`;
      }
      if (prompt.includes("[TIE]")) {
        return `{"winner":"tie","rationale":"tie marker"}`;
      }
      return `{"winner":"A","rationale":"default to A"}`;
    };

    const result = await compareDatasets({
      datasetA,
      datasetB,
      sampleSize: 3,
      seed: 42,
      judgeModel: mockJudge,
    });

    expect(result.comparisons.length).toBe(3);
    expect(result.totals.A).toBe(1);
    expect(result.totals.B).toBe(1);
    expect(result.totals.tie).toBe(1);
    expect(result.preferred).toBe("tie");
  });
});
