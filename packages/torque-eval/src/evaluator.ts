import fsp from "node:fs/promises";
import path from "node:path";
import { generateObject } from "ai";
import { z } from "zod";
import type { IDatasetRow } from "@qforge/torque";
import type {
  CompareDatasetsOptions,
  CompareDatasetsResult,
  ComparisonProgress,
  ComparisonRenderer,
  JudgeDecision,
  DatasetCollection,
  DatasetComparisonTarget,
  DatasetLeaderboardEntry,
  DatasetPairSummary,
  EloConfig,
  JudgeModel,
  PairSample,
  PairwiseComparison,
  PairwiseComparisonRun,
  PairwiseRunOrder,
  PairwiseWinner,
  ScoreDatasetOptions,
  ScoreDatasetResult,
  ScoreRecord,
} from "./types";
import { loadDataset } from "./loaders";
import { samplePairedRows, sampleRows } from "./sampling";
import { buildPairPrompt, buildSinglePrompt } from "./prompts";
import { pairResponseSchema, scoreResponseSchema } from "./parsers";
import { processWithConcurrency } from "./concurrency";
import { PairwiseEvaluationRenderer } from "./evaluation-renderer";

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

function extractJudgeModelId(judgeModel: JudgeModel): string | undefined {
  if (typeof judgeModel === "string") {
    const trimmed = judgeModel.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (
    typeof judgeModel === "object" &&
    judgeModel !== null &&
    "modelId" in judgeModel &&
    typeof judgeModel.modelId === "string"
  ) {
    return judgeModel.modelId;
  }

  return undefined;
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
    judgeModelId: extractJudgeModelId(options.judgeModel),
  };
}

interface LoadedDataset {
  id: string;
  label: string;
  rows: IDatasetRow[];
}

interface ComparisonJob extends PairSample {
  datasetAId: string;
  datasetBId: string;
}

function normalizeDatasetCollection(
  datasets: DatasetCollection
): DatasetComparisonTarget[] {
  if (Array.isArray(datasets)) {
    if (datasets.length < 2) {
      throw new Error("compareDatasets requires at least two datasets.");
    }
    const seen = new Set<string>();
    return datasets.map((entry) => {
      const id = entry.id?.trim();
      if (!id) {
        throw new Error("Each dataset entry must include a non-empty id.");
      }
      if (seen.has(id)) {
        throw new Error(`Duplicate dataset id "${id}" detected.`);
      }
      seen.add(id);
      return {
        id,
        dataset: entry.dataset,
        label: entry.label ?? id,
      };
    });
  }

  const entries = Object.entries(datasets);
  if (entries.length < 2) {
    throw new Error("compareDatasets requires at least two datasets.");
  }
  return entries.map(([id, dataset]) => ({
    id,
    dataset,
    label: id,
  }));
}

async function loadDatasetsForComparison(
  datasets: DatasetCollection
): Promise<LoadedDataset[]> {
  const targets = normalizeDatasetCollection(datasets);
  const loaded = await Promise.all(
    targets.map(async (target) => {
      const rows = await loadDataset(target.dataset);
      if (rows.length === 0) {
        throw new Error(
          `Dataset "${target.id}" is empty. Provide at least one row to compare.`
        );
      }
      return {
        id: target.id,
        label: target.label ?? target.id,
        rows,
      };
    })
  );
  return loaded;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

function derivePairSeed(
  baseSeed: number | undefined,
  datasetAId: string,
  datasetBId: string
): number | undefined {
  if (typeof baseSeed !== "number") {
    return undefined;
  }
  const pairHash = hashString(createPairKey(datasetAId, datasetBId));
  return (baseSeed + pairHash) >>> 0;
}

function createPairKey(datasetAId: string, datasetBId: string): string {
  return [datasetAId, datasetBId].sort().join("::");
}

function createComparisonKey(
  datasetAId: string,
  datasetBId: string,
  rowId: string
): string {
  return `${createPairKey(datasetAId, datasetBId)}::${rowId}`;
}

function normalizeWinnerForOrder(
  winner: JudgeDecision,
  order: PairwiseRunOrder,
  datasetAId: string,
  datasetBId: string
): PairwiseWinner {
  if (winner === "tie") return "tie";
  if (order === "datasetA-first") {
    return winner === "A" ? datasetAId : datasetBId;
  }
  return winner === "A" ? datasetBId : datasetAId;
}

function deriveAggregateWinner(winners: PairwiseWinner[]): PairwiseWinner {
  if (winners.length === 0) return "tie";
  if (winners.some((winner) => winner === "tie")) {
    return "tie";
  }
  const first = winners[0];
  return winners.every((winner) => winner === first) ? first! : "tie";
}

function describeOrder(
  order: PairwiseRunOrder,
  datasetAId: string,
  datasetBId: string
): string {
  return order === "datasetA-first"
    ? `dataset "${datasetAId}" row labeled as Row A`
    : `dataset "${datasetBId}" row labeled as Row A`;
}

function summarizeRationale(
  runs: PairwiseComparisonRun[],
  overallWinner: PairwiseWinner,
  datasetAId: string,
  datasetBId: string
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
          : `dataset "${run.normalizedWinner}"`;
      return `Run ${index + 1} (${describeOrder(
        run.order,
        datasetAId,
        datasetBId
      )}): model returned "${run.winner}" (${normalized} after normalization). ${baseRationale}`;
    })
    .join("\n\n");

  const summary =
    overallWinner === "tie"
      ? "Overall result: tie (no row won both orderings)."
      : `Overall result: dataset "${overallWinner}" won both orderings.`;

  return `${runSummaries}\n\n${summary}`.trim();
}

