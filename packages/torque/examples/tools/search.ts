/**
 * Search Tools
 *
 * Tools for performing web searches and retrieving information.
 * Useful for training models to handle information retrieval tasks.
 */

import { tool } from "../../src/schema";
import { z } from "zod";

export const webSearchTool = tool({
  name: "web_search",
  description: "Search the web for information",
  parameters: z.object({
    query: z.string().describe("The search query"),
    max_results: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(10)
      .optional()
      .describe("Maximum number of results to return"),
    search_type: z
      .enum(["general", "news", "images", "videos"])
      .default("general")
      .optional()
      .describe("Type of search to perform"),
  }),
  output: z.object({
    results: z.array(
      z.object({
        title: z.string(),
        snippet: z.string(),
        url: z.string().url(),
        published_date: z.string().optional(),
      })
    ),
    total_results: z
      .number()
      .optional()
      .describe("Total number of results found"),
  }),
});

export const knowledgeBaseTool = tool({
  name: "search_knowledge_base",
  description: "Search an internal knowledge base or documentation",
  parameters: z.object({
    query: z.string().describe("Search query"),
    category: z
      .string()
      .optional()
      .describe("Specific category to search within"),
    limit: z.number().int().min(1).max(50).default(10).optional(),
  }),
  output: z.object({
    results: z.array(
      z.object({
        title: z.string(),
        content: z.string(),
        category: z.string().optional(),
        relevance_score: z.number().min(0).max(1).optional(),
        last_updated: z.string().optional(),
      })
    ),
  }),
});
