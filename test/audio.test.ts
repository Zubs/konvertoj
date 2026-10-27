import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "../src/main.js";
import {
  defaultSettings,
  findFfmpeg,
  probeMedia,
} from "../src/video/ffmpeg.js";
import { makeFolder } from "./support/folders.js";

const found = await findFfmpeg(defaultSettings()).catch(() => undefined);
const ffmpeg = found?.path ?? "";
const projectFolder = process.cwd();

function video(
  folder: string,
  name: string,
  { seconds = 4, audio = true } = {},
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
    "testsrc2=s=64x36:r=1",
    ...(audio ? ["-f", "lavfi", "-i", "sine=f=440:sample_rate=44100"] : []),
    "-t",
    String(seconds),
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    ...(audio ? ["-c:a", "aac"] : []),
    file,
  ]);
  return file;
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

async function length(file: string) {
  return (await probeMedia(ffmpeg, file)).duration ?? 0;
}

function describeFile(file: string): string {
  try {
    execFileSync(ffmpeg, ["-hide_banner", "-i", file], { stdio: "pipe" });
  } catch (error) {
    return String((error as { stderr: Buffer }).stderr);
  }
  return "";
}

function samples(file: string): string {
  const raw = execFileSync(
    ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-i", file, "-f", "s16le", "pipe:1"],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  return createHash("sha256").update(raw).digest("hex");
}

describe.skipIf(!found)("audio from video", { timeout: 60_000 }, () => {
  it("says a video without sound has no audio", async () => {
    const folder = makeFolder();
    video(folder, "silent.mp4", { audio: false });
    const result = await run(folder, "-m", "mp4tomp3", "silent.mp4");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("has no audio");
  });

  it("turns one MP4 into an MP3 of the same length", async () => {
    const folder = makeFolder();
    video(folder, "talk.mp4");
    const result = await run(folder, "-m", "mp4tomp3", "talk.mp4");
    expect(result.exitCode).toBe(0);
    expect(
      Math.abs((await length(path.join(folder, "talk.mp3"))) - 4),
    ).toBeLessThan(0.1);
  });

  it("extracts a whole folder to MP3", async () => {
    const folder = makeFolder();
    mkdirSync(path.join(folder, "videos"));
    for (const name of ["a.mp4", "b.mov", "c.mkv"]) {
      video(path.join(folder, "videos"), name, { seconds: 2 });
    }
    const result = await run(folder, "-m", "tomp3", "videos", "-o", "audio");
    expect(result.exitCode).toBe(0);
    expect(readdirSync(path.join(folder, "audio")).sort()).toEqual([
      "a.mp3",
      "b.mp3",
      "c.mp3",
    ]);
  });

  it("writes every format with its usual codec, WAV and FLAC losslessly", async () => {
    const folder = makeFolder();
    video(folder, "clip.mp4", { seconds: 2 });
    for (const target of ["mp3", "wav", "m4a", "ogg", "flac"]) {
      expect(
        (await run(folder, "-m", `mp4to${target}`, "clip.mp4")).exitCode,
        target,
      ).toBe(0);
    }
    expect(describeFile(path.join(folder, "clip.mp3"))).toMatch(/Audio: mp3/);
    expect(describeFile(path.join(folder, "clip.wav"))).toMatch(
      /Audio: pcm_s16le/,
    );
    expect(describeFile(path.join(folder, "clip.m4a"))).toMatch(/Audio: aac/);
    expect(describeFile(path.join(folder, "clip.ogg"))).toMatch(
      /Audio: (vorbis|opus)/,
    );
    expect(describeFile(path.join(folder, "clip.flac"))).toMatch(/Audio: flac/);
    expect(samples(path.join(folder, "clip.flac"))).toBe(
      samples(path.join(folder, "clip.wav")),
    );
  });

  it("makes bigger files at a higher bitrate, and lists the allowed bitrates", async () => {
    const folder = makeFolder();
    video(folder, "clip.mp4", { seconds: 6 });
    await run(
      folder,
      "-m",
      "mp4tomp3",
      "clip.mp4",
      "--bitrate",
      "320k",
      "-o",
      "high",
    );
    await run(
      folder,
      "-m",
      "mp4tomp3",
      "clip.mp4",
      "--bitrate",
      "128k",
      "-o",
      "low",
    );
    expect(statSync(path.join(folder, "high.mp3")).size).toBeGreaterThan(
      statSync(path.join(folder, "low.mp3")).size,
    );
    const refused = await run(
      folder,
      "-m",
      "mp4tomp3",
      "clip.mp4",
      "--bitrate",
      "100k",
    );
    expect(refused.exitCode).toBe(1);
    expect(refused.stderr).toContain("128k, 192k, 256k, 320k");
  });

  it("warns once that --bitrate is ignored for WAV", async () => {
    const folder = makeFolder();
    video(folder, "a.mp4", { seconds: 1 });
    video(folder, "b.mp4", { seconds: 1 });
    const result = await run(
      folder,
      "-m",
      "towav",
      "a.mp4",
      "b.mp4",
      "--bitrate",
      "320k",
      "-o",
      "wavs",
    );
    expect(result.exitCode).toBe(0);
    expect(
      result.stderr.match(
        /Warning: --bitrate is ignored for WAV, which is lossless\./g,
      ),
    ).toHaveLength(1);
  });

  it(
    "trims to a section, accurate to the second",
    { timeout: 120_000 },
    async () => {
      const folder = makeFolder();
      video(folder, "talk.mp4", { seconds: 180 });
      await run(
        folder,
        "-m",
        "mp4tomp3",
        "talk.mp4",
        "--start",
        "0:30",
        "--end",
        "2:15",
        "-o",
        "section",
      );
      await run(
        folder,
        "-m",
        "mp4tomp3",
        "talk.mp4",
        "--start",
        "2:00",
        "-o",
        "tail",
      );
      await run(
        folder,
        "-m",
        "mp4tomp3",
        "talk.mp4",
        "--end",
        "0:20",
        "-o",
        "head",
      );
      expect(
        Math.abs((await length(path.join(folder, "section.mp3"))) - 105),
      ).toBeLessThan(0.5);
      expect(
        Math.abs((await length(path.join(folder, "tail.mp3"))) - 60),
      ).toBeLessThan(0.5);
      expect(
        Math.abs((await length(path.join(folder, "head.mp3"))) - 20),
      ).toBeLessThan(0.5);
    },
  );

  it(
    "reads the three spellings of a time the same way",
    { timeout: 120_000 },
    async () => {
      const folder = makeFolder();
      video(folder, "talk.mp4", { seconds: 120 });
      const lengths: number[] = [];
      for (const [index, time] of ["90", "1:30", "0:01:30"].entries()) {
        await run(
          folder,
          "-m",
          "mp4towav",
          "talk.mp4",
          "--start",
          time,
          "-o",
          `cut${index}`,
        );
        lengths.push(await length(path.join(folder, `cut${index}.wav`)));
      }
      expect(lengths[1]).toBeCloseTo(lengths[0] ?? 0, 1);
      expect(lengths[2]).toBeCloseTo(lengths[0] ?? 0, 1);
      expect(Math.abs((lengths[0] ?? 0) - 30)).toBeLessThan(0.5);
    },
  );

  it("rejects backwards and zero-length ranges, and starts past the end", async () => {
    const folder = makeFolder();
    video(folder, "talk.mp4", { seconds: 3 });
    const backwards = await run(
      folder,
      "-m",
      "mp4tomp3",
      "talk.mp4",
      "--start",
      "2:00",
      "--end",
      "1:00",
    );
    expect(backwards.stderr).toContain("--end 1:00 must be after --start 2:00");
    const zero = await run(folder, "-m", "mp4tomp3", "talk.mp4", "--end", "0");
    expect(zero.exitCode).toBe(1);
    expect(zero.stderr).toContain(
      "--end 0 must be after the start of the video",
    );
    const late = await run(
      folder,
      "-m",
      "mp4tomp3",
      "talk.mp4",
      "--start",
      "5:00",
    );
    expect(late.stderr).toContain("the video is only 0:03 long");
  });

  it("skips earlier MP3s on a second run, and explains audio given directly", async () => {
    const folder = makeFolder();
    mkdirSync(path.join(folder, "videos"));
    video(path.join(folder, "videos"), "a.mp4", { seconds: 1 });
    expect((await run(folder, "-m", "tomp3", "videos")).exitCode).toBe(0);
    const again = await run(folder, "-m", "tomp3", "videos");
    expect(again.exitCode).toBe(0);
    expect(again.stdout).toContain("skipped: already an MP3");
    const direct = await run(
      folder,
      "-m",
      "towav",
      path.join("videos", "a.mp3"),
    );
    expect(direct.stderr).toContain("doesn't convert between audio formats");
  });

  it("says a damaged video looks damaged", async () => {
    const folder = makeFolder();
    const file = video(folder, "cut.mp4", { seconds: 2 });
    const contents = readFileSync(file);
    writeFileSync(file, contents.subarray(0, Math.floor(contents.length / 2)));
    const result = await run(folder, "-m", "mp4tomp3", "cut.mp4");
    expect(result.stderr).toContain("looks damaged");
  });

  it(
    "turns a recorded talk into a podcast MP3",
    { timeout: 120_000 },
    async () => {
      const folder = makeFolder();
      video(folder, "talk.mp4", { seconds: 100 });
      expect(
        (await run(folder, "-m", "tomp3", "talk.mp4", "--start", "1:30"))
          .exitCode,
      ).toBe(0);
      expect(
        Math.abs((await length(path.join(folder, "talk.mp3"))) - 10),
      ).toBeLessThan(0.5);
    },
  );
});
