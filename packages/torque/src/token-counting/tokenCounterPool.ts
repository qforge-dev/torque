import type {
  TokenCountPayload,
  TokenCountResult,
  TokenCountWorkerRequest,
  TokenCountWorkerResponse,
} from "./types";

type CountTokensModule = typeof import("./countTokens");

type WorkerHandle = {
  postMessage: (message: TokenCountWorkerRequest) => void;
  terminate: () => void;
  onmessage: ((event: { data: TokenCountWorkerResponse }) => void) | null;
  onerror: ((event: { message?: string; error?: unknown }) => void) | null;
  onmessageerror: ((event: { message?: string; error?: unknown }) => void) | null;
};

type QueueEntry = {
  payload: TokenCountPayload;
  resolve: (result: TokenCountResult) => void;
  reject: (error: Error) => void;
};

type PendingEntry = QueueEntry & { worker: WorkerHandle };

const moduleExtension = import.meta.url.endsWith(".ts") ? ".ts" : ".js";
const workerSpecifier = `./tokenCounterWorker${moduleExtension}`;
const countTokensSpecifier = `./countTokens${moduleExtension}`;
const WorkerCtor =
  typeof globalThis !== "undefined" &&
  typeof (globalThis as any).Worker === "function"
    ? ((globalThis as any).Worker as new (
        scriptURL: string | URL,
        options?: { type?: "module" | "classic" }
      ) => WorkerHandle)
    : undefined;
const DEFAULT_TOKEN_MODEL = "gpt-5";

export class TokenCounterPool {
  private readonly workerUrl = WorkerCtor
    ? new URL(workerSpecifier, import.meta.url).href
    : null;
  private readonly queue: QueueEntry[] = [];
  private readonly pending = new Map<number, PendingEntry>();
  private readonly workers = new Set<WorkerHandle>();
  private readonly idleWorkers: WorkerHandle[] = [];
  private requestId = 0;
  private destroyed = false;
  private fallbackCounterPromise?: Promise<
    CountTokensModule["countTokensSync"]
  >;

  constructor(private readonly workerCount: number) {
    if (workerCount <= 0) {
      throw new Error("TokenCounterPool requires at least one worker");
    }

    if (this.workerUrl) {
      for (let i = 0; i < workerCount; i++) {
        this.spawnWorker();
      }
    }
  }

  async countTokens(payload: TokenCountPayload): Promise<TokenCountResult> {
    if (this.destroyed) {
      throw new Error("TokenCounterPool has been destroyed");
    }

    if (!this.workerUrl || !WorkerCtor) {
      const counter = await this.getFallbackCounter();
      return counter(
        payload.messages,
        payload.tools,
        payload.model ?? DEFAULT_TOKEN_MODEL
      );
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ payload, resolve, reject });
      this.dispatch();
    });
  }

  async destroy(): Promise<void> {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      job.reject(new Error("TokenCounterPool destroyed"));
    }

    for (const [, pending] of this.pending) {
      pending.reject(new Error("TokenCounterPool destroyed"));
    }
    this.pending.clear();

    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers.clear();
    this.idleWorkers.length = 0;
  }

  private async getFallbackCounter(): Promise<
    CountTokensModule["countTokensSync"]
  > {
    if (!this.fallbackCounterPromise) {
      this.fallbackCounterPromise = import(
        countTokensSpecifier
      ).then((module: CountTokensModule) => module.countTokensSync);
    }
    return this.fallbackCounterPromise;
  }

  private spawnWorker(): void {
    if (!this.workerUrl || !WorkerCtor) {
      return;
    }

    const worker = new WorkerCtor(this.workerUrl, {
      type: "module",
    });

    worker.onmessage = (event: any) => {
      this.handleWorkerMessage(worker, event.data as TokenCountWorkerResponse);
    };

    const handleError = (event: any) => {
      const error =
        event instanceof Error
          ? event
          : new Error(event?.message ?? "Token counter worker failed");
      this.handleWorkerFailure(worker, error);
    };

    worker.onerror = handleError;
    worker.onmessageerror = handleError;

    this.workers.add(worker);
    this.idleWorkers.push(worker);
    this.dispatch();
  }

  private handleWorkerMessage(
    worker: WorkerHandle,
    message: TokenCountWorkerResponse
  ): void {
    const pending = this.pending.get(message.id);
    if (!pending) {
      return;
    }

    this.pending.delete(message.id);

    if ("error" in message) {
      pending.reject(new Error(message.error));
    } else {
      pending.resolve(message.result);
    }

    if (!this.destroyed) {
      this.idleWorkers.push(worker);
      this.dispatch();
    } else {
      worker.terminate();
    }
  }

  private dispatch(): void {
    if (
      this.destroyed ||
      !this.workerUrl ||
      !WorkerCtor ||
      this.idleWorkers.length === 0
    ) {
      return;
    }

    while (this.idleWorkers.length > 0 && this.queue.length > 0) {
      const worker = this.idleWorkers.shift()!;
      const job = this.queue.shift()!;
      const requestId = this.requestId++;

      this.pending.set(requestId, {
        worker,
        payload: job.payload,
        resolve: job.resolve,
        reject: job.reject,
      });

      const message: TokenCountWorkerRequest = {
        id: requestId,
        payload: {
          messages: job.payload.messages,
          tools: job.payload.tools,
          model: job.payload.model ?? DEFAULT_TOKEN_MODEL,
        },
      };

      worker.postMessage(message);
    }
  }

  private handleWorkerFailure(worker: WorkerHandle, error: Error): void {
    const reassigned: QueueEntry[] = [];

    for (const [id, pending] of this.pending.entries()) {
      if (pending.worker === worker) {
        this.pending.delete(id);
        reassigned.push({
          payload: pending.payload,
          resolve: pending.resolve,
          reject: pending.reject,
        });
      }
    }

    this.removeWorker(worker);

    if (this.destroyed) {
      for (const job of reassigned) {
        job.reject(error);
      }
      return;
    }

    for (const job of reassigned.reverse()) {
      this.queue.unshift(job);
    }

    this.spawnWorker();
    this.dispatch();
  }

  private removeWorker(worker: WorkerHandle): void {
    worker.terminate();
    this.workers.delete(worker);

    const index = this.idleWorkers.indexOf(worker);
    if (index >= 0) {
      this.idleWorkers.splice(index, 1);
    }
  }
}
