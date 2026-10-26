import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { main, type MainOptions } from "../src/main.js";
import type { Mode } from "../src/modes/registry.js";
import {
  cacheFolder,
  downloadSource,
  findFfmpeg,
  installFfmpeg,
  runFfmpeg,
  type DownloadSource,
} from "../src/video/ffmpeg.js";
import { makeFolder } from "./support/folders.js";
import { writeImage } from "./support/images.js";

const projectFolder = process.cwd();
const onWindows = process.platform === "win32";
const servers: Server[] = [];

afterEach(async () => {
  process.chdir(projectFolder);
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise((resolve) => server.close(resolve))),
  );
});

function fakeFfmpeg(
  folder: string,
  version = "6.1.1",
): { bin: string; argsFile: string; script: string } {
  const bin = path.join(folder, "bin");
  mkdirSync(bin, { recursive: true });
  const argsFile = path.join(folder, "args.txt");
  const script = [
    "#!/bin/sh",
    `if [ "$1" = "-version" ]; then echo "ffmpeg version ${version} Copyright (c) the FFmpeg developers"; exit 0; fi`,
    `for argument in "$@"; do printf '%s\\n' "$argument"; done > "${argsFile}"`,
    'echo "out_time_us=N/A"',
    'echo "out_time_us=5000000"',
    'echo "progress=end"',
    "exit 0",
    "",
  ].join("\n");
  const file = path.join(bin, "ffmpeg");
  writeFileSync(file, script);
  chmodSync(file, 0o755);
  return { bin, argsFile, script };
}

async function serve(body: Buffer, { cutShort = false } = {}) {
  let requests = 0;
  const server = createServer((_request, response) => {
    requests++;
    response.writeHead(200, { "content-length": String(body.length) });
    if (cutShort) {
      response.write(body.subarray(0, Math.floor(body.length / 2)));
      setTimeout(() => response.socket?.destroy(), 100);
      return;
    }
    setTimeout(() => response.end(body), 150);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/ffmpeg.gz`,
    requests: () => requests,
  };
}

function sourceFor(
  url: string,
  body: Buffer,
  sha256 = createHash("sha256").update(body).digest("hex"),
): DownloadSource {
  return { url, bytes: body.length, sha256 };
}

const usingFfmpeg: Mode = {
  name: "videotest",
  group: "Video & Audio",
  inputs: ["png"],
  output: "same",
  outputSuffix: "video",
  options: [],
  usesFfmpeg: true,
  description: "Run FFmpeg on a file (test only)",
  examples: ["konvertoj -m videotest clip.png"],
  run: async (context) => {
    const [input] = context.inputs;
    await runFfmpeg(context.ffmpeg ?? "", ["-i", input?.path ?? ""], {
      duration: 10,
      onProgress: context.progress,
    });
    await context.save(async (temporaryPath) =>
      writeFileSync(temporaryPath, "done"),
    );
  },
};

async function run(folder: string, args: string[], options: MainOptions) {
  process.chdir(folder);
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
    { extraModes: [usingFfmpeg], home: path.join(folder, "home"), ...options },
  );
  return { exitCode, stdout, stderr };
}

async function folderWithClip() {
  const folder = makeFolder();
  await writeImage(folder, "clip.png", "png");
  return folder;
}

describe("cache folder", () => {
  it("follows each system's convention", () => {
    expect(
      cacheFolder({
        environment: { LOCALAPPDATA: "C:\\Users\\a\\AppData\\Local" },
        home: "C:\\Users\\a",
        platform: "win32",
      }),
    ).toBe("C:\\Users\\a\\AppData\\Local\\konvertoj");
    expect(
      cacheFolder({ environment: {}, home: "C:\\Users\\a", platform: "win32" }),
    ).toBe("C:\\Users\\a\\AppData\\Local\\konvertoj");
    expect(
      cacheFolder({ environment: {}, home: "/Users/a", platform: "darwin" }),
    ).toBe("/Users/a/Library/Caches/konvertoj");
    expect(
      cacheFolder({ environment: {}, home: "/home/a", platform: "linux" }),
    ).toBe("/home/a/.cache/konvertoj");
    expect(
      cacheFolder({
        environment: { XDG_CACHE_HOME: "/data/cache" },
        home: "/home/a",
        platform: "linux",
      }),
    ).toBe("/data/cache/konvertoj");
  });

  it("gives the exact download size for each computer", () => {
    expect(downloadSource("darwin", "arm64").bytes).toBe(19246198);
    expect(downloadSource("win32", "x64").url).toMatch(
      /\/b6\.1\.1\/ffmpeg-win32-x64\.gz$/,
    );
    expect(() => downloadSource("win32", "arm64")).toThrow(
      "has no FFmpeg download for this computer",
    );
  });
});

describe.skipIf(onWindows)("finding FFmpeg", () => {
  it("uses FFmpeg 6 from the PATH without downloading", async () => {
    const folder = await folderWithClip();
    const { bin } = fakeFfmpeg(folder);
    const result = await run(folder, ["-m", "videotest", "clip.png"], {
      environment: { PATH: bin },
      interactive: true,
      ask: async () => "n",
    });
    expect(result.exitCode).toBe(0);
    expect(existsSync(path.join(folder, "clip-video.png"))).toBe(true);
  });

  it("ignores FFmpeg 4 and offers the download", async () => {
    const folder = await folderWithClip();
    const { bin } = fakeFfmpeg(folder, "4.4.2");
    const questions: string[] = [];
    const result = await run(folder, ["-m", "videotest", "clip.png"], {
      environment: { PATH: bin },
      interactive: true,
      ask: async (question) => (questions.push(question), "n"),
    });
    expect(questions).toHaveLength(1);
    expect(result.exitCode).toBe(1);
  });

  it("accepts dated git builds", async () => {
    const folder = makeFolder();
    const { bin } = fakeFfmpeg(
      folder,
      "2024-05-13-git-37db0454e4-full_build-www.gyan.dev",
    );
    expect(
      (await findFfmpeg({ environment: { PATH: bin }, home: folder }))?.source,
    ).toBe("installed");
  });

  it("prefers KONVERTOJ_FFMPEG_PATH, and names a broken one", async () => {
    const folder = makeFolder();
    const { bin } = fakeFfmpeg(folder);
    const chosen = fakeFfmpeg(path.join(folder, "other"));
    const found = await findFfmpeg({
      environment: {
        PATH: bin,
        KONVERTOJ_FFMPEG_PATH: path.join(chosen.bin, "ffmpeg"),
      },
      home: folder,
    });
    expect(found).toEqual({
      path: path.join(chosen.bin, "ffmpeg"),
      source: "chosen",
    });
    await expect(
      findFfmpeg({
        environment: { KONVERTOJ_FFMPEG_PATH: path.join(folder, "missing") },
        home: folder,
      }),
    ).rejects.toThrow(
      `KONVERTOJ_FFMPEG_PATH is set to ${path.join(folder, "missing")}, which isn't a working FFmpeg`,
    );
    expect(
      await findFfmpeg({
        environment: { PATH: "", KONVERTOJ_FFMPEG_PATH: "" },
        home: folder,
      }),
    ).toBeUndefined();
  });

  it("passes awkward file names as one argument and reports progress", async () => {
    const folder = makeFolder();
    const { bin, argsFile } = fakeFfmpeg(folder);
    const name = path.join(folder, 'my "holiday" clip $(echo hi).mov');
    const fractions: number[] = [];
    await runFfmpeg(path.join(bin, "ffmpeg"), ["-i", name], {
      duration: 10,
      onProgress: (fraction) => fractions.push(fraction),
    });
    expect(readFileSync(argsFile, "utf8").split("\n")).toContain(name);
    expect(fractions).toEqual([0.5]);
  });
});

