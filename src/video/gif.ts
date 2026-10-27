import { convertImage } from "../convert/image.js";
import { openImage } from "../convert/decode.js";
import { damagedFile, isUserError, UserError } from "../errors.js";
import { imageInputs } from "../modes/formats.js";
import type { RunContext } from "../modes/registry.js";
import { looksDamaged, probeMedia, runFfmpeg } from "./ffmpeg.js";
import { formatTime, parseTime } from "./times.js";

const videoOnly = ["fps", "speed", "start", "end", "force"];
const longestClip = 30;
const defaultWidth = 480;
const defaultFps = 10;

async function imageToGif(
  context: RunContext,
): Promise<{ skipped: string } | void> {
  const [input] = context.inputs;
  const given = videoOnly.find((name) => context.options[name] !== undefined);
  if (given && input?.format === "gif" && context.options.width === undefined) {
    return { skipped: "already a GIF" };
  }
  if (given) {
    throw new UserError(
      `--${given} only applies to videos. Remove it to make a GIF from this image.`,
    );
  }
  const options = { ...context.options };
  if (typeof options.width === "string" && input) {
    const opened = await openImage(input, {}, false, { fit: "inside" });
    if (Number(options.width) >= opened.width) {
      delete options.width;
      context.note(
        `kept at ${opened.width} × ${opened.height}, because togif never makes images bigger`,
      );
    }
  }
  await convertImage({ ...context, options }, "gif");
}

function numberOption(
  options: RunContext["options"],
  name: string,
  fallback: number,
): number {
  return typeof options[name] === "string" ? Number(options[name]) : fallback;
}

export async function makeGif(
  context: RunContext,
): Promise<{ skipped: string } | void> {
  const [input] = context.inputs;
  if (!input) {
    return;
  }
  if (imageInputs.includes(input.format ?? "")) {
    return imageToGif(context);
  }
  const ffmpeg = context.ffmpeg;
  if (!ffmpeg) {
    throw new UserError(
      "is a video, so it needs FFmpeg. Run konvertoj --install-video, then try again.",
    );
  }
  const { options } = context;
  const media = await probeMedia(ffmpeg, input.path, context.signal);
  if (!media.video) {
    throw new UserError("has no video, so there's nothing to turn into a GIF.");
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
  if (length !== undefined && length > longestClip && options.force !== true) {
    throw new UserError(
      `is ${Math.ceil(length)} seconds long, and GIFs of more than ${longestClip} seconds get very large. Choose a section with --start and --end, or add --force.`,
    );
  }
  const speed = numberOption(options, "speed", 1);
  const fps = numberOption(options, "fps", defaultFps);
  const width = Math.min(
    numberOption(options, "width", defaultWidth),
    media.video.width,
  );
  const graph = [
    `[0:v:${media.video.stream}]setpts=PTS/${speed},fps=${fps},scale=${width}:-2:flags=lanczos,split[a][b]`,
    "[a]palettegen=stats_mode=diff[p]",
    "[b][p]paletteuse=dither=sierra2_4a[out]",
  ].join(";");
  await context.save(async (temporaryPath) => {
    const args = [
      ...(start > 0 ? ["-ss", String(start)] : []),
      ...(requestedEnd !== undefined && length !== undefined
        ? ["-t", String(length)]
        : []),
      "-i",
      input.path,
      "-filter_complex",
      graph,
      "-map",
      "[out]",
      "-an",
      "-loop",
      "0",
      "-f",
      "gif",
      temporaryPath,
    ];
    let frames: number;
    try {
      ({ frames } = await runFfmpeg(ffmpeg, args, {
        signal: context.signal,
        duration: length === undefined ? undefined : length / speed,
        onProgress: context.progress,
      }));
    } catch (error) {
      if (context.signal.aborted || isUserError(error)) {
        throw error;
      }
      if (looksDamaged(String((error as Error).message))) {
        throw damagedFile(error);
      }
      throw new UserError(
        "couldn't be turned into a GIF by FFmpeg. Run again with --verbose for details.",
        { cause: error },
      );
    }
    if (frames === 0) {
      throw new UserError(
        "has no video, so there's nothing to turn into a GIF.",
      );
    }
  });
}
