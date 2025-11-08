import fsp from "node:fs/promises";
import path from "node:path";
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
  const fileContents = await fsp.readFile(filePath, "utf-8");
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".jsonl") {
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

  throw new Error(
    `Unsupported dataset extension "${extension}". Use JSON or JSONL files.`
  );
}
