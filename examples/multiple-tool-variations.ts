/**
 * Multiple Tool Variations Example
 *
 * This example demonstrates how to generate datasets with different tools
 * using oneOf to randomly select which tool to use for each example.
 */

import {
  generateDataset,
  generatedUser,
  generatedAssistant,
  generatedToolCall,
  generatedToolCallResult,
  tool,
  oneOf,
} from "@qforge/torque";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

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

// Define multiple tools
const weatherTool = tool({
  name: "get_weather",
  description: "Get current weather for a location",
  parameters: z.object({
    location: z.string().describe("City name"),
    units: z.enum(["celsius", "fahrenheit"]).optional(),
  }),
  output: z.object({
    temperature: z.number(),
    condition: z.string(),
  }),
});

const calculatorTool = tool({
  name: "calculator",
  description: "Perform basic arithmetic operations",
  parameters: z.object({
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    a: z.number(),
    b: z.number(),
  }),
  output: z.object({
    result: z.number(),
  }),
});

const searchTool = tool({
  name: "web_search",
  description: "Search the web for information",
  parameters: z.object({
    query: z.string().describe("Search query"),
  }),
  output: z.object({
    results: z.array(z.string()),
  }),
});

// Generate dataset with tool variations
const tools = [weatherTool, calculatorTool, searchTool];

await generateDataset(
  () => {
    const selectedTool = oneOf(tools);

    return [
      selectedTool.toolFunction(),
      generatedUser({ prompt: "Ask question requiring this tool" }),
      generatedToolCall(selectedTool as any, "t1"),
      generatedToolCallResult(selectedTool as any, "t1"),
      generatedAssistant({ prompt: "Present the result" }),
    ];
  },
  {
    count: 5, // 5 examples per tool on average
    model: openai("gpt-5-mini"),
    output: "data/multi-tool.jsonl",
    seed: 12345,
  }
);
