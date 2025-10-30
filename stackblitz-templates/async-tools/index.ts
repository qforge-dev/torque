/**
 * Async Tool Pattern Example - Torque Interactive Playground
 * 
 * This example demonstrates:
 * - Modeling long-running tool operations
 * - Immediate acknowledgments with <tool_ack />
 * - Filler conversation while waiting
 * - Final result delivery
 * 
 * This pattern is useful for training LLMs to handle async operations
 * like web searches, API calls, or background tasks.
 * 
 * 🔑 BEFORE RUNNING:
 * 1. Click on the 🔒 icon in the bottom left
 * 2. Add environment variable: OPENAI_API_KEY=your-key-here
 * 3. Click "Run" or press Ctrl+Enter
 */

import {
  generateDataset,
  tool,
  generatedUser,
  generatedAssistant,
  generatedToolCall,
  generatedToolCallResult,
  times,
  between,
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

// Define a search tool that takes time to execute
const searchTool = tool({
  name: "web_search",
  description: "Search the web for information",
  parameters: z.object({
    query: z.string().describe("The search query"),
    max_results: z.number().optional().describe("Maximum number of results"),
  }),
  output: z.union([
    z.object({
      results: z.array(
        z.object({
          title: z.string(),
          snippet: z.string(),
          url: z.string(),
        })
      ),
    }),
    z.string(),
  ]),
});

await generateDataset(
  () => [
    searchTool.toolFunction(),

    // User initiates request
    generatedUser({
      prompt: "Ask for information that would require a web search",
    }),

    // Assistant acknowledges and starts tool
    generatedAssistant({
      prompt: "Acknowledge the request and indicate starting the search",
    }),

    // Tool call
    generatedToolCall(searchTool, "search-1"),

    // Immediate acknowledgment (tool started but not complete)
    generatedToolCallResult(searchTool, "search-1", "<tool_ack />"),

    generatedAssistant({
      prompt: "Assure user the search is in progress and will take a moment",
    }),

    // Filler conversation while waiting (1-3 exchanges)
    ...times(between(1, 3), [
      generatedUser({
        prompt:
          "Casual conversation unrelated to the search - could be small talk, other questions, or checking in",
      }),
      generatedAssistant({
        prompt:
          "Respond naturally to the casual conversation. Don't mention the search unless user asks about it.",
      }),
    ]),

    // Final tool call with same arguments (result ready)
    generatedToolCall(searchTool, "search-1-FINAL", {
      reuseArgsFrom: "search-1",
    }),
    generatedToolCallResult(searchTool, "search-1-FINAL"),

    // Present results
    generatedAssistant({
      prompt: "Present the search results in a helpful, organized way",
    }),
  ],
  {
    count: 5,
    model: openai("gpt-4o-mini", { apiKey }),
    output: "data/async-search.jsonl",
    seed: 500,
    concurrency: 2,
    generationContext: {
      global: {
        messages: [
          {
            role: "system",
            content: `Keep messages natural and concise. 
The filler conversation should feel realistic - not forced.
Avoid repetitive phrases like "Sure" or "Thanks" at the start of messages.`,
          },
        ],
      },
    },
  }
);

console.log("\n✨ Dataset generation complete!");
console.log("📁 Check the 'data/async-search.jsonl' file");
console.log("\n💡 Notice the async pattern:");
console.log("   1. Tool call with <tool_ack /> response");
console.log("   2. Natural filler conversation");
console.log("   3. Same tool call with real results");

