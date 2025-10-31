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
  oneOf,
  times,
  between,
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

// Example 1: User Personas with Faker
// Generate conversations with realistic user profiles
await generateDataset(
  () => [
    generatedUser({
      prompt: `Introduce yourself as ${faker.person.fullName()} from ${faker.location.city()}, ${faker.location.country()}. Mention your job as a ${faker.person.jobTitle()}.`,
    }),
    generatedAssistant({
      prompt: "Warmly greet the user and acknowledge their introduction",
    }),
  ],
  {
    count: 10,
    model: openai("gpt-5-mini"),
    output: "data/faker-personas.jsonl",
    seed: 42, // Same seed = same names/cities every time
  }
);

// Example 2: E-commerce Conversations
// Use faker to generate product-related conversations
await generateDataset(
  () => [
    generatedUser({
      prompt: `Ask about a product: ${faker.commerce.productName()} priced at ${faker.commerce.price({ symbol: "$" })}`,
    }),
    generatedAssistant({
      prompt: "Provide helpful information about the product",
    }),
    generatedUser({
      prompt: `Ask to ship it to ${faker.location.streetAddress()}, ${faker.location.city()}`,
    }),
    generatedAssistant({
      prompt: "Confirm the shipping address and provide next steps",
    }),
  ],
  {
    count: 15,
    model: openai("gpt-5-mini"),
    output: "data/faker-ecommerce.jsonl",
    seed: 100,
  }
);

// Example 3: Customer Support with Random Issues
// Generate diverse support conversations
await generateDataset(
  () => {
    const issueType = oneOf([
      "account login",
      "billing",
      "technical issue",
      "feature request",
    ]);

    return [
      generatedUser({
        prompt: `Report a ${issueType} problem. Your email is ${faker.internet.email()} and account ID is ${faker.string.alphanumeric(10)}.`,
      }),
      generatedAssistant({
        prompt: "Acknowledge the issue and ask for more details",
      }),
      ...times(between(1, 3), [
        generatedUser({
          prompt: "Provide more details about the issue",
        }),
        generatedAssistant({
          prompt: "Respond helpfully and work toward resolution",
        }),
      ]),
    ];
  },
  {
    count: 20,
    model: openai("gpt-5-mini"),
    output: "data/faker-support.jsonl",
    seed: 200,
  }
);

// Example 4: Appointment Scheduling
// Generate realistic scheduling conversations with dates and times
await generateDataset(
  () => [
    generatedUser({
      prompt: `Request an appointment for ${faker.person.fullName()} on ${faker.date.future().toLocaleDateString()} at ${faker.date.future().toLocaleTimeString()}. Contact: ${faker.phone.number()}`,
    }),
    generatedAssistant({
      prompt: "Confirm availability and suggest appointment times",
    }),
    generatedUser({
      prompt: "Confirm or request alternative time",
    }),
    generatedAssistant({
      prompt: "Finalize the appointment details",
    }),
  ],
  {
    count: 12,
    model: openai("gpt-5-mini"),
    output: "data/faker-appointments.jsonl",
    seed: 300,
  }
);

console.log("\n✅ Faker integration examples generated!");
console.log(
  "💡 Run with the same seeds to get identical fake data across runs"
);
console.log("📚 Explore more faker methods at: https://fakerjs.dev/");

