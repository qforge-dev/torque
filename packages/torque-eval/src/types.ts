import type { LanguageModel } from "ai";
import type { IDatasetRow } from "@qforge/torque";

export type DatasetSource = string | IDatasetRow[];

export type JudgeModel = LanguageModel;

export type RowIdExtractor = (
  row: IDatasetRow,
  index: number
) => string | undefined;

export interface SampledRow {
  id: string;
  row: IDatasetRow;
  index: number;
}

export interface PairSample {
  id: string;
  rowA: IDatasetRow;
  rowB: IDatasetRow;
}

export interface DatasetComparisonTarget {
  id: string;
  dataset: DatasetSource;
  label?: string;
}

export type DatasetCollection =
  | Record<string, DatasetSource>
  | ReadonlyArray<DatasetComparisonTarget>;

export interface EloConfig {
  initialRating?: number;
  kFactor?: number;
}

export interface ScoreDatasetOptions {
  dataset: DatasetSource;
  sampleSize: number;
  judgeModel: JudgeModel;
  seed?: number;
  instructions?: string;
  rowIdExtractor?: RowIdExtractor;
}

export interface ScoreBreakdown {
  quality: number;
  coherence: number;
  adherence: number;
  notes: string;
}

export interface ScoreRecord {
  id: string;
  prompt: string;
  response: string;
  scores: ScoreBreakdown;
  row: IDatasetRow;
}

export interface ScoreDatasetResult {
  samples: ScoreRecord[];
  averages: {
    quality: number;
    coherence: number;
    adherence: number;
  };
  judgeModelId?: string;
}

export interface CompareDatasetsOptions {
  datasets: DatasetCollection;
  sampleSize: number;
  judgeModel: JudgeModel;
  seed?: number;
  instructions?: string;
  rowIdExtractor?: RowIdExtractor;
  concurrency?: number;
  showProgress?: boolean;
  progressRenderer?: ComparisonRenderer;
  onProgress?: (progress: ComparisonProgress) => void;
  outputPath?: string;
  resumeFrom?: string;
  initialComparisons?: PairwiseComparison[];
  elo?: EloConfig;
}

export type JudgeDecision = "A" | "B" | "tie";

export type PairwiseWinner = string | "tie";

export type PairwiseRunOrder = "datasetA-first" | "datasetB-first";

export interface PairwiseComparisonRun {
  order: PairwiseRunOrder;
  prompt: string;
  response: string;
  winner: JudgeDecision;
  normalizedWinner: PairwiseWinner;
  rationale: string;
}

export interface PairwiseComparison {
  id: string;
  datasetAId: string;
  datasetBId: string;
  prompt: string;
  response: string;
  winner: PairwiseWinner;
  rationale: string;
  rowA: IDatasetRow;
  rowB: IDatasetRow;
  runs: PairwiseComparisonRun[];
}

export interface DatasetPairSummary {
  datasetAId: string;
  datasetBId: string;
  wins: Record<string, number> & { tie: number };
  samples: number;
}

export interface DatasetLeaderboardEntry {
  datasetId: string;
  rating: number;
  wins: number;
  losses: number;
  ties: number;
}

export interface CompareDatasetsResult {
  comparisons: PairwiseComparison[];
  pairs: DatasetPairSummary[];
  leaderboard: DatasetLeaderboardEntry[];
  judgeModelId?: string;
}

export interface ComparisonProgress {
  completed: number;
  inProgress: number;
  total: number;
  datasetWins: Record<string, number>;
  ties: number;
}

export interface ComparisonRendererConfig {
  total: number;
  concurrency: number;
  seed?: number;
  instructions?: string;
  judgeModelId?: string;
  datasetIds: string[];
}

export interface ComparisonSummary {
  pairs: DatasetPairSummary[];
  leaderboard: DatasetLeaderboardEntry[];
  outputPath?: string;
  durationMs: number;
  judgeModelId?: string;
}

export interface ComparisonRenderer {
  start(config: ComparisonRendererConfig): void;
  update(progress: ComparisonProgress): void;
  finish(summary: ComparisonSummary): void;
  fail(error: Error): void;
}
