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
  datasetA: DatasetSource;
  datasetB: DatasetSource;
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
}

export type PairwiseWinner = "A" | "B" | "tie";

export type PairwiseRunOrder = "datasetA-first" | "datasetB-first";

export interface PairwiseComparisonRun {
  order: PairwiseRunOrder;
  prompt: string;
  response: string;
  winner: PairwiseWinner;
  normalizedWinner: PairwiseWinner;
  rationale: string;
}

export interface PairwiseComparison {
  id: string;
  prompt: string;
  response: string;
  winner: PairwiseWinner;
  rationale: string;
  rowA: IDatasetRow;
  rowB: IDatasetRow;
  runs: PairwiseComparisonRun[];
}

export interface CompareDatasetsResult {
  comparisons: PairwiseComparison[];
  totals: {
    A: number;
    B: number;
    tie: number;
  };
  preferred: PairwiseWinner;
  judgeModelId?: string;
}

export interface ComparisonProgress {
  completed: number;
  inProgress: number;
  total: number;
  wins: {
    A: number;
    B: number;
    tie: number;
  };
}

export interface ComparisonRendererConfig {
  total: number;
  concurrency: number;
  seed?: number;
  instructions?: string;
  judgeModelId?: string;
}

export interface ComparisonSummary {
  totals: CompareDatasetsResult["totals"];
  preferred: PairwiseWinner;
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
