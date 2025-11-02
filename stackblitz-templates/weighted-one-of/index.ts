/**
 * Weighted oneOf Example
 *
 * Demonstrates mixing explicit weights and automatically distributed weights
 * when selecting between schema branches.
 */

import {
  generateDataset,
  generatedAssistant,
  generatedUser,
  oneOf,
} from "@qforge/torque";
import type { IMessageSchema } from "@qforge/torque";
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

const weightedRecommendation = () => [
  generatedUser({
    prompt:
      "Ask for a weekend getaway recommendation highlighting preferences.",
  }),

  // The first option gets an explicit 0.3 weight.
  // The remaining 0.7 is split equally between the other two options (0.35 each).
  oneOf<IMessageSchema>([
    {
      value: generatedAssistant({
        prompt:
          "Suggest a relaxing beach weekend with lodging, food, and activity ideas.",
      }),
      weight: 0.3,
    },
    generatedAssistant({
      prompt:
        "Pitch a city break itinerary with cultural highlights and a dinner suggestion.",
    }),
    generatedAssistant({
      prompt:
        "Outline an outdoor adventure with hiking plans and gear recommendations.",
    }),
  ]),
];

const weightedFollowUp = () => [
  generatedUser({
    prompt:
      "Ask a follow-up question based on the earlier recommendation (budget, timing, or logistics).",
  }),

  // Mixing multiple weighted and unweighted options.
  oneOf<IMessageSchema>([
    {
      value: generatedAssistant({
        prompt:
          "Clarify travel logistics and provide concrete next steps for booking.",
      }),
      weight: 0.4,
    },
    {
      value: generatedAssistant({
        prompt:
          "Offer budget-friendly alternatives while keeping the original theme intact.",
      }),
      weight: 0.2,
    },
    // unweighted option gets 0.4 remaining weight
    generatedAssistant({
      prompt:
        "Recommend optional add-ons or upgrades that enhance the overall experience.",
    }),
  ]),
];

await generateDataset(
  () => [...weightedRecommendation(), ...weightedFollowUp()],
  {
    count: 5,
    model: openai("gpt-5-mini"),
    output: "data/weighted-one-of.jsonl",
    seed: 512,
  }
);
