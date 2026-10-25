import path from "node:path";
import { describe, expect, it } from "vitest";
import type { PlannedItem } from "../src/outputs.js";
import {
  formatChange,
  formatSize,
  Reporter,
  type BatchResult,
  type Output,
} from "../src/report.js";

const cwd = path.resolve("work");

function fakeOutput(terminal: boolean, colours = false) {
  const written = { out: "", err: "" };
  const output: Output = {
    out: (text) => (written.out += text),
    err: (text) => (written.err += text),
    errIsTerminal: terminal,
    colours: { out: colours, err: colours },
  };
  return { output, written };
}

function item(name: string, output?: string, extraInputs = 0): PlannedItem {
  const inputs = [
    name,
    ...Array.from({ length: extraInputs }, (_, index) => `extra${index}.jpg`),
  ].map((file) => ({
    path: path.join(cwd, file),
  }));
  return { inputs, output: output && path.join(cwd, output) };
}

function result(overrides: Partial<BatchResult> = {}): BatchResult {
  return {
    converted: 0,
    failed: [],
    skipped: 0,
    sizeBefore: 0,
    sizeAfter: 0,
    interrupted: false,
    ...overrides,
  };
}

function clock(start = 0) {
  let time = start;
  return {
    now: () => time,
    advance: (milliseconds: number) => (time += milliseconds),
  };
}

describe("formatSize", () => {
  it.each([
    [0, "0 B"],
    [500, "500 B"],
    [1000, "1000 B"],
    [4000, "3.9 KB"],
    [4500, "4.4 KB"],
    [419_840, "410 KB"],
    [2_516_582, "2.4 MB"],
    [3 * 1024 ** 3, "3.0 GB"],
  ])("formats %d bytes as %s", (bytes, expected) => {
    expect(formatSize(bytes)).toBe(expected);
  });
});

describe("formatChange", () => {
  it.each([
    [100, 26, "−74%"],
    [4000, 4500, "+13%"],
    [500, 500, "0%"],
  ])("shows %d → %d as %s", (before, after, expected) => {
    expect(formatChange(before, after)).toBe(expected);
  });
});

