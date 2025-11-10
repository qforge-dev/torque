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
    datasetWins: {},
    ties: 0,
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
    const datasetWins = Object.fromEntries(
      (config.datasetIds ?? []).map((id) => [id, 0])
    );
    this.progress = {
      completed: 0,
      inProgress: 0,
      total: config.total,
      datasetWins,
      ties: 0,
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
    console.log("║             Pairwise Evaluation Dashboard ⚖️             ║");
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
    if (this.config.datasetIds?.length) {
      console.log(
        `   Datasets: ${this.config.datasetIds.join(", ")}`
      );
    }
    const judgeModel = this.config.judgeModelId ?? "unknown judge model";
    console.log(`   Judge model: ${judgeModel}`);
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
    const { completed, inProgress, total, ties } = this.progress;
    const percentage =
      total > 0 ? ((completed / total) * 100).toFixed(1) : "0.0";
    console.log("📊 Progress:");
    console.log(
      `   ${this.renderProgressBar(
        completed,
        total
      )} ${completed}/${total} (${percentage}%)`
    );
    const remaining = Math.max(total - completed - inProgress, 0);
    console.log(`   ⚙️  In flight: ${inProgress} | 📋 Remaining: ${remaining}`);
    const winsLine = this.formatWinsLine();
    if (winsLine) {
      console.log(`   🏆 Wins: ${winsLine}`);
    } else {
      console.log("   🏆 Wins: no results yet");
    }
    console.log(`   🤝 Ties: ${ties ?? 0}`);
    console.log(`   🏁 Leader: ${this.describeLeader()}`);
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
    console.log("🏆 Leaderboard:");
    if (summary.leaderboard.length === 0) {
      console.log("   No comparisons were run.");
    } else {
      summary.leaderboard.slice(0, 5).forEach((entry, index) => {
        console.log(
          `   ${index + 1}. ${entry.datasetId} — rating ${entry.rating.toFixed(
            1
          )} (W:${entry.wins} L:${entry.losses} T:${entry.ties})`
        );
      });
    }
    console.log();
    console.log("🤝 Pair totals:");
    if (summary.pairs.length === 0) {
      console.log("   No pairwise stats recorded.");
    } else {
      summary.pairs.forEach((pair) => {
        const winsA = pair.wins[pair.datasetAId] ?? 0;
        const winsB = pair.wins[pair.datasetBId] ?? 0;
        console.log(
          `   ${pair.datasetAId} vs ${pair.datasetBId}: ${winsA}-${winsB} (ties: ${pair.wins.tie})`
        );
      });
    }
    const judgeModel =
      summary.judgeModelId ??
      this.config?.judgeModelId ??
      "unknown judge model";
    console.log(`🧑‍⚖️ Judge model: ${judgeModel}`);
    if (summary.outputPath) {
      console.log(`💾 Saved results to: ${summary.outputPath}`);
    }
    console.log();
  }

  private getSortedWins(): Array<[string, number]> {
    const wins = this.progress.datasetWins ?? {};
    return Object.entries(wins).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
    );
  }

  private formatWinsLine(): string {
    const sorted = this.getSortedWins();
    if (sorted.length === 0) {
      return "";
    }
    return sorted
      .slice(0, 3)
      .map(([id, count]) => `${id}: ${count}`)
      .join(" | ");
  }

  private describeLeader(): string {
    const sorted = this.getSortedWins();
    if (sorted.length === 0) {
      return "no results yet";
    }
    const [leaderId, leaderWins] = sorted[0]!;
    const nextWins = sorted[1]?.[1];
    if (typeof nextWins === "number" && leaderWins === nextWins) {
      return "tie";
    }
    return `${leaderId} (${leaderWins})`;
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
