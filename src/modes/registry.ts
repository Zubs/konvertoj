import {
  audioOutputs,
  defaultQualities,
  formatLabels,
  imageInputs,
  imageOutputs,
  sampleFiles,
  videoInputs,
} from "./formats.js";
import type { InputFile } from "../inputs.js";
import type { Section } from "../report.js";
import {
  angle,
  aspect,
  at,
  auto,
  background,
  bitrate,
  commonOptions,
  compressQuality,
  direction,
  end,
  enlargeScale,
  fit,
  force,
  fps,
  gifWidth,
  grayscale,
  height,
  imageQuality,
  json,
  left,
  level,
  lossless,
  margin,
  mute,
  noEnlarge,
  orientation,
  page,
  pageSize,
  palette,
  pdfDpi,
  position,
  progressive,
  resizeScale,
  resolution,
  rotateBackground,
  sizes,
  speed,
  start,
  svgDpi,
  targetSize,
  top,
  trim,
  videoQuality,
  width,
  type OptionDefinition,
} from "./options.js";

export const groups = [
  "Image",
  "PDF",
  "GIF",
  "Video & Audio",
  "Tools",
] as const;
export type Group = (typeof groups)[number];

export interface Mode {
  name: string;
  group: Group;
  inputs: string[];
  output: string;
  options: OptionDefinition[];
  description: string;
  examples: string[];
  outputSuffix?: string;
  combinesInputs?: true;
  multipleOutputs?: true;
  usesFfmpeg?: true;
  checkOptions?: (options: RunContext["options"]) => string | undefined;
  warnings?: (options: RunContext["options"]) => string[];
  run?: (context: RunContext) => Promise<{ skipped: string } | void>;
}

export interface RunContext {
  inputs: InputFile[];
  output: string;
  options: Record<string, string | boolean | undefined>;
  save(
    write: (temporaryPath: string) => Promise<void>,
    options?: { suffix?: string },
  ): Promise<string>;
  progress(fraction: number): void;
  detail(message: string): void;
  note(message: string): void;
  show(section: Section): void;
  colours: boolean;
  ffmpeg?: string;
  signal: AbortSignal;
}

const anyImageLabel = "any image";
const anyVideoLabel = "any supported video";

function label(format: string): string {
  return formatLabels[format] ?? format;
}

function convertTo(target: string): Mode["run"] {
  return async (context) =>
    (await import("../convert/image.js")).convertImage(context, target);
}

function convertKeepingFormat(enlarge: boolean): Mode["run"] {
  return async (context) =>
    (await import("../convert/image.js")).convertImage(
      context,
      context.inputs[0]?.format ?? "",
      { keepFormat: true, enlarge },
    );
}

function resizeProblem(options: RunContext["options"]): string | undefined {
  const sized = options.width !== undefined || options.height !== undefined;
  if (options.scale !== undefined && sized) {
    return "--scale can't be used with --width or --height. Choose one way to size the image.";
  }
  if (options.scale === undefined && !sized) {
    return "Give --width, --height or --scale to say how big the image should be.";
  }
  return undefined;
}

function compressProblem(options: RunContext["options"]): string | undefined {
  const given = ["quality", "level", "target-size"].filter(
    (name) => options[name] !== undefined,
  );
  return given.length > 1
    ? "Use only one of --quality, --level and --target-size."
    : undefined;
}

function editWith(
  name: "cropImage" | "rotateImage" | "flipImage",
): Mode["run"] {
  return async (context) => (await import("../convert/edit.js"))[name](context);
}

