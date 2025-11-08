import type { IDatasetRow } from "@qforge/torque";
import type {
  PairSample,
  RowIdExtractor,
  SampledRow,
} from "./types";

type RandomFn = () => number;

function createSeededRandom(seed: number): RandomFn {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deriveRowId(
  row: IDatasetRow,
  index: number,
  rowIdExtractor?: RowIdExtractor
): string {
  const overrideId = rowIdExtractor?.(row, index);
  if (overrideId && overrideId.trim().length > 0) {
    return overrideId;
  }

  const metadata = row.meta?.metadata;
  if (
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata)
  ) {
    const candidateKeys = ["id", "rowId", "exampleId"];
    for (const key of candidateKeys) {
      const value = (metadata as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
    }
  }

  if (typeof row.meta?.seed === "number") {
    return `seed_${row.meta.seed}`;
  }

  return `row_${index}`;
}

function shuffleInPlace<T>(array: T[], random: RandomFn): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j]!, array[i]!];
  }
}

export function sampleRows(
  rows: IDatasetRow[],
  count: number,
  seed?: number,
  rowIdExtractor?: RowIdExtractor
): SampledRow[] {
  if (rows.length === 0) {
    return [];
  }

  const normalizedCount = Math.max(
    1,
    Math.min(count, rows.length)
  );

  const indices = rows.map((_, idx) => idx);
  const random =
    typeof seed === "number"
      ? createSeededRandom(seed)
      : Math.random;
  shuffleInPlace(indices, random);

  return indices.slice(0, normalizedCount).map((index) => {
    const row = rows[index]!;
    return {
      id: deriveRowId(row, index, rowIdExtractor),
      row,
      index,
    };
  });
}

export function samplePairedRows(
  datasetA: IDatasetRow[],
  datasetB: IDatasetRow[],
  count: number,
  seed?: number,
  rowIdExtractor?: RowIdExtractor
): PairSample[] {
  if (datasetA.length === 0 || datasetB.length === 0) {
    return [];
  }

  const mapRows = (rows: IDatasetRow[]) => {
    const map = new Map<string, IDatasetRow>();
    rows.forEach((row, idx) => {
      const id = deriveRowId(row, idx, rowIdExtractor);
      if (!map.has(id)) {
        map.set(id, row);
      }
    });
    return map;
  };

  const mapA = mapRows(datasetA);
  const mapB = mapRows(datasetB);

  const commonIds = Array.from(mapA.keys()).filter((id) =>
    mapB.has(id)
  );

  if (commonIds.length === 0) {
    throw new Error(
      "No overlapping row IDs were found between the two datasets"
    );
  }

  const normalizedCount = Math.max(
    1,
    Math.min(count, commonIds.length)
  );

  const random =
    typeof seed === "number"
      ? createSeededRandom(seed)
      : Math.random;
  shuffleInPlace(commonIds, random);

  return commonIds.slice(0, normalizedCount).map((id) => ({
    id,
    rowA: mapA.get(id)!,
    rowB: mapB.get(id)!,
  }));
}
