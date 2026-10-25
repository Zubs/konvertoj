import {
  chmodSync,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { UserError } from "../src/errors.js";
import {
  pendingTemporaryFiles,
  prepareOutputFolders,
  writeOutputFile,
} from "../src/output-files.js";
import { cannotTestPermissions, makeFolder } from "./support/folders.js";

const lockedPaths: string[] = [];

afterEach(() => {
  for (const locked of lockedPaths.splice(0)) {
    chmodSync(locked, 0o755);
  }
});

describe("prepareOutputFolders", () => {
  it("creates a missing output folder", async () => {
    const cwd = makeFolder();
    await prepareOutputFolders(
      [{ inputs: [], output: path.join(cwd, "converted", "a.jpg") }],
      cwd,
    );
    expect(statSync(path.join(cwd, "converted")).isDirectory()).toBe(true);
    expect(readdirSync(path.join(cwd, "converted"))).toEqual([]);
  });

  it.skipIf(cannotTestPermissions)(
    "fails for a folder it can't write to, naming it",
    async () => {
      const cwd = makeFolder(["locked/.keep"]);
      const locked = path.join(cwd, "locked");
      chmodSync(locked, 0o555);
      lockedPaths.push(locked);
      const error = await prepareOutputFolders(
        [{ inputs: [], output: path.join(locked, "a.jpg") }],
        cwd,
      ).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(UserError);
      expect((error as UserError).message).toBe(
        "Can't write to locked. Choose another folder with -o.",
      );
    },
  );
});

describe("writeOutputFile", () => {
  it("leaves only the complete file after a successful write", async () => {
    const cwd = makeFolder();
    const saved = await writeOutputFile(
      path.join(cwd, "photo.jpg"),
      (temporaryPath) => writeFile(temporaryPath, "result"),
      { overwrite: false },
    );
    expect(saved).toBe(path.join(cwd, "photo.jpg"));
    expect(readFileSync(saved, "utf8")).toBe("result");
    expect(readdirSync(cwd)).toEqual(["photo.jpg"]);
  });

  it("leaves nothing behind when writing fails", async () => {
    const cwd = makeFolder();
    const failure = new Error("disk full");
    const write = async (temporaryPath: string) => {
      await writeFile(temporaryPath, "half");
      throw failure;
    };
    await expect(
      writeOutputFile(path.join(cwd, "photo.jpg"), write, { overwrite: false }),
    ).rejects.toBe(failure);
    expect(readdirSync(cwd)).toEqual([]);
  });

  it("takes the next number when the name appeared meanwhile", async () => {
    const cwd = makeFolder();
    const finalPath = path.join(cwd, "photo.jpg");
    const saved = await writeOutputFile(
      finalPath,
      async (temporaryPath) => {
        writeFileSync(finalPath, "someone else");
        await writeFile(temporaryPath, "result");
      },
      { overwrite: false },
    );
    expect(saved).toBe(path.join(cwd, "photo (1).jpg"));
    expect(readFileSync(finalPath, "utf8")).toBe("someone else");
  });

  it("replaces the file with --overwrite", async () => {
    const cwd = makeFolder(["photo.jpg"]);
    const finalPath = path.join(cwd, "photo.jpg");
    const saved = await writeOutputFile(
      finalPath,
      (temporaryPath) => writeFile(temporaryPath, "result"),
      {
        overwrite: true,
      },
    );
    expect(saved).toBe(finalPath);
    expect(readFileSync(finalPath, "utf8")).toBe("result");
  });

  it("only reads the input next to the output", async () => {
    const cwd = makeFolder(["photo.png"]);
    const input = path.join(cwd, "photo.png");
    const before = {
      contents: readFileSync(input, "utf8"),
      modified: statSync(input).mtimeMs,
    };
    await writeOutputFile(
      path.join(cwd, "photo.jpg"),
      async (temporaryPath) => writeFile(temporaryPath, readFileSync(input)),
      { overwrite: true },
    );
    expect({
      contents: readFileSync(input, "utf8"),
      modified: statSync(input).mtimeMs,
    }).toEqual(before);
    expect(existsSync(path.join(cwd, "photo.jpg"))).toBe(true);
  });
  it("forgets temporary files once they're renamed or removed", async () => {
    const cwd = makeFolder();
    await writeOutputFile(
      path.join(cwd, "a.jpg"),
      (temporaryPath) => writeFile(temporaryPath, "a"),
      {
        overwrite: false,
      },
    );
    await writeOutputFile(
      path.join(cwd, "b.jpg"),
      async () => {
        throw new Error("disk full");
      },
      { overwrite: false },
    ).catch(() => undefined);
    expect(pendingTemporaryFiles.size).toBe(0);
  });
});
