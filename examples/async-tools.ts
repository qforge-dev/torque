/**
 * Async Tool Pattern Example
 *
 * This example demonstrates how to model conversations where tools
 * take time to execute (async operations). The pattern includes:
 * 1. Tool call with immediate acknowledgment
 * 2. Filler conversation while waiting
 * 3. Final result delivery
 *
 * This is useful for training LLMs to handle long-running operations
 * like web searches, API calls, or background tasks.
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

// Define a data analysis tool
const analysisTool = tool({
  name: "analyze_data",
  description: "Analyze a dataset and generate insights",
  parameters: z.object({
    dataset_url: z.string().describe("URL to the dataset"),
    analysis_type: z.enum(["descriptive", "predictive", "prescriptive"]),
  }),
  output: z.union([
    z.object({
      summary: z.string(),
      key_insights: z.array(z.string()),
      visualizations: z.array(z.string()).optional(),
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
    count: 30,
    model: openai("gpt-5-mini"),
    output: "data/async-search.jsonl",
    seed: 500,
    concurrency: 3,
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
      user: {
        messages: [
          {
            role: "system",
            content:
              "User messages should be varied - sometimes patient, sometimes checking status, sometimes changing topic.",
          },
        ],
      },
    },
  }
);

// Example with data analysis (longer async operation)
await generateDataset(
  () => [
    analysisTool.toolFunction(),

    generatedUser({
      prompt: "Request analysis of a dataset",
    }),

    generatedAssistant({
      prompt: "Acknowledge and start the analysis",
    }),

    generatedToolCall(analysisTool, "analysis-1"),
    generatedToolCallResult(analysisTool, "analysis-1", "<tool_ack />"),

    generatedAssistant({
      prompt: "Explain the analysis will take some time due to dataset size",
    }),

    // More filler conversation (2-4 exchanges)
    ...times(between(2, 4), [
      generatedUser({
        prompt:
          "Either ask about the analysis status or engage in unrelated conversation",
      }),
      generatedAssistant({
        prompt:
          "Respond appropriately - if asked about status, provide reassurance; otherwise engage naturally",
      }),
    ]),

    // Final result
    generatedToolCall(analysisTool, "analysis-1-FINAL", {
      reuseArgsFrom: "analysis-1",
    }),
    generatedToolCallResult(analysisTool, "analysis-1-FINAL"),

    generatedAssistant({
      prompt: "Present the analysis results with key insights highlighted",
    }),
  ],
  {
    count: 20,
    model: openai("gpt-5-mini"),
    output: "data/async-analysis.jsonl",
    seed: 600,
    concurrency: 2,
  }
);
