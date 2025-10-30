/**
 * CLI Renderer for dataset generation progress
 * Provides a live-updating dashboard view in the console
 */

export interface IGenerationState {
  id: number;
  totalSteps: number;
  currentStep: number;
  currentStepName: string;
  status: "pending" | "in-progress" | "completed";
}

export interface IOverallProgress {
  completed: number;
  inProgress: number;
  total: number;
}

export class DatasetGenerationRenderer {
  private generations: Map<number, IGenerationState> = new Map();
  private overallProgress: IOverallProgress = {
    completed: 0,
    inProgress: 0,
    total: 0,
  };
  private startTime: number = Date.now();
  private seed?: number;
  private outputFile: string = "";
  private concurrency: number = 1;
  private isStarted: boolean = false;

  constructor() {}

  /**
   * Initialize the renderer with configuration
   */
  start(config: {
    total: number;
    seed?: number;
    outputFile: string;
    concurrency: number;
  }) {
    this.overallProgress.total = config.total;
    this.seed = config.seed;
    this.outputFile = config.outputFile;
    this.concurrency = config.concurrency;
    this.isStarted = true;
    this.render();
  }

  /**
   * Update generation state
   */
  updateGeneration(
    id: number,
    updates: Partial<
      Omit<IGenerationState, "id"> & {
        status?: "pending" | "in-progress" | "completed";
      }
    >
  ) {
    const existing = this.generations.get(id) || {
      id,
      totalSteps: 0,
      currentStep: 0,
      currentStepName: "",
      status: "pending" as const,
    };

    this.generations.set(id, { ...existing, ...updates });
    this.render();
  }

  /**
   * Update overall progress
   */
  updateProgress(progress: IOverallProgress) {
    this.overallProgress = progress;
    this.render();
  }

  /**
   * Mark a generation as started
   */
  startGeneration(id: number, totalSteps: number) {
    this.updateGeneration(id, {
      totalSteps,
      currentStep: 0,
      status: "in-progress",
      currentStepName: "Initializing...",
    });
  }

  /**
   * Update step progress for a generation
   */
  updateStep(id: number, step: number, stepName: string) {
    this.updateGeneration(id, {
      currentStep: step,
      currentStepName: stepName,
    });
  }

  /**
   * Mark a generation as completed
   */
  completeGeneration(id: number) {
    this.updateGeneration(id, {
      status: "completed",
    });
  }

  /**
   * Finish and show final summary
   */
  finish() {
    const elapsedTime = ((Date.now() - this.startTime) / 1000).toFixed(2);

    // Clear and show final state
    this.clearConsole();

    console.log(
      "╔═══════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║            Dataset Generation Complete! ✅                ║"
    );
    console.log(
      "╚═══════════════════════════════════════════════════════════╝"
    );
    console.log();
    console.log(`⏱️  Total time: ${elapsedTime}s`);
    console.log(
      `📦 Generated ${this.overallProgress.completed} records successfully`
    );
    console.log(`💾 Saved to: ${this.outputFile}`);
    console.log();
  }

  /**
   * Clear the console
   */
  private clearConsole() {
    // Move cursor to top and clear screen
    process.stdout.write("\x1b[2J\x1b[H");
  }

  /**
   * Render the current state
   */
  private render() {
    if (!this.isStarted) return;

    this.clearConsole();

    // Header
    console.log(
      "╔═══════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║           Dataset Generation Dashboard 🚀                 ║"
    );
    console.log(
      "╚═══════════════════════════════════════════════════════════╝"
    );
    console.log();

    // Configuration
    console.log("📋 Configuration:");
    console.log(`   Total records: ${this.overallProgress.total}`);
    console.log(`   Concurrency: ${this.concurrency}`);
    if (this.seed !== undefined) {
      console.log(`   Seed: ${this.seed}`);
    }
    console.log(`   Output: ${this.outputFile}`);
    console.log();

    // Overall Progress
    const { completed, inProgress, total } = this.overallProgress;
    const remaining = total - completed - inProgress;
    const percentage =
      total > 0 ? ((completed / total) * 100).toFixed(1) : "0.0";

    console.log("📊 Overall Progress:");
    console.log(
      `   ${this.renderProgressBar(
        completed,
        total
      )} ${completed}/${total} (${percentage}%)`
    );
    console.log(
      `   ⏳ In Progress: ${inProgress} | 📋 Remaining: ${remaining}`
    );
    console.log();

    // Individual Generations (only show in-progress)
    const inProgressGenerations = Array.from(this.generations.values())
      .filter((gen) => gen.status === "in-progress")
      .sort((a, b) => a.id - b.id);

    if (inProgressGenerations.length > 0) {
      console.log("🔄 Active Generations:");

      for (const gen of inProgressGenerations) {
        this.renderGeneration(gen);
      }
    }

    // Footer with elapsed time
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log();
    console.log(`⏱️  Elapsed: ${elapsed}s`);
  }

  /**
   * Render a single generation (compact one-line format)
   */
  private renderGeneration(gen: IGenerationState) {
    const statusIcon =
      gen.status === "completed"
        ? "✅"
        : gen.status === "in-progress"
        ? "⚙️"
        : "⏸️";

    if (gen.totalSteps > 0) {
      const stepPercentage =
        gen.totalSteps > 0
          ? ((gen.currentStep / gen.totalSteps) * 100).toFixed(0)
          : "0";

      const progressBar = this.renderProgressBar(
        gen.currentStep,
        gen.totalSteps,
        15
      );

      const stepInfo = `${gen.currentStep}/${gen.totalSteps} (${stepPercentage}%)`;
      const statusText = gen.currentStepName || "Initializing...";

      console.log(
        `   ${statusIcon} Gen #${
          gen.id + 1
        }: ${progressBar} ${stepInfo} - ${statusText}`
      );
    } else {
      console.log(`   ${statusIcon} Gen #${gen.id + 1}: Initializing...`);
    }
  }

  /**
   * Render a progress bar
   */
  private renderProgressBar(
    current: number,
    total: number,
    width: number = 30
  ): string {
    if (total === 0 || !Number.isFinite(total) || !Number.isFinite(current)) {
      return `[${"░".repeat(width)}]`;
    }

    // Ensure current is within valid bounds
    const clampedCurrent = Math.max(0, Math.min(current, total));
    const filled = Math.floor((clampedCurrent / total) * width);
    const clampedFilled = Math.max(0, Math.min(filled, width));
    const empty = Math.max(0, width - clampedFilled);

    return `[${"█".repeat(clampedFilled)}${"░".repeat(empty)}]`;
  }
}
