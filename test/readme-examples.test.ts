import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { main } from "../src/main.js";
import {
  acceptedOptions,
  findMode,
  modes,
  type Mode,
} from "../src/modes/registry.js";
import { parseTime } from "../src/video/times.js";
import { defaultSettings, findFfmpeg } from "../src/video/ffmpeg.js";
import { makeFolder } from "./support/folders.js";
import { writeImage } from "./support/images.js";

const found = await findFfmpeg(defaultSettings()).catch(() => undefined);
const projectFolder = process.cwd();
const videoFormats = ["mp4", "mov", "mkv", "avi", "webm", "m4v"];

function readmeCommands(): string[] {
  const readme = readFileSync("README.md", "utf8");
  const blocks = [...readme.matchAll(/```bash\n([\s\S]*?)```/g)].flatMap(
    ([, block]) => (block ?? "").split("\n"),
  );
  const inline = readme
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .flatMap((line) =>
      [...line.matchAll(/`((?:npx )?konvertoj [^`]+)`/g)].map(
        ([, command]) => command ?? "",
      ),
    );
  return [...blocks, ...inline]
    .map((line) => line.trim().replace(/^npx /, ""))
    .filter((line) => line.startsWith("konvertoj "));
}

const fromReadme = readmeCommands();
const commands = [
  ...new Set([...fromReadme, ...modes.flatMap((mode) => mode.examples)]),
];

interface Planned {
  mode: Mode;
  args: string[];
  inputs: string[];
  start: number;
}

function plan(command: string): Planned {
  if (/["']/.test(command)) {
    throw new Error(`${command} contains a quote`);
  }
  const words = command.split(" ").slice(1);
  const modeAt = words.findIndex((word) => word === "-m" || word === "--mode");
  const mode = modeAt === -1 ? undefined : findMode(words[modeAt + 1] ?? "");
  if (!mode) {
    throw new Error(`${command} has no known mode`);
  }
  const rest = words.filter(
    (_, index) => index !== modeAt && index !== modeAt + 1,
  );
  const options = acceptedOptions(mode);
  const inputs: string[] = [];
  let start = 0;
  for (let index = 0; index < rest.length; index++) {
    const word = rest[index] ?? "";
    if (!word.startsWith("-")) {
      inputs.push(word);
      continue;
    }
    const option = options.find(
      (candidate) =>
        word === `--${candidate.name}` ||
        (candidate.short && word === `-${candidate.short}`),
    );
    if (option?.kind === "value") {
      if (option.name === "start") {
        start = parseTime(rest[index + 1] ?? "0") ?? 0;
      }
      index++;
    }
  }
  return { mode, args: words, inputs, start };
}

let samples = "";

async function run(folder: string, args: string[]): Promise<number> {
  process.chdir(folder);
  try {
    return await main(
      args,
      {
        out: () => {},
        err: () => {},
        errIsTerminal: false,
        colours: { out: false, err: false },
      },
      {
        environment: {
          ...process.env,
          KONVERTOJ_FFMPEG_PATH: found?.path ?? "",
        },
        interactive: false,
      },
    );
  } finally {
    process.chdir(projectFolder);
  }
}

beforeAll(async () => {
  samples = mkdtempSync(path.join(tmpdir(), "konvertoj-samples-"));
  for (const format of ["jpg", "png", "webp", "avif", "gif", "tiff"]) {
    await writeImage(samples, `sample.${format}`, format, {
      width: 1000,
      height: 1000,
    });
  }
  await run(samples, ["-m", "pngtobmp", "sample.png"]);
  await run(samples, ["-m", "pngtoico", "sample.png"]);
  copyFileSync(
    path.join("test", "fixtures", "iphone.heic"),
    path.join(samples, "sample.heic"),
  );
  writeFileSync(
    path.join(samples, "sample.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><rect width="1000" height="1000" fill="teal"/></svg>',
  );
  const document = await PDFDocument.create();
  for (let page = 0; page < 3; page++) {
    document.addPage([200, 200]);
  }
  writeFileSync(path.join(samples, "sample.pdf"), await document.save());
}, 120_000);

afterAll(() => rmSync(samples, { recursive: true, force: true }));

function makeVideo(file: string, seconds: number) {
  execFileSync(found?.path ?? "", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=s=64x36:r=5",
    "-f",
    "lavfi",
    "-i",
    "sine=f=440",
    "-t",
    String(seconds),
    file,
  ]);
}

function createInput(folder: string, input: string, planned: Planned) {
  const target = path.join(folder, input);
  const extension = path.extname(input).slice(1).toLowerCase();
  const videoSeconds = Math.max(3, planned.start + 3);
  if (!extension) {
    mkdirSync(target, { recursive: true });
    const format = planned.mode.inputs[0] ?? "jpg";
    for (const name of ["one", "two"]) {
      createInput(target, `${name}.${format}`, planned);
    }
    return;
  }
  mkdirSync(path.dirname(target), { recursive: true });
  if (videoFormats.includes(extension)) {
    makeVideo(target, videoSeconds);
    return;
  }
  copyFileSync(path.join(samples, `sample.${extension}`), target);
}

describe("README examples", () => {
  it("cover every mode", () => {
    const covered = new Set(
      fromReadme.map((command) => plan(command).mode.name),
    );
    expect(
      modes.filter((mode) => !covered.has(mode.name)).map((mode) => mode.name),
    ).toEqual([]);
  });

  it("include the quick start", () => {
    expect(fromReadme).toEqual(
      expect.arrayContaining([
        "konvertoj -m heictojpg holiday.heic",
        "konvertoj -m compress hero.jpg",
        "konvertoj -m topdf ./receipts -o receipts.pdf",
      ]),
    );
  });

  it("reject placeholders and quotes", () => {
    expect(() => plan("konvertoj -m <mode> <input>")).toThrow(
      "has no known mode",
    );
    expect(() => plan('konvertoj -m resize "my photo.jpg"')).toThrow(
      "contains a quote",
    );
  });

  it.each(commands)("%s", { timeout: 120_000 }, async (command) => {
    const planned = plan(command);
    const needsVideo = planned.inputs.some((input) => {
      const extension = path.extname(input).slice(1);
      return videoFormats.includes(extension || (planned.mode.inputs[0] ?? ""));
    });
    if (needsVideo && !found) {
      return;
    }
    const folder = makeFolder();
    for (const input of planned.inputs) {
      createInput(folder, input, planned);
    }
    expect(await run(folder, planned.args)).toBe(0);
  });
});
