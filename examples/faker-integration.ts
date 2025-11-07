/**
 * Faker Integration Example
 *
 * This example demonstrates how to use faker.js for generating realistic fake data
 * that automatically respects the seed system for reproducible datasets.
 *
 * Faker is useful for:
 * - Creating realistic user personas with names, emails, addresses
 * - Generating sample data for testing (product names, prices, dates)
 * - Adding variety to prompts without manually writing examples
 */

import {
  generateDataset,
  generatedUser,
  generatedAssistant,
  faker,
  // times,
  // between,
} from "@qforge/torque";
// Uncomment times/between above when experimenting with multi-turn variations.
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

// Generate conversations with realistic user profiles.
await generateDataset(
  () => [
    generatedUser({
      prompt: `Introduce yourself as ${faker.person.fullName()} from ${faker.location.city()}, ${faker.location.country()}. Mention your job as a ${faker.person.jobTitle()}.`,
    }),
    generatedAssistant({
      prompt: "Warmly greet the user and acknowledge their introduction",
    }),
    /*
    Alternate prompt ideas:
      - Product Q&A:
          faker.commerce.productName(), faker.commerce.price({ symbol: "$" })
      - Support triage:
          faker.helpers.arrayElement(["account login", "billing", "technical issue", "feature request"]),
          faker.internet.email(),
          faker.string.alphanumeric(10)
      - Appointment request:
          faker.date.future().toLocaleDateString(), faker.date.future().toLocaleTimeString(), faker.phone.number()

    For longer flows, reintroduce additional turns such as:
      generatedUser({ prompt: `Ask to ship it to ${faker.location.streetAddress()}, ${faker.location.city()}` }),
      generatedAssistant({ prompt: "Confirm the shipping address and provide next steps" }),
      // times(between(1, 3), [...]) // requires uncommenting the helpers at the top
    */
  ],
  {
    count: 5,
    model: openai("gpt-5-mini"),
    output: "data/faker-personas.jsonl",
    seed: 42, // Same seed = same names/cities every time
    // Swap the trio above for data/faker-ecommerce.jsonl (count: 15, seed: 100),
    // data/faker-support.jsonl (count: 20, seed: 200), or
    // data/faker-appointments.jsonl (count: 12, seed: 300).
  }
);

console.log("\n✅ Faker integration examples generated!");
console.log(
  "💡 Run with the same seeds to get identical fake data across runs"
);
console.log("📚 Explore more faker methods at: https://fakerjs.dev/");
