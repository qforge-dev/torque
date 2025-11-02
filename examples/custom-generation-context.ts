/**
 * Custom Generation Context Example
 *
 * This example shows how to customize the AI generation behavior
 * with global, user, and assistant-specific instructions.
 */

import {
  generateDataset,
  generatedUser,
  generatedAssistant,
  // times,
  // between,
} from "@qforge/torque";
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
    generatedUser({ prompt: "Technical question about programming" }),
    generatedAssistant({
      prompt: "Provide detailed answer with code examples",
    }),
  ],
  {
    count: 5,
    model: openai("gpt-5-mini"),
    output: "data/custom-context-roles.jsonl",
    seed: 100,
    generationContext: {
      global: {
        messages: [
          {
            role: "system",
            content: "Keep all messages professional and informative.",
          },
        ],
      },
      user: {
        messages: [
          {
            role: "system",
            content:
              "Generate diverse user messages with varying levels of technical detail.",
          },
        ],
      },
      assistant: {
        messages: [
          {
            role: "system",
            content:
              "Assistant should be helpful but concise. Use 2-3 sentences max.",
          },
        ],
      },
    },
  }
);
/*
Variations:
  - Casual tone: change the global message to "Keep the tone casual and friendly. Use contractions and keep responses short."
  - Quick follow-ups: swap the user message for "Respond with quick, high-level follow-up questions only."
  - Friendly assistant: replace the assistant message with "Be warm and personable. Use emojis occasionally. Keep responses brief."
*/
