import { generateDataset, user, assistant, generatedAssistant } from "../index";
import { openai } from "@ai-sdk/openai";

// Define two different conversation schemas
const customerSupportSchema = () => [
  user({ content: "I need help with my order" }),
  generatedAssistant({ prompt: "Provide a helpful customer support response" }),
];

const technicalSupportSchema = () => [
  user({ content: "My application is crashing" }),
  generatedAssistant({ prompt: "Provide technical troubleshooting steps" }),
];

// Option A: Generate multiple schemas with individual counts and seeds
await generateDataset(
  [
    { schema: customerSupportSchema, count: 15, seed: 100 },
    { schema: technicalSupportSchema, count: 15, seed: 200 },
  ],
  {
    model: openai("gpt-5-mini"),
    output: "data/mixed-support.jsonl",
    // Note: count is not needed when using schema array
    // Each schema can have its own seed for deterministic generation
  }
);

// Option B: Still supports existing usage with single schema
await generateDataset(customerSupportSchema, {
  count: 30,
  seed: 42,
  model: openai("gpt-5-mini"),
  output: "data/customer-support.jsonl",
});
