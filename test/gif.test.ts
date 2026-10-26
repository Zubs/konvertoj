import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { main, type MainOptions } from "../src/main.js";
import { defaultSettings, findFfmpeg } from "../src/video/ffmpeg.js";
import { makeFolder } from "./support/folders.js";
import { writeImage } from "./support/images.js";

const found = await findFfmpeg(defaultSettings()).catch(() => undefined);
const ffmpeg = found?.path ?? "";
const projectFolder = process.cwd();

async function run(folder: string, args: string[], options: MainOptions = {}) {
  process.chdir(folder);
  let stdout = "";
  let stderr = "";
  try {
    const exitCode = await main(
      args,
      {
        out: (text) => (stdout += text),
        err: (text) => (stderr += text),
        errIsTerminal: false,
        colours: { out: false, err: false },
      },
      {
        environment: { ...process.env, KONVERTOJ_FFMPEG_PATH: ffmpeg },
        interactive: false,
        ...options,
      },
    );
    return { exitCode, stdout, stderr };
  } finally {
    process.chdir(projectFolder);
  }
}

const withoutFfmpeg = (folder: string): MainOptions => ({
  environment: { PATH: "" },
  home: path.join(folder, "home"),
  interactive: false,
});

function clip(
  folder: string,
  name: string,
  seconds: number,
  source = "testsrc2=s=640x360:r=25",
): string {
  const file = path.join(folder, name);
  execFileSync(ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    source,
    "-t",
    String(seconds),
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
    file,
  ]);
  return file;
}

async function gifInfo(file: string) {
  const metadata = await sharp(file, { animated: true }).metadata();
  const delays = metadata.delay ?? [];
  return {
    pages: metadata.pages ?? 1,
    width: metadata.width,
    loop: metadata.loop,
    seconds: delays.reduce((sum, delay) => sum + delay, 0) / 1000,
  };
}

async function writeAnimatedWebp(folder: string, name: string) {
  const frames = Buffer.alloc(12 * 30 * 4);
  for (let index = 0; index < 12 * 30; index++) {
    frames[index * 4 + (Math.floor(index / 120) % 3)] = 255;
    frames[index * 4 + 3] = 255;
  }
  await sharp(frames, {
    raw: { width: 12, height: 30, channels: 4, pageHeight: 10 },
  })
    .webp({ loop: 0, delay: [100, 100, 100] })
    .toFile(path.join(folder, name));
}

