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
const outputPath = path.join(process.cwd(), "pairwise-results.json");

const pairwise = await compareDatasets({
  datasetA: "/Users/michalwarda/Projects/torque/data/ds1.jsonl",
  datasetB: "/Users/michalwarda/Projects/torque/data/ds2.jsonl",
  sampleSize: 5,
  seed: 7,
  judgeModel: openai("gpt-5-mini"),
  concurrency: 5,
  progressRenderer: renderer,
  outputPath,
});

console.log();
console.log(
  `Preferred outcome: ${
    pairwise.preferred === "tie" ? "tie" : `dataset ${pairwise.preferred}`
  }`
);
console.log(`Detailed comparison saved to ${outputPath}`);
