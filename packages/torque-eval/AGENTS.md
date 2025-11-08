# @qforge/torque-eval Agent Guide

## Purpose
- Provide LLM-assisted scoring (`scoreDataset`) and pairwise comparisons (`compareDatasets`) for Torque-generated datasets.
- Support both file-based `.json/.jsonl` inputs and in-memory `IDatasetRow[]` payloads with optional deterministic sampling.
- Output aggregated scores, rationales, and winner tallies suitable for dashboards or regression tracking.

## Code Map
- `src/evaluator.ts`: public API, orchestrates loading, sampling, prompt construction, judge invocation, and aggregation.
- `src/loaders.ts`: file + JSON parsing helpers; must remain streaming-friendly and side-effect free.
- `src/sampling.ts`: Mulberry32 deterministic shuffle; never swap RNGs without design review.
- `src/prompts.ts`: single vs. pairwise rubric builders; ensure instructions stay judge-model-agnostic.
- `src/parsers.ts`: strict JSON response parsing + fallback heuristics; expand cautiously to avoid silent failures.
- `src/types.ts`: shared option/result interfaces consumed by dependents.

## Implementation Guardrails
1. **Deterministic sampling** – Always pass `seed` through to `shuffleAndSample`; document behavior when fewer rows than `sampleSize` exist.
2. **Side-effect boundaries** – Loading is the only place that touches the filesystem; everything else should operate on plain data.
3. **Prompt clarity** – Keep rubric wording concise; note why any new criteria are added and ensure both single + pairwise modes stay aligned.
4. **Judge abstraction** – Support both `LanguageModel` instances and `(prompt) => Promise<string>` fallbacks; never assume OpenAI-specific fields.
5. **Robust parsing** – Treat malformed judge responses as recoverable errors with actionable messages (`parsers.ts`); emit enough context for debugging but strip secrets.

## Testing & Verification
- Run targeted tests: `bun test packages/torque-eval` (covers evaluator, sampling, parsing).
- Type check/build: `bun run --filter @qforge/torque-eval build`.
- When adding loaders or prompt changes, include fixtures in `tests/` or inline snapshots that assert phrasing + token counts.
- For AI SDK-dependent flows (https://ai-sdk.dev/docs/ai-sdk-core/testing), replace real judge models with `MockLanguageModelV2` from `ai/test` so `generateText` receives deterministic responses:

```ts
import { MockLanguageModelV2 } from "ai/test";
import { scoreDataset } from "./evaluator";

const mockJudge = new MockLanguageModelV2({
  doGenerate: async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify({
          quality: 8,
          coherence: 8,
          adherence: 9,
          notes: "rubric satisfied",
        }),
      },
    ],
    finishReason: "stop",
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    warnings: [],
  }),
});

const result = await scoreDataset({
  dataset,
  sampleSize: 1,
  judgeModel: mockJudge,
});
```

- For judge integrations you cannot exercise locally, provide mock implementations in tests and document manual verification steps in PR notes.

## When to Escalate to a Human
- Adding support for new file formats, third-party judge APIs, or long-running background jobs.
- Changing scoring rubrics, aggregation math, or any public return shape.
- Introducing persistence, telemetry, or secrets storage requirements.

## Definition of Done
- Deterministic sampling verified by tests (fixed seed expectations).
- Error messages link the failing row/id whenever possible.
- README examples reflect new behaviors or options.
- Outputs remain serializable (JSON-safe) and backwards compatible.
