import { compareDatasets } from "./src/evaluator";
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

const pairwise = await compareDatasets({
  datasetA: "/Users/michalwarda/Projects/torque/data/ds1.jsonl",
  datasetB: "/Users/michalwarda/Projects/torque/data/ds2.jsonl",
  sampleSize: 5,
  seed: 7,
  judgeModel: openai("gpt-4.1-mini"),
});

console.dir(pairwise, { depth: null });