describe("GIFs from images", () => {
  it("says an empty file is empty", async () => {
    const folder = makeFolder();
    writeFileSync(path.join(folder, "nothing.png"), "");
    const result = await run(
      folder,
      ["-m", "togif", "nothing.png"],
      withoutFfmpeg(folder),
    );
    expect(result.stderr).toContain("is empty");
  });

  it("makes a still GIF from a PNG and keeps an animated WebP's frames, without FFmpeg", async () => {
    const folder = makeFolder();
    await writeImage(folder, "logo.png", "png");
    await writeAnimatedWebp(folder, "sticker.webp");
    const result = await run(
      folder,
      ["-m", "togif", "logo.png", "sticker.webp", "-o", "gifs"],
      withoutFfmpeg(folder),
    );
    expect(result.exitCode).toBe(0);
    expect((await gifInfo(path.join(folder, "gifs", "logo.gif"))).pages).toBe(
      1,
    );
    expect(
      (await gifInfo(path.join(folder, "gifs", "sticker.gif"))).pages,
    ).toBe(3);
  });

  it("resizes images down with --width but never enlarges them", async () => {
    const folder = makeFolder();
    await writeImage(folder, "logo.png", "png", { width: 100, height: 50 });
    const big = await run(
      folder,
      ["-m", "togif", "logo.png", "--width", "2000", "-o", "big"],
      withoutFfmpeg(folder),
    );
    expect((await gifInfo(path.join(folder, "big.gif"))).width).toBe(100);
    expect(big.stdout).toContain(
      "Note: kept at 100 × 50, because togif never makes images bigger",
    );
    await run(
      folder,
      ["-m", "togif", "logo.png", "--width", "10", "-o", "small"],
      withoutFfmpeg(folder),
    );
    expect((await gifInfo(path.join(folder, "small.gif"))).width).toBe(10);
  });

  it("rejects video-only options for an image", async () => {
    const folder = makeFolder();
    await writeImage(folder, "logo.png", "png");
    const result = await run(
      folder,
      ["-m", "togif", "logo.png", "--fps", "5"],
      withoutFfmpeg(folder),
    );
    expect(result.stderr).toContain("--fps only applies to videos");
  });

  it("doesn't skip a GIF given --width alongside a video-only option", async () => {
    const folder = makeFolder();
    await writeAnimatedWebp(folder, "sticker.webp");
    await run(folder, ["-m", "togif", "sticker.webp"], withoutFfmpeg(folder));
    const result = await run(
      folder,
      ["-m", "togif", "sticker.gif", "--width", "6", "--fps", "5"],
      withoutFfmpeg(folder),
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--fps only applies to videos");
  });
});

describe.skipIf(!found)("GIFs from videos", { timeout: 120_000 }, () => {
  it("makes a looping GIF 480 wide at 10 frames a second", async () => {
    const folder = makeFolder();
    clip(folder, "demo.mp4", 5);
    const result = await run(folder, ["-m", "togif", "demo.mp4"]);
    expect(result.exitCode).toBe(0);
    const info = await gifInfo(path.join(folder, "demo.gif"));
    expect(info.width).toBe(480);
    expect(info.loop).toBe(0);
    expect(Math.abs(info.pages - 50)).toBeLessThanOrEqual(2);
  });

  it("makes one GIF per clip in a folder", async () => {
    const folder = makeFolder();
    mkdirSync(path.join(folder, "clips"));
    clip(path.join(folder, "clips"), "a.mp4", 1);
    clip(path.join(folder, "clips"), "b.mov", 1);
    await run(folder, ["-m", "togif", "clips", "-o", "gifs"]);
    expect(readdirSync(path.join(folder, "gifs")).sort()).toEqual([
      "a.gif",
      "b.gif",
    ]);
  });

  it("accepts 1 and 30 frames a second and rejects 0 and 31", async () => {
    const folder = makeFolder();
    clip(folder, "demo.mp4", 2);
    for (const fps of ["1", "30"]) {
      expect(
        (
          await run(folder, [
            "-m",
            "togif",
            "demo.mp4",
            "--fps",
            fps,
            "-o",
            `fps${fps}`,
          ])
        ).exitCode,
      ).toBe(0);
    }
    for (const fps of ["0", "31"]) {
      expect(
        (await run(folder, ["-m", "togif", "demo.mp4", "--fps", fps])).exitCode,
      ).toBe(1);
    }
  });

  it("halves the length at --speed 2, and rejects 0.4 and 5", async () => {
    const folder = makeFolder();
    clip(folder, "demo.mp4", 4);
    await run(folder, ["-m", "togif", "demo.mp4", "--speed", "2"]);
    expect(
      Math.abs((await gifInfo(path.join(folder, "demo.gif"))).seconds - 2),
    ).toBeLessThan(0.25);
    for (const speed of ["0.4", "5"]) {
      expect(
        (await run(folder, ["-m", "togif", "demo.mp4", "--speed", speed]))
          .exitCode,
      ).toBe(1);
    }
  });

  it("makes a three-second GIF from --start 0:02 --end 0:05", async () => {
    const folder = makeFolder();
    clip(folder, "demo.mp4", 8);
    await run(folder, [
      "-m",
      "togif",
      "demo.mp4",
      "--start",
      "0:02",
      "--end",
      "0:05",
    ]);
    expect(
      Math.abs((await gifInfo(path.join(folder, "demo.gif"))).seconds - 3),
    ).toBeLessThan(0.25);
  });

  it("refuses 31 seconds without --force and accepts 30", async () => {
    const folder = makeFolder();
    clip(folder, "long.mp4", 31, "testsrc2=s=160x90:r=5");
    clip(folder, "ok.mp4", 30, "testsrc2=s=160x90:r=5");
    const refused = await run(folder, ["-m", "togif", "long.mp4"]);
    expect(refused.stderr).toContain(
      "Choose a section with --start and --end, or add --force",
    );
    expect((await run(folder, ["-m", "togif", "ok.mp4"])).exitCode).toBe(0);
    expect(
      (await run(folder, ["-m", "togif", "long.mp4", "--force", "--fps", "1"]))
        .exitCode,
    ).toBe(0);
  });

  it("needs FFmpeg for a video but not for an image", async () => {
    const folder = makeFolder();
    clip(folder, "demo.mp4", 1);
    await writeImage(folder, "logo.png", "png");
    const video = await run(
      folder,
      ["-m", "togif", "demo.mp4"],
      withoutFfmpeg(folder),
    );
    expect(video.exitCode).toBe(1);
    expect(video.stderr).toContain("--install-video");
    expect(
      (await run(folder, ["-m", "togif", "logo.png"], withoutFfmpeg(folder)))
        .exitCode,
    ).toBe(0);
  });

  it("matches the colours better than a plain conversion", async () => {
    const folder = makeFolder();
    const source = clip(folder, "colours.mp4", 1, "mandelbrot=s=640x360:r=10");
    await run(folder, ["-m", "togif", "colours.mp4", "-o", "palette"]);
    const scale = ["-vf", "scale=480:-2:flags=lanczos"];
    execFileSync(ffmpeg, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      source,
      ...scale,
      path.join(folder, "plain.gif"),
    ]);
    execFileSync(ffmpeg, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      source,
      ...scale,
      "-frames:v",
      "1",
      path.join(folder, "reference.png"),
    ]);
    const raw = async (file: string) =>
      sharp(file, { pages: 1 }).removeAlpha().raw().toBuffer();
    const reference = await raw(path.join(folder, "reference.png"));
    const difference = async (file: string) => {
      const pixels = await raw(file);
      let total = 0;
      for (let index = 0; index < reference.length; index++) {
        total += Math.abs((pixels[index] ?? 0) - (reference[index] ?? 0));
      }
      return total / reference.length;
    };
    expect(await difference(path.join(folder, "palette.gif"))).toBeLessThan(
      await difference(path.join(folder, "plain.gif")),
    );
  });

  it("skips an earlier GIF in a folder run again with --fps", async () => {
    const folder = makeFolder();
    mkdirSync(path.join(folder, "clips"));
    clip(path.join(folder, "clips"), "a.mp4", 1);
    await run(folder, ["-m", "togif", "clips"]);
    const again = await run(folder, ["-m", "togif", "clips", "--fps", "15"]);
    expect(again.exitCode).toBe(0);
    expect(again.stdout).toContain("a.gif skipped: already a GIF");
  });

  it("turns a screen recording into a GIF for a README", async () => {
    const folder = makeFolder();
    clip(folder, "recording.mov", 6);
    const result = await run(folder, [
      "-m",
      "togif",
      "recording.mov",
      "--start",
      "0:01",
      "--end",
      "0:04",
    ]);
    expect(result.exitCode).toBe(0);
    const info = await gifInfo(path.join(folder, "recording.gif"));
    expect(info.pages).toBeGreaterThan(1);
    expect(info.loop).toBe(0);
  });
});
