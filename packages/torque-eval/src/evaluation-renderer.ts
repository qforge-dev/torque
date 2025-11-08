import type {
  ComparisonProgress,
  ComparisonRenderer,
  ComparisonSummary,
  ComparisonRendererConfig,
} from "./types";

export class PairwiseEvaluationRenderer implements ComparisonRenderer {
  private progress: ComparisonProgress = {
    completed: 0,
    inProgress: 0,
    total: 0,
  };
  private config: ComparisonRendererConfig | null = null;
  private startTime = 0;
  private lastRenderTime = 0;
  private pendingRenderTimer?: NodeJS.Timeout;
  private readonly RENDER_THROTTLE_MS = 250;
  private isFinished = false;

  start(config: ComparisonRendererConfig): void {
    this.config = config;
    this.startTime = Date.now();
    this.progress = {
      completed: 0,
      inProgress: 0,
      total: config.total,
    };
    this.isFinished = false;
    this.queueRender(true);
  }

  update(progress: ComparisonProgress): void {
    if (!this.config || this.isFinished) return;
    this.progress = progress;
    this.queueRender();
  }

  finish(summary: ComparisonSummary): void {
    if (!this.config) return;
    this.isFinished = true;
    this.clearPendingRender();
    this.clearConsole();
    this.renderCompletion(summary);
  }

  fail(error: Error): void {
    if (!this.config) return;
    this.isFinished = true;
    this.clearPendingRender();
    this.clearConsole();
    console.log(
      "╔═══════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║        Pairwise Evaluation Failed ❌                      ║"
    );
    console.log(
      "╚═══════════════════════════════════════════════════════════╝"
    );
    console.log();
    console.log("Reason:", error.message);
  }

  private queueRender(force = false): void {
    if (!this.config || this.isFinished) {
      return;
    }

    const now = Date.now();
    const timeSinceLastRender = now - this.lastRenderTime;

    if (force || timeSinceLastRender >= this.RENDER_THROTTLE_MS) {
      this.renderImmediate();
      this.lastRenderTime = now;
      this.clearPendingRender();
      return;
    }

    if (!this.pendingRenderTimer) {
      const delay = this.RENDER_THROTTLE_MS - timeSinceLastRender;
      this.pendingRenderTimer = setTimeout(() => {
        this.pendingRenderTimer = undefined;
        this.renderImmediate();
        this.lastRenderTime = Date.now();
      }, delay);
    }
  }

  private clearPendingRender(): void {
    if (this.pendingRenderTimer) {
      clearTimeout(this.pendingRenderTimer);
      this.pendingRenderTimer = undefined;
    }
  }

  private renderImmediate(): void {
    if (!this.config) return;
    this.clearConsole();

    console.log(
      "╔═══════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║             Pairwise Evaluation Dashboard ⚖️             ║"
    );
    console.log(
      "╚═══════════════════════════════════════════════════════════╝"
    );
    console.log();

    this.renderConfig();
    this.renderProgress();
    this.renderFooter();
  }

  private renderConfig(): void {
    if (!this.config) return;
    console.log("📋 Configuration:");
    console.log(`   Total pairs: ${this.config.total}`);
    console.log(`   Concurrency: ${this.config.concurrency}`);
    if (this.config.seed !== undefined) {
      console.log(`   Seed: ${this.config.seed}`);
    }
    if (this.config.instructions) {
      console.log(
        `   Instructions: ${this.config.instructions.slice(0, 60)}${
          this.config.instructions.length > 60 ? "…" : ""
        }`
      );
    }
    console.log();
  }

  private renderProgress(): void {
    const { completed, inProgress, total } = this.progress;
    const percentage =
      total > 0 ? ((completed / total) * 100).toFixed(1) : "0.0";
    console.log("📊 Progress:");
    console.log(
      `   ${this.renderProgressBar(completed, total)} ${completed}/${total} (${percentage}%)`
    );
    const remaining = Math.max(total - completed - inProgress, 0);
    console.log(
      `   ⚙️  In flight: ${inProgress} | 📋 Remaining: ${remaining}`
    );
    console.log();
  }

  private renderFooter(): void {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(`⏱️  Elapsed: ${elapsed}s`);
  }

  private renderCompletion(summary: ComparisonSummary): void {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
    console.log(
      "╔═══════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║          Pairwise Evaluation Complete ✅                  ║"
    );
    console.log(
      "╚═══════════════════════════════════════════════════════════╝"
    );
    console.log();

    console.log(`⏱️  Total time: ${elapsed}s`);
    console.log(
      `📊 Totals -> A: ${summary.totals.A} | B: ${summary.totals.B} | ties: ${summary.totals.tie}`
    );
    console.log(
      summary.preferred === "tie"
        ? "🤝 Preferred outcome: tie"
        : `🏆 Preferred outcome: dataset ${summary.preferred}`
    );
    if (summary.outputPath) {
      console.log(`💾 Saved results to: ${summary.outputPath}`);
    }
    console.log();
  }

  private renderProgressBar(
    current: number,
    total: number,
    width: number = 30
  ): string {
    if (total <= 0) {
      return `[${"░".repeat(width)}]`;
    }
    const ratio = Math.min(Math.max(current / total, 0), 1);
    const filled = Math.round(ratio * width);
    return `[${"█".repeat(filled)}${"░".repeat(Math.max(width - filled, 0))}]`;
  }

  private clearConsole(): void {
    process.stdout.write("\x1b[2J\x1b[H");
  }
}
