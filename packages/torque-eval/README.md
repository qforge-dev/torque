# @qforge/torque-eval

LLM-assisted evaluation helpers for Torque datasets. Sample rows, call your preferred judge model, and get either absolute scores or pairwise winners to compare generations from different models.

## Installation

```bash
bun add @qforge/torque-eval
# peer dependencies
bun add @qforge/torque ai
```

## Quick Start

```ts
import {
  scoreDataset,
  compareDatasets,
  PairwiseEvaluationRenderer,
} from "@qforge/torque-eval";
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Absolute scoring (single dataset)
const absolute = await scoreDataset({
  dataset: "data/generated-conversations.jsonl",
  sampleSize: 25,
  seed: 42,
  judgeModel: openai("gpt-4o-mini"), // LanguageModel instance
});

// Pairwise comparison
const renderer = new PairwiseEvaluationRenderer();
const pairwise = await compareDatasets({
  datasets: {
    control: "data/model-a-run.jsonl",
    variant: "data/model-b-run.jsonl",
  },
  sampleSize: 40,
  seed: 7,
  judgeModel: openai("gpt-4o-mini"),
  concurrency: 5,
  progressRenderer: renderer,
  outputPath: "data/pairwise-report.json",
});

// Prefer a custom flow? Provide your own `(prompt) => Promise<string>` instead.
```

Both helpers automatically:

- Load `.json`, `.jsonl`, or `.parquet` Torque exports (or accept an in-memory `IDatasetRow[]`)
- Sample the requested number of rows with an optional deterministic seed
- Build a rich prompt that includes schema metadata and the message transcript
- Parse the judge JSON response and aggregate totals

## API

### `scoreDataset(options)`

| Option | Description |
| ------ | ----------- |
| `dataset` | File path or `IDatasetRow[]`. |
| `sampleSize` | Number of rows to judge (>=1). |
| `seed` | Optional deterministic seed for sampling. |
| `judgeModel` | ai-sdk `LanguageModel` (e.g., `openai("gpt-4o-mini")`) or `(prompt: string) => Promise<string>` returning JSON. |
| `instructions` | Optional extra guidance appended to the default rubric. |
| `rowIdExtractor` | Optional `(row) => string` used for reporting IDs. |

Returns `{ samples, averages }` where each sample exposes the raw prompt/response plus parsed `quality`, `coherence`, `adherence`, and `notes`.

### `compareDatasets(options)`

Provide `datasets` as either an object (`{ control: datasetA, variant: datasetB, ... }`) or an array of `{ id, dataset }`. Add `concurrency` to cap simultaneous judge calls (defaults to `1`). Rows are paired per dataset combination using their metadata IDs (or a custom `rowIdExtractor`). The result contains:

- `comparisons`: every per-row decision and the underlying prompts/responses.
- `pairs`: aggregate wins/ties for each dataset pair.
- `leaderboard`: Elo-style ratings (`initialRating=1500`, `kFactor=32` by default) summarizing wins/losses/ties across the whole tournament.
- `sampleSize` is applied per dataset pair. When you resume from a previous run we only schedule the additional row IDs needed to reach that count, so storing past results keeps existing pairings intact.

Optional helpers:

- `showProgress: true` or a custom `progressRenderer` (e.g., `PairwiseEvaluationRenderer`) to render a live dashboard with in-flight counts plus running A/B/tie tallies and a celebratory summary.
- `onProgress(progress)` for custom integrations/metrics.
- `outputPath` to persist the entire result object as prettified JSON.
- `resumeFrom` to load a previous JSON result file. Already-resolved row IDs are reused so you can add new datasets or top up the sample size without rerunning older matches. Combine with `outputPath` (or omit it to overwrite the same file) for incremental runs.
- `initialComparisons` if you want to seed the Elo leaderboard with comparisons you've already computed in memory.
- `elo` to tweak `initialRating` or `kFactor`.

## Customizing prompts

If you need additional rules, pass an `instructions` string. It gets appended to the stock rubric so you can add e.g. “Prefer concise answers under 3 sentences” without maintaining a big prompt template. For deeper changes you can import `buildSinglePrompt` / `buildPairPrompt` and craft your own strings.

## Sampling control

Sampling uses a deterministic shuffle (Mulberry32). Provide the same `seed` to reuse the exact examples across runs. To override how IDs are derived (e.g., if you store the identifier on a different metadata key), provide `rowIdExtractor`.
