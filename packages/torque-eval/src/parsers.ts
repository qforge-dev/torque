import { z } from "zod";
import type { PairwiseWinner, ScoreBreakdown } from "./types";

const SCORE_MIN = 0;
const SCORE_MAX = 10;

export const scoreResponseSchema: z.ZodType<ScoreBreakdown> = z.object({
  quality: z.number().min(SCORE_MIN).max(SCORE_MAX),
  coherence: z.number().min(SCORE_MIN).max(SCORE_MAX),
  adherence: z.number().min(SCORE_MIN).max(SCORE_MAX),
  notes: z.string().optional().default(""),
});

export const pairResponseSchema: z.ZodType<{
  winner: PairwiseWinner;
  rationale: string;
}> = z.object({
  winner: z.enum(["A", "B", "tie"]),
  rationale: z.string().optional().default(""),
});
