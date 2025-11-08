import type { LanguageModel } from "ai";
import type { IDatasetRow } from "@qforge/torque";

export type DatasetSource = string | IDatasetRow[];

export type JudgeModel =
  | ((prompt: string) => Promise<string>)
  | LanguageModel;

export type RowIdExtractor = (row: IDatasetRow, index: number) => string | undefined;

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
}

export interface CompareDatasetsOptions {
  datasetA: DatasetSource;
  datasetB: DatasetSource;
  sampleSize: number;
  judgeModel: JudgeModel;
  seed?: number;
  instructions?: string;
  rowIdExtractor?: RowIdExtractor;
}

export type PairwiseWinner = "A" | "B" | "tie";

export interface PairwiseComparison {
  id: string;
  prompt: string;
  response: string;
  winner: PairwiseWinner;
  rationale: string;
  rowA: IDatasetRow;
  rowB: IDatasetRow;
}

export interface CompareDatasetsResult {
  comparisons: PairwiseComparison[];
  totals: {
    A: number;
    B: number;
    tie: number;
  };
  preferred: PairwiseWinner;
}