function cropProblem(options: RunContext["options"]): string | undefined {
  const has = (name: string) => options[name] !== undefined;
  const sized = has("width") || has("height");
  const placedExactly = has("left") || has("top");
  if (!sized && !has("aspect") && !has("trim") && !placedExactly) {
    return "Choose how to crop: --width and --height (placed with --left and --top, or --position), --aspect such as 16:9, or --trim.";
  }
  if (
    has("trim") &&
    (sized || placedExactly || has("aspect") || has("position"))
  ) {
    return has("aspect")
      ? "--aspect and --trim can't be used together. Choose one way to crop."
      : "--trim can't be used with other crop options. Use it on its own.";
  }
  if (has("aspect") && (sized || placedExactly)) {
    return "--aspect can't be used with --width, --height, --left or --top. Choose one way to crop.";
  }
  if (has("left") !== has("top")) {
    return "--left and --top go together. Give both, or use --position.";
  }
  if (has("aspect") || has("trim")) {
    return undefined;
  }
  if (!has("width") || !has("height")) {
    return "--width and --height go together for crop. Give both.";
  }
  if (placedExactly && has("position")) {
    return "--position can't be used with --left and --top. Choose one way to place the crop.";
  }
  return undefined;
}

function rotateProblem(options: RunContext["options"]): string | undefined {
  return options.angle === undefined && options.auto === undefined
    ? "Give --angle, e.g. --angle 90, or --auto to turn a photo upright."
    : undefined;
}

function flipProblem(options: RunContext["options"]): string | undefined {
  return options.direction === undefined
    ? "Give --direction horizontal or --direction vertical."
    : undefined;
}

function colourPickProblem(options: RunContext["options"]): string | undefined {
  return options.at === undefined && options.palette === undefined
    ? "Give --at, e.g. --at 10,10, or --palette, e.g. --palette 5."
    : undefined;
}

const pageWidthsInMillimetres: Record<string, number> = {
  a4: 210,
  letter: 215.9,
};

function pdfMarginProblem(options: RunContext["options"]): string | undefined {
  const size =
    typeof options["page-size"] === "string"
      ? options["page-size"].toLowerCase()
      : "a4";
  const across = pageWidthsInMillimetres[size];
  const wanted =
    typeof options.margin === "string" ? Number(options.margin) : undefined;
  if (across === undefined || wanted === undefined || wanted * 2 < across) {
    return undefined;
  }
  const label = size === "a4" ? "A4" : "letter";
  return `--margin ${wanted} is half the page or more (${label} is ${across} mm across). Choose a smaller margin.`;
}

function pageListProblem(options: RunContext["options"]): string | undefined {
  if (typeof options.page !== "string") {
    return undefined;
  }
  const backwards = options.page.split(",").find((part) => {
    const [first, last] = part.split("-").map(Number);
    return last !== undefined && first !== undefined && last < first;
  });
  return backwards
    ? `--page ${backwards} goes backwards. Write the lower page first, e.g. ${backwards.split("-").reverse().join("-")}.`
    : undefined;
}

function pdfRun(
  name: "createPdf" | "exportPages",
  target?: string,
): Mode["run"] {
  return async (context) => {
    if (name === "createPdf") {
      return (await import("../convert/pdf-create.js")).createPdf(context);
    }
    return (await import("../convert/pdf-export.js")).exportPages(
      context,
      target ?? "png",
    );
  };
}

function timeRangeProblem(options: RunContext["options"]): string | undefined {
  if (typeof options.end !== "string") {
    return undefined;
  }
  const seconds = (value: string) =>
    value
      .split(":")
      .map(Number)
      .reduce((total, part) => total * 60 + part, 0);
  const startAt =
    typeof options.start === "string" ? seconds(options.start) : 0;
  if (seconds(options.end) > startAt) {
    return undefined;
  }
  return typeof options.start === "string"
    ? `--end ${options.end} must be after --start ${options.start}.`
    : `--end ${options.end} must be after the start of the video.`;
}

function targetEncodingOptions(target: string): OptionDefinition[] {
  const options: OptionDefinition[] = [];
  if (target in defaultQualities || target === "tiff") {
    options.push(imageQuality(defaultQualities[target]?.toString()));
  }
  if (target === "webp" || target === "avif") {
    options.push(lossless);
  }
  if (target === "jpg") {
    options.push(progressive);
  }
  if (target === "ico") {
    options.push(sizes);
  }
  return options;
}

