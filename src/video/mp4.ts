import { isUserError, damagedFile, UserError } from "../errors.js";
import type { RunContext } from "../modes/registry.js";
import { looksDamaged, probeMedia, runFfmpeg } from "./ffmpeg.js";

const qualities: Record<string, number> = { low: 28, medium: 23, high: 18 };
const noVideo =
  "has no video. konvertoj turns videos into MP4s; for sound only, try -m tomp3.";

function videoFilters(
  context: RunContext,
  width: number,
  height: number,
): string {
  const { resolution } = context.options;
  const limit =
    typeof resolution === "string"
      ? Number.parseInt(resolution, 10)
      : undefined;
  if (limit !== undefined && Math.min(width, height) > limit) {
    const scale = width >= height ? `scale=-2:${limit}` : `scale=${limit}:-2`;
    return `${scale},format=yuv420p`;
  }
  if (limit !== undefined) {
    context.note(
      `kept at ${width} × ${height}, because --resolution only makes videos smaller`,
    );
  }
  return "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p";
}

export async function convertToMp4(context: RunContext): Promise<void> {
  const [input] = context.inputs;
  const ffmpeg = context.ffmpeg;
  if (!input || !ffmpeg) {
    return;
  }
  const media = await probeMedia(ffmpeg, input.path, context.signal);
  if (!media.video) {
    throw new UserError(noVideo);
  }
  const keepAudio = media.hasAudio && context.options.mute !== true;
  const quality =
    typeof context.options.quality === "string"
      ? context.options.quality.toLowerCase()
      : "medium";
  await context.save(async (temporaryPath) => {
    const args = [
      "-i",
      input.path,
      "-map",
      `0:v:${media.video?.stream ?? 0}`,
      ...(context.options["strip-metadata"] === true
        ? ["-map_metadata", "-1", "-map_chapters", "-1"]
        : []),
      ...(keepAudio ? ["-map", "0:a:0?"] : []),
      "-vf",
      videoFilters(context, media.video?.width ?? 0, media.video?.height ?? 0),
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      String(qualities[quality] ?? qualities.medium),
      "-profile:v",
      "high",
      ...(keepAudio ? ["-c:a", "aac", "-b:a", "160k"] : ["-an"]),
      "-movflags",
      "+faststart",
      "-f",
      "mp4",
      temporaryPath,
    ];
    let frames: number;
    try {
      ({ frames } = await runFfmpeg(ffmpeg, args, {
        signal: context.signal,
        duration: media.duration,
        onProgress: context.progress,
      }));
    } catch (error) {
      if (context.signal.aborted || isUserError(error)) {
        throw error;
      }
      if ((error as { frames?: number }).frames === 0) {
        throw new UserError(noVideo, { cause: error });
      }
      if (looksDamaged(String((error as Error).message))) {
        throw damagedFile(error);
      }
      throw new UserError(
        "couldn't be converted by FFmpeg. Run again with --verbose for details.",
        { cause: error },
      );
    }
    if (frames === 0) {
      throw new UserError(noVideo);
    }
  });
}
