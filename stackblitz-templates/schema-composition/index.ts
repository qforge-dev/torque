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

// Reusable greeting pattern
const greeting = () => [
  system({ content: "You are a helpful assistant." }),
  user({ content: "Hello!" }),
  assistant({ content: "Hi! How can I help?" }),
];

const formalGreeting = () => [
  system({ content: "You are a professional assistant." }),
  user({ content: "Good morning." }),
  assistant({ content: "Good morning. How may I assist you today?" }),
];

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
    /*
    Tweaks:
      - Add the formalGreeting option by expanding the oneOf call above.
      - Force a specific intro with `...greeting()` in place of oneOf.
      - Append extra scripted turns after the assistant line for wrap-up messaging.
    */
  ],
  {
    count: 5,
    model: openai("gpt-5-mini"),
    output: "data/composed-patterns.jsonl",
    seed: 200,
  }
);
