import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mainHelp, modeHelp, modeList } from "../src/help.js";
import { main } from "../src/main.js";
import { findMode } from "../src/modes/registry.js";
import { copyMode } from "./support/copy-mode.mjs";
import { makeFolder } from "./support/folders.js";

const projectFolder = process.cwd();

function makeFiles(names: string[]) {
  for (const name of names) {
    writeFileSync(path.join(workFolder, name), name);
  }
}
const { version } = JSON.parse(
  readFileSync(path.join(projectFolder, "package.json"), "utf8"),
) as { version: string };
let workFolder = "";

beforeEach(() => {
  workFolder = makeFolder(["photo.heic", "photo.jpg", "clip.mov", "clip.mp4"]);
  process.chdir(workFolder);
});

afterEach(() => {
  process.chdir(projectFolder);
});

async function run(...args: string[]) {
  let stdout = "";
  let stderr = "";
  const exitCode = await main(
    args,
    {
      out: (text) => (stdout += text),
      err: (text) => (stderr += text),
      errIsTerminal: false,
      colours: { out: false, err: false },
    },
    { extraModes: [copyMode] },
  );
  return { exitCode, stdout, stderr };
}

async function expectFailure(args: string[], ...messageParts: string[]) {
  const result = await run(...args);
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
  it("shows the help screen with no arguments", async () => {
    expect(await run()).toEqual({
      exitCode: 0,
      stdout: `${mainHelp()}\n`,
      stderr: "",
    });
  });

  it.each(["--help", "-h"])("shows the help screen with %s", async (flag) => {
    expect(await run(flag)).toEqual({
      exitCode: 0,
      stdout: `${mainHelp()}\n`,
      stderr: "",
    });
  });

  it("prints the version from package.json", async () => {
    expect(await run("--version")).toEqual({
      exitCode: 0,
      stdout: `${version}\n`,
      stderr: "",
    });
  });

  it("lists the modes", async () => {
    expect(await run("--list-modes")).toEqual({
      exitCode: 0,
      stdout: `${modeList()}\n`,
      stderr: "",
    });
  });

  it("shows a mode's help with -m or --mode", async () => {
    const expected = {
      exitCode: 0,
      stdout: `${modeHelp(findMode("heictojpg")!)}\n`,
      stderr: "",
    };
    expect(await run("-m", "heictojpg", "--help")).toEqual(expected);
    expect(await run("--mode", "heictojpg", "--help")).toEqual(expected);
  });

  it("treats -o and --output the same", async () => {
    expect(await run("-m", "heictojpg", "photo.heic", "-o", "beach")).toEqual(
      await run("-m", "heictojpg", "photo.heic", "--output", "beach"),
    );
  });

  it.each(["heic2jpg", "heic-to-jpg", "HEICtoJPG", "heictojgp"])(
    "suggests heictojpg for %s",
    async (name) => {
      await expectFailure(
        ["-m", name],
        `Unknown mode ${name}.`,
        "Did you mean heictojpg?",
      );
    },
  );

  it("maps format aliases when suggesting", async () => {
    await expectFailure(["-m", "jpegtopng"], "Did you mean jpgtopng?");
  });

  it("points to --list-modes when nothing is close", async () => {
    await expectFailure(
      ["-m", "banana"],
      "Unknown mode banana.",
      "konvertoj --list-modes",
    );
  });

  it("explains that HEIC and SVG are input only", async () => {
    await expectFailure(
      ["-m", "pngtoheic"],
      "can read HEIC files but can't create them",
      "Did you mean pngtojpg?",
    );
    await expectFailure(
      ["-m", "jpgtosvg"],
      "can read SVG files but can't create them",
      "Did you mean jpgtopng?",
    );
    await expectFailure(
      ["-m", "tosvg"],
      "can read SVG files",
      "Did you mean topng?",
    );
    const noSuggestion = await expectFailure(
      ["-m", "pngtosvg"],
      "can read SVG files",
      "konvertoj --list-modes",
    );
    expect(noSuggestion.stderr).not.toContain("Did you mean");
  });

  it("needs a mode name after -m", async () => {
    await expectFailure(["-m"], "-m needs a mode name", commandShape);
  });

  it("needs -m when files are given", async () => {
    await expectFailure(["photo.heic"], "Choose a mode with -m", commandShape);
  });

  it("rejects an option from another mode", async () => {
    await expectFailure(
      ["-m", "heictojpg", "photo.heic", "--angle", "90"],
      "--angle",
      "heictojpg",
      "konvertoj -m heictojpg --help",
    );
  });

  it("rejects an option no mode has", async () => {
    await expectFailure(
      ["-m", "heictojpg", "photo.heic", "--banana"],
      "--banana isn't a konvertoj option",
    );
  });

  it("rejects a missing or unexpected value", async () => {
    await expectFailure(
      ["-m", "heictojpg", "photo.heic", "--quality"],
      "--quality needs a value",
    );
    await expectFailure(
      ["-m", "heictojpg", "photo.heic", "--overwrite=yes"],
      "--overwrite doesn't take a value",
    );
  });

  it("rejects words outside the allowed list", async () => {
    await expectFailure(
      ["-m", "resize", "photo.jpg", "--fit", "banana"],
      "--fit",
      "banana",
      "contain, cover, fill, inside, outside",
    );
  });

  it.each(["101", "0", "abc"])(
    "rejects image --quality %s",
    async (quality) => {
      await expectFailure(
        ["-m", "heictojpg", "photo.heic", "--quality", quality],
        "--quality must be a whole number from 1 to 100",
      );
    },
  );

  it("only accepts whole numbers where the rule says so", async () => {
    await expectFailure(
      ["-m", "togif", "clip.mp4", "--fps", "2.5"],
      "--fps must be a whole number from 1 to 30",
    );
  });

  it("applies each mode's own rule for a shared option name", async () => {
    await expectFailure(
      ["-m", "movtomp4", "clip.mov", "--quality", "80"],
      "low, medium, high",
    );
  });

  it.each([
    ["heictojpg", "photo.heic", "--quality", "1"],
    ["heictojpg", "photo.heic", "--quality", "100"],
    ["movtomp4", "clip.mov", "--quality", "HIGH"],
    ["rotate", "photo.jpg", "--angle", "-90"],
    ["crop", "photo.jpg", "--aspect", "banana"],
    ["heictojpg", "photo.heic", "--background", "red"],
    ["heictojpg", "photo.heic", "--background", "#f80"],
    ["heictojpg", "photo.heic", "--background", "#FF8800"],
    ["heictojpg", "photo.heic", "--background", "rgb(255, 136, 0)"],
  ])(
    "accepts valid values for %s %s %s %s",
    async (mode, file, option, value) => {
      const result = await run("-m", mode, file, option, value);
      expect(result.stderr).not.toContain(" must be ");
    },
  );

  it.each(["0", "257", "abc", "16,,32"])(
    "rejects --sizes %s",
    async (value) => {
      await expectFailure(
        ["-m", "pngtoico", "logo.png", "--sizes", value],
        "--sizes must be whole numbers from 1 to 256 separated by commas",
      );
    },
  );

  it("rejects a colour it doesn't recognise before touching files", async () => {
    await expectFailure(
      ["-m", "pngtojpg", "photo.png", "--background", "banana", "-o", "out/"],
      "--background must be a colour such as white, #ff8800 or rgb(255,136,0). You gave banana.",
    );
    expect(existsSync(path.join(workFolder, "out"))).toBe(false);
  });

  it("says when a mode isn't built yet", async () => {
    await expectFailure(
      ["-m", "movtomp4", "clip.mov"],
      "movtomp4 isn't available yet.",
    );
  });
  it("checks a mode's own option rules before inputs", async () => {
    const result = await expectFailure(
      ["-m", "resize", "missing.jpg"],
      "Give --width, --height or --scale",
    );
    expect(result.stderr).not.toContain("can't be found");
  });

  it("checks option values before inputs", async () => {
    const result = await expectFailure(
      ["-m", "heictojpg", "missing.heic", "--quality", "101"],
      "--quality must be a whole number from 1 to 100",
    );
    expect(result.stderr).not.toContain("can't be found");
  });

  it("reports input mistakes before saying a mode isn't built", async () => {
    const result = await expectFailure(
      ["-m", "movtomp4", "missing.mov"],
      "missing.mov can't be found",
    );
    expect(result.stderr).not.toContain("isn't available yet");
  });

  it("needs input files", async () => {
    await expectFailure(
      ["-m", "heictojpg"],
      "No input files given.",
      commandShape,
    );
  });

  it("prints the plan for a dry run", async () => {
    rmSync(path.join(workFolder, "photo.jpg"));
    expect(await run("-m", "heictojpg", "photo.heic", "--dry-run")).toEqual({
      exitCode: 0,
      stdout: "photo.heic → photo.jpg\n",
      stderr: "",
    });
  });

  it("lists every pair in a dry run without creating the output folder", async () => {
    makeFiles(["a.heic", "b.heic", "c.heic"]);
    const result = await run(
      "-m",
      "heictojpg",
      "a.heic",
      "b.heic",
      "c.heic",
      "-o",
      "converted",
      "--dry-run",
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(
      ["a", "b", "c"]
        .map(
          (name) => `${name}.heic → ${path.join("converted", `${name}.jpg`)}`,
        )
        .join("\n") + "\n",
    );
    expect(existsSync(path.join(workFolder, "converted"))).toBe(false);
  });

  it("shows naming warnings", async () => {
    const result = await run(
      "-m",
      "heictojpg",
      "photo.heic",
      "-o",
      "new.png",
      "--dry-run",
    );
    expect(result.stderr).toBe(
      "Warning: -o new.png ends in .png, but heictojpg makes JPG files. Saving as new.jpg.\n",
    );
    expect(result.stdout).toBe("photo.heic → new.jpg\n");
  });
  it("runs a mode and reports one success with a summary", async () => {
    makeFiles(["notes.txt"]);
    const result = await run("-m", "copy", "notes.txt");
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatch(
      /^✓ notes\.txt → notes-copy\.txt {2}9 B → 9 B\nDone in \d+\.\ds: 1 converted, 0 failed, 0 skipped\. 9 B → 9 B \(0%\)\.\n$/,
    );
    expect(readFileSync(path.join(workFolder, "notes-copy.txt"), "utf8")).toBe(
      "notes.txt",
    );
  });

  it("prints nothing on success with --quiet", async () => {
    makeFiles(["notes.txt"]);
    expect(await run("-m", "copy", "notes.txt", "--quiet")).toEqual({
      exitCode: 0,
      stdout: "",
      stderr: "",
    });
  });

  it("prints only failures with --quiet", async () => {
    makeFiles(["notes.txt", "fail.txt"]);
    expect(await run("-m", "copy", "notes.txt", "fail.txt", "-q")).toEqual({
      exitCode: 2,
      stdout: "",
      stderr: "✗ fail.txt: couldn't be copied because its name says fail\n",
    });
  });

  it("shows the technical error with --verbose", async () => {
    makeFiles(["crash.txt"]);
    const result = await run("-m", "copy", "crash.txt", "--verbose");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "✗ crash.txt: couldn't be converted because of an unexpected problem. Run again with --verbose for details.\n    Error: boom",
    );
    expect(result.stderr).toMatch(/^ {8}at /m);
  });

  it("hides the technical error without --verbose", async () => {
    makeFiles(["crash.txt"]);
    const result = await run("-m", "copy", "crash.txt");
    expect(result.stderr).not.toContain("boom");
    expect(result.stderr).not.toMatch(/^ +at /m);
  });

  it("rejects --quiet with --verbose", async () => {
    makeFiles(["notes.txt"]);
    await expectFailure(
      ["-m", "copy", "notes.txt", "-q", "-v"],
      "Use either --quiet or --verbose, not both.",
    );
  });

  it("says an unbuilt mode isn't available without creating the -o folder", async () => {
    await expectFailure(
      ["-m", "movtomp4", "clip.mov", "-o", "converted/"],
      "movtomp4 isn't available yet.",
    );
    expect(existsSync(path.join(workFolder, "converted"))).toBe(false);
  });
});
