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
  oneOf,
} from "@qforge/torque";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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

// Define a weather tool
const weatherTool = tool({
  name: "get_weather",
  description: "Get current weather information for a location",
  parameters: z.object({
    location: z.string().describe("City name or coordinates"),
    units: z
      .enum(["celsius", "fahrenheit"])
      .optional()
      .describe("Temperature units"),
  }),
  output: z.object({
    temperature: z.number(),
    condition: z.string(),
    humidity: z.number().optional(),
  }),
});

// Example 1: Single tool usage
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
  ],
  {
    count: 25,
    model: openai("gpt-5-mini"),
    output: "data/calculator-usage.jsonl",
    seed: 100,
  }
);

// Example 2: Multiple tools with random selection
await generateDataset(
  () => {
    // Randomly choose which tool to use for each example
    const selectedTool = oneOf([calculatorTool, weatherTool]);

    return [
      selectedTool.toolFunction(),
      generatedUser({
        prompt:
          "Ask a question that requires using the available tool (look at conversation structure to see which tool is available)",
      }),
      generatedAssistant({
        prompt: "Acknowledge the request and indicate will use the tool",
      }),
      generatedToolCall(selectedTool as any, "t1"),
      generatedToolCallResult(selectedTool as any, "t1"),
      generatedAssistant({
        prompt: "Present the tool result in a helpful, natural way",
      }),
    ];
  },
  {
    count: 50,
    model: openai("gpt-5-mini"),
    output: "data/multi-tool-usage.jsonl",
    seed: 200,
    concurrency: 3,
  }
);

// Example 3: Multiple tool calls in one conversation
await generateDataset(
  () => [
    weatherTool.toolFunction(),
    calculatorTool.toolFunction(),

    // First tool call
    generatedUser({ prompt: "Ask about weather in a specific city" }),
    generatedToolCall(weatherTool, "weather-1"),
    generatedToolCallResult(weatherTool, "weather-1"),
    generatedAssistant({ prompt: "Present the weather information" }),

    // Second tool call
    generatedUser({
      prompt:
        "Ask for a temperature conversion calculation based on the weather",
    }),
    generatedToolCall(calculatorTool, "calc-1"),
    generatedToolCallResult(calculatorTool, "calc-1"),
    generatedAssistant({ prompt: "Present the conversion result" }),
  ],
  {
    count: 20,
    model: openai("gpt-5-mini"),
    output: "data/multi-call-conversation.jsonl",
    seed: 300,
  }
);
