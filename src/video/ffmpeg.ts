import { execFile, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { chmod, mkdir, open, rename, rm, stat, utimes } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { damagedFile, UserError } from "../errors.js";
import { pendingTemporaryFiles } from "../output-files.js";
import { formatSize } from "../report.js";

export interface DownloadSource {
  url: string;
  bytes: number;
  sha256: string;
}

export type FfmpegSource = "chosen" | "installed" | "cached" | "downloaded";

export interface FoundFfmpeg {
  path: string;
  source: FfmpegSource;
}

export interface FfmpegSettings {
  environment: NodeJS.ProcessEnv;
  home: string;
  platform?: NodeJS.Platform;
}

const release = "b6.1.1";
const releaseUrl = `https://github.com/eugeneware/ffmpeg-static/releases/download/${release}`;
const lowestMajorVersion = 5;
const lockRefresh = 5_000;
const staleLock = 30_000;
const lockCheck = 500;
const stallTimeout = 30_000;
const progressRedraw = 100;
const installHelp =
  "install FFmpeg yourself from https://ffmpeg.org/download.html";

const builds: Record<string, [number, string]> = {
  "darwin-arm64": [
    19246198,
    "8923876afa8db5585022d7860ec7e589af192f441c56793971276d450ed3bbfa",
  ],
  "darwin-x64": [
    25296431,
    "929b375c1182d956c51f7ac25e0b2b0411fb01f6f407aa15c9758efeb4242106",
  ],
  "linux-arm": [
    19167563,
    "64b115a12f0ab77c277e3c418aae8b40ef881e75e746a0e2d066a206b9bc5172",
  ],
  "linux-arm64": [
    25568691,
    "754a678672298bc68156adff58aa7385a592c2b30b1d0ae8750c45c915c4bac0",
  ],
  "linux-ia32": [
    22184031,
    "169b27c078a8ecedb814cac67afccf15a9868d63e9d74ef86088adefaa500d00",
  ],
  "linux-x64": [
    29354986,
    "bfe8a8fc511530457b528c48d77b5737527b504a3797a9bc4866aeca69c2dffa",
  ],
  "win32-x64": [
    29581307,
    "8883a3dffbd0a16cf4ef95206ea05283f78908dbfb118f73c83f4951dcc06d77",
  ],
};

export function downloadSource(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): DownloadSource {
  const key = `${platform}-${arch}`;
  const build = builds[key];
  if (!build) {
    throw new UserError(
      `konvertoj has no FFmpeg download for this computer (${platform} ${arch}). Please ${installHelp}, or point KONVERTOJ_FFMPEG_PATH at it.`,
    );
  }
  const [bytes, sha256] = build;
  return { url: `${releaseUrl}/ffmpeg-${key}.gz`, bytes, sha256 };
}

export function cacheFolder({
  environment,
  home,
  platform = process.platform,
}: FfmpegSettings): string {
  const join = platform === "win32" ? path.win32.join : path.posix.join;
  if (platform === "win32") {
    return join(
      environment.LOCALAPPDATA || join(home, "AppData", "Local"),
      "konvertoj",
    );
  }
  if (platform === "darwin") {
    return join(home, "Library", "Caches", "konvertoj");
  }
  const xdg = environment.XDG_CACHE_HOME;
  return join(
    xdg && path.posix.isAbsolute(xdg) ? xdg : join(home, ".cache"),
    "konvertoj",
  );
}

function executableName(base: string, platform = process.platform): string {
  return platform === "win32" ? `${base}.exe` : base;
}

export function cachedPath(settings: FfmpegSettings): string {
  return path.join(
    cacheFolder(settings),
    executableName(`ffmpeg-${release}`, settings.platform),
  );
}

export function ffmpegVersion(file: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile(
      file,
      ["-version"],
      { timeout: 10_000, windowsHide: true },
      (error, stdout) => {
        const firstLine = String(stdout).split("\n")[0] ?? "";
        resolve(
          !error && firstLine.startsWith("ffmpeg version")
            ? firstLine
            : undefined,
        );
      },
    );
  });
}