function imageConversionOptions(
  target: string,
  inputs: string[],
): OptionDefinition[] {
  const options = [
    ...targetEncodingOptions(target),
    background,
    grayscale,
    width,
    height,
    fit,
  ];
  if (inputs.includes("svg")) {
    options.push(svgDpi);
  }
  return options;
}

function imageModes(): Mode[] {
  const pairs = imageInputs.flatMap((from) =>
    imageOutputs
      .filter((to) => to !== from)
      .map((to) => ({
        name: `${from}to${to}`,
        group: "Image" as const,
        inputs: [from],
        output: to,
        options: imageConversionOptions(to, [from]),
        description: `Convert ${label(from)} to ${label(to)}`,
        examples: [
          `konvertoj -m ${from}to${to} ${sampleFiles[from]}`,
          `konvertoj -m ${from}to${to} ./images -o ./converted`,
        ],
        run: convertTo(to),
      })),
  );
  const anyImage = imageOutputs
    .filter((to) => to !== "gif")
    .map((to) => ({
      name: `to${to}`,
      group: "Image" as const,
      inputs: imageInputs,
      output: to,
      options: imageConversionOptions(to, imageInputs),
      description: `Convert ${anyImageLabel} to ${label(to)}`,
      examples: [`konvertoj -m to${to} ./downloads -o ./${to}s`],
      run: convertTo(to),
    }));
  return [...pairs, ...anyImage];
}

function pdfModes(): Mode[] {
  const pdfOptions = [pageSize, orientation, margin];
  const fromImages = imageInputs.map((from) => ({
    name: `${from}topdf`,
    group: "PDF" as const,
    inputs: [from],
    output: "pdf",
    combinesInputs: true as const,
    options: pdfOptions,
    checkOptions: pdfMarginProblem,
    run: pdfRun("createPdf"),
    description: `Turn ${label(from)} images into one PDF`,
    examples: [
      `konvertoj -m ${from}topdf ./scans -o scans`,
      `konvertoj -m ${from}topdf ${sampleFiles[from]}`,
    ],
  }));
  const fromAnyImage = {
    name: "topdf",
    group: "PDF" as const,
    inputs: imageInputs,
    output: "pdf",
    combinesInputs: true as const,
    options: pdfOptions,
    checkOptions: pdfMarginProblem,
    run: pdfRun("createPdf"),
    description: `Turn ${anyImageLabel} files into one PDF`,
    examples: ["konvertoj -m topdf ./receipts -o receipts"],
  };
  const toImages = imageOutputs.map((to) => ({
    name: `pdfto${to}`,
    group: "PDF" as const,
    multipleOutputs: true as const,
    checkOptions: pageListProblem,
    run: pdfRun("exportPages", to),
    inputs: ["pdf"],
    output: to,
    options: [page, pdfDpi, background, ...targetEncodingOptions(to)],
    description: `Export PDF pages as ${label(to)} images`,
    examples: [
      `konvertoj -m pdfto${to} report.pdf -o pages`,
      `konvertoj -m pdfto${to} report.pdf --page 3`,
    ],
  }));
  return [...fromImages, fromAnyImage, ...toImages];
}

function gifModes(): Mode[] {
  return [
    {
      name: "togif",
      group: "GIF",
      inputs: [...imageInputs, ...videoInputs],
      output: "gif",
      options: [gifWidth, fps, start, end, speed, force],
      description: "Turn an image or a short video clip into a GIF",
      examples: [
        "konvertoj -m togif clip.mp4 --start 0:02 --end 0:05",
        "konvertoj -m togif sticker.webp",
      ],
    },
  ];
}

function videoAndAudioModes(): Mode[] {
  return videoAndAudioDefinitions().map((mode) => ({
    ...mode,
    usesFfmpeg: true as const,
  }));
}

