import fsp from "fs/promises";
import type { DatasetFormat } from "./types";
import * as parquet from "parquetjs";

export class JsonlWriter implements IDatasetWriter {
  private writeLock = Promise.resolve();

  constructor(private filePath: string) {}

  async init(): Promise<void> {
    // No initialization needed for JSONL
  }

  async appendRow(row: Record<string, any>): Promise<void> {
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

  constructor(
    private filePath: string,
    private schemaFields: Record<string, any>
  ) {}

  async init(): Promise<void> {
    const schema = new parquet.ParquetSchema(this.schemaFields);
    this.writer = await parquet.ParquetWriter.openFile(schema, this.filePath);
  }

  async appendRow(row: Record<string, any>): Promise<void> {
    if (!this.writer) {
      throw new Error("ParquetWriter not initialized. Call init() first.");
    }
    // Serialize writes to avoid concurrent access issues with Parquet
    this.writeLock = this.writeLock.then(async () => {
      const data: Record<string, any> = {};
      for (const key of Object.keys(this.schemaFields)) {
        const value = row[key];
        if (typeof value === "object" && value !== null) {
          data[key] = JSON.stringify(value);
        } else {
          data[key] = value;
        }
      }
      await this.writer!.appendRow(data);
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
  filePath: string,
  parquetSchema?: Record<string, any>
): IDatasetWriter {
  switch (format) {
    case "jsonl":
      return new JsonlWriter(filePath);
    case "parquet":
      if (!parquetSchema) {
        throw new Error("Parquet schema is required for parquet format");
      }
      return new ParquetWriter(filePath, parquetSchema);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

export interface IDatasetWriter {
  init(): Promise<void>;
  appendRow(row: Record<string, any>): Promise<void>;
  close(): Promise<void>;
}
