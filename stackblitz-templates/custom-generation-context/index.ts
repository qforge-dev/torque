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

// Example 1: Global generation context
await generateDataset(
  () => [
    generatedUser({ prompt: "Greeting" }),
    generatedAssistant({ prompt: "Respond to greeting" }),
    ...times(between(2, 4), [
      generatedUser({ prompt: "Ask a question" }),
      generatedAssistant({ prompt: "Answer the question" }),
    ]),
  ],
  {
    count: 10,
    model: openai("gpt-4o-mini", { apiKey }),
    output: "data/custom-context-global.jsonl",
    seed: 42,
    generationContext: {
      global: {
        messages: [
          {
            role: "system",
            content:
              'Keep messages concise and natural. Avoid starting with "Sure" or "Thanks".',
          },
        ],
      },
    },
  }
);

// Example 2: Role-specific generation context
await generateDataset(
  () => [
    generatedUser({ prompt: "Technical question about programming" }),
    generatedAssistant({
      prompt: "Provide detailed answer with code examples",
    }),
  ],
  {
    count: 20,
    model: openai("gpt-4o-mini", { apiKey }),
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

// Example 3: Style-specific customization
await generateDataset(
  () => [
    generatedUser({ prompt: "Casual conversation starter" }),
    generatedAssistant({ prompt: "Respond in a friendly, casual way" }),
    ...times(3, [
      generatedUser({ prompt: "Continue casual conversation" }),
      generatedAssistant({ prompt: "Keep the tone light and friendly" }),
    ]),
  ],
  {
    count: 15,
    model: openai("gpt-4o-mini", { apiKey }),
    output: "data/custom-context-casual.jsonl",
    seed: 200,
    generationContext: {
      global: {
        messages: [
          {
            role: "system",
            content:
              "Keep the tone casual and friendly. Use contractions and informal language. Avoid corporate speak.",
          },
        ],
      },
      user: {
        messages: [
          {
            role: "system",
            content:
              "User messages should sound natural and conversational, like texting a friend.",
          },
        ],
      },
      assistant: {
        messages: [
          {
            role: "system",
            content:
              "Be warm and personable. Use emojis occasionally. Keep responses brief.",
          },
        ],
      },
    },
  }
);
