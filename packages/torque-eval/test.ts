import path from "node:path";
import { compareDatasets } from "./src/evaluator";
import { PairwiseEvaluationRenderer } from "./src/evaluation-renderer";
import { createOpenAI } from "@ai-sdk/openai";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error("❌ ERROR: OPENAI_API_KEY not found!");
  console.log("\n📝 To add your API key:");
  console.log(
    "1. Add: OPENAI_API_KEY=your-key-here or change the apiKey variable above."
  );
  console.log("2. Run this script again\n");
  process.exit(1);
}

const openai = createOpenAI({ apiKey });
const renderer = new PairwiseEvaluationRenderer();
const outputPath = path.join(process.cwd(), "pairwise-results-5.json");

const pairwise = await compareDatasets({
  datasets: {
    "gpt-5": "/Users/michalwarda/Projects/torque/data/ds1.jsonl",
    "gpt-5-mini": "/Users/michalwarda/Projects/torque/data/ds2.jsonl",
    "grok-code-fast-1": "/Users/michalwarda/Projects/torque/data/ds3.jsonl",
    "gemini-2.5-flash-lite":
      "/Users/michalwarda/Projects/torque/data/ds4.jsonl",
    "gemini-2.5-flash": "/Users/michalwarda/Projects/torque/data/ds5.jsonl",
    "minimax-m2": "/Users/michalwarda/Projects/torque/data/ds6.jsonl",
  },
  sampleSize: 20,
  seed: 7,
  judgeModel: openai("gpt-5-mini"),
  concurrency: 20,
  progressRenderer: renderer,
  outputPath,
});

const leader = pairwise.leaderboard[0];
if (leader) {
  console.log(
    `Top dataset: ${leader.datasetId} (rating ${leader.rating.toFixed(1)}, W:${
      leader.wins
    } L:${leader.losses} T:${leader.ties})`
  );
} else {
  console.log("No comparisons were executed.");
}
console.log(`Judge model: ${pairwise.judgeModelId ?? "unknown judge model"}`);
console.log(`Detailed comparison saved to ${outputPath}`);
