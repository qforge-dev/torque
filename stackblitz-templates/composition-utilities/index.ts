/**
 * Composition Utilities Example - Torque Interactive Playground
 * 
 * This example demonstrates:
 * - oneOf - Random selection from options
 * - times - Repeat patterns
 * - between - Variable repetition
 * - optional - 50% chance inclusion
 * 
 * 🔑 BEFORE RUNNING:
 * 1. Click on the 🔒 icon in the bottom left
 * 2. Add environment variable: OPENAI_API_KEY=your-key-here
 * 3. Click "Run" or press Ctrl+Enter
 */

import {
  generateDataset,
  user,
  assistant,
  generatedUser,
  generatedAssistant,
  oneOf,
  times,
  between,
  optional,
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

// Example: Combining all utilities
await generateDataset(
  () => [
    // Random greeting
    oneOf([
      user({ content: "Hello" }),
      user({ content: "Hi" }),
      user({ content: "Hey there" }),
    ]),
    assistant({ content: "Hello! How can I assist you?" }),

    // Variable number of Q&A exchanges (2-4 times)
    ...times(between(2, 4), [
      generatedUser({ prompt: "Ask a question about programming" }),
      generatedAssistant({
        prompt: "Provide a helpful answer with code examples",
      }),
    ]),

    // Optional closing (50% chance)
    optional(user({ content: "Thank you!" })),
    optional(
      assistant({ content: "You're welcome! Feel free to ask anytime." })
    ),
  ],
  {
    count: 5,
    model: openai("gpt-4o-mini", { apiKey }),
    output: "data/combined-utilities.jsonl",
    seed: 400,
  }
);

console.log("\n✨ Dataset generation complete!");
console.log("📁 Check the 'data/combined-utilities.jsonl' file");
console.log("\n💡 Notice how each conversation varies:");
console.log("   - Different greetings (oneOf)");
console.log("   - Different number of Q&As (between 2-4)");
console.log("   - Some have closing messages, some don't (optional)");

