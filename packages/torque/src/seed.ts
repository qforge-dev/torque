import { openai } from "@ai-sdk/openai";
import { generateDataset } from "./dataset";
import { generatedAssistant, generatedToolCall, tool } from "./schema";
import type { IMessageSchema } from "./types";
import z from "zod";

export const singleAsyncNoResultYetAsk = (): IMessageSchema => {
  return () => {
    const weatherTool = tool({
      name: "get_weather",
      description: "Get current weather information for a location",
      parameters: z.object({
        location: z.string().describe("City name or coordinates"),
      }),
      output: z.object({
        temperature: z.number().describe("The temperature in Celsius"),
        condition: z.string().describe("The weather condition"),
      }),
    });

    return [
      generatedAssistant({
        prompt: "Hello, how are you?",
        toolCalls: [
          generatedToolCall(weatherTool, "t1", {
            prompt: "What is the weather in Tokyo?",
          }),
        ],
      }),
    ];
  };
};

await generateDataset(
  [{ count: 2, schema: singleAsyncNoResultYetAsk(), seed: 200 }],
  {
    model: openai("gpt-4.1"),
    seed: 42,
    output: "/tmp/seed-generated-user-test.jsonl",
  }
);
