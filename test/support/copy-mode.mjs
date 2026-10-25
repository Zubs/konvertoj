import { Buffer } from "node:buffer";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";

export const copyStats = { running: 0, mostAtOnce: 0 };

export function resetCopyStats() {
  copyStats.running = 0;
  copyStats.mostAtOnce = 0;
}

function userError(message) {
  const error = new Error(message);
  error.name = "UserError";
  return error;
}

async function copy({ inputs, save, detail, signal }) {
  const [input] = inputs;
  const name = path.basename(input.path);
  copyStats.running++;
  copyStats.mostAtOnce = Math.max(copyStats.mostAtOnce, copyStats.running);
  try {
    detail(`Copying ${name}`);
    if (name.includes("slow")) {
      await setTimeout(300, undefined, { signal });
    }
    if (name.includes("fail")) {
      throw userError("couldn't be copied because its name says fail");
    }
    if (name.includes("crash")) {
      throw new Error("boom");
    }
    if (name.includes("skip")) {
      return { skipped: "its name says skip" };
    }
    if (name.includes("big")) {
      const contents = await readFile(input.path);
      await save((temporaryPath) =>
        writeFile(temporaryPath, Buffer.concat([contents, contents])),
      );
      return;
    }
    await save((temporaryPath) => copyFile(input.path, temporaryPath));
  } finally {
    copyStats.running--;
  }
}

export const copyMode = {
  name: "copy",
  group: "Tools",
  inputs: ["txt"],
  output: "same",
  outputSuffix: "copy",
  options: [],
  description: "Copy files (test only)",
  examples: ["konvertoj -m copy notes.txt"],
  run: copy,
};

export const explodeMode = {
  ...copyMode,
  name: "explode",
  description: "Fail outside any single file's work (test only)",
  examples: ["konvertoj -m explode notes.txt"],
  get options() {
    throw new Error("kaboom");
  },
};
