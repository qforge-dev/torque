/**
 * Custom Generation Context Example - Torque Interactive Playground
 * 
 * This example demonstrates:
 * - Global generation context (applies to all messages)
 * - Role-specific context (user vs assistant)
 * - Style customization
 * 
 * Use generation context to control AI behavior and style.
 * 
 * 🔑 BEFORE RUNNING:
 * 1. Click on the 🔒 icon in the bottom left
 * 2. Add environment variable: OPENAI_API_KEY=your-key-here
 * 3. Click "Run" or press Ctrl+Enter
 */

import {
  generateDataset,
  generatedUser,
  generatedAssistant,
  times,
  between,
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

// Example with custom generation context
await generateDataset(
  () => [
    generatedUser({ prompt: "Technical question about programming" }),
    generatedAssistant({
      prompt: "Provide detailed answer with code examples",
    }),
    ...times(between(1, 2), [
      generatedUser({ prompt: "Follow-up question" }),
      generatedAssistant({ prompt: "Provide additional details" }),
    ]),
  ],
  {
    count: 5,
    model: openai("gpt-4o-mini", { apiKey }),
    output: "data/custom-context.jsonl",
    seed: 100,
    generationContext: {
      // Applies to all generated messages
      global: {
        messages: [
          {
            role: "system",
            content: 'Keep messages concise. Avoid starting with "Sure" or "Thanks".',
          },
        ],
      },
      // User-specific instructions
      user: {
        messages: [
          {
            role: "system",
            content:
              "Generate diverse user messages with varying levels of technical detail.",
          },
        ],
      },
      // Assistant-specific instructions
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

console.log("\n✨ Dataset generation complete!");
console.log("📁 Check the 'data/custom-context.jsonl' file");
console.log("\n💡 Notice how generation context controls:");
console.log("   - Message style and tone");
console.log("   - Length and verbosity");
console.log("   - User vs assistant behavior");

