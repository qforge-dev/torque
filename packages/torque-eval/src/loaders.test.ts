import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import * as parquet from "parquetjs";
import type { IDatasetRow } from "@qforge/torque";
import { loadDataset } from "./loaders";

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

function createRow(id: string, assistantText: string): IDatasetRow {
  return {
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: `Prompt ${id}` }],
        generationId: `${id}-user`,
      },
      {
        role: "assistant",
        content: [{ type: "text", text: assistantText }],
        generationId: `${id}-assistant`,
      },
    ],
    tools: [],
    schema: {
      metadata: { scenario: "loader-test" },
      messages: [],
      tools: [],
    },
    meta: {
      seed: Number.parseInt(id.replace(/\D/g, ""), 10) || 0,
      metadata: { id },
    },
  } satisfies IDatasetRow;
}

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "torque-eval-loader-"));
  tempDirs.push(dir);
  return dir;
}

describe("loadDataset", () => {
  it("loads dataset rows from a Parquet file", async () => {
    const dir = await createTempDir();
    const filePath = path.join(dir, "dataset.parquet");

    const writer = await parquet.ParquetWriter.openFile(
      new parquet.ParquetSchema({
        messages: { type: "UTF8" },
        tools: { type: "UTF8" },
        schema: { type: "UTF8" },
        meta: { type: "UTF8" },
      }),
      filePath
    );

    const rows = [
      createRow("row_1", "Assistant reply 1"),
      createRow("row_2", "Assistant reply 2"),
    ];

    for (const row of rows) {
      await writer.appendRow({
        messages: JSON.stringify(row.messages),
        tools: JSON.stringify(row.tools),
        schema: JSON.stringify(row.schema),
        meta: JSON.stringify(row.meta),
      });
    }

    await writer.close();

    const loaded = await loadDataset(filePath);

    expect(loaded).toHaveLength(2);
    expect((loaded[0]!.meta?.metadata as { id: string }).id).toBe("row_1");
    expect(loaded[1]!.messages[1]!.content![0]).toEqual({
      type: "text",
      text: "Assistant reply 2",
    } as const);
  });

  it("supports loading standard JSON arrays", async () => {
    const dir = await createTempDir();
    const filePath = path.join(dir, "dataset.json");
    const rows = [createRow("row_1", "json reply")];
    await writeFile(filePath, JSON.stringify(rows), "utf-8");

    const loaded = await loadDataset(filePath);
    expect(loaded).toHaveLength(1);
    expect((loaded[0]!.meta?.metadata as { id: string }).id).toBe("row_1");
  });
});
