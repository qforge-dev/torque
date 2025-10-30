/**
 * Schema Composition Example
 *
 * This example shows how to compose reusable schema patterns
 * to build complex conversations from smaller building blocks.
 */

import {
  generateDataset,
  user,
  assistant,
  system,
  generatedUser,
  generatedAssistant,
  oneOf,
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

// Reusable greeting pattern
const greeting = () => [
  system({ content: "You are a helpful assistant." }),
  user({ content: "Hello!" }),
  assistant({ content: "Hi! How can I help?" }),
];

// Example 1: Extend a base schema
await generateDataset(
  () => [
    ...greeting(),
    user({ content: "What's the weather like?" }),
    assistant({ content: "I'd be happy to check that for you!" }),
  ],
  {
    count: 5,
    model: openai("gpt-4o-mini", { apiKey }),
    output: "data/extended-greeting.jsonl",
    seed: 42,
  }
);

// Example 2: Create variations with oneOf
const formalGreeting = () => [
  system({ content: "You are a professional assistant." }),
  user({ content: "Good morning." }),
  assistant({ content: "Good morning. How may I assist you today?" }),
];

await generateDataset(
  () => [
    oneOf([greeting, formalGreeting]),
    // Continue with shared conversation flow
    generatedUser({ prompt: "Ask a question" }),
    generatedAssistant({ prompt: "Provide helpful answer" }),
  ],
  {
    count: 10,
    model: openai("gpt-4o-mini", { apiKey }),
    output: "data/varied-greetings.jsonl",
    seed: 100,
  }
);

// Example 3: Build a library of reusable patterns
const techSupportIntro = () => [
  system({ content: "You are a technical support assistant." }),
  user({ content: "I'm having a problem with my device." }),
  assistant({ content: "I'm here to help. Can you describe the issue?" }),
];

const salesIntro = () => [
  system({ content: "You are a friendly sales assistant." }),
  user({ content: "I'm interested in your product." }),
  assistant({ content: "Great! I'd love to tell you more about it." }),
];

await generateDataset(
  () => [
    // Randomly select conversation type
    oneOf([greeting, techSupportIntro, salesIntro]),
    // Dynamic follow-up based on AI generation
    generatedUser({ prompt: "Continue the conversation naturally" }),
    generatedAssistant({ prompt: "Respond helpfully in character" }),
  ],
  {
    count: 15,
    model: openai("gpt-4o-mini", { apiKey }),
    output: "data/composed-patterns.jsonl",
    seed: 200,
  }
);