function buildPairSummaries(
  comparisons: PairwiseComparison[]
): DatasetPairSummary[] {
  const map = new Map<string, DatasetPairSummary>();
  for (const comparison of comparisons) {
    const key = createPairKey(comparison.datasetAId, comparison.datasetBId);
    let summary = map.get(key);
    if (!summary) {
      summary = {
        datasetAId: comparison.datasetAId,
        datasetBId: comparison.datasetBId,
        wins: {
          [comparison.datasetAId]: 0,
          [comparison.datasetBId]: 0,
          tie: 0,
        },
        samples: 0,
      };
      map.set(key, summary);
    }
    if (comparison.winner === "tie") {
      summary.wins.tie += 1;
    } else {
      summary.wins[comparison.winner] =
        (summary.wins[comparison.winner] ?? 0) + 1;
    }
    summary.samples += 1;
  }

  return Array.from(map.values()).sort((a, b) => {
    const keyA = createPairKey(a.datasetAId, a.datasetBId);
    const keyB = createPairKey(b.datasetAId, b.datasetBId);
    return keyA.localeCompare(keyB);
  });
}

function buildLeaderboard(
  comparisons: PairwiseComparison[],
  datasetIds: string[],
  eloConfig?: EloConfig
): DatasetLeaderboardEntry[] {
  const initialRating = eloConfig?.initialRating ?? 1500;
  const kFactor = eloConfig?.kFactor ?? 32;
  const entries = new Map<string, DatasetLeaderboardEntry>();

  const ensureEntry = (datasetId: string) => {
    let entry = entries.get(datasetId);
    if (!entry) {
      entry = {
        datasetId,
        rating: initialRating,
        wins: 0,
        losses: 0,
        ties: 0,
      };
      entries.set(datasetId, entry);
    }
    return entry;
  };

  datasetIds.forEach(ensureEntry);

  for (const comparison of comparisons) {
    const entryA = ensureEntry(comparison.datasetAId);
    const entryB = ensureEntry(comparison.datasetBId);
    const ratingA = entryA.rating;
    const ratingB = entryB.rating;
    const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
    const expectedB = 1 - expectedA;

    let scoreA: number;
    let scoreB: number;

    if (comparison.winner === "tie") {
      scoreA = 0.5;
      scoreB = 0.5;
      entryA.ties += 1;
      entryB.ties += 1;
    } else if (comparison.winner === comparison.datasetAId) {
      scoreA = 1;
      scoreB = 0;
      entryA.wins += 1;
      entryB.losses += 1;
    } else if (comparison.winner === comparison.datasetBId) {
      scoreA = 0;
      scoreB = 1;
      entryB.wins += 1;
      entryA.losses += 1;
    } else {
      continue;
    }

    entryA.rating = Number(
      (ratingA + kFactor * (scoreA - expectedA)).toFixed(2)
    );
    entryB.rating = Number(
      (ratingB + kFactor * (scoreB - expectedB)).toFixed(2)
    );
  }

  return Array.from(entries.values()).sort(
    (a, b) =>
      b.rating - a.rating || a.datasetId.localeCompare(b.datasetId)
  );
}