function videoAndAudioDefinitions(): Mode[] {
  const toMp4Options = [videoQuality, resolution, mute];
  const toMp4Run: Mode["run"] = async (context) =>
    (await import("../video/mp4.js")).convertToMp4(context);
  const toMp4 = videoInputs
    .filter((from) => from !== "mp4")
    .map((from) => ({
      name: `${from}tomp4`,
      group: "Video & Audio" as const,
      inputs: [from],
      output: "mp4",
      options: toMp4Options,
      run: toMp4Run,
      description: `Convert ${label(from)} video to MP4`,
      examples: [`konvertoj -m ${from}tomp4 ${sampleFiles[from]}`],
    }));
  const anyToMp4 = {
    name: "tomp4",
    group: "Video & Audio" as const,
    inputs: videoInputs,
    output: "mp4",
    options: toMp4Options,
    run: toMp4Run,
    description: `Convert ${anyVideoLabel} to MP4`,
    examples: ["konvertoj -m tomp4 ./videos -o ./mp4s"],
  };
  const audioOptions = [bitrate, start, end];
  const audioRun =
    (to: string): Mode["run"] =>
    async (context) =>
      (await import("../video/audio.js")).extractAudio(context, to);
  const audioWarnings = (to: string) => (options: RunContext["options"]) =>
    (to === "wav" || to === "flac") && options.bitrate !== undefined
      ? [`--bitrate is ignored for ${label(to)}, which is lossless.`]
      : [];
  const toAudio = videoInputs.flatMap((from) =>
    audioOutputs.map((to) => ({
      name: `${from}to${to}`,
      group: "Video & Audio" as const,
      inputs: [from],
      output: to,
      options: audioOptions,
      run: audioRun(to),
      checkOptions: timeRangeProblem,
      warnings: audioWarnings(to),
      description: `Extract the audio from ${label(from)} video as ${label(to)}`,
      examples: [`konvertoj -m ${from}to${to} ${sampleFiles[from]}`],
    })),
  );
  const anyToAudio = audioOutputs.map((to) => ({
    name: `to${to}`,
    group: "Video & Audio" as const,
    inputs: videoInputs,
    output: to,
    options: audioOptions,
    run: audioRun(to),
    checkOptions: timeRangeProblem,
    warnings: audioWarnings(to),
    description: `Extract the audio from ${anyVideoLabel} as ${label(to)}`,
    examples: [`konvertoj -m to${to} talk.mp4 --start 1:30 --end 45:00`],
  }));
  return [...toMp4, anyToMp4, ...toAudio, ...anyToAudio];
}

