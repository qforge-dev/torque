/**
 * Translation and Language Tools
 *
 * Tools for translating text and detecting languages.
 * Demonstrates multi-language capabilities and text processing.
 */

import { tool } from "../../src/schema";
import { z } from "zod";

export const translateTool = tool({
  name: "translate_text",
  description: "Translate text from one language to another",
  parameters: z.object({
    text: z.string().describe("Text to translate"),
    source_language: z
      .string()
      .optional()
      .describe("Source language code (e.g., 'en', 'es') - auto-detect if not provided"),
    target_language: z.string().describe("Target language code (e.g., 'fr', 'de')"),
    formality: z
      .enum(["formal", "informal", "auto"])
      .default("auto")
      .optional()
      .describe("Translation formality level"),
  }),
  output: z.object({
    translated_text: z.string(),
    source_language: z.string().describe("Detected or specified source language"),
    target_language: z.string(),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Translation confidence score"),
  }),
});

export const detectLanguageTool = tool({
  name: "detect_language",
  description: "Detect the language of a given text",
  parameters: z.object({
    text: z.string().describe("Text to analyze"),
  }),
  output: z.object({
    language_code: z.string().describe("ISO language code (e.g., 'en', 'es')"),
    language_name: z.string().describe("Full language name (e.g., 'English')"),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .describe("Detection confidence score"),
    alternative_languages: z
      .array(
        z.object({
          language_code: z.string(),
          confidence: z.number(),
        })
      )
      .optional(),
  }),
});

export const listLanguagesTool = tool({
  name: "list_supported_languages",
  description: "Get a list of all supported languages for translation",
  parameters: z.object({
    search: z
      .string()
      .optional()
      .describe("Search for specific languages by name or code"),
  }),
  output: z.object({
    languages: z.array(
      z.object({
        code: z.string().describe("Language code"),
        name: z.string().describe("Language name"),
        native_name: z.string().optional(),
      })
    ),
    total_count: z.number().int(),
  }),
});

