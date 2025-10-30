/**
 * Basic Conversation Example
 *
 * This example shows how to create simple back-and-forth conversations
 * with both static and AI-generated content.
 */

import {
  generateDataset,
  user,
  assistant,
  generatedUser,
  generatedAssistant,
} from "@qforge/torque";
import { createOpenAI } from "@ai-sdk/openai";

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

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Example 1: Static Conversations
await generateDataset(
  () => [
    user({ content: "Hello! I need help with TypeScript." }),
    assistant({
      content:
        "I'd be happy to help with TypeScript! What specific topic would you like to learn about?",
    }),
    user({ content: "How do I use generics?" }),
    assistant({
      content:
        "Generics allow you to create reusable components that work with multiple types. Here's a simple example: `function identity<T>(arg: T): T { return arg; }`",
    }),
  ],
  {
    count: 10,
    model: openai("gpt-5-mini"),
    output: "data/static-conversations.jsonl",
    seed: 42,
  }
);

// Example 2: AI-Generated Conversations
await generateDataset(
  () => [
    generatedUser({
      prompt:
        "User asks a programming question about any language or framework",
    }),
    generatedAssistant({
      prompt:
        "Assistant provides a helpful, detailed answer with code examples",
    }),
    generatedUser({
      prompt: "User asks a follow-up question to clarify or dive deeper",
    }),
    generatedAssistant({
      prompt: "Assistant provides additional details and examples",
    }),
  ],
  {
    count: 50,
    model: openai("gpt-5-mini"),
    output: "data/generated-conversations.jsonl",
    seed: 42,
    generationContext: {
      global: {
        messages: [
          {
            role: "system",
            content:
              "Keep responses clear and concise. Use practical examples. Avoid overly formal language.",
          },
        ],
      },
    },
  }
);
