/**
 * Quick Start Example
 *
 * This is the simplest example to get started with Torque.
 * Demonstrates AI-generated user messages with static/generated assistant responses.
 */

import {
  generateDataset,
  generatedUser,
  assistant,
  generatedAssistant,
  oneOf,
} from "@qforge/torque";
import { openai } from "@ai-sdk/openai";

await generateDataset(
  () => [
    generatedUser({ prompt: "Friendly greeting or introduction" }), // AI generated
    oneOf([
      // pick one randomly
      assistant({ content: "Hello!" }), // static
      generatedAssistant({ prompt: "Respond to greeting" }), // AI generated
    ]),
  ],
  {
    count: 2, // number of examples
    model: openai("gpt-5-mini"), // any ai-sdk model
    seed: 42, // replayable RNG
    output: "data/quick-start.jsonl",
  }
);
