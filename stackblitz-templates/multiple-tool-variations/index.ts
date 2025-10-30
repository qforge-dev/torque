/**
 * Multiple Tool Variations Example - Torque Interactive Playground
 * 
 * This example demonstrates:
 * - Defining multiple tools
 * - Using oneOf to randomly select tools
 * - Generating diverse tool usage patterns
 * 
 * 🔑 BEFORE RUNNING:
 * 1. Click on the 🔒 icon in the bottom left
 * 2. Add environment variable: OPENAI_API_KEY=your-key-here
 * 3. Click "Run" or press Ctrl+Enter
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
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

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
    count: 10,
    model: openai("gpt-4o-mini", { apiKey }),
    output: "data/multi-tool.jsonl",
    seed: 12345,
  }
);

console.log("\n✨ Dataset generation complete!");
console.log("📁 Check the 'data/multi-tool.jsonl' file");
console.log("\n💡 The dataset includes examples for all three tools!");