function recentEnough(versionLine: string): boolean {
  const major = /^ffmpeg version n?(\d+)\./.exec(versionLine)?.[1];
  return major === undefined || Number(major) >= lowestMajorVersion;
}

function onPath(environment: NodeJS.ProcessEnv): string[] {
  const folders = (environment.PATH ?? environment.Path ?? "")
    .split(path.delimiter)
    .filter(Boolean);
  return folders
    .map((folder) => path.join(folder, executableName("ffmpeg")))
    .filter((file) => existsSync(file));
}

export async function findFfmpeg(
  settings: FfmpegSettings,
): Promise<FoundFfmpeg | undefined> {
  const chosen = settings.environment.KONVERTOJ_FFMPEG_PATH;
  if (chosen) {
    if (!(await ffmpegVersion(chosen))) {
      throw new UserError(
        `KONVERTOJ_FFMPEG_PATH is set to ${chosen}, which isn't a working FFmpeg. Fix or unset it.`,
      );
    }
    return { path: chosen, source: "chosen" };
  }
  for (const file of onPath(settings.environment)) {
    const version = await ffmpegVersion(file);
    if (version && recentEnough(version)) {
      return { path: file, source: "installed" };
    }
  }
  const cached = cachedPath(settings);
  if (existsSync(cached)) {
    return { path: cached, source: "cached" };
  }
  return undefined;
}

function isAbort(error: unknown): boolean {
  return (error as Error | undefined)?.name === "AbortError";
}

async function takeLock(
  lock: string,
  finished: () => boolean,
  waiting: () => void,
  signal?: AbortSignal,
): Promise<boolean> {
  let saidWaiting = false;
  for (;;) {
    try {
      const handle = await open(lock, "wx");
      await handle.close();
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }
    const touched = await stat(lock).catch(() => undefined);
    if (touched && Date.now() - touched.mtimeMs > staleLock) {
      const again = await stat(lock).catch(() => undefined);
      if (again && Date.now() - again.mtimeMs > staleLock) {
        await rm(lock, { force: true });
      }
      continue;
    }
    if (!saidWaiting) {
      waiting();
      saidWaiting = true;
    }
    await new Promise((resolve) => setTimeout(resolve, lockCheck));
    signal?.throwIfAborted();
    if (finished()) {
      return false;
    }
  }
}

export async function installFfmpeg({
  source,
  final,
  onProgress = () => {},
  onWaiting = () => {},
  signal,
}: {
  source: DownloadSource;
  final: string;
  onProgress?: (received: number, total: number) => void;
  onWaiting?: () => void;
  signal?: AbortSignal;
}): Promise<string> {
  const folder = path.dirname(final);
  await mkdir(folder, { recursive: true });
  const lock = `${final}.lock`;
  const ours = await takeLock(lock, () => existsSync(final), onWaiting, signal);
  if (!ours) {
    return final;
  }
  const temporary = path.join(
    folder,
    `.ffmpeg-${randomBytes(6).toString("hex")}.download`,
  );
  pendingTemporaryFiles.add(temporary);
  pendingTemporaryFiles.add(lock);
  const refresher = setInterval(() => {
    const now = new Date();
    utimes(lock, now, now).catch(() => {});
  }, lockRefresh);
  try {
    if (existsSync(final)) {
      return final;
    }
    await download(source, temporary, onProgress, signal);
    await chmod(temporary, 0o755);
    await rename(temporary, final);
    return final;
  } finally {
    clearInterval(refresher);
    await rm(temporary, { force: true });
    await rm(lock, { force: true });
    pendingTemporaryFiles.delete(temporary);
    pendingTemporaryFiles.delete(lock);
  }
}

