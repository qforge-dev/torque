/**
 * File Operations Tools
 *
 * Tools for reading, writing, and managing files and directories.
 * Useful for training models to handle file system operations.
 */

import { tool } from "../../src/schema";
import { z } from "zod";

export const readFileTool = tool({
  name: "read_file",
  description: "Read the contents of a file",
  parameters: z.object({
    path: z.string().describe("File path to read"),
    encoding: z
      .enum(["utf-8", "ascii", "base64"])
      .default("utf-8")
      .optional()
      .describe("File encoding"),
    line_start: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Start reading from this line number"),
    line_end: z
      .number()
      .int()
      .optional()
      .describe("Stop reading at this line number"),
  }),
  output: z.object({
    content: z.string().describe("File contents"),
    size_bytes: z.number().int().optional().describe("File size in bytes"),
    line_count: z.number().int().optional().describe("Total number of lines"),
  }),
});

export const writeFileTool = tool({
  name: "write_file",
  description: "Write content to a file (creates or overwrites)",
  parameters: z.object({
    path: z.string().describe("File path to write to"),
    content: z.string().describe("Content to write"),
    encoding: z.enum(["utf-8", "ascii", "base64"]).default("utf-8").optional(),
    create_directories: z
      .boolean()
      .default(true)
      .optional()
      .describe("Create parent directories if they don't exist"),
  }),
  output: z.object({
    path: z.string().describe("Path where file was written"),
    bytes_written: z.number().int().describe("Number of bytes written"),
    status: z.enum(["success", "error"]),
  }),
});

export const listDirectoryTool = tool({
  name: "list_directory",
  description: "List files and directories in a given path",
  parameters: z.object({
    path: z.string().describe("Directory path to list"),
    recursive: z
      .boolean()
      .default(false)
      .optional()
      .describe("List subdirectories recursively"),
    include_hidden: z
      .boolean()
      .default(false)
      .optional()
      .describe("Include hidden files (starting with .)"),
    filter: z
      .string()
      .optional()
      .describe("Glob pattern to filter results (e.g., *.ts)"),
  }),
  output: z.object({
    entries: z.array(
      z.object({
        name: z.string(),
        path: z.string(),
        type: z.enum(["file", "directory", "symlink"]),
        size_bytes: z.number().int().optional(),
        modified_time: z.string().optional(),
      })
    ),
    total_count: z.number().int(),
  }),
});

export const deleteFileTool = tool({
  name: "delete_file",
  description: "Delete a file or directory",
  parameters: z.object({
    path: z.string().describe("Path to delete"),
    recursive: z
      .boolean()
      .default(false)
      .optional()
      .describe("Delete directories recursively"),
  }),
  output: z.object({
    path: z.string(),
    status: z.enum(["deleted", "not_found", "error"]),
  }),
});