function mergeComparisons(
  existing: PairwiseComparison[],
  incoming: PairwiseComparison[]
): PairwiseComparison[] {
  const merged = new Map<string, PairwiseComparison>();
  const append = (comparison: PairwiseComparison) => {
    const key = createComparisonKey(
      comparison.datasetAId,
      comparison.datasetBId,
      comparison.id
    );
    merged.set(key, comparison);
  };
  existing.forEach(append);
  incoming.forEach(append);

  return Array.from(merged.values()).sort((a, b) => {
    const keyA = createComparisonKey(a.datasetAId, a.datasetBId, a.id);
    const keyB = createComparisonKey(b.datasetAId, b.datasetBId, b.id);
    return keyA.localeCompare(keyB);
  });
}

function filterComparisonsForDatasets(
  comparisons: PairwiseComparison[],
  datasetIds: Set<string>
): PairwiseComparison[] {
  return comparisons.filter(
    (comparison) =>
      datasetIds.has(comparison.datasetAId) &&
      datasetIds.has(comparison.datasetBId)
  );
}

async function loadExistingComparisons(
  resumeFrom?: string
): Promise<PairwiseComparison[]> {
  if (!resumeFrom) {
    return [];
  }

  try {
    const contents = await fsp.readFile(resumeFrom, "utf-8");
    const parsed = JSON.parse(contents);
    if (!Array.isArray(parsed?.comparisons)) {
      throw new Error("File does not contain a comparisons array.");
    }
    return parsed.comparisons as PairwiseComparison[];
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return [];
    }
    throw new Error(
      `Failed to resume comparisons from ${resumeFrom}: ${err.message}`
    );
  }
}

