# Torque Repository Agent Guide

## Mission & Scope
- Keep the Torque monorepo healthy: the core DSL (`packages/torque`), evaluation helpers (`packages/torque-eval`), shared scripts, and StackBlitz templates.
- Prefer small, reviewable changes; surface architectural or product questions early.
- Preserve type safety, deterministic generation, and reproducibility across every package.

## Context Map
- `packages/torque`: declarative DSL for assembling synthetic LLM datasets (schemas, generators, RNG helpers, CLI renderer).
- `packages/torque-eval`: dataset scoring + pairwise comparison utilities built on top of Torque exports.
- `scripts/generate-stackblitz-templates.ts` and `stackblitz-templates/*`: browser playgrounds that must stay in sync with published APIs.
- Shared data lives in `data/` and examples in `examples/`; keep them lightweight and anonymized.

## Ways of Working
1. **Clarify intent** – Restate requirements, note assumptions, and point to the relevant files or docs before modifying code.
2. **Design in the open** – For behavioral shifts or new public APIs, outline the approach (data flow, error handling, backward compatibility) before implementing.
3. **Bias toward composability** – Reuse existing helpers (e.g., `withSeed`, schema builders, loader utilities) instead of duplicating logic.
4. **Document as you go** – Update README snippets, StackBlitz templates, or inline JSDoc when APIs change.
5. **Validate determinism** – Any change touching randomness, caching, or streaming must explain how determinism and reproducibility are preserved.

## Tooling & Commands
- Install deps with `bun install` (Node 18+). Keep `bun.lock` consistent.
- Linting is enforced via TypeScript; run targeted builds instead of ad-hoc scripts.
- Useful commands:
  - `bun run --filter @qforge/torque build`
  - `bun run --filter @qforge/torque-eval build`
  - `bun test` (or `bun test packages/<pkg>` for targeted suites)
  - `bun run scripts/generate-stackblitz-templates.ts`
- Prefer Bun-native test utilities (`bun:test`). Do not introduce new test runners without discussion.

## AI SDK Testing
- Follow the AI SDK testing guide (https://ai-sdk.dev/docs/ai-sdk-core/testing) whenever a test depends on `generateText` or other `ai` helpers—keep network calls out of CI.
- Use the mocks re-exported from `ai/test` to stand up deterministic providers; they expose call logs (`mock.doGenerateCalls`) so you can assert prompts without patching global state.
- Example for a language-model dependency:

```ts
import { MockLanguageModelV2 } from "ai/test";
import { scoreDataset } from "@qforge/torque-eval";

const mockJudge = new MockLanguageModelV2({
  doGenerate: async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify({
          quality: 10,
          coherence: 9,
          adherence: 9,
          notes: "passes rubric",
        }),
      },
    ],
    finishReason: "stop",
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    warnings: [],
  }),
});

await scoreDataset({
  dataset,
  sampleSize: 1,
  judgeModel: mockJudge, // behaves like a LanguageModel from ai-sdk
});
```

- Prefer feeding helpers/functions (e.g., pass `async (prompt) => JSON.stringify({...})`) only for ultra-light tests; `MockLanguageModelV2` (and its streaming sibling) gives better parity with production code.

## Quality Bar
- Every change must include automated coverage or a justification for gaps.
- Keep prompts, instructions, and fixtures free of secrets or user data.
- Large data files (>1MB) should live in `data/` and be gitignored if generated.
- Public APIs require changelog/README updates and migrate notes if breaking.

## When to Escalate to a Human
- You need new third-party services, paid APIs, or environment variables.
- A change could break template backwards compatibility or published npm contracts.
- A deterministic behavior (RNG, sampling, caching) must change.
- Security/privacy concerns, or when unsure how to anonymize sample data.

## Deliverables Checklist
- [ ] Code + tests pass via Bun
- [ ] Docs/templates reflect the change
- [ ] Repro steps and verification commands included in PR/summary
- [ ] Todo / follow-up issues opened if scope is split
