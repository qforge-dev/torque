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

// Example 1: oneOf - Random selection
await generateDataset(
  () => [
    // Choose randomly from options
    oneOf([
      user({ content: "Hello" }),
      user({ content: "Hi there" }),
      user({ content: "Hey" }),
    ]),
    assistant({ content: "Hi! How can I help you today?" }),
  ],
  {
    count: 10,
    model: openai("gpt-5-mini"),
    output: "data/one-of-example.jsonl",
    seed: 42,
  }
);

// Example 2: times - Repeat pattern
await generateDataset(
  () => [
    user({ content: "I have several questions." }),
    assistant({ content: "Sure, go ahead!" }),

    // Repeat pattern 3 times
    ...times(3, [
      generatedUser({ prompt: "Ask a question" }),
      generatedAssistant({ prompt: "Answer the question" }),
    ]),
  ],
  {
    count: 5,
    model: openai("gpt-5-mini"),
    output: "data/times-example.jsonl",
    seed: 100,
  }
);

// Example 3: between - Variable repetition
await generateDataset(
  () => [
    user({ content: "Let's have a conversation." }),
    assistant({ content: "I'd be happy to chat!" }),

    // Repeat random number of times (1-5)
    ...times(between(1, 5), [generatedUser({ prompt: "Follow-up question" })]),
  ],
  {
    count: 10,
    model: openai("gpt-5-mini"),
    output: "data/between-example.jsonl",
    seed: 200,
  }
);

// Example 4: optional - 50% chance
await generateDataset(
  () => [
    user({ content: "Thanks for your help!" }),
    assistant({ content: "You're welcome!" }),

    // Optionally include (50% chance)
    optional(assistant({ content: "Anything else I can help with?" })),
  ],
  {
    count: 10,
    model: openai("gpt-5-mini"),
    output: "data/optional-example.jsonl",
    seed: 300,
  }
);

// Example 5: Combining all utilities
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
    ...times(between(2, 4), [
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
  ],
  {
    count: 20,
    model: openai("gpt-5-mini"),
    output: "data/combined-utilities.jsonl",
    seed: 400,
  }
);
