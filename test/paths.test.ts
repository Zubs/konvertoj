import { mkdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { displayPath } from "../src/paths.js";
import { makeFolder } from "./support/folders.js";
import { writeImage } from "./support/images.js";
import { runIn } from "./support/run-main.js";

describe("displayPath", () => {
  const cwd = path.resolve("work");

  it("shows a file inside the current folder relative to it", () => {
    expect(displayPath(cwd, path.join(cwd, "photos", "a.jpg"))).toBe(
      path.join("photos", "a.jpg"),
    );
  });

  it("shows a file outside the current folder in full", () => {
    const outside = path.resolve("elsewhere", "b.jpg");
    expect(displayPath(cwd, outside)).toBe(outside);
    expect(displayPath(cwd, path.dirname(cwd))).toBe(path.dirname(cwd));
  });

  it("shows the current folder itself in full", () => {
    expect(displayPath(cwd, cwd)).toBe(cwd);
  });

  it("keeps a name that only starts with two dots relative", () => {
    expect(displayPath(cwd, path.join(cwd, "..notes.jpg"))).toBe("..notes.jpg");
  });

  it.runIf(process.platform === "win32")(
    "shows a file on another drive in full",
    () => {
      expect(displayPath("C:\\work", "D:\\photos\\a.jpg")).toBe(
        "D:\\photos\\a.jpg",
      );
    },
  );

  it("shows a failing file outside the current folder in full in a run", async () => {
    const folder = makeFolder();
    mkdirSync(path.join(folder, "here"));
    const missing = path.join(folder, "missing.png");
    await writeImage(folder, "real.png", "png");
    const result = await runIn(
      path.join(folder, "here"),
      "-m",
      "pngtojpg",
      path.join(folder, "real.png"),
      "-o",
      path.join(folder, "out.jpg"),
    );
    expect(result.stdout).toContain(
      `✓ ${path.join(folder, "real.png")} → ${path.join(folder, "out.jpg")}`,
    );
    const failed = await runIn(
      path.join(folder, "here"),
      "-m",
      "pngtojpg",
      missing,
    );
    expect(failed.stderr).not.toContain("..");
  });
});
