import path from "node:path";
import { styleText } from "node:util";
import type { PlannedItem } from "./outputs.js";

export interface Output {
  out(text: string): void;
  err(text: string): void;
  errIsTerminal: boolean;
  colours: { out: boolean; err: boolean };
}

export interface ReportSettings {
  quiet: boolean;
  verbose: boolean;
  cwd: string;
  printing?: boolean;
  json?: boolean;
}

export interface Section {
  text: string;
  data: Record<string, unknown>;
}

export interface BatchResult {
  converted: number;
  failed: { item: PlannedItem; reason: string }[];
  skipped: number;
  sizeBefore: number;
  sizeAfter: number;
  interrupted: boolean;
}

type Style = Parameters<typeof styleText>[0];

const clearLine = "\r\x1b[K";
const redrawInterval = 100;

export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const shown = value < 10 ? value.toFixed(1) : Math.round(value).toString();
  return `${shown} ${units[unit]}`;
}

export function formatChange(before: number, after: number): string {
  const percent = Math.round(((after - before) / before) * 100);
  if (percent < 0) {
    return `−${-percent}%`;
  }
  return percent > 0 ? `+${percent}%` : "0%";
}

function formatDuration(milliseconds: number): string {
  const seconds = milliseconds / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)
    .toString()
    .padStart(2, "0")}s`;
}

function formatTimeLeft(seconds: number): string {
  if (seconds < 60) {
    const whole = Math.max(1, Math.round(seconds));
    return `about ${whole} second${whole === 1 ? "" : "s"} left`;
  }
  return `about ${Math.round(seconds / 60)} minutes left`;
}

function technicalDetails(error: unknown): string {
  const details =
    error instanceof Error ? (error.stack ?? String(error)) : String(error);
  const cause = error instanceof Error ? error.cause : undefined;
  return cause === undefined
    ? details
    : `${details}\nCaused by: ${technicalDetails(cause)}`;
}

export class Reporter {
  private done = 0;
  private jobProgress?: { fraction: number; startedAt: number };
  private barShown = false;
  private lastDrawn = 0;
  private readonly startedAt: number;
  private readonly sections: { index: number; section: Section }[] = [];

  constructor(
    private readonly output: Output,
    private readonly settings: ReportSettings,
    private readonly total: number,
    private readonly now: () => number = Date.now,
  ) {
    this.startedAt = now();
  }

  private get chatter(): "out" | "err" {
    return this.settings.printing ? "err" : "out";
  }

  started(item: PlannedItem): void {
    if (this.settings.verbose) {
      this.line(this.chatter, `Working on ${this.describe(item)}`);
    }
    this.showBar();
  }

  detail(message: string): void {
    if (this.settings.verbose) {
      this.line(this.chatter, `  ${message}`);
    }
  }

  shown(index: number, section: Section, notes: string[] = []): void {
    this.done++;
    this.jobProgress = undefined;
    this.sections.push({ index, section });
    if (!this.settings.quiet) {
      for (const note of notes) {
        this.line("err", `  Note: ${note}`);
      }
    }
    this.showBar();
  }

  succeeded(
    item: PlannedItem,
    before: number,
    after: number,
    notes: string[] = [],
    otherOutputs = 0,
  ): void {
    this.done++;
    this.jobProgress = undefined;
    if (!this.settings.quiet) {
      const others =
        otherOutputs > 0
          ? ` and ${otherOutputs} other${otherOutputs === 1 ? "" : "s"}`
          : "";
      const output = item.output
        ? `${path.relative(this.settings.cwd, item.output)}${others}`
        : "";
      const change = before > 0 ? ` (${formatChange(before, after)})` : "";
      const sizes = `${formatSize(before)} → ${formatSize(after)}${change}`;
      this.line(
        "out",
        `${this.paint("out", "green", "✓")} ${this.describe(item)} → ${output}  ${sizes}`,
      );
      for (const note of notes) {
        this.line("out", `  Note: ${note}`);
      }
    }
    this.showBar();
  }

  skipped(item: PlannedItem, reason: string): void {
    this.done++;
    this.jobProgress = undefined;
    if (!this.settings.quiet) {
      this.line(
        this.chatter,
        this.paint(
          this.chatter,
          "dim",
          `- ${this.describe(item)} skipped: ${reason}`,
        ),
      );
    }
    this.showBar();
  }

  failed(item: PlannedItem, reason: string, error?: unknown): void {
    this.done++;
    this.jobProgress = undefined;
    this.line(
      "err",
      `${this.paint("err", "red", "✗")} ${this.describe(item)}: ${reason}`,
    );
    if (this.settings.verbose && error !== undefined) {
      this.line("err", technicalDetails(error).replace(/^/gm, "    "));
    }
    this.showBar();
  }

  progress(fraction: number, startedAt: number): void {
    this.jobProgress = { fraction, startedAt };
    this.drawBar(false);
  }

  finish(result: BatchResult): void {
    this.hideBar();
    if (this.settings.printing) {
      this.printSections(result);
      return;
    }
    if (this.settings.quiet) {
      return;
    }
    const counts = `${result.converted} converted, ${result.failed.length} failed, ${result.skipped} skipped.`;
    const heading = result.interrupted
      ? `Stopped by Ctrl+C after ${this.done} of ${this.total}:`
      : `Done in ${formatDuration(this.now() - this.startedAt)}:`;
    const sizes =
      result.converted > 0
        ? ` ${formatSize(result.sizeBefore)} → ${formatSize(result.sizeAfter)}${
            result.sizeBefore > 0
              ? ` (${formatChange(result.sizeBefore, result.sizeAfter)})`
              : ""
          }.`
        : "";
    const lines = [`${heading} ${this.paint("out", "bold", counts)}${sizes}`];
    if (result.failed.length > 0) {
      lines.push(
        "Failed:",
        ...result.failed.map(
          ({ item, reason }) => `  ${this.describe(item)}: ${reason}`,
        ),
      );
    }
    this.output.out(`${lines.join("\n")}\n`);
  }

  private printSections(result: BatchResult): void {
    if (result.interrupted) {
      this.output.err(
        `Stopped by Ctrl+C after ${this.done} of ${this.total}.\n`,
      );
    }
    const ordered = this.sections
      .sort((a, b) => a.index - b.index)
      .map(({ section }) => section);
    if (this.settings.json) {
      this.output.out(
        `${JSON.stringify(
          ordered.map((section) => section.data),
          null,
          2,
        )}\n`,
      );
    } else if (ordered.length > 0) {
      this.output.out(
        `${ordered.map((section) => section.text).join("\n\n")}\n`,
      );
    }
  }

  private describe(item: PlannedItem): string {
    const [first] = item.inputs;
    const name = first ? path.relative(this.settings.cwd, first.path) : "";
    const others = item.inputs.length - 1;
    if (others === 0) {
      return name;
    }
    return `${name} and ${others} other${others === 1 ? "" : "s"}`;
  }

  private paint(stream: "out" | "err", style: Style, text: string): string {
    return this.output.colours[stream]
      ? styleText(style, text, { validateStream: false })
      : text;
  }

  private line(stream: "out" | "err", text: string): void {
    const barWasShown = this.barShown;
    this.hideBar();
    this.output[stream](`${text}\n`);
    if (barWasShown) {
      this.drawBar(true);
    }
  }

  private showBar(): void {
    if (!this.barShown) {
      this.drawBar(true);
    }
  }

  private drawBar(force: boolean): void {
    if (
      !this.output.errIsTerminal ||
      this.settings.quiet ||
      this.done >= this.total
    ) {
      return;
    }
    const time = this.now();
    if (!force && time - this.lastDrawn < redrawInterval) {
      return;
    }
    this.lastDrawn = time;
    let text = `Converting ${this.done}/${this.total}…`;
    if (this.jobProgress) {
      const { fraction, startedAt } = this.jobProgress;
      text += ` ${Math.round(fraction * 100)}%`;
      const elapsed = (time - startedAt) / 1000;
      if (elapsed >= 1 && fraction > 0) {
        text += `, ${formatTimeLeft((elapsed * (1 - fraction)) / fraction)}`;
      }
    }
    this.output.err(`${clearLine}${text}`);
    this.barShown = true;
  }

  private hideBar(): void {
    if (this.barShown) {
      this.output.err(clearLine);
      this.barShown = false;
    }
  }
}
