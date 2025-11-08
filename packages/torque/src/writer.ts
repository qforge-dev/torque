import fsp from "fs/promises";
import type { DatasetFormat, IDatasetRow } from "./types";
import * as parquet from "parquetjs";

export class JsonlWriter implements IDatasetWriter {
  private writeLock = Promise.resolve();

  constructor(private filePath: string) {}

  async init(): Promise<void> {
    // No initialization needed for JSONL
  }

  async appendRow(row: IDatasetRow): Promise<void> {
    // Serialize writes to ensure proper ordering
    this.writeLock = this.writeLock.then(async () => {
      const jsonLine = JSON.stringify(row) + "\n";
      await fsp.appendFile(this.filePath, jsonLine, "utf-8");
    });
    await this.writeLock;
  }

  async close(): Promise<void> {
    // Wait for all pending writes to complete
    await this.writeLock;
  }
}
export class ParquetWriter implements IDatasetWriter {
  private writer: parquet.ParquetWriter | null = null;
  private writeLock = Promise.resolve();

  constructor(private filePath: string) {}

  async init(): Promise<void> {
    const schema = new parquet.ParquetSchema({
      messages: { type: "UTF8" }, // JSON string
      tools: { type: "UTF8" }, // JSON string
      schema: { type: "UTF8" }, // JSON string
      meta: { type: "UTF8" }, // JSON string
    });
    this.writer = await parquet.ParquetWriter.openFile(schema, this.filePath);
  }

  async appendRow(row: IDatasetRow): Promise<void> {
    if (!this.writer) {
      throw new Error("ParquetWriter not initialized. Call init() first.");
    }
    // Serialize writes to avoid concurrent access issues with Parquet
    this.writeLock = this.writeLock.then(async () => {
      // Convert complex nested structures to JSON strings for Parquet storage
      await this.writer!.appendRow({
        messages: JSON.stringify(row.messages),
        tools: JSON.stringify(row.tools),
        schema: JSON.stringify(row.schema),
        meta: JSON.stringify(row.meta),
      });
    });
    await this.writeLock;
  }

  async close(): Promise<void> {
    // Wait for all pending writes to complete before closing
    await this.writeLock;
    if (this.writer) {
      await this.writer.close();
    }
  }
}
export function createWriter(
  format: DatasetFormat,
  filePath: string
): IDatasetWriter {
  switch (format) {
    case "jsonl":
      return new JsonlWriter(filePath);
    case "parquet":
      return new ParquetWriter(filePath);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
} // Writer abstraction for different output formats

export interface IDatasetWriter {
  init(): Promise<void>;
  appendRow(row: IDatasetRow): Promise<void>;
  close(): Promise<void>;
}
