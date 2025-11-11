/**
 * Calculator Tool
 *
 * A basic arithmetic calculator tool for performing mathematical operations.
 * Useful for training models to handle math queries and tool-assisted calculations.
 */

import { tool } from "../../src/schema";
import { z } from "zod";

export const calculatorTool = tool({
  name: "calculator",
  description: "Perform basic arithmetic operations",
  parameters: z.object({
    operation: z
      .enum(["add", "subtract", "multiply", "divide", "power", "modulo"])
      .describe("The arithmetic operation to perform"),
    a: z.number().describe("First operand"),
    b: z.number().describe("Second operand"),
  }),
  output: z.object({
    result: z.number().describe("The calculation result"),
    expression: z
      .string()
      .optional()
      .describe("The mathematical expression that was evaluated"),
  }),
});

export const advancedCalculatorTool = tool({
  name: "advanced_calculator",
  description:
    "Perform advanced mathematical operations including trigonometry, logarithms, and roots",
  parameters: z.object({
    operation: z
      .enum([
        "sin",
        "cos",
        "tan",
        "log",
        "ln",
        "sqrt",
        "abs",
        "round",
        "ceil",
        "floor",
      ])
      .describe("The mathematical function to apply"),
    value: z.number().describe("The input value"),
    precision: z
      .number()
      .int()
      .min(0)
      .max(10)
      .optional()
      .describe("Number of decimal places for rounding"),
  }),
  output: z.object({
    result: z.number().describe("The calculated result"),
    unit: z
      .string()
      .optional()
      .describe("Unit of the result (e.g., 'radians', 'degrees')"),
  }),
});
