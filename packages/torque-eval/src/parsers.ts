import type { PairwiseWinner, ScoreBreakdown } from "./types";

function extractJsonBlock(response: string): any {
  const trimmed = response.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("Judge response did not contain valid JSON.");
    }
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    return JSON.parse(candidate);
  }
}

function coerceScore(value: unknown, field: string): number {
  const num = typeof value === "string" ? Number(value) : (value as number);
  if (!Number.isFinite(num)) {
    throw new Error(`Judge response missing numeric "${field}" score.`);
  }
  return Math.max(0, Math.min(10, num));
}

export function parseScoreResponse(response: string): ScoreBreakdown {
  const payload = extractJsonBlock(response);
  return {
    quality: coerceScore(payload.quality, "quality"),
    coherence: coerceScore(payload.coherence, "coherence"),
    adherence: coerceScore(payload.adherence, "adherence"),
    notes:
      typeof payload.notes === "string"
        ? payload.notes
        : JSON.stringify(payload.notes ?? ""),
  };
}

export function parsePairResponse(response: string): {
  winner: PairwiseWinner;
  rationale: string;
} {
  const payload = extractJsonBlock(response);
  const winner = payload.winner;
  if (winner !== "A" && winner !== "B" && winner !== "tie") {
    throw new Error(
      `Judge response must set winner to "A", "B", or "tie". Received: ${winner}`
    );
  }
  const rationale =
    typeof payload.rationale === "string"
      ? payload.rationale
      : JSON.stringify(payload.rationale ?? "");
  return { winner, rationale };
}
