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
import { scoreDataset, compareDatasets } from "@qforge/torque-eval";
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
const pairwise = await compareDatasets({
  datasetA: "data/model-a-run.jsonl",
  datasetB: "data/model-b-run.jsonl",
  sampleSize: 40,
  seed: 7,
  judgeModel: openai("gpt-4o-mini"),
  concurrency: 5,
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

Same options as `scoreDataset`, but you pass both `datasetA` and `datasetB`. Add `concurrency` to limit how many pairwise comparisons run in parallel (defaults to `1`). Rows are paired by `meta.metadata.id` (falls back to the seed or a custom extractor). Returns `{ comparisons, totals, preferred }` where `totals` contains `{ A, B, tie }`.

## Customizing prompts

If you need additional rules, pass an `instructions` string. It gets appended to the stock rubric so you can add e.g. “Prefer concise answers under 3 sentences” without maintaining a big prompt template. For deeper changes you can import `buildSinglePrompt` / `buildPairPrompt` and craft your own strings.

## Sampling control

Sampling uses a deterministic shuffle (Mulberry32). Provide the same `seed` to reuse the exact examples across runs. To override how IDs are derived (e.g., if you store the identifier on a different metadata key), provide `rowIdExtractor`.
