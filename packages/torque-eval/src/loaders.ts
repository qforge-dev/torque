import fsp from "node:fs/promises";
import path from "node:path";
import * as parquet from "parquetjs";
import type { IDatasetRow } from "@qforge/torque";
import type { DatasetSource } from "./types";

/**
 * Loads dataset rows either from an in-memory array or from a JSON/JSONL file path.
 */
export async function loadDataset(
  source: DatasetSource
): Promise<IDatasetRow[]> {
  if (Array.isArray(source)) {
    return source.filter(Boolean);
  }

  if (typeof source !== "string") {
    throw new Error("Unsupported dataset source");
  }

  const filePath = source;
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".jsonl") {
    const fileContents = await fsp.readFile(filePath, "utf-8");
    return fileContents
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, idx) => {
        try {
          return JSON.parse(line) as IDatasetRow;
        } catch (error) {
          throw new Error(
            `Failed to parse JSONL line ${idx + 1} in ${filePath}: ${
              (error as Error).message
            }`
          );
        }
      });
  }

  if (extension === ".json" || extension === ".ndjson") {
    const fileContents = await fsp.readFile(filePath, "utf-8");
    try {
      const data = JSON.parse(fileContents);
      if (Array.isArray(data)) {
        return data as IDatasetRow[];
      }
      if (Array.isArray((data as any)?.rows)) {
        return (data as { rows: IDatasetRow[] }).rows;
      }
      throw new Error("JSON file does not contain an array of rows");
    } catch (error) {
      throw new Error(
        `Failed to parse JSON dataset at ${filePath}: ${
          (error as Error).message
        }`
      );
    }
  }

  if (extension === ".parquet") {
    const reader = await parquet.ParquetReader.openFile(filePath);
    try {
      const cursor = reader.getCursor();
      const rows: IDatasetRow[] = [];
      let index = 0;
      while (true) {
        const record = (await cursor.next()) as Record<string, unknown> | null;
        if (!record) {
          break;
        }
        index += 1;
        rows.push({
          messages: parseJsonColumn<IDatasetRow["messages"]>(
            record.messages,
            "messages",
            filePath,
            index
          ),
          tools: parseJsonColumn<IDatasetRow["tools"]>(
            record.tools,
            "tools",
            filePath,
            index
          ),
          schema: parseJsonColumn<IDatasetRow["schema"]>(
            record.schema,
            "schema",
            filePath,
            index
          ),
          meta: parseJsonColumn<IDatasetRow["meta"]>(
            record.meta,
            "meta",
            filePath,
            index
          ),
        });
      }
      return rows;
    } catch (error) {
      throw new Error(
        `Failed to read Parquet dataset at ${filePath}: ${(error as Error).message}`
      );
    } finally {
      await reader.close();
    }
  }

  throw new Error(
    `Unsupported dataset extension "${extension}". Use JSON, JSONL, or Parquet files.`
  );
}

function parseJsonColumn<T>(
  value: unknown,
  column: string,
  filePath: string,
  index: number
): T {
  if (typeof value !== "string") {
    throw new Error(
      `Unexpected ${column} column type in ${filePath} at row ${index}. Expected JSON string.`
    );
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse ${column} JSON in ${filePath} at row ${index}: ${
        (error as Error).message
      }`
    );
  }
}
