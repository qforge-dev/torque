/**
 * Tool Calling Example
 *
 * This example demonstrates how to define tools with Zod schemas
 * and generate conversations that include tool calls and results.
 */

import {
  generateDataset,
  tool,
  generatedUser,
  generatedAssistant,
  generatedToolCall,
  generatedToolCallResult,
} from "@qforge/torque";
// Add oneOf to the list above if you want to randomize tool selection.
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

// Define a calculator tool
const calculatorTool = tool({
  name: "calculator",
  description: "Perform basic arithmetic operations",
  parameters: z.object({
    operation: z
      .enum(["add", "subtract", "multiply", "divide"])
      .describe("The operation to perform"),
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
  }),
  output: z.object({
    result: z.number().describe("The calculation result"),
  }),
});

/*
Toggle-able weather tool:
const weatherTool = tool({
  name: "get_weather",
  description: "Get current weather information for a location",
  parameters: z.object({
    location: z.string().describe("City name or coordinates"),
    units: z.enum(["celsius", "fahrenheit"]).optional(),
  }),
  output: z.object({
    temperature: z.number(),
    condition: z.string(),
    humidity: z.number().optional(),
  }),
});
*/

await generateDataset(
  () => [
    calculatorTool.toolFunction(),
    generatedUser({ prompt: "Ask for a calculation to be performed" }),
    generatedAssistant({
      prompt: "Acknowledge and indicate will use calculator",
    }),
    generatedToolCall(calculatorTool, "calc-1"),
    generatedToolCallResult(calculatorTool, "calc-1"),
    generatedAssistant({
      prompt: "Present the calculation result to the user",
    }),
    /*
    Other options:
      - Swap in the weather tool block above and replace the calculator calls accordingly.
      - Chain both tools by appending an extra generatedUser/toolCall/toolCallResult trio.
      - After enabling oneOf in the imports, pick the tool dynamically:
          const toolForRun = oneOf([calculatorTool, weatherTool]);
          toolForRun.toolFunction();
    */
  ],
  {
    count: 25,
    model: openai("gpt-5-mini"),
    output: "data/calculator-usage.jsonl",
    seed: 100,
  }
);
