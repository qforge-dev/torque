/**
 * Code Execution Tools
 *
 * Tools for executing code in various languages and environments.
 * Useful for training models to handle code generation and execution tasks.
 */

import { tool } from "../../src/schema";
import { z } from "zod";

export const executeCodeTool = tool({
  name: "execute_code",
  description: "Execute code in a sandboxed environment",
  parameters: z.object({
    code: z.string().describe("Code to execute"),
    language: z
      .enum([
        "python",
        "javascript",
        "typescript",
        "bash",
        "ruby",
        "go",
        "rust",
        "java",
      ])
      .describe("Programming language"),
    timeout_seconds: z
      .number()
      .int()
      .min(1)
      .max(300)
      .default(30)
      .optional()
      .describe("Execution timeout"),
    input: z.string().optional().describe("Standard input for the program"),
  }),
  output: z.object({
    stdout: z.string().describe("Standard output from execution"),
    stderr: z.string().optional().describe("Standard error output"),
    exit_code: z.number().int().describe("Process exit code"),
    execution_time_ms: z.number().optional(),
    status: z.enum(["success", "error", "timeout"]),
  }),
});

export const lintCodeTool = tool({
  name: "lint_code",
  description: "Run a linter on code to check for style and syntax issues",
  parameters: z.object({
    code: z.string().describe("Code to lint"),
    language: z
      .enum(["python", "javascript", "typescript", "go", "rust"])
      .describe("Programming language"),
    config: z
      .record(z.string(), z.any())
      .optional()
      .describe("Linter configuration options"),
  }),
  output: z.object({
    issues: z.array(
      z.object({
        line: z.number().int(),
        column: z.number().int().optional(),
        severity: z.enum(["error", "warning", "info"]),
        message: z.string(),
        rule: z.string().optional(),
      })
    ),
    total_errors: z.number().int(),
    total_warnings: z.number().int(),
    status: z.enum(["passed", "failed"]),
  }),
});

export const formatCodeTool = tool({
  name: "format_code",
  description: "Format code according to language conventions",
  parameters: z.object({
    code: z.string().describe("Code to format"),
    language: z
      .enum(["python", "javascript", "typescript", "go", "rust", "java", "html", "css"])
      .describe("Programming language"),
    style: z
      .string()
      .optional()
      .describe("Code style guide to use (e.g., 'google', 'airbnb')"),
  }),
  output: z.object({
    formatted_code: z.string(),
    changes_count: z.number().int().describe("Number of formatting changes made"),
    status: z.enum(["formatted", "no_changes", "error"]),
  }),
});

export const explainCodeTool = tool({
  name: "explain_code",
  description: "Generate an explanation of what a code snippet does",
  parameters: z.object({
    code: z.string().describe("Code to explain"),
    language: z.string().describe("Programming language"),
    detail_level: z
      .enum(["brief", "detailed", "line-by-line"])
      .default("detailed")
      .optional(),
  }),
  output: z.object({
    explanation: z.string().describe("Natural language explanation of the code"),
    key_concepts: z
      .array(z.string())
      .optional()
      .describe("Important concepts used in the code"),
    complexity: z.enum(["low", "medium", "high"]).optional(),
  }),
});

