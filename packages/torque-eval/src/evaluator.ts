import { generateObject } from "ai";
import { z } from "zod";
import type {
  CompareDatasetsOptions,
  CompareDatasetsResult,
  PairwiseComparison,
  PairwiseComparisonRun,
  PairwiseRunOrder,
  PairwiseWinner,
  ScoreDatasetOptions,
  ScoreDatasetResult,
  ScoreRecord,
  JudgeModel,
} from "./types";
import { loadDataset } from "./loaders";
import { samplePairedRows, sampleRows } from "./sampling";
import { buildPairPrompt, buildSinglePrompt } from "./prompts";
import { pairResponseSchema, scoreResponseSchema } from "./parsers";

function averageScores(samples: ScoreRecord[]): ScoreDatasetResult["averages"] {
  if (samples.length === 0) {
    return { quality: 0, coherence: 0, adherence: 0 };
  }

  const totals = samples.reduce(
    (acc, sample) => {
      acc.quality += sample.scores.quality;
      acc.coherence += sample.scores.coherence;
      acc.adherence += sample.scores.adherence;
      return acc;
    },
    { quality: 0, coherence: 0, adherence: 0 }
  );

  const divisor = samples.length;
  return {
    quality: Number((totals.quality / divisor).toFixed(2)),
    coherence: Number((totals.coherence / divisor).toFixed(2)),
    adherence: Number((totals.adherence / divisor).toFixed(2)),
  };
}

async function runJudgeModel<T>(
  judgeModel: JudgeModel,
  prompt: string,
  schema: z.ZodType<T>
): Promise<{ data: T; response: string }> {
  const result = await generateObject({
    model: judgeModel,
    prompt,
    schema,
  });

  return {
    data: result.object,
    response: JSON.stringify(result.object, null, 2),
  };
}

export async function scoreDataset(
  options: ScoreDatasetOptions
): Promise<ScoreDatasetResult> {
  const rows = await loadDataset(options.dataset);
  if (rows.length === 0) {
    throw new Error("Dataset is empty. Cannot score zero rows.");
  }

  const sample = sampleRows(
    rows,
    options.sampleSize,
    options.seed,
    options.rowIdExtractor
  );

  if (sample.length === 0) {
    throw new Error("Sampling returned no rows to score.");
  }

  const samples: ScoreRecord[] = [];
  for (const item of sample) {
    const prompt = buildSinglePrompt(item.row, options.instructions);
    const { data: scores, response } = await runJudgeModel(
      options.judgeModel,
      prompt,
      scoreResponseSchema
    );
    samples.push({
      id: item.id,
      prompt,
      response,
      scores,
      row: item.row,
    });
  }

  return {
    samples,
    averages: averageScores(samples),
  };
}

function derivePreferredWinner(totals: {
  A: number;
  B: number;
  tie: number;
}): PairwiseWinner {
  const max = Math.max(totals.A, totals.B, totals.tie);
  if (max === totals.tie) return "tie";
  if (max === totals.A && max === totals.B) return "tie";
  if (max === totals.A) return "A";
  if (max === totals.B) return "B";
  return "tie";
}

function normalizeWinnerForOrder(
  winner: PairwiseWinner,
  order: PairwiseRunOrder
): PairwiseWinner {
  if (winner === "tie") return "tie";
  if (order === "datasetA-first") {
    return winner;
  }
  return winner === "A" ? "B" : "A";
}

function deriveAggregateWinner(winners: PairwiseWinner[]): PairwiseWinner {
  if (winners.length === 0) return "tie";
  if (winners.some((winner) => winner === "tie")) {
    return "tie";
  }
  const first = winners[0];
  return winners.every((winner) => winner === first) ? first! : "tie";
}

function describeOrder(order: PairwiseRunOrder): string {
  return order === "datasetA-first"
    ? "datasetA row labeled as Row A"
    : "datasetB row labeled as Row A";
}

function summarizeRationale(
  runs: PairwiseComparisonRun[],
  overallWinner: PairwiseWinner
): string {
  const runSummaries = runs
    .map((run, index) => {
      const baseRationale =
        run.rationale && run.rationale.trim().length > 0
          ? run.rationale
          : "No rationale provided.";
      const normalized =
        run.normalizedWinner === "tie"
          ? "tie"
          : `dataset ${run.normalizedWinner}`;
      return `Run ${index + 1} (${describeOrder(run.order)}): model returned "${
        run.winner
      }" (${normalized} after normalization). ${baseRationale}`;
    })
    .join("\n\n");

  const summary =
    overallWinner === "tie"
      ? "Overall result: tie (no row won both orderings)."
      : `Overall result: dataset ${overallWinner} won both orderings.`;

  return `${runSummaries}\n\n${summary}`.trim();
}

export async function compareDatasets(
  options: CompareDatasetsOptions
): Promise<CompareDatasetsResult> {
  const [datasetA, datasetB] = await Promise.all([
    loadDataset(options.datasetA),
    loadDataset(options.datasetB),
  ]);

  if (datasetA.length === 0 || datasetB.length === 0) {
    throw new Error("Both datasets must contain at least one row.");
  }

  const pairs = samplePairedRows(
    datasetA,
    datasetB,
    options.sampleSize,
    options.seed,
    options.rowIdExtractor
  );

  if (pairs.length === 0) {
    throw new Error("No matching row IDs found to compare.");
  }

  const totals: CompareDatasetsResult["totals"] = {
    A: 0,
    B: 0,
    tie: 0,
  };

  const comparisons: PairwiseComparison[] = [];

  for (const pair of pairs) {
    const runDefinitions: Array<{
      order: PairwiseRunOrder;
      rowA: typeof pair.rowA;
      rowB: typeof pair.rowB;
    }> = [
      { order: "datasetA-first", rowA: pair.rowA, rowB: pair.rowB },
      { order: "datasetB-first", rowA: pair.rowB, rowB: pair.rowA },
    ];

    const runs: PairwiseComparisonRun[] = [];

    for (const definition of runDefinitions) {
      const prompt = buildPairPrompt(
        definition.rowA,
        definition.rowB,
        options.instructions
      );
      const { data: pairResult, response } = await runJudgeModel(
        options.judgeModel,
        prompt,
        pairResponseSchema
      );
      const normalizedWinner = normalizeWinnerForOrder(
        pairResult.winner,
        definition.order
      );
      runs.push({
        order: definition.order,
        prompt,
        response,
        winner: pairResult.winner,
        normalizedWinner,
        rationale: pairResult.rationale,
      });
    }

    const normalizedWinners = runs.map((run) => run.normalizedWinner);
    const finalWinner = deriveAggregateWinner(normalizedWinners);
    totals[finalWinner] += 1;

    const rationale = summarizeRationale(runs, finalWinner);

    comparisons.push({
      id: pair.id,
      prompt: runs[0]?.prompt ?? "",
      response: runs[0]?.response ?? "",
      winner: finalWinner,
      rationale,
      rowA: pair.rowA,
      rowB: pair.rowB,
      runs,
    });
  }

  return {
    comparisons,
    totals,
    preferred: derivePreferredWinner(totals),
  };
}
