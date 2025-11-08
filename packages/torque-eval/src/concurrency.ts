export async function processWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  processor: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const normalizedConcurrency = normalizeConcurrency(concurrency);
  const workerCount = Math.min(normalizedConcurrency, items.length);
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const currentIndex = nextIndex;
      if (currentIndex >= items.length) {
        break;
      }
      nextIndex = currentIndex + 1;

      const item = items[currentIndex]!;
      results[currentIndex] = await processor(item, currentIndex);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return results;
}

function normalizeConcurrency(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.floor(value));
}
