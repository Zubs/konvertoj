import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "../src/main.js";
import type { Output } from "../src/report.js";
import {
  defaultSettings,
  findFfmpeg,
  probeMedia,
  readMediaInfo,
} from "../src/video/ffmpeg.js";
import { makeFolder } from "./support/folders.js";

const found = await findFfmpeg(defaultSettings()).catch(() => undefined);
const ffmpeg = found?.path ?? "";
const fixture = path.resolve("test", "fixtures", "clip.mov");
const projectFolder = process.cwd();

function make(folder: string, name: string, args: string[]): string {
  const file = path.join(folder, name);
  execFileSync(ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    ...args,
    file,
  ]);
  return file;
}

function clip(
  folder: string,
  name: string,
  {
    size = "320x180",
    seconds = 1,
    rate = 10,
    audio = true,
    extra = [] as string[],
  } = {},
) {
  return make(folder, name, [
    "-f",
    "lavfi",
    "-i",
    `testsrc2=s=${size}:r=${rate}`,
    ...(audio ? ["-f", "lavfi", "-i", "sine=f=440:sample_rate=44100"] : []),
    "-t",
    String(seconds),
    ...extra,
  ]);
}

async function run(folder: string, ...args: string[]) {
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
      },
    );
    return { exitCode, stdout, stderr };
  } finally {
    process.chdir(projectFolder);
  }
}

async function probe(file: string) {
  return probeMedia(ffmpeg, file);
}

function topLevelBoxes(file: string): string[] {
  const data = readFileSync(file);
  const boxes: string[] = [];
  for (let offset = 0; offset + 8 <= data.length;) {
    const size = data.readUInt32BE(offset);
    boxes.push(data.toString("latin1", offset + 4, offset + 8));
    if (size < 8) {
      break;
    }
    offset += size;
  }
  return boxes;
}

const ffmpeg6Output = [
  "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'clip.mov':",
  "  Duration: 00:01:02.50, start: 0.000000, bitrate: 266 kb/s",
  "  Stream #0:0[0x1](und): Video: hevc (Main) (hvc1 / 0x31637668), yuv420p(tv, progressive), 1920x1080, 171 kb/s, 30 fps",
  "    Side data:",
  "      displaymatrix: rotation of -90.00 degrees",
  "  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 48000 Hz, mono, fltp, 70 kb/s",
].join("\r\n");

describe("reading FFmpeg's description of a file", () => {
  it("understands FFmpeg 6 output with Windows line endings", () => {
    expect(readMediaInfo(ffmpeg6Output)).toEqual({
      duration: 62.5,
      video: { codec: "hevc", width: 1080, height: 1920, stream: 0 },
      hasAudio: true,
    });
  });

  it("skips a cover picture stored as the first video stream", () => {
    const text = [
      "  Duration: 00:00:05.00, start: 0.000000, bitrate: 266 kb/s",
      "  Stream #0:0: Video: mjpeg (Baseline), yuvj420p(pc), 600x600, 1 fps",
      "  Stream #0:1: Video: h264 (High), yuv420p(progressive), 640x360, 25 fps (default)",
    ].join("\n");
    expect(readMediaInfo(text).video).toEqual({
      codec: "h264",
      width: 640,
      height: 360,
      stream: 1,
    });
  });

  it("allows an unknown duration", () => {
    const info = readMediaInfo(ffmpeg6Output.replace("00:01:02.50", "N/A"));
    expect(info.duration).toBeUndefined();
    expect(info.video?.codec).toBe("hevc");
  });

  it("finds no video in an audio-only file", () => {
    const text = ffmpeg6Output
      .split("\r\n")
      .filter((line) => !/Video|displaymatrix|Side data/.test(line))
      .join("\n");
    expect(readMediaInfo(text).video).toBeUndefined();
  });
});