async function download(
  source: DownloadSource,
  temporary: string,
  onProgress: (received: number, total: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const stalled = new AbortController();
  const both = signal
    ? AbortSignal.any([signal, stalled.signal])
    : stalled.signal;
  let response: Response;
  try {
    response = await fetch(source.url, { signal: both });
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    throw new UserError(
      `konvertoj couldn't connect to download the video add-on. Check your internet connection, then run konvertoj --install-video, or ${installHelp}.`,
      { cause: error },
    );
  }
  if (!response.ok || !response.body) {
    throw new UserError(
      `The video add-on couldn't be downloaded (the server answered ${response.status}). Try again later, or ${installHelp}.`,
    );
  }
  const hash = createHash("sha256");
  let received = 0;
  let timer = setTimeout(() => stalled.abort(), stallTimeout);
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      hash.update(chunk);
      received += chunk.length;
      onProgress(received, source.bytes);
      clearTimeout(timer);
      timer = setTimeout(() => stalled.abort(), stallTimeout);
      done(null, chunk);
    },
  });
  try {
    await pipeline(
      Readable.fromWeb(
        response.body as import("node:stream/web").ReadableStream,
      ),
      counter,
      createGunzip(),
      createWriteStream(temporary),
      { signal: both },
    );
  } catch (error) {
    if (signal?.aborted || (isAbort(error) && signal?.aborted)) {
      throw error;
    }
    throw new UserError(
      `The video add-on download stopped part-way, so nothing was saved. Try again, or ${installHelp}.`,
      { cause: error },
    );
  } finally {
    clearTimeout(timer);
  }
  if (hash.digest("hex") !== source.sha256) {
    throw new UserError(
      `The video add-on download didn't match its checksum, so it was deleted. Try again later, or ${installHelp}.`,
    );
  }
}

export interface EnsureSettings extends FfmpegSettings {
  interactive: boolean;
  explicit: boolean;
  ask?: (question: string, signal?: AbortSignal) => Promise<string>;
  err: (text: string) => void;
  errIsTerminal: boolean;
  source?: DownloadSource;
  signal?: AbortSignal;
}

function progressLine(err: (text: string) => void) {
  let lastDrawn = 0;
  return (received: number, total: number) => {
    const now = Date.now();
    if (now - lastDrawn < progressRedraw && received < total) {
      return;
    }
    lastDrawn = now;
    err(
      `\r\x1b[KDownloading the video add-on… ${formatSize(received)} of ${formatSize(total)}`,
    );
  };
}

export async function ensureFfmpeg(
  settings: EnsureSettings,
): Promise<FoundFfmpeg> {
  const found = await findFfmpeg(settings);
  if (found) {
    return found;
  }
  if (!settings.interactive && !settings.explicit) {
    throw new UserError(
      `Video and audio need FFmpeg, and konvertoj won't download it without asking. Run konvertoj --install-video first, or ${installHelp}.`,
    );
  }
  const source = settings.source ?? downloadSource(settings.platform);
  if (settings.interactive && settings.ask) {
    const answer = await settings.ask(
      `Video and audio need a one-time download of ${formatSize(source.bytes)} (FFmpeg, from github.com/eugeneware/ffmpeg-static, GPL-licensed). Continue? (Y/n) `,
      settings.signal,
    );
    if (!/^(y|yes)?$/i.test(answer.trim())) {
      throw new UserError(
        `Not downloading. Video and audio need FFmpeg: run konvertoj --install-video when you're ready, or ${installHelp}.`,
      );
    }
  }
  const showProgress = settings.errIsTerminal;
  const saved = await installFfmpeg({
    source,
    final: cachedPath(settings),
    onProgress: showProgress ? progressLine(settings.err) : undefined,
    onWaiting: () =>
      settings.err(
        "Another konvertoj is downloading the video add-on. Waiting for it to finish…\n",
      ),
    signal: settings.signal,
  });
  settings.err(
    `${showProgress ? "\r\x1b[K" : ""}Saved the video add-on to ${saved}.\n`,
  );
  return { path: saved, source: "downloaded" };
}

export function defaultSettings(): FfmpegSettings {
  return { environment: process.env, home: homedir() };
}