function toolModes(): Mode[] {
  const tool = (mode: Omit<Mode, "group">): Mode => ({
    ...mode,
    group: "Tools",
  });
  return [
    tool({
      name: "compress",
      inputs: ["jpg", "png", "webp", "avif", "gif"],
      output: "same",
      outputSuffix: "compressed",
      options: [compressQuality, level, targetSize],
      checkOptions: compressProblem,
      run: async (context) =>
        (await import("../convert/compress.js")).compressImage(context),
      description: "Make images smaller while keeping them looking good",
      examples: [
        "konvertoj -m compress hero.jpg",
        "konvertoj -m compress ./images --target-size 200kb",
      ],
    }),
    tool({
      name: "resize",
      inputs: imageOutputs,
      output: "same",
      outputSuffix: "resized",
      options: [width, height, resizeScale, fit, noEnlarge],
      checkOptions: resizeProblem,
      run: convertKeepingFormat(false),
      description: "Change an image's width and height",
      examples: [
        "konvertoj -m resize photo.jpg --width 1200",
        "konvertoj -m resize ./screenshots --scale 50%",
      ],
    }),
    tool({
      name: "enlarge",
      inputs: imageOutputs,
      output: "same",
      outputSuffix: "enlarged",
      options: [enlargeScale],
      run: convertKeepingFormat(true),
      description: "Upscale an image to 2x or 4x its size",
      examples: [
        "konvertoj -m enlarge icon.png",
        "konvertoj -m enlarge photo.jpg --scale 4x",
      ],
    }),
    tool({
      name: "crop",
      inputs: imageOutputs,
      output: "same",
      outputSuffix: "cropped",
      options: [width, height, left, top, position, aspect, trim],
      checkOptions: cropProblem,
      run: editWith("cropImage"),
      description:
        "Cut an image to an area, a position or an aspect ratio, or trim plain borders",
      examples: [
        "konvertoj -m crop photo.jpg --width 800 --height 800",
        "konvertoj -m crop ./photos --aspect 1:1",
        "konvertoj -m crop screenshot.png --trim",
      ],
    }),
    tool({
      name: "rotate",
      inputs: imageOutputs,
      output: "same",
      outputSuffix: "rotated",
      options: [angle, auto, rotateBackground],
      checkOptions: rotateProblem,
      run: editWith("rotateImage"),
      description:
        "Turn an image by any angle, or upright using its orientation tag",
      examples: [
        "konvertoj -m rotate scan.jpg --angle 180",
        "konvertoj -m rotate ./phone --auto",
      ],
    }),
    tool({
      name: "flip",
      inputs: imageOutputs,
      output: "same",
      outputSuffix: "flipped",
      options: [direction],
      checkOptions: flipProblem,
      run: editWith("flipImage"),
      description: "Mirror an image horizontally or vertically",
      examples: ["konvertoj -m flip selfie.jpg --direction horizontal"],
    }),
    tool({
      name: "strip",
      inputs: ["jpg", "png", "webp", "avif", "tiff"],
      output: "same",
      outputSuffix: "stripped",
      options: [],
      run: async (context) =>
        (await import("../convert/strip.js")).stripDetails(context),
      description: "Remove camera, date and location details from images",
      examples: ["konvertoj -m strip ./holiday -o ./to-share"],
    }),
    tool({
      name: "info",
      inputs: imageInputs,
      output: "none",
      options: [json],
      run: async (context) =>
        (await import("../convert/info.js")).showInfo(context),
      description: "Show an image's format, size, dimensions and details",
      examples: [
        "konvertoj -m info photo.jpg",
        "konvertoj -m info ./photos --json",
      ],
    }),
    tool({
      name: "colorpick",
      inputs: imageInputs,
      output: "none",
      options: [at, palette, json],
      checkOptions: colourPickProblem,
      run: async (context) =>
        (await import("../convert/colours.js")).pickColours(context),
      description: "Report the colour at a point, or an image's main colours",
      examples: [
        "konvertoj -m colorpick logo.png --at 10,10",
        "konvertoj -m colorpick brand.jpg --palette 5",
      ],
    }),
  ];
}

export const modes: Mode[] = [
  ...imageModes(),
  ...pdfModes(),
  ...gifModes(),
  ...videoAndAudioModes(),
  ...toolModes(),
];

const modesByName = new Map(modes.map((mode) => [mode.name, mode]));

export function findMode(name: string): Mode | undefined {
  return modesByName.get(name);
}

const fileOptions = ["output", "overwrite", "strip-metadata"];

export function commonOptionsFor(mode: Mode): OptionDefinition[] {
  return mode.output === "none"
    ? commonOptions.filter((option) => !fileOptions.includes(option.name))
    : commonOptions;
}

export function acceptedOptions(mode: Mode): OptionDefinition[] {
  return [...mode.options, ...commonOptionsFor(mode)];
}

export function describeFormats(formats: string[]): string {
  if (formats === imageInputs) {
    return anyImageLabel;
  }
  if (formats === videoInputs) {
    return anyVideoLabel;
  }
  return formats.map(label).join(", ");
}

export function describeOutput(mode: Mode): string {
  if (mode.output === "same") {
    return "the same format as the input";
  }
  if (mode.output === "none") {
    return "no file, the details are printed";
  }
  return label(mode.output);
}
