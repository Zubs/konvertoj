import { chmodSync, mkdirSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { InputError, resolveInputs } from "../src/inputs.js";
import { cannotTestPermissions, makeFolder } from "./support/folders.js";

const lockedPaths: string[] = [];

afterEach(() => {
  for (const locked of lockedPaths.splice(0)) {
    chmodSync(locked, 0o755);
  }
});

async function inputNames(cwd: string, args: string[], recursive = false) {
  const { inputs } = await resolveInputs(args, { recursive, cwd });
  return inputs.map((input) => path.relative(cwd, input.path));
}

async function failure(cwd: string, args: string[]) {
  const error = await resolveInputs(args, { recursive: false, cwd }).catch(
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(InputError);
  return (error as InputError).message;
}

describe("resolveInputs", () => {
  it("needs at least one input", async () => {
    expect(await failure(makeFolder(), [])).toContain("No input files given.");
  });

  it("uses a single file", async () => {
    const cwd = makeFolder(["holiday.heic"]);
    expect(await inputNames(cwd, ["holiday.heic"])).toEqual(["holiday.heic"]);
  });

  it("expands a quoted pattern itself", async () => {
    const cwd = makeFolder(["photos/a.heic", "photos/b.heic", "photos/c.png"]);
    expect(await inputNames(cwd, ["photos/*.heic"])).toEqual([
      path.join("photos", "a.heic"),
      path.join("photos", "b.heic"),
    ]);
  });

  it("expands an absolute pattern and records its base", async () => {
    const cwd = makeFolder(["photos/a.heic"]);
    const pattern = path.join(cwd, "photos", "*.heic").replaceAll("\\", "/");
    const { inputs } = await resolveInputs([pattern], {
      recursive: false,
      cwd,
    });
    expect(inputs).toEqual([
      {
        path: path.join(cwd, "photos", "a.heic"),
        base: path.join(cwd, "photos"),
      },
    ]);
  });

  it.runIf(process.platform === "win32")(
    "accepts Windows separators in a pattern",
    async () => {
      const cwd = makeFolder(["photos/a.heic"]);
      expect(await inputNames(cwd, ["photos\\*.heic"])).toEqual([
        path.join("photos", "a.heic"),
      ]);
    },
  );

  it("reads only a folder's top level without --recursive", async () => {
    const cwd = makeFolder(["shots/a.png", "shots/sub/b.png"]);
    expect(await inputNames(cwd, ["shots"])).toEqual([
      path.join("shots", "a.png"),
    ]);
  });

  it("reads subfolders with --recursive", async () => {
    const cwd = makeFolder(["shots/a.png", "shots/sub/b.png"]);
    expect(await inputNames(cwd, ["shots"], true)).toEqual([
      path.join("shots", "a.png"),
      path.join("shots", "sub", "b.png"),
    ]);
  });

  it("skips hidden files and folders found in folders and patterns", async () => {
    const cwd = makeFolder([
      "shots/photo.jpg",
      "shots/.DS_Store",
      "shots/.cache/old.jpg",
    ]);
    expect(await inputNames(cwd, ["shots"], true)).toEqual([
      path.join("shots", "photo.jpg"),
    ]);
    expect(await inputNames(cwd, ["shots/**/*"])).toEqual([
      path.join("shots", "photo.jpg"),
    ]);
  });

  it("uses a hidden file named directly", async () => {
    const cwd = makeFolder([".hidden.jpg"]);
    expect(await inputNames(cwd, [".hidden.jpg"])).toEqual([".hidden.jpg"]);
  });

  it("sorts a folder's files in natural order", async () => {
    const cwd = makeFolder([
      "pages/page10.png",
      "pages/page2.png",
      "pages/Page1.png",
    ]);
    expect(await inputNames(cwd, ["pages"])).toEqual([
      path.join("pages", "Page1.png"),
      path.join("pages", "page2.png"),
      path.join("pages", "page10.png"),
    ]);
  });

  it("keeps the typed order of named files", async () => {
    const cwd = makeFolder(["a.jpg", "b.jpg"]);
    expect(await inputNames(cwd, ["b.jpg", "a.jpg"])).toEqual([
      "b.jpg",
      "a.jpg",
    ]);
  });

  it("uses a file only once", async () => {
    const cwd = makeFolder(["photos/photo.jpg"]);
    expect(
      await inputNames(cwd, [
        "photos/photo.jpg",
        "photos/photo.jpg",
        "./photos/photo.jpg",
        "photos",
      ]),
    ).toEqual([path.join("photos", "photo.jpg")]);
  });

  it("names a missing file", async () => {
    const message = await failure(makeFolder(), ["holday.heic"]);
    expect(message).toContain("holday.heic can't be found");
  });

  it("names every wrong input together", async () => {
    const cwd = makeFolder(["empty/.DS_Store"]);
    const message = await failure(cwd, [
      "one.heic",
      "two.heic",
      "empty",
      "*.heic",
    ]);
    expect(message).toContain("one.heic can't be found");
    expect(message).toContain("two.heic can't be found");
    expect(message).toContain("No matching files found in empty.");
    expect(message).toContain('No matching files found for "*.heic".');
  });

  it("records the base each input came from", async () => {
    const cwd = makeFolder(["shots/a.png", "photos/2024/b.png", "c.png"]);
    const { inputs } = await resolveInputs(
      ["shots", "photos/2024/*.png", "c.png"],
      { recursive: false, cwd },
    );
    expect(inputs.map((input) => input.base)).toEqual([
      path.join(cwd, "shots"),
      path.join(cwd, "photos", "2024"),
      undefined,
    ]);
  });

  it("works with unusual file names", async () => {
    const longName = `${"a".repeat(196)}.jpg`;
    const names = ["my photo.jpg", "café.jpg", "🌴 beach.jpg", longName];
    const cwd = makeFolder(names);
    expect(await inputNames(cwd, names)).toEqual(names);
  });

  it.skipIf(cannotTestPermissions)(
    "marks an unreadable file instead of stopping",
    async () => {
      const cwd = makeFolder(["a.jpg", "secret.jpg"]);
      const secret = path.join(cwd, "secret.jpg");
      chmodSync(secret, 0o000);
      lockedPaths.push(secret);
      const { inputs } = await resolveInputs(["a.jpg", "secret.jpg"], {
        recursive: false,
        cwd,
      });
      expect(inputs).toEqual([
        { path: path.join(cwd, "a.jpg") },
        { path: secret, unreadable: "permission denied" },
      ]);
    },
  );

  it.skipIf(cannotTestPermissions)(
    "skips a locked subfolder with a warning",
    async () => {
      const cwd = makeFolder(["shots/a.png", "shots/locked/b.png"]);
      const locked = path.join(cwd, "shots", "locked");
      mkdirSync(locked, { recursive: true });
      chmodSync(locked, 0o000);
      lockedPaths.push(locked);
      const { inputs, warnings } = await resolveInputs(["shots"], {
        recursive: true,
        cwd,
      });
      expect(inputs.map((input) => path.relative(cwd, input.path))).toEqual([
        path.join("shots", "a.png"),
      ]);
      expect(warnings).toEqual([
        `Skipped ${path.join("shots", "locked")} because it can't be opened.`,
      ]);
    },
  );
});