export function runFfmpeg(
  file: string,
  args: string[],
  {
    signal,
    duration,
    onProgress = () => {},
  }: {
    signal?: AbortSignal;
    duration?: number;
    onProgress?: (fraction: number) => void;
  } = {},
): Promise<{ frames: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      file,
      [
        "-hide_banner",
        "-nostdin",
        "-y",
        "-progress",
        "pipe:1",
        "-nostats",
        ...args,
      ],
      { shell: false, windowsHide: true, signal },
    );
    let errors = "";
    let frames = 0;
    let pending = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      pending += chunk;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? "";
      for (const line of lines) {
        const frame = /^frame=(\d+)/.exec(line.trim())?.[1];
        if (frame !== undefined) {
          frames = Number(frame);
        }
        const time = /^out_time_us=(\d+)/.exec(line.trim())?.[1];
        if (time !== undefined && duration && duration > 0) {
          onProgress(Math.min(1, Number(time) / 1e6 / duration));
        }
      }
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      errors = (errors + chunk).slice(-4096);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ frames });
      } else {
        reject(
          Object.assign(
            new Error(`FFmpeg exited with code ${code}: ${errors.trim()}`),
            { frames },
          ),
        );
      }
    });
  });
}

export interface MediaInfo {
  duration?: number;
  video?: { codec: string; width: number; height: number; stream: number };
  hasAudio: boolean;
}

const damagedSigns = [
  "invalid data found",
  "moov atom not found",
  "could not find codec parameters",
];

const pictureCodecs = ["mjpeg", "png", "bmp", "gif", "webp"];

function videoStreams(lines: string[]) {
  const starts = lines
    .map((line, index) => (/Stream #.*: Video: /.test(line) ? index : -1))
    .filter((index) => index !== -1);
  return starts.map((start, order) => {
    const line = lines[start] ?? "";
    const next = lines.findIndex(
      (other, index) => index > start && /^\s*Stream #/.test(other),
    );
    const own = lines.slice(start + 1, next === -1 ? undefined : next);
    const codec = /: Video: (\w+)/.exec(line)?.[1] ?? "unknown";
    return {
      order,
      line,
      own,
      codec,
      picture: /attached pic/.test(line) || pictureCodecs.includes(codec),
      main: /\(default\)/.test(line),
    };
  });
}

export function readMediaInfo(text: string): MediaInfo {
  const lines = text.split(/\r?\n/);
  const duration = /Duration: (\d+):(\d\d):(\d\d(?:\.\d+)?)/.exec(text);
  const info: MediaInfo = {
    duration: duration
      ? Number(duration[1]) * 3600 +
        Number(duration[2]) * 60 +
        Number(duration[3])
      : undefined,
    hasAudio: lines.some((line) => /Stream #.*: Audio: /.test(line)),
  };
  const streams = videoStreams(lines);
  const moving = streams.filter((stream) => !stream.picture);
  const chosen =
    moving.find((stream) => stream.main) ?? moving[0] ?? streams[0];
  if (!chosen) {
    return info;
  }
  const size = /, (\d{2,5})x(\d{2,5})/.exec(chosen.line);
  const rotation = Number(
    chosen.own
      .map(
        (other) => /display ?matrix: rotation of (-?[\d.]+)/i.exec(other)?.[1],
      )
      .find((value) => value !== undefined) ?? 0,
  );
  const turned = Math.abs(Math.round(rotation)) % 180 === 90;
  const width = Number(size?.[1] ?? 0);
  const height = Number(size?.[2] ?? 0);
  info.video = {
    codec: chosen.codec,
    width: turned ? height : width,
    height: turned ? width : height,
    stream: chosen.order,
  };
  return info;
}

export function looksDamaged(text: string): boolean {
  const lower = text.toLowerCase();
  return damagedSigns.some((sign) => lower.includes(sign));
}

export function probeMedia(
  file: string,
  input: string,
  signal?: AbortSignal,
): Promise<MediaInfo> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      ["-hide_banner", "-nostdin", "-i", input],
      { windowsHide: true, signal, maxBuffer: 4 * 1024 * 1024 },
      (error, _stdout, stderr) => {
        if (signal?.aborted) {
          reject(error);
          return;
        }
        const text = String(stderr);
        if (looksDamaged(text) || !/Input #0/.test(text)) {
          reject(damagedFile(new Error(text.trim().slice(-1000))));
          return;
        }
        resolve(readMediaInfo(text));
      },
    );
  });
}
