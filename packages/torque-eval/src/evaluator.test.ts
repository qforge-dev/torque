import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import * as parquet from "parquetjs";
import { MockLanguageModelV2 } from "ai/test";
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

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "torque-eval-evaluator-"));
  tempDirs.push(dir);
  return dir;
}

function buildTextGenerationResult(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof payload === "string" ? payload : JSON.stringify(payload),
      },
    ],
    finishReason: "stop" as const,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    warnings: [],
  };
}

describe("scoreDataset", () => {
  it("samples rows and aggregates judge scores", async () => {
    const dataset = [
      createRow("row_1", "Assistant responds 1"),
      createRow("row_2", "Assistant responds 2"),
      createRow("row_3", "Assistant responds 3"),
    ];

    const mockJudge = new MockLanguageModelV2({
      doGenerate: async () =>
        buildTextGenerationResult({
          quality: 8,
          coherence: 7.5,
          adherence: 9,
          notes: "looks good",
        }),
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

    const mockJudge = new MockLanguageModelV2({
      doGenerate: async (options) => {
        const promptText = JSON.stringify(options.prompt);
        if (promptText.includes("[B_WINS]")) {
          return buildTextGenerationResult({
            winner: "B",
            rationale: "marker indicates B",
          });
        }
        if (promptText.includes("[TIE]")) {
          return buildTextGenerationResult({
            winner: "tie",
            rationale: "tie marker",
          });
        }
        return buildTextGenerationResult({
          winner: "A",
          rationale: "default to A",
        });
      },
    });

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

  it("supports mixing JSON and Parquet sources", async () => {
    const dir = await createTempDir();
    const jsonPath = path.join(dir, "datasetA.json");
    const parquetPath = path.join(dir, "datasetB.parquet");

    const sharedRow = createRow("row_1", "Version A answer");
    await writeFile(jsonPath, JSON.stringify([sharedRow]), "utf-8");

    const writer = await parquet.ParquetWriter.openFile(
      new parquet.ParquetSchema({
        messages: { type: "UTF8" },
        tools: { type: "UTF8" },
        schema: { type: "UTF8" },
        meta: { type: "UTF8" },
      }),
      parquetPath
    );

    const altRow = createRow("row_1", "Version B answer");
    await writer.appendRow({
      messages: JSON.stringify(altRow.messages),
      tools: JSON.stringify(altRow.tools),
      schema: JSON.stringify(altRow.schema),
      meta: JSON.stringify(altRow.meta),
    });
    await writer.close();

    const result = await compareDatasets({
      datasetA: jsonPath,
      datasetB: parquetPath,
      sampleSize: 1,
      judgeModel: new MockLanguageModelV2({
        doGenerate: async () =>
          buildTextGenerationResult({
            winner: "B",
            rationale: "parquet wins",
          }),
      }),
    });

    expect(result.comparisons).toHaveLength(1);
    expect(result.totals.B).toBe(1);
    expect(result.preferred).toBe("B");
  });
});