describe.skipIf(onWindows)("downloading the add-on", () => {
  it("explains both routes when the download is declined", async () => {
    const folder = await folderWithClip();
    const result = await run(folder, ["-m", "videotest", "clip.png"], {
      environment: { PATH: "" },
      interactive: true,
      ask: async () => "n",
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("konvertoj --install-video");
    expect(result.stderr).toContain("install FFmpeg yourself");
  });

  it("never downloads in a non-interactive run", async () => {
    const folder = await folderWithClip();
    const { script } = fakeFfmpeg(folder);
    const body = gzipSync(script);
    const server = await serve(body);
    const result = await run(folder, ["-m", "videotest", "clip.png"], {
      environment: { PATH: "" },
      interactive: false,
      ffmpegSource: sourceFor(server.url, body),
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Run konvertoj --install-video first");
    expect(server.requests()).toBe(0);
  });

  it("downloads, verifies and uses the add-on after a yes, then reuses it", async () => {
    const folder = await folderWithClip();
    const { script } = fakeFfmpeg(path.join(folder, "source"));
    const body = gzipSync(script);
    const server = await serve(body);
    const questions: string[] = [];
    const options: MainOptions = {
      environment: { PATH: "" },
      interactive: true,
      ask: async (question) => (questions.push(question), ""),
      ffmpegSource: sourceFor(server.url, body),
    };
    const first = await run(folder, ["-m", "videotest", "clip.png"], options);
    expect(first.exitCode).toBe(0);
    expect(questions[0]).toContain(`one-time download of`);
    expect(first.stderr).toContain("Saved the video add-on to");
    const second = await run(folder, ["-m", "videotest", "clip.png"], options);
    expect(second.exitCode).toBe(0);
    expect(questions).toHaveLength(1);
    expect(server.requests()).toBe(1);
  });

  it("installs in advance with --install-video, and says so the second time", async () => {
    const folder = makeFolder();
    const { script } = fakeFfmpeg(path.join(folder, "source"));
    const body = gzipSync(script);
    const server = await serve(body);
    const options: MainOptions = {
      environment: { PATH: "" },
      interactive: false,
      ffmpegSource: sourceFor(server.url, body),
    };
    expect((await run(folder, ["--install-video"], options)).exitCode).toBe(0);
    const again = await run(folder, ["--install-video"], options);
    expect(again.exitCode).toBe(0);
    expect(again.stdout).toContain("The video add-on is already installed at");
    expect(server.requests()).toBe(1);
  });

  it("deletes a download with the wrong checksum", async () => {
    const folder = makeFolder();
    const body = gzipSync("not ffmpeg");
    const server = await serve(body);
    const final = path.join(folder, "cache", "ffmpeg");
    await expect(
      installFfmpeg({
        source: sourceFor(server.url, body, "0".repeat(64)),
        final,
      }),
    ).rejects.toThrow("didn't match its checksum");
    expect(readdirSync(path.join(folder, "cache"))).toEqual([]);
  });

  it("leaves nothing behind when the download stops part-way, and can try again", async () => {
    const folder = makeFolder();
    const body = gzipSync("x".repeat(200_000) + Math.random());
    const broken = await serve(body, { cutShort: true });
    const final = path.join(folder, "cache", "ffmpeg");
    await expect(
      installFfmpeg({ source: sourceFor(broken.url, body), final }),
    ).rejects.toThrow("stopped part-way");
    expect(readdirSync(path.join(folder, "cache"))).toEqual([]);
    const working = await serve(body);
    expect(
      await installFfmpeg({ source: sourceFor(working.url, body), final }),
    ).toBe(final);
  });

  it("downloads once when two installs run together, and clears a stale lock", async () => {
    const folder = makeFolder();
    const body = gzipSync("fake ffmpeg");
    const server = await serve(body);
    const final = path.join(folder, "cache", "ffmpeg");
    mkdirSync(path.dirname(final), { recursive: true });
    writeFileSync(`${final}.lock`, "");
    const old = new Date(Date.now() - 60_000);
    const { utimesSync } = await import("node:fs");
    utimesSync(`${final}.lock`, old, old);
    const results = await Promise.all([
      installFfmpeg({ source: sourceFor(server.url, body), final }),
      installFfmpeg({ source: sourceFor(server.url, body), final }),
    ]);
    expect(results).toEqual([final, final]);
    expect(server.requests()).toBe(1);
    expect(readFileSync(final, "utf8")).toBe("fake ffmpeg");
  });

  it("says when it can't connect, while image modes keep working", async () => {
    const folder = await folderWithClip();
    const result = await run(folder, ["--install-video"], {
      environment: { PATH: "" },
      interactive: false,
      ffmpegSource: {
        url: "http://127.0.0.1:9/ffmpeg.gz",
        bytes: 10,
        sha256: "0".repeat(64),
      },
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "couldn't connect to download the video add-on",
    );
    expect(
      (
        await run(folder, ["-m", "pngtojpg", "clip.png"], {
          environment: { PATH: "" },
        })
      ).exitCode,
    ).toBe(0);
  });

  it("stops with 130 when Ctrl+C is pressed at the prompt or during the download", async () => {
    const folder = await folderWithClip();
    const body = gzipSync("fake ffmpeg");
    const server = await serve(body);
    const controller = new AbortController();
    const atPrompt = await run(folder, ["-m", "videotest", "clip.png"], {
      environment: { PATH: "" },
      interactive: true,
      signal: controller.signal,
      ask: async () => {
        controller.abort();
        throw new DOMException("aborted", "AbortError");
      },
      ffmpegSource: sourceFor(server.url, body),
    });
    expect(atPrompt.exitCode).toBe(130);
    expect(atPrompt.stderr).toContain("Stopped. Nothing was downloaded.");
    const stopped = new AbortController();
    stopped.abort();
    const duringDownload = await run(folder, ["--install-video"], {
      environment: { PATH: "" },
      interactive: false,
      signal: stopped.signal,
      ffmpegSource: sourceFor(server.url, body),
    });
    expect(duringDownload.exitCode).toBe(130);
    const cache = path.join(folder, "home", "Library", "Caches", "konvertoj");
    expect(existsSync(cache) ? readdirSync(cache) : []).toEqual([]);
  });

  it("gets a first-time user from a video mode to a result with one yes", async () => {
    const folder = await folderWithClip();
    const { script } = fakeFfmpeg(path.join(folder, "source"));
    const body = gzipSync(script);
    const server = await serve(body);
    const result = await run(folder, ["-m", "videotest", "clip.png"], {
      environment: { PATH: "" },
      interactive: true,
      ask: async () => "y",
      ffmpegSource: sourceFor(server.url, body),
    });
    expect(result.exitCode).toBe(0);
    expect(existsSync(path.join(folder, "clip-video.png"))).toBe(true);
  });
});
