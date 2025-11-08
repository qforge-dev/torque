export async function processWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  processor: (item: T, index: number) => Promise<R>,
  options?: {
    onProgress?: (completed: number, inProgress: number, total: number) => void;
  }
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const normalizedConcurrency = normalizeConcurrency(concurrency);
  const workerCount = Math.min(normalizedConcurrency, items.length);
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let completed = 0;
  let inProgress = 0;

  const reportProgress = () => {
    options?.onProgress?.(completed, inProgress, items.length);
  };

  reportProgress();

  async function runWorker(): Promise<void> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const currentIndex = nextIndex;
      if (currentIndex >= items.length) {
        break;
      }
      nextIndex = currentIndex + 1;

      const item = items[currentIndex]!;
      inProgress++;
      reportProgress();

      try {
        results[currentIndex] = await processor(item, currentIndex);
      } finally {
        inProgress = Math.max(0, inProgress - 1);
        completed++;
        reportProgress();
      }
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