describe.skipIf(!found)("video to MP4", { timeout: 60_000 }, () => {
  it("says a file without video has no video, and an empty file is empty", async () => {
    const folder = makeFolder();
    make(folder, "sound.mp4", [
      "-f",
      "lavfi",
      "-i",
      "sine=f=440",
      "-t",
      "1",
      "-c:a",
      "aac",
    ]);
    writeFileSync(path.join(folder, "empty.mov"), "");
    const sound = await run(
      folder,
      "-m",
      "tomp4",
      "sound.mp4",
      "--quality",
      "high",
    );
    expect(sound.stderr).toContain("has no video");
    const empty = await run(folder, "-m", "movtomp4", "empty.mov");
    expect(empty.stderr).toContain("is empty");
  });

  it("turns the iPhone MOV into an MP4 that plays everywhere, upright", async () => {
    const folder = makeFolder();
    copyFileSync(fixture, path.join(folder, "clip.mov"));
    const result = await run(folder, "-m", "movtomp4", "clip.mov");
    expect(result.exitCode).toBe(0);
    const output = path.join(folder, "clip.mp4");
    const info = await probe(output);
    expect(info.video).toEqual({
      codec: "h264",
      width: 180,
      height: 320,
      stream: 0,
    });
    expect(info.hasAudio).toBe(true);
    const boxes = topLevelBoxes(output);
    expect(boxes.indexOf("moov")).toBeLessThan(boxes.indexOf("mdat"));
  });

  it("writes yuv420p H.264 with AAC", async () => {
    const folder = makeFolder();
    copyFileSync(fixture, path.join(folder, "clip.mov"));
    await run(folder, "-m", "movtomp4", "clip.mov");
    let description = "";
    try {
      execFileSync(
        ffmpeg,
        ["-hide_banner", "-i", path.join(folder, "clip.mp4")],
        { stdio: "pipe" },
      );
    } catch (error) {
      description = String((error as { stderr: Buffer }).stderr);
    }
    expect(description).toMatch(/Video: h264 \(High\).*yuv420p/);
    expect(description).toMatch(/Audio: aac/);
  });

  it("converts a folder of MOVs, one at a time", async () => {
    const folder = makeFolder();
    mkdirSync(path.join(folder, "holiday"));
    for (const name of ["beach.mov", "dinner.mov", "boat.mov"]) {
      clip(path.join(folder, "holiday"), name, { extra: ["-c:v", "libx264"] });
    }
    const result = await run(
      folder,
      "-m",
      "movtomp4",
      "./holiday",
      "-o",
      "./mp4s",
    );
    expect(result.exitCode).toBe(0);
    expect(readdirSync(path.join(folder, "mp4s")).sort()).toEqual([
      "beach.mp4",
      "boat.mp4",
      "dinner.mp4",
    ]);
  });

  it(
    "scales 4K down to 720p, and keeps a 480p video with a note",
    { timeout: 180_000 },
    async () => {
      const folder = makeFolder();
      clip(folder, "big.mov", {
        size: "3840x2160",
        rate: 2,
        audio: false,
        extra: ["-c:v", "libx264", "-preset", "ultrafast"],
      });
      clip(folder, "small.mov", {
        size: "854x480",
        audio: false,
        extra: ["-c:v", "libx264"],
      });
      await run(folder, "-m", "movtomp4", "big.mov", "--resolution", "720p");
      expect((await probe(path.join(folder, "big.mp4"))).video).toMatchObject({
        width: 1280,
        height: 720,
      });
      const small = await run(
        folder,
        "-m",
        "movtomp4",
        "small.mov",
        "--resolution",
        "720p",
      );
      expect((await probe(path.join(folder, "small.mp4"))).video).toMatchObject(
        { width: 854, height: 480 },
      );
      expect(small.stdout).toContain(
        "Note: kept at 854 × 480, because --resolution only makes videos smaller",
      );
    },
  );

  it("makes bigger files at higher quality", async () => {
    const folder = makeFolder();
    clip(folder, "detail.mov", {
      size: "640x360",
      seconds: 2,
      rate: 25,
      audio: false,
      extra: ["-c:v", "libx264", "-crf", "10"],
    });
    await run(
      folder,
      "-m",
      "movtomp4",
      "detail.mov",
      "--quality",
      "high",
      "-o",
      "high",
    );
    await run(
      folder,
      "-m",
      "movtomp4",
      "detail.mov",
      "--quality",
      "low",
      "-o",
      "low",
    );
    expect(statSync(path.join(folder, "high.mp4")).size).toBeGreaterThan(
      statSync(path.join(folder, "low.mp4")).size,
    );
  });

  it(
    "converts a one-second clip and one over an hour long",
    { timeout: 180_000 },
    async () => {
      const folder = makeFolder();
      clip(folder, "short.mov", { extra: ["-c:v", "libx264"] });
      clip(folder, "long.mov", {
        size: "64x36",
        seconds: 3700,
        rate: 1,
        audio: false,
        extra: ["-c:v", "libx264", "-preset", "ultrafast"],
      });
      await run(folder, "-m", "movtomp4", "short.mov", "long.mov", "-o", "out");
      expect(
        (await probe(path.join(folder, "out", "short.mp4"))).duration,
      ).toBeCloseTo(1, 0);
      expect(
        Math.round(
          (await probe(path.join(folder, "out", "long.mp4"))).duration ?? 0,
        ),
      ).toBe(3700);
    },
  );

  it("removes the location with --strip-metadata", async () => {
    const folder = makeFolder();
    clip(folder, "trip.mov", {
      extra: [
        "-c:v",
        "libx264",
        "-movflags",
        "use_metadata_tags",
        "-metadata",
        "location=+51.5074-000.1278/",
      ],
    });
    await run(folder, "-m", "movtomp4", "trip.mov", "-o", "kept");
    await run(
      folder,
      "-m",
      "movtomp4",
      "trip.mov",
      "--strip-metadata",
      "-o",
      "clean",
    );
    const tags = (file: string) => {
      try {
        execFileSync(ffmpeg, ["-hide_banner", "-i", path.join(folder, file)], {
          stdio: "pipe",
        });
      } catch (error) {
        return String((error as { stderr: Buffer }).stderr);
      }
      return "";
    };
    expect(tags("kept.mp4")).toContain("+51.5074");
    expect(tags("clean.mp4")).not.toContain("+51.5074");
  });

  it("converts a silent video, and mutes one with sound", async () => {
    const folder = makeFolder();
    clip(folder, "silent.mov", { audio: false, extra: ["-c:v", "libx264"] });
    clip(folder, "loud.mov", { extra: ["-c:v", "libx264", "-c:a", "aac"] });
    expect((await run(folder, "-m", "movtomp4", "silent.mov")).exitCode).toBe(
      0,
    );
    expect((await probe(path.join(folder, "silent.mp4"))).hasAudio).toBe(false);
    await run(folder, "-m", "movtomp4", "loud.mov", "--mute");
    expect((await probe(path.join(folder, "loud.mp4"))).hasAudio).toBe(false);
  });

  it("converts MKV, AVI, WebM and M4V with tomp4", async () => {
    const folder = makeFolder();
    clip(folder, "a.mkv", { extra: ["-c:v", "libx264"] });
    clip(folder, "b.avi", { extra: ["-c:v", "mpeg4"] });
    clip(folder, "c.webm", { extra: ["-c:v", "libvpx", "-c:a", "libopus"] });
    clip(folder, "d.m4v", {
      extra: ["-c:v", "libx264", "-f", "mp4", "-brand", "M4V "],
    });
    const result = await run(
      folder,
      "-m",
      "tomp4",
      "a.mkv",
      "b.avi",
      "c.webm",
      "d.m4v",
      "-o",
      "out",
    );
    expect(result.exitCode).toBe(0);
    expect(readdirSync(path.join(folder, "out")).sort()).toEqual([
      "a.mp4",
      "b.mp4",
      "c.mp4",
      "d.mp4",
    ]);
  });

  it("converts a WebM with no recorded duration", async () => {
    const folder = makeFolder();
    const piped = execFileSync(ffmpeg, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=s=160x90:r=10",
      "-t",
      "1",
      "-c:v",
      "libvpx",
      "-f",
      "webm",
      "pipe:1",
    ]);
    writeFileSync(path.join(folder, "recording.webm"), piped);
    const result = await run(folder, "-m", "webmtomp4", "recording.webm");
    expect(result.exitCode).toBe(0);
  });

  it("trims odd sizes to even ones", async () => {
    const folder = makeFolder();
    clip(folder, "odd.mkv", {
      size: "321x181",
      audio: false,
      extra: ["-c:v", "ffv1"],
    });
    await run(folder, "-m", "mkvtomp4", "odd.mkv");
    expect((await probe(path.join(folder, "odd.mp4"))).video).toMatchObject({
      width: 320,
      height: 180,
    });
  });

  it("lists the allowed values for --resolution and --quality", async () => {
    const folder = makeFolder();
    const resolution = await run(
      folder,
      "-m",
      "movtomp4",
      "clip.mov",
      "--resolution",
      "4k",
    );
    expect(resolution.stderr).toContain("1080p, 720p, 480p");
    const quality = await run(
      folder,
      "-m",
      "movtomp4",
      "clip.mov",
      "--quality",
      "max",
    );
    expect(quality.stderr).toContain("low, medium, high");
  });

  it("says a cut-off MOV looks damaged", async () => {
    const folder = makeFolder();
    const file = clip(folder, "cut.mov", { extra: ["-c:v", "libx264"] });
    const contents = readFileSync(file);
    writeFileSync(file, contents.subarray(0, Math.floor(contents.length / 2)));
    const result = await run(folder, "-m", "movtomp4", "cut.mov");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("looks damaged");
  });

  it("says a video stream with no frames has no video", async () => {
    const folder = makeFolder();
    try {
      clip(folder, "blank.mov", {
        extra: ["-c:v", "libx264", "-c:a", "aac", "-frames:v", "0"],
      });
    } catch {
      expect(readdirSync(folder)).toContain("blank.mov");
    }
    const result = await run(folder, "-m", "movtomp4", "blank.mov");
    expect(result.stderr).toContain("has no video");
    expect(readdirSync(folder)).toEqual(["blank.mov"]);
  });

  it(
    "removes the half-written MP4 when stopped",
    { timeout: 120_000 },
    async () => {
      const folder = makeFolder();
      clip(folder, "long.mov", {
        size: "1280x720",
        seconds: 30,
        rate: 30,
        extra: ["-c:v", "libx264", "-preset", "ultrafast"],
      });
      process.chdir(folder);
      const controller = new AbortController();
      const output: Output = {
        out: () => {},
        err: () => {},
        errIsTerminal: false,
        colours: { out: false, err: false },
      };
      setTimeout(() => controller.abort(), 1500);
      try {
        const exitCode = await main(["-m", "movtomp4", "long.mov"], output, {
          signal: controller.signal,
          environment: { ...process.env, KONVERTOJ_FFMPEG_PATH: ffmpeg },
        });
        expect(exitCode).toBe(130);
      } finally {
        process.chdir(projectFolder);
      }
      expect(readdirSync(folder)).toEqual(["long.mov"]);
    },
  );

  it("shows the file's percentage on the progress line", async () => {
    const folder = makeFolder();
    clip(folder, "moving.mov", {
      size: "640x360",
      seconds: 4,
      rate: 25,
      extra: ["-c:v", "libx264", "-preset", "ultrafast"],
    });
    let errors = "";
    const output: Output = {
      out: () => {},
      err: (text) => (errors += text),
      errIsTerminal: true,
      colours: { out: false, err: false },
    };
    process.chdir(folder);
    try {
      await main(["-m", "movtomp4", "moving.mov"], output, {
        environment: { ...process.env, KONVERTOJ_FFMPEG_PATH: ffmpeg },
      });
    } finally {
      process.chdir(projectFolder);
    }
    expect(errors).toMatch(/Converting 0\/1… \d+%/);
  });
});
