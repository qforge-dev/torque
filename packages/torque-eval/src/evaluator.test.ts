import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import * as parquet from "parquetjs";
import { MockLanguageModelV2 } from "ai/test";
import type { IDatasetRow } from "@qforge/torque";
import { scoreDataset, compareDatasets } from "./evaluator";
import type {
  ComparisonProgress,
  ComparisonRenderer,
  ComparisonRendererConfig,
  ComparisonSummary,
} from "./types";

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

function findRowLabelForMarker(
  promptText: string,
  marker: string
): "A" | "B" | null {
  const markerIndex = promptText.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }
  const rowBIndex = promptText.indexOf("ROW B MESSAGES:");
  if (rowBIndex === -1) {
    return null;
  }
  return markerIndex > rowBIndex ? "B" : "A";
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
      createRow("row_2", "Version A answer 2 [A_WINS]"),
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
        if (promptText.includes("[TIE]")) {
          return buildTextGenerationResult({
            winner: "tie",
            rationale: "tie marker",
          });
        }
        if (promptText.includes("[B_WINS]")) {
          const label = findRowLabelForMarker(promptText, "[B_WINS]") ?? "B";
          return buildTextGenerationResult({
            winner: label,
            rationale: "marker indicates dataset B row",
          });
        }
        if (promptText.includes("[A_WINS]")) {
          const label = findRowLabelForMarker(promptText, "[A_WINS]") ?? "A";
          return buildTextGenerationResult({
            winner: label,
            rationale: "marker indicates dataset A row",
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
    expect(result.totals).toEqual({ A: 1, B: 1, tie: 1 });
    expect(result.preferred).toBe("tie");

    const comparisonMap = Object.fromEntries(
      result.comparisons.map((comparison) => [comparison.id, comparison])
    );

    const row1 = comparisonMap["row_1"];
    expect(row1).toBeDefined();
    const row1Runs = row1!.runs;
    expect(row1Runs).toHaveLength(2);
    expect(row1Runs.map((run) => run.order)).toEqual([
      "datasetA-first",
      "datasetB-first",
    ]);
    expect(row1Runs.map((run) => run.normalizedWinner)).toEqual(["B", "B"]);
    expect(row1!.winner).toBe("B");

    const row2 = comparisonMap["row_2"];
    expect(row2).toBeDefined();
    expect(row2!.runs.map((run) => run.normalizedWinner)).toEqual(["A", "A"]);
    expect(row2!.winner).toBe("A");

    const row3 = comparisonMap["row_3"];
    expect(row3).toBeDefined();
    expect(row3!.runs.every((run) => run.normalizedWinner === "tie")).toBe(
      true
    );
    expect(row3!.winner).toBe("tie");
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

    const altRow = createRow("row_1", "Version B answer [PARQUET_WIN]");
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
        doGenerate: async (options) => {
          const promptText = JSON.stringify(options.prompt);
          const label =
            findRowLabelForMarker(promptText, "[PARQUET_WIN]") ?? "B";
          return buildTextGenerationResult({
            winner: label,
            rationale: "parquet wins",
          });
        },
      }),
    });

    expect(result.comparisons).toHaveLength(1);
    expect(result.totals).toEqual({ A: 0, B: 1, tie: 0 });
    expect(result.preferred).toBe("B");
    expect(result.comparisons[0]?.runs).toHaveLength(2);
  });

  it("treats split decisions as ties", async () => {
    const datasetA = [createRow("row_1", "Dataset A content")];
    const datasetB = [createRow("row_1", "Dataset B content")];

    const mockJudge = new MockLanguageModelV2({
      doGenerate: async () =>
        buildTextGenerationResult({
          winner: "A",
          rationale: "always pick Row A",
        }),
    });

    const result = await compareDatasets({
      datasetA,
      datasetB,
      sampleSize: 1,
      seed: 99,
      judgeModel: mockJudge,
    });

    expect(result.totals.tie).toBe(1);
    expect(result.totals.A).toBe(0);
    expect(result.totals.B).toBe(0);
    const comparison = result.comparisons[0];
    expect(comparison).toBeDefined();
    expect(comparison!.runs).toHaveLength(2);
    expect(comparison!.runs[0]!.normalizedWinner).toBe("A");
    expect(comparison!.runs[1]!.normalizedWinner).toBe("B");
    expect(comparison!.winner).toBe("tie");
  });

  it("still prefers the dataset with more wins even if ties dominate", async () => {
    const datasetA = [
      createRow("row_1", "Dataset A answer 1 [FORCE_TIE]"),
      createRow("row_2", "Dataset A answer 2 [FORCE_TIE]"),
      createRow("row_3", "Dataset A answer 3 [A_WIN]"),
    ];
    const datasetB = [
      createRow("row_1", "Dataset B answer 1 [FORCE_TIE]"),
      createRow("row_2", "Dataset B answer 2 [FORCE_TIE]"),
      createRow("row_3", "Dataset B answer 3"),
    ];

    const mockJudge = new MockLanguageModelV2({
      doGenerate: async (options) => {
        const promptText = JSON.stringify(options.prompt);
        if (promptText.includes("[FORCE_TIE]")) {
          return buildTextGenerationResult({
            winner: "tie",
            rationale: "forced tie marker",
          });
        }
        const label = findRowLabelForMarker(promptText, "[A_WIN]") ?? "A";
        return buildTextGenerationResult({
          winner: label,
          rationale: "marker prefers dataset A",
        });
      },
    });

    const result = await compareDatasets({
      datasetA,
      datasetB,
      sampleSize: 3,
      judgeModel: mockJudge,
    });

    expect(result.totals).toEqual({ A: 1, B: 0, tie: 2 });
    expect(result.preferred).toBe("A");
  });

  it("honors the requested concurrency when running comparisons", async () => {
    const datasetA = Array.from({ length: 6 }, (_, idx) =>
      createRow(`row_${idx + 1}`, `Dataset A answer ${idx + 1}`)
    );
    const datasetB = Array.from({ length: 6 }, (_, idx) =>
      createRow(`row_${idx + 1}`, `Dataset B answer ${idx + 1}`)
    );

    let inFlight = 0;
    let maxInFlight = 0;
    const concurrency = 3;

    const mockJudge = new MockLanguageModelV2({
      doGenerate: async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;
        return buildTextGenerationResult({
          winner: "A",
          rationale: "dataset A preferred",
        });
      },
    });

    await compareDatasets({
      datasetA,
      datasetB,
      sampleSize: 6,
      seed: 11,
      judgeModel: mockJudge,
      concurrency,
    });

    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(concurrency);
    expect(inFlight).toBe(0);
  });

  it("writes results to disk when outputPath is provided", async () => {
    const dir = await createTempDir();
    const outputPath = path.join(dir, "comparison.json");

    const datasetA = [createRow("row_1", "Dataset A answer [A_WINS]")];
    const datasetB = [createRow("row_1", "Dataset B answer")];

    const result = await compareDatasets({
      datasetA,
      datasetB,
      sampleSize: 1,
      judgeModel: new MockLanguageModelV2({
        doGenerate: async (options) => {
          const promptText = JSON.stringify(options.prompt);
          const label = findRowLabelForMarker(promptText, "[A_WINS]") ?? "A";
          return buildTextGenerationResult({
            winner: label,
            rationale: "marker hints at preferred row",
          });
        },
      }),
      outputPath,
    });

    const persisted = JSON.parse(await readFile(outputPath, "utf-8"));
    expect(persisted.totals).toEqual(result.totals);
    expect(persisted.preferred).toEqual("A");
  });

  it("supports custom progress renderers and callbacks", async () => {
    const datasetA = [
      createRow("row_1", "Dataset A answer 1"),
      createRow("row_2", "Dataset A answer 2"),
    ];
    const datasetB = [
      createRow("row_1", "Dataset B answer 1"),
      createRow("row_2", "Dataset B answer 2"),
    ];

    class TestRenderer implements ComparisonRenderer {
      public startCalled = false;
      public finishCalled = false;
      public failCalled = false;
      public progressSnapshots: ComparisonProgress[] = [];

      start(_config: ComparisonRendererConfig): void {
        this.startCalled = true;
      }
      update(progress: ComparisonProgress): void {
        this.progressSnapshots.push(progress);
      }
      finish(_summary: ComparisonSummary): void {
        this.finishCalled = true;
      }
      fail(_error: Error): void {
        this.failCalled = true;
      }
    }

    const renderer = new TestRenderer();
    const callbackSnapshots: ComparisonProgress[] = [];

    await compareDatasets({
      datasetA,
      datasetB,
      sampleSize: 2,
      judgeModel: new MockLanguageModelV2({
        doGenerate: async () =>
          buildTextGenerationResult({
            winner: "A",
            rationale: "deterministic",
          }),
      }),
      progressRenderer: renderer,
      onProgress: (progress) => callbackSnapshots.push(progress),
    });

    expect(renderer.startCalled).toBe(true);
    expect(renderer.finishCalled).toBe(true);
    expect(renderer.failCalled).toBe(false);
    expect(renderer.progressSnapshots.at(-1)?.completed).toBe(2);
    expect(renderer.progressSnapshots.at(-1)?.wins).toEqual({
      A: 0,
      B: 0,
      tie: 2,
    });
    expect(callbackSnapshots.length).toBeGreaterThan(0);
    expect(callbackSnapshots.at(-1)?.completed).toBe(2);
    expect(callbackSnapshots.at(-1)?.wins).toEqual({
      A: 0,
      B: 0,
      tie: 2,
    });
  });
});
