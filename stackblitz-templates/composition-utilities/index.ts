/**
 * Composition Utilities Example
 *
 * This example demonstrates all the composition helpers:
 * oneOf, times, between, and optional
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
import type { IMessageSchemaGroup } from "@qforge/torque";
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

const openai = createOpenAI({
  apiKey,
});

await generateDataset(
  () => [
    // Random greeting
    oneOf([
      user({ content: "Hello" }),
      user({ content: "Hi" }),
      user({ content: "Hey there" }),
    ]),
    assistant({ content: "Hello! How can I assist you?" }),

    // Variable number of Q&A exchanges
    times(between(2, 4), [
      generatedUser({ prompt: "Ask a question about programming" }),
      generatedAssistant({
        prompt: "Provide a helpful answer with code examples",
      }),
    ]),

    // Optional closing
    optional(user({ content: "Thank you!" })),
    optional(
      assistant({ content: "You're welcome! Feel free to ask anytime." })
    ),
    /*
      Variations:
        - Swap in user({ content: "Hello" }) above for a deterministic opening.
        - Replace the times(between(...)) block with `times(3, [...])` to fix the length.
        - Keep only the optional(...) lines to spotlight optional() on its own.
      */
  ],
  {
    count: 5,
    model: openai("gpt-5-mini"),
    output: "data/combined-utilities.jsonl",
    seed: 400,
  }
);
