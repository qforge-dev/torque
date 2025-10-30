/**
 * Schema Composition Example - Torque Interactive Playground
 * 
 * This example demonstrates:
 * - Building reusable schema patterns
 * - Composing schemas with the spread operator
 * - Creating variations with oneOf
 * - Building component libraries
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
  system,
  generatedUser,
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

// Reusable greeting pattern
const greeting = () => [
  system({ content: "You are a helpful assistant." }),
  user({ content: "Hello!" }),
  assistant({ content: "Hi! How can I help?" }),
];

// Formal greeting variation
const formalGreeting = () => [
  system({ content: "You are a professional assistant." }),
  user({ content: "Good morning." }),
  assistant({ content: "Good morning. How may I assist you today?" }),
];

// Tech support intro
const techSupportIntro = () => [
  system({ content: "You are a technical support assistant." }),
  user({ content: "I'm having a problem with my device." }),
  assistant({ content: "I'm here to help. Can you describe the issue?" }),
];

// Sales intro
const salesIntro = () => [
  system({ content: "You are a friendly sales assistant." }),
  user({ content: "I'm interested in your product." }),
  assistant({ content: "Great! I'd love to tell you more about it." }),
];

// Generate dataset with composed patterns
await generateDataset(
  () => [
    // Randomly select conversation type
    oneOf([greeting, formalGreeting, techSupportIntro, salesIntro]),
    // Dynamic follow-up based on AI generation
    generatedUser({ prompt: "Continue the conversation naturally" }),
    generatedAssistant({ prompt: "Respond helpfully in character" }),
  ],
  {
    count: 10,
    model: openai("gpt-4o-mini", { apiKey }),
    output: "data/composed-patterns.jsonl",
    seed: 200,
  }
);

console.log("\n✨ Dataset generation complete!");
console.log("📁 Check the 'data/composed-patterns.jsonl' file");
console.log("\n💡 Each conversation starts with a different intro pattern!");