describe("Reporter", () => {
  it("prints a success line and a summary", () => {
    const { output, written } = fakeOutput(false);
    const time = clock();
    const reporter = new Reporter(
      output,
      { quiet: false, verbose: false, cwd },
      1,
      time.now,
    );
    reporter.succeeded(item("photo.heic", "photo.jpg"), 2_516_582, 419_840);
    time.advance(1200);
    reporter.finish(
      result({ converted: 1, sizeBefore: 2_516_582, sizeAfter: 419_840 }),
    );
    expect(written.out).toBe(
      "✓ photo.heic → photo.jpg  2.4 MB → 410 KB\nDone in 1.2s: 1 converted, 0 failed, 0 skipped. 2.4 MB → 410 KB (−83%).\n",
    );
    expect(written.err).toBe("");
  });

  it("prints skip and failure lines, and lists failures in the summary", () => {
    const { output, written } = fakeOutput(false);
    const reporter = new Reporter(
      output,
      { quiet: false, verbose: false, cwd },
      2,
      clock().now,
    );
    const failedItem = item("secret.jpg");
    reporter.skipped(item("photo.jpg"), "already a JPG");
    reporter.failed(failedItem, "can't be read (permission denied)");
    reporter.finish(
      result({
        skipped: 1,
        failed: [
          { item: failedItem, reason: "can't be read (permission denied)" },
        ],
      }),
    );
    expect(written.out).toBe(
      "- photo.jpg skipped: already a JPG\nDone in 0.0s: 0 converted, 1 failed, 1 skipped.\nFailed:\n  secret.jpg: can't be read (permission denied)\n",
    );
    expect(written.err).toBe(
      "✗ secret.jpg: can't be read (permission denied)\n",
    );
  });

  it("names a combined item's first input and how many others", () => {
    const { output, written } = fakeOutput(false);
    const reporter = new Reporter(
      output,
      { quiet: false, verbose: false, cwd },
      1,
      clock().now,
    );
    reporter.succeeded(item("scan1.jpg", "scans.pdf", 2), 3000, 1000);
    expect(written.out).toBe(
      "✓ scan1.jpg and 2 others → scans.pdf  2.9 KB → 1000 B\n",
    );
  });

  it("shows a progress bar only in a terminal, and clears it before lines and the summary", () => {
    const piped = fakeOutput(false);
    const pipedReporter = new Reporter(
      piped.output,
      { quiet: false, verbose: false, cwd },
      2,
      clock().now,
    );
    pipedReporter.progress(0.5, 0);
    pipedReporter.succeeded(item("a.png", "a.jpg"), 10, 10);
    expect(piped.written.err).toBe("");

    const terminal = fakeOutput(true);
    const time = clock();
    const reporter = new Reporter(
      terminal.output,
      { quiet: false, verbose: false, cwd },
      2,
      time.now,
    );
    time.advance(200);
    reporter.progress(0.1, 200);
    expect(terminal.written.err).toBe("\r\x1b[KConverting 0/2… 10%");
    reporter.succeeded(item("a.png", "a.jpg"), 10, 10);
    expect(terminal.written.err).toBe(
      "\r\x1b[KConverting 0/2… 10%\r\x1b[K\r\x1b[KConverting 1/2…",
    );
    reporter.succeeded(item("b.png", "b.jpg"), 10, 10);
    reporter.finish(result({ converted: 2, sizeBefore: 20, sizeAfter: 20 }));
    expect(terminal.written.err.endsWith("\r\x1b[K")).toBe(true);
    expect(terminal.written.out).not.toContain("\r");
  });

  it("shows the progress bar as soon as work starts", () => {
    const { output, written } = fakeOutput(true);
    const reporter = new Reporter(
      output,
      { quiet: false, verbose: false, cwd },
      2,
      clock().now,
    );
    reporter.started(item("a.png", "a.jpg"));
    expect(written.err).toBe("\r\x1b[KConverting 0/2…");
  });

  it("shows a long job's percentage and time left", () => {
    const { output, written } = fakeOutput(true);
    const time = clock();
    const reporter = new Reporter(
      output,
      { quiet: false, verbose: false, cwd },
      1,
      time.now,
    );
    time.advance(30_000);
    reporter.progress(0.45, 0);
    expect(written.err).toBe(
      "\r\x1b[KConverting 0/1… 45%, about 37 seconds left",
    );
  });

  it("limits redraws to once every 100 ms", () => {
    const { output, written } = fakeOutput(true);
    const time = clock(1000);
    const reporter = new Reporter(
      output,
      { quiet: false, verbose: false, cwd },
      1,
      time.now,
    );
    time.advance(100);
    reporter.progress(0.1, 1000);
    reporter.progress(0.2, 1000);
    time.advance(100);
    reporter.progress(0.3, 1000);
    expect(written.err).toBe(
      "\r\x1b[KConverting 0/1… 10%\r\x1b[KConverting 0/1… 30%",
    );
  });

  it("shows only failures with --quiet", () => {
    const { output, written } = fakeOutput(true);
    const reporter = new Reporter(
      output,
      { quiet: true, verbose: false, cwd },
      2,
      clock().now,
    );
    reporter.progress(0.5, 0);
    reporter.succeeded(item("a.png", "a.jpg"), 10, 10);
    reporter.failed(item("b.png"), "couldn't be converted");
    reporter.finish(
      result({
        converted: 1,
        failed: [{ item: item("b.png"), reason: "couldn't be converted" }],
      }),
    );
    expect(written.out).toBe("");
    expect(written.err).toBe("✗ b.png: couldn't be converted\n");
  });

  it("adds starts, details and stacks with --verbose", () => {
    const { output, written } = fakeOutput(false);
    const reporter = new Reporter(
      output,
      { quiet: false, verbose: true, cwd },
      1,
      clock().now,
    );
    reporter.started(item("a.png"));
    reporter.detail("Copying a.png");
    reporter.failed(item("a.png"), "couldn't be converted", new Error("boom"));
    expect(written.out).toBe("Working on a.png\n  Copying a.png\n");
    expect(written.err).toContain(
      "✗ a.png: couldn't be converted\n    Error: boom\n",
    );
    expect(written.err).toMatch(/^ {8}at /m);
  });

  it("uses colour codes only when colours are on", () => {
    const plain = fakeOutput(false, false);
    new Reporter(
      plain.output,
      { quiet: false, verbose: false, cwd },
      1,
      clock().now,
    ).succeeded(item("a.png", "a.jpg"), 1, 1);
    expect(plain.written.out).not.toContain("\x1b[");

    const coloured = fakeOutput(false, true);
    new Reporter(
      coloured.output,
      { quiet: false, verbose: false, cwd },
      1,
      clock().now,
    ).succeeded(item("a.png", "a.jpg"), 1, 1);
    expect(coloured.written.out).toContain("\x1b[32m✓\x1b[39m");
  });

  it("reports how far it got when stopped", () => {
    const { output, written } = fakeOutput(false);
    const reporter = new Reporter(
      output,
      { quiet: false, verbose: false, cwd },
      10,
      clock().now,
    );
    for (const name of ["a", "b", "c", "d"]) {
      reporter.succeeded(item(`${name}.png`, `${name}.jpg`), 100, 50);
    }
    reporter.finish(
      result({
        converted: 4,
        sizeBefore: 400,
        sizeAfter: 200,
        interrupted: true,
      }),
    );
    expect(written.out.trim().split("\n").at(-1)).toBe(
      "Stopped by Ctrl+C after 4 of 10: 4 converted, 0 failed, 0 skipped. 400 B → 200 B (−50%).",
    );
  });
});
