/**
 * Database Tools
 *
 * Tools for querying and manipulating database records.
 * Demonstrates structured data retrieval and CRUD operations.
 */

import { tool } from "../../src/schema";
import { z } from "zod";

export const queryDatabaseTool = tool({
  name: "query_database",
  description: "Execute a SQL query against the database",
  parameters: z.object({
    query: z.string().describe("SQL query to execute"),
    parameters: z
      .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
      .optional()
      .describe("Query parameters for prepared statements"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .default(100)
      .optional()
      .describe("Maximum number of rows to return"),
  }),
  output: z.object({
    rows: z.array(z.record(z.string(), z.any())).describe("Query result rows"),
    row_count: z.number().int().describe("Number of rows returned"),
    affected_rows: z
      .number()
      .int()
      .optional()
      .describe("Number of rows affected (for INSERT/UPDATE/DELETE)"),
    execution_time_ms: z.number().optional(),
  }),
});

export const searchRecordsTool = tool({
  name: "search_records",
  description: "Search for records in a database table with filters",
  parameters: z.object({
    table: z.string().describe("Table name to search"),
    filters: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional()
      .describe("Field-value pairs to filter by"),
    sort_by: z.string().optional().describe("Field to sort results by"),
    sort_order: z.enum(["asc", "desc"]).default("asc").optional(),
    limit: z.number().int().min(1).max(1000).default(50).optional(),
    offset: z.number().int().min(0).default(0).optional(),
  }),
  output: z.object({
    records: z.array(z.record(z.string(), z.any())),
    total_count: z.number().int().describe("Total matching records"),
    page_count: z.number().int().optional(),
  }),
});

export const createRecordTool = tool({
  name: "create_record",
  description: "Create a new record in a database table",
  parameters: z.object({
    table: z.string().describe("Table name"),
    data: z.record(z.string(), z.any()).describe("Record data as key-value pairs"),
  }),
  output: z.object({
    id: z
      .union([z.string(), z.number()])
      .describe("ID of the created record"),
    created_at: z.string().optional(),
    status: z.enum(["created", "error"]),
  }),
});

export const updateRecordTool = tool({
  name: "update_record",
  description: "Update an existing database record",
  parameters: z.object({
    table: z.string().describe("Table name"),
    id: z.union([z.string(), z.number()]).describe("Record ID to update"),
    data: z.record(z.string(), z.any()).describe("Fields to update"),
  }),
  output: z.object({
    id: z.union([z.string(), z.number()]),
    updated_at: z.string().optional(),
    status: z.enum(["updated", "not_found", "error"]),
    changes_count: z.number().int().optional(),
  }),
});

