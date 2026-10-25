import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mainHelp, modeHelp, modeList } from "../src/help.js";
import { main } from "../src/main.js";
import { findMode } from "../src/modes/registry.js";

function run(...args: string[]) {
  let stdout = "";
  let stderr = "";
  const exitCode = main(args, {
    out: (text) => (stdout += text),
    err: (text) => (stderr += text),
  });
  return { exitCode, stdout, stderr };
}

function expectFailure(args: string[], ...messageParts: string[]) {
  const result = run(...args);
  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).not.toMatch(/^ {4}at /m);
  for (const part of messageParts) {
    expect(result.stderr).toContain(part);
  }
  return result;
}

const commandShape = "konvertoj -m <mode> <input> -o <output> [options]";

describe("main", () => {
  it("shows the help screen with no arguments", () => {
    expect(run()).toEqual({
      exitCode: 0,
      stdout: `${mainHelp()}\n`,
      stderr: "",
    });
  });

  it.each(["--help", "-h"])("shows the help screen with %s", (flag) => {
    expect(run(flag)).toEqual({
      exitCode: 0,
      stdout: `${mainHelp()}\n`,
      stderr: "",
    });
  });

  it("prints the version from package.json", () => {
    const { version } = JSON.parse(readFileSync("package.json", "utf8")) as {
      version: string;
    };
    expect(run("--version")).toEqual({
      exitCode: 0,
      stdout: `${version}\n`,
      stderr: "",
    });
  });

  it("lists the modes", () => {
    expect(run("--list-modes")).toEqual({
      exitCode: 0,
      stdout: `${modeList()}\n`,
      stderr: "",
    });
  });

  it("shows a mode's help with -m or --mode", () => {
    const expected = {
      exitCode: 0,
      stdout: `${modeHelp(findMode("heictojpg")!)}\n`,
      stderr: "",
    };
    expect(run("-m", "heictojpg", "--help")).toEqual(expected);
    expect(run("--mode", "heictojpg", "--help")).toEqual(expected);
  });

  it("treats -o and --output the same", () => {
    expect(run("-m", "heictojpg", "photo.heic", "-o", "beach")).toEqual(
      run("-m", "heictojpg", "photo.heic", "--output", "beach"),
    );
  });

  it.each(["heic2jpg", "heic-to-jpg", "HEICtoJPG", "heictojgp"])(
    "suggests heictojpg for %s",
    (name) => {
      expectFailure(
        ["-m", name],
        `Unknown mode ${name}.`,
        "Did you mean heictojpg?",
      );
    },
  );

  it("maps format aliases when suggesting", () => {
    expectFailure(["-m", "jpegtopng"], "Did you mean jpgtopng?");
  });

  it("points to --list-modes when nothing is close", () => {
    expectFailure(
      ["-m", "banana"],
      "Unknown mode banana.",
      "konvertoj --list-modes",
    );
  });

  it("explains that HEIC and SVG are input only", () => {
    expectFailure(
      ["-m", "pngtoheic"],
      "can read HEIC files but can't create them",
      "Did you mean pngtojpg?",
    );
    expectFailure(
      ["-m", "jpgtosvg"],
      "can read SVG files but can't create them",
      "Did you mean jpgtopng?",
    );
    expectFailure(["-m", "tosvg"], "can read SVG files", "Did you mean topng?");
    const noSuggestion = expectFailure(
      ["-m", "pngtosvg"],
      "can read SVG files",
      "konvertoj --list-modes",
    );
    expect(noSuggestion.stderr).not.toContain("Did you mean");
  });

  it("needs a mode name after -m", () => {
    expectFailure(["-m"], "-m needs a mode name", commandShape);
  });

  it("needs -m when files are given", () => {
    expectFailure(["photo.heic"], "Choose a mode with -m", commandShape);
  });

  it("rejects an option from another mode", () => {
    expectFailure(
      ["-m", "heictojpg", "photo.heic", "--angle", "90"],
      "--angle",
      "heictojpg",
      "konvertoj -m heictojpg --help",
    );
  });

  it("rejects an option no mode has", () => {
    expectFailure(
      ["-m", "heictojpg", "photo.heic", "--banana"],
      "--banana isn't a konvertoj option",
    );
  });

  it("rejects a missing or unexpected value", () => {
    expectFailure(
      ["-m", "heictojpg", "photo.heic", "--quality"],
      "--quality needs a value",
    );
    expectFailure(
      ["-m", "heictojpg", "photo.heic", "--overwrite=yes"],
      "--overwrite doesn't take a value",
    );
  });

  it("rejects words outside the allowed list", () => {
    expectFailure(
      ["-m", "resize", "photo.jpg", "--fit", "banana"],
      "--fit",
      "banana",
      "contain, cover, fill, inside, outside",
    );
  });

  it.each(["101", "0", "abc"])("rejects image --quality %s", (quality) => {
    expectFailure(
      ["-m", "heictojpg", "photo.heic", "--quality", quality],
      "--quality must be a whole number from 1 to 100",
    );
  });

  it("only accepts whole numbers where the rule says so", () => {
    expectFailure(
      ["-m", "togif", "clip.mp4", "--fps", "2.5"],
      "--fps must be a whole number from 1 to 30",
    );
  });

  it("applies each mode's own rule for a shared option name", () => {
    expectFailure(
      ["-m", "movtomp4", "clip.mov", "--quality", "80"],
      "low, medium, high",
    );
  });

  it.each([
    ["heictojpg", "photo.heic", "--quality", "1"],
    ["heictojpg", "photo.heic", "--quality", "100"],
    ["movtomp4", "clip.mov", "--quality", "HIGH"],
    ["rotate", "photo.jpg", "--angle", "-90"],
    ["heictojpg", "photo.heic", "--background", "banana"],
  ])("accepts valid values for %s %s %s %s", (mode, file, option, value) => {
    expectFailure(
      ["-m", mode, file, option, value],
      `${mode} isn't available yet.`,
    );
  });

  it("says when a mode isn't built yet", () => {
    expectFailure(
      ["-m", "heictojpg", "photo.heic"],
      "heictojpg isn't available yet.",
    );
  });
});
