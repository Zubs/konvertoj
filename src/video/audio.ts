import { damagedFile, isUserError, UserError } from "../errors.js";
import { bitrate } from "../modes/options.js";
import type { RunContext } from "../modes/registry.js";
import { encoders, looksDamaged, probeMedia, runFfmpeg } from "./ffmpeg.js";
import { formatTime, parseTime } from "./times.js";

async function codecFor(
  ffmpeg: string,
  target: string,
  rate: string,
): Promise<string[]> {
  switch (target) {
    case "mp3":
      return ["-c:a", "libmp3lame", "-b:a", rate, "-f", "mp3"];
    case "m4a":
      return ["-c:a", "aac", "-b:a", rate, "-f", "ipod"];
    case "ogg": {
      if (/\blibvorbis\b/.test(await encoders(ffmpeg))) {
        return ["-c:a", "libvorbis", "-b:a", rate, "-f", "ogg"];
      }
      const opusRate = Number.parseInt(rate, 10) > 256 ? "256k" : rate;
      return ["-c:a", "libopus", "-b:a", opusRate, "-f", "ogg"];
    }
    case "wav":
      return ["-c:a", "pcm_s16le", "-f", "wav"];
    default:
      return ["-c:a", "flac", "-sample_fmt", "s16", "-f", "flac"];
  }
}

export async function extractAudio(
  context: RunContext,
  target: string,
): Promise<void> {
  const [input] = context.inputs;
  const ffmpeg = context.ffmpeg;
  if (!input || !ffmpeg) {
    return;
  }
  const { options } = context;
  const media = await probeMedia(ffmpeg, input.path, context.signal);
  if (!media.hasAudio) {
    throw new UserError("has no audio, so there's nothing to extract.");
  }
  const start =
    typeof options.start === "string" ? parseTime(options.start) : 0;
  const { duration } = media;
  if (duration !== undefined && start >= duration) {
    throw new UserError(
      `starts at ${formatTime(start)}, but the video is only ${formatTime(duration)} long. Choose a --start before ${formatTime(duration)}.`,
    );
  }
  const requestedEnd =
    typeof options.end === "string" ? parseTime(options.end) : undefined;
  const end =
    requestedEnd !== undefined && duration !== undefined
      ? Math.min(requestedEnd, duration)
      : (requestedEnd ?? duration);
  const length = end === undefined ? undefined : end - start;
  const rate =
    typeof options.bitrate === "string"
      ? options.bitrate.toLowerCase()
      : (bitrate.defaultValue ?? "192k");
  const codec = await codecFor(ffmpeg, target, rate);
  if (codec.includes("libopus") && !codec.includes(rate)) {
    context.note(
      `saved at 256k, the highest bitrate OGG with Opus allows for every recording`,
    );
  }
  await context.save(async (temporaryPath) => {
    const args = [
      ...(start > 0 ? ["-ss", String(start)] : []),
      "-i",
      input.path,
      ...(length !== undefined && requestedEnd !== undefined
        ? ["-t", String(length)]
        : []),
      "-map",
      "0:a:0",
      "-vn",
      ...(options["strip-metadata"] === true
        ? ["-map_metadata", "-1", "-map_chapters", "-1"]
        : []),
      ...codec,
      temporaryPath,
    ];
    try {
      await runFfmpeg(ffmpeg, args, {
        signal: context.signal,
        duration: length,
        onProgress: context.progress,
      });
    } catch (error) {
      if (context.signal.aborted || isUserError(error)) {
        throw error;
      }
      if (looksDamaged(String((error as Error).message))) {
        throw damagedFile(error);
      }
      throw new UserError(
        "couldn't be converted by FFmpeg. Run again with --verbose for details.",
        { cause: error },
      );
    }
  });
}
