# @qforge/torque Agent Guide

## Product Surface

- Declarative DSL for composing LLM datasets (messages, tools, metadata) with deterministic RNG helpers.
- Shipping artifacts: `dist/` bundle, README examples, StackBlitz templates under `stackblitz-templates/`.
- Consumers rely on stable builder APIs (`generatedUser`, `oneOf`, `times`, `metadata`, schema helpers) and Bun-friendly ESM output.

## Code Map

- `src/generators.ts`, `schema.ts`, `schema-rng.ts`: core composition primitives and RNG utilities.
- `src/faker.ts`, `src/seed.ts`, `src/utils.ts`: deterministic seeding & Faker wiring.
- `src/writer.ts`, `src/dataset.ts`, `src/cli-renderer.ts`, `src/formatter.ts`: dataset materialization, formatters, Parquet/JSONL writers, CLI UX.
- Tests co-located in `src/*.test.ts` using `bun:test`; keep new tests near the code they cover.

## Implementation Guardrails

1. **Determinism first** – Always thread `seed` + `withSeed` helpers through new flows; never call `Math.random` or instantiate Faker ad-hoc.
2. **Immutable schemas** – Treat schema objects as frozen after the `check` phase; copy before mutating and respect `phase` on `IMessageSchemaContext`.
3. **Types are the contract** – Update `src/types.ts` alongside behavior changes and re-run `tsc -p tsconfig.build.json`.
4. **Error messaging** – Use descriptive errors (see `schema.ts` for tone) and prefer `ZodError`-style aggregates when validating user structures.
5. **CLI/story templates** – If a change affects example output, refresh snippets in the README and regenerate StackBlitz templates (`bun run generate:templates`).

## Testing & Verification

- Unit tests: `bun test packages/torque/src` (Bun discovers `*.test.ts`).
- Type check + build: `bun run --filter @qforge/torque build`.
- For RNG-sensitive code, add golden tests that fix a seed and assert exact arrays/messages.
- When exercising `ai`-dependent helpers (see https://ai-sdk.dev/docs/ai-sdk-core/testing), stub providers with `MockLanguageModelV2` from `ai/test` so Bun tests stay offline:

```ts
import { MockLanguageModelV2 } from "ai/test";

const mockModel = new MockLanguageModelV2({
  doGenerate: async () => ({
    content: [{ type: "text", text: "stubbed completion" }],
    finishReason: "stop",
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    warnings: [],
  }),
});
```

- Document manual verification steps (e.g., running `examples/*.ts`) when automated tests are insufficient.

## When to Loop In a Human

- Introducing new public builder APIs or altering existing function signatures.
- Changes that risk breaking template compatibility, dataset schemas, or CLI output formats.
- Work that requires new dependencies, native bindings, or non-Bun tooling.

## Definition of Done

- Code is deterministic, typed, and tested.
- README + templates reflect surface changes.
- `dist/` is regenerated only during release—do not commit build artifacts.
- Summary includes seeds/examples used to validate behavior.
