/**
 * Quick Start Example
 *
 * This is the simplest example to get started with Torque.
 * Demonstrates AI-generated user messages with static/generated assistant responses.
 */

import {
  generateDataset,
  generatedUser,
  assistant,
  generatedAssistant,
  oneOf,
} from "@qforge/torque";
import { openai } from "@ai-sdk/openai";

// Get API key from environment variable
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error("❌ ERROR: OPENAI_API_KEY not found!");
  console.log("\n📝 To add your API key:");
  console.log("1. Click the 🔒 icon in the bottom left corner");
  console.log("2. Add: OPENAI_API_KEY=your-key-here");
  console.log("3. Run this script again\n");
  process.exit(1);
}

console.log("✅ API key loaded successfully!");
console.log("🚀 Starting dataset generation...\n");

await generateDataset(
  () => [
    generatedUser({ prompt: "Friendly greeting or introduction" }), // AI generated
    oneOf([
      // pick one randomly
      assistant({ content: "Hello!" }), // static
      generatedAssistant({ prompt: "Respond to greeting" }), // AI generated
    ]),
  ],
  {
    count: 2, // number of examples
    model: openai("gpt-4o-mini", { apiKey }), // any ai-sdk model
    seed: 42, // replayable RNG
    output: "data/quick-start.jsonl",
  }
);