export async function compareDatasets(
  options: CompareDatasetsOptions
): Promise<CompareDatasetsResult> {
  if (
    typeof options.sampleSize !== "number" ||
    !Number.isFinite(options.sampleSize)
  ) {
    throw new Error("sampleSize must be a finite number.");
  }
  const samplesPerPair = Math.max(1, Math.floor(options.sampleSize));
  const evaluationStart = Date.now();
  const judgeModelId = extractJudgeModelId(options.judgeModel);

  const datasets = await loadDatasetsForComparison(options.datasets);
  const datasetIds = datasets.map((dataset) => dataset.id);
  const datasetIdSet = new Set(datasetIds);

  const [resumeComparisons, providedComparisons] = await Promise.all([
    loadExistingComparisons(options.resumeFrom),
    Promise.resolve(options.initialComparisons ?? []),
  ]);

  const baselineComparisons = mergeComparisons(
    filterComparisonsForDatasets(resumeComparisons, datasetIdSet),
    filterComparisonsForDatasets(providedComparisons, datasetIdSet)
  );

  const comparisonsByPair = new Map<string, PairwiseComparison[]>();
  for (const comparison of baselineComparisons) {
    const key = createPairKey(comparison.datasetAId, comparison.datasetBId);
    if (!comparisonsByPair.has(key)) {
      comparisonsByPair.set(key, []);
    }
    comparisonsByPair.get(key)!.push(comparison);
  }

  const jobs: ComparisonJob[] = [];
  for (let i = 0; i < datasets.length - 1; i++) {
    for (let j = i + 1; j < datasets.length; j++) {
      const datasetA = datasets[i]!;
      const datasetB = datasets[j]!;
      const pairKey = createPairKey(datasetA.id, datasetB.id);
      const existingIds = new Set(
        (comparisonsByPair.get(pairKey) ?? []).map((comparison) => comparison.id)
      );
      const needed =
        samplesPerPair > existingIds.size
          ? samplesPerPair - existingIds.size
          : 0;
      if (needed <= 0) {
        continue;
      }
      const sampledPairs = samplePairedRows(
        datasetA.rows,
        datasetB.rows,
        needed,
        derivePairSeed(options.seed, datasetA.id, datasetB.id),
        options.rowIdExtractor,
        existingIds
      );
      for (const sample of sampledPairs) {
        jobs.push({
          datasetAId: datasetA.id,
          datasetBId: datasetB.id,
          ...sample,
        });
      }
    }
  }

  const renderer = resolveRenderer(options);
  const totalJobs = jobs.length;
  const concurrency = options.concurrency ?? 1;
  const datasetWinTracker = new Map<string, number>();
  datasetIds.forEach((id) => datasetWinTracker.set(id, 0));
  let tieCount = 0;

  const recordWinner = (winner: PairwiseWinner) => {
    if (winner === "tie") {
      tieCount += 1;
      return;
    }
    datasetWinTracker.set(
      winner,
      (datasetWinTracker.get(winner) ?? 0) + 1
    );
  };

  baselineComparisons.forEach((comparison) => {
    recordWinner(comparison.winner);
  });

  renderer?.start({
    total: totalJobs,
    concurrency,
    seed: options.seed,
    instructions: options.instructions,
    judgeModelId,
    datasetIds,
  });

  const snapshotDatasetWins = () =>
    Object.fromEntries(
      datasetIds.map((id) => [id, datasetWinTracker.get(id) ?? 0])
    );

  const notifyProgress = (
    progress: Omit<ComparisonProgress, "datasetWins" | "ties">
  ) => {
    const enrichedProgress: ComparisonProgress = {
      ...progress,
      datasetWins: snapshotDatasetWins(),
      ties: tieCount,
    };
    renderer?.update(enrichedProgress);
    options.onProgress?.(enrichedProgress);
  };

  notifyProgress({ completed: 0, inProgress: 0, total: totalJobs });

  try {
    let newComparisons: PairwiseComparison[] = [];
    if (jobs.length > 0) {
      newComparisons = await processWithConcurrency(
        jobs,
        concurrency,
        async (job) => {
          const runDefinitions: Array<{
            order: PairwiseRunOrder;
            rowA: typeof job.rowA;
            rowB: typeof job.rowB;
          }> = [
            { order: "datasetA-first", rowA: job.rowA, rowB: job.rowB },
            { order: "datasetB-first", rowA: job.rowB, rowB: job.rowA },
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
              definition.order,
              job.datasetAId,
              job.datasetBId
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
          const rationale = summarizeRationale(
            runs,
            finalWinner,
            job.datasetAId,
            job.datasetBId
          );
          recordWinner(finalWinner);

          return {
            id: job.id,
            datasetAId: job.datasetAId,
            datasetBId: job.datasetBId,
            prompt: runs[0]?.prompt ?? "",
            response: runs[0]?.response ?? "",
            winner: finalWinner,
            rationale,
            rowA: job.rowA,
            rowB: job.rowB,
            runs,
          };
        },
        {
          onProgress: (completed, inProgress, total) => {
            notifyProgress({ completed, inProgress, total });
          },
        }
      );
    }

    const comparisons = mergeComparisons(baselineComparisons, newComparisons);
    const pairs = buildPairSummaries(comparisons);
    const leaderboard = buildLeaderboard(comparisons, datasetIds, options.elo);

    const result: CompareDatasetsResult = {
      comparisons,
      pairs,
      leaderboard,
      judgeModelId,
    };

    let savedPath: string | undefined;
    const outputTarget = options.outputPath ?? options.resumeFrom;
    if (outputTarget) {
      savedPath = await persistResultToFile(result, outputTarget);
    }

    renderer?.finish({
      pairs,
      leaderboard,
      outputPath: savedPath,
      durationMs: Date.now() - evaluationStart,
      judgeModelId,
    });

    return result;
  } catch (error) {
    if (error instanceof Error) {
      renderer?.fail(error);
    }
    throw error;
  }
}

function resolveRenderer(
  options: CompareDatasetsOptions
): ComparisonRenderer | undefined {
  if (options.progressRenderer) {
    return options.progressRenderer;
  }
  if (options.showProgress) {
    return new PairwiseEvaluationRenderer();
  }
  return undefined;
}

async function persistResultToFile(
  result: CompareDatasetsResult,
  requestedPath: string
): Promise<string> {
  const resolvedPath = path.isAbsolute(requestedPath)
    ? requestedPath
    : path.resolve(requestedPath);
  await fsp.mkdir(path.dirname(resolvedPath), { recursive: true });
  await fsp.writeFile(
    resolvedPath,
    JSON.stringify(result, null, 2),
    "utf-8"
  );
  return resolvedPath;
}
