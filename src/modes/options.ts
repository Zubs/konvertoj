import { isColour } from "./colours.js";

export type OptionRule =
  | { choices: string[] }
  | { min?: number; max?: number; wholeNumber: boolean }
  | { colour: true }
  | { sizeList: { min: number; max: number } }
  | { pattern: RegExp; description: string };

export interface OptionDefinition {
  name: string;
  kind: "flag" | "value";
  short?: string;
  placeholder?: string;
  description: string;
  defaultValue?: string;
  rule?: OptionRule;
}

function flag(
  name: string,
  description: string,
  short?: string,
): OptionDefinition {
  return { name, kind: "flag", short, description };
}

function value(
  name: string,
  placeholder: string,
  description: string,
  details: Pick<OptionDefinition, "short" | "defaultValue" | "rule"> = {},
): OptionDefinition {
  return { name, kind: "value", placeholder, description, ...details };
}

const wholeNumberFromOne = { min: 1, wholeNumber: true };
const wholeNumberFromZero = { min: 0, wholeNumber: true };

export const commonOptions = [
  value(
    "output",
    "path",
    "Name of the new file, or a folder when there are several inputs",
    {
      short: "o",
    },
  ),
  flag(
    "overwrite",
    "Replace existing files instead of adding a number to the new name",
  ),
  flag("strip-metadata", "Remove camera, date and location details"),
  flag("recursive", "Include files in subfolders", "r"),
  flag("dry-run", "Show what would be created without writing anything"),
  flag("quiet", "Only show errors", "q"),
  flag("verbose", "Show every step and full error details", "v"),
];

export function imageQuality(defaultValue?: string): OptionDefinition {
  return value("quality", "number", "Image quality", {
    defaultValue,
    rule: { min: 1, max: 100, wholeNumber: true },
  });
}

export const background = value(
  "background",
  "colour",
  "Colour used where transparency is lost, e.g. white, #ff8800 or rgb(255,136,0)",
  { defaultValue: "white", rule: { colour: true } },
);
export const grayscale = flag("grayscale", "Make the image black and white");
export const width = value("width", "pixels", "Width in pixels", {
  rule: wholeNumberFromOne,
});
export const height = value("height", "pixels", "Height in pixels", {
  rule: wholeNumberFromOne,
});
export const fit = value(
  "fit",
  "how",
  "How the image fits the width and height",
  {
    defaultValue: "inside",
    rule: { choices: ["contain", "cover", "fill", "inside", "outside"] },
  },
);
export const lossless = flag("lossless", "Keep every pixel exactly");
export const progressive = flag(
  "progressive",
  "Save a JPG that loads gradually",
);
export const sizes = value(
  "sizes",
  "list",
  "Icon sizes in pixels, separated by commas",
  {
    defaultValue: "16,32,48",
    rule: { sizeList: { min: 1, max: 256 } },
  },
);
export const svgDpi = value(
  "dpi",
  "number",
  "Sharpness for drawing the SVG, in dots per inch (default: the SVG's own size)",
  { rule: { min: 1, max: 7200, wholeNumber: false } },
);

export const pageSize = value(
  "page-size",
  "size",
  "Page size, or fit to make each page match its image",
  {
    defaultValue: "A4",
    rule: { choices: ["A4", "letter", "fit"] },
  },
);
export const orientation = value(
  "orientation",
  "direction",
  "Page orientation",
  {
    defaultValue: "auto",
    rule: { choices: ["portrait", "landscape", "auto"] },
  },
);
export const margin = value(
  "margin",
  "mm",
  "Space around each image in millimetres (0 with --page-size fit)",
  { defaultValue: "10", rule: { min: 0, wholeNumber: false } },
);
export const page = value(
  "page",
  "pages",
  "Pages to export, e.g. 3, 1-5, 1,3,7 or all",
  {
    defaultValue: "all",
    rule: {
      pattern: /^(all|[1-9]\d*(-[1-9]\d*)?(,[1-9]\d*(-[1-9]\d*)?)*)$/i,
      description:
        "all, a page such as 3, a range such as 1-5 or a list such as 1,3,7",
    },
  },
);
export const pdfDpi = value(
  "dpi",
  "number",
  "Sharpness of the exported pages, in dots per inch",
  {
    defaultValue: "150",
    rule: { min: 36, max: 600, wholeNumber: false },
  },
);

export const gifWidth = value(
  "width",
  "pixels",
  "Width in pixels for GIFs made from video",
  {
    defaultValue: "480",
    rule: wholeNumberFromOne,
  },
);
export const fps = value(
  "fps",
  "number",
  "Frames per second for GIFs made from video",
  {
    defaultValue: "10",
    rule: { min: 1, max: 30, wholeNumber: true },
  },
);
const timeRule = {
  pattern: /^(\d+(\.\d+)?|\d+:[0-5]\d(\.\d+)?|\d+:[0-5]\d:[0-5]\d(\.\d+)?)$/,
  description: "a time such as 90, 1:30 or 1:02:30",
};
export const start = value(
  "start",
  "time",
  "Where to start, e.g. 90, 1:30 or 1:02:30",
  { rule: timeRule },
);
export const end = value(
  "end",
  "time",
  "Where to stop, e.g. 90, 1:30 or 1:02:30",
  { rule: timeRule },
);
export const speed = value("speed", "number", "Playback speed", {
  defaultValue: "1",
  rule: { min: 0.5, max: 4, wholeNumber: false },
});
export const force = flag("force", "Allow clips longer than 30 seconds");

export const videoQuality = value("quality", "level", "Video quality", {
  defaultValue: "medium",
  rule: { choices: ["low", "medium", "high"] },
});
export const resolution = value(
  "resolution",
  "size",
  "Make the video smaller, keeping its shape",
  {
    rule: { choices: ["1080p", "720p", "480p"] },
  },
);
export const mute = flag("mute", "Remove the audio");
export const bitrate = value(
  "bitrate",
  "rate",
  "Audio bitrate for MP3, M4A and OGG",
  {
    defaultValue: "192k",
    rule: { choices: ["128k", "192k", "256k", "320k"] },
  },
);

export const compressQuality = imageQuality();
export const level = value("level", "level", "How much to compress", {
  defaultValue: "medium",
  rule: { choices: ["low", "medium", "high"] },
});
export const targetSize = value(
  "target-size",
  "size",
  "Largest file size, e.g. 200kb or 1.5mb",
  {
    rule: {
      pattern: /^(?=.*[1-9])\d+(\.\d+)?(kb|mb)$/i,
      description: "a size such as 200kb or 1.5mb",
    },
  },
);
export const resizeScale = value(
  "scale",
  "percent",
  "New size as a percentage, e.g. 50%",
  {
    rule: {
      pattern: /^(?=.*[1-9])\d+(\.\d+)?%$/,
      description: "a percentage such as 50% or 200%",
    },
  },
);
export const noEnlarge = flag("no-enlarge", "Never make the image bigger");
export const enlargeScale = value(
  "scale",
  "factor",
  "How much bigger to make the image",
  {
    defaultValue: "2x",
    rule: { choices: ["2x", "4x"] },
  },
);
export const left = value(
  "left",
  "pixels",
  "Distance from the left edge in pixels",
  {
    rule: wholeNumberFromZero,
  },
);
export const top = value(
  "top",
  "pixels",
  "Distance from the top edge in pixels",
  {
    rule: wholeNumberFromZero,
  },
);
export const position = value(
  "position",
  "where",
  "Which part of the image to keep",
  {
    defaultValue: "center",
    rule: {
      choices: [
        "center",
        "top",
        "bottom",
        "left",
        "right",
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
      ],
    },
  },
);
export const aspect = value(
  "aspect",
  "ratio",
  "Aspect ratio to crop to, e.g. 16:9 or 1:1",
  {
    rule: {
      pattern: /^(?=[^:]*[1-9])\d+(\.\d+)?:(?=.*[1-9])\d+(\.\d+)?$/,
      description: "a ratio such as 16:9 or 1:1",
    },
  },
);
export const trim = flag("trim", "Remove plain borders around the image");
export const angle = value(
  "angle",
  "degrees",
  "Angle to turn the image by, e.g. 90 or -45",
  {
    rule: { wholeNumber: false },
  },
);
export const rotateBackground = value(
  "background",
  "colour",
  "Colour for the corners when the angle isn't a multiple of 90 (default: transparent where possible, otherwise white)",
  { rule: { colour: true } },
);
export const auto = flag(
  "auto",
  "Turn the image upright using its orientation tag",
);
export const direction = value(
  "direction",
  "direction",
  "Which way to flip the image",
  {
    rule: { choices: ["horizontal", "vertical"] },
  },
);
export const json = flag("json", "Print the details as JSON");
export const at = value(
  "at",
  "x,y",
  "Pixel to report, counted from the top left starting at 0",
  {
    rule: {
      pattern: /^\d+,\d+$/,
      description: "two whole numbers such as 10,20",
    },
  },
);
export const palette = value(
  "palette",
  "count",
  "Number of main colours to report, e.g. 5",
  {
    rule: { min: 1, max: 16, wholeNumber: true },
  },
);

export function describeRule(rule: OptionRule): string {
  if ("choices" in rule) {
    return `one of ${rule.choices.join(", ")}`;
  }
  if ("colour" in rule) {
    return "a colour such as white, #ff8800 or rgb(255,136,0)";
  }
  if ("pattern" in rule) {
    return rule.description;
  }
  if ("sizeList" in rule) {
    return `whole numbers from ${rule.sizeList.min} to ${rule.sizeList.max} separated by commas`;
  }
  const kind = rule.wholeNumber ? "a whole number" : "a number";
  if (rule.min !== undefined && rule.max !== undefined) {
    return `${kind} from ${rule.min} to ${rule.max}`;
  }
  if (rule.min !== undefined) {
    return `${kind} of ${rule.min} or more`;
  }
  return kind;
}

export function followsRule(rule: OptionRule, given: string): boolean {
  if ("choices" in rule) {
    return rule.choices.some(
      (choice) => choice.toLowerCase() === given.toLowerCase(),
    );
  }
  if ("colour" in rule) {
    return isColour(given);
  }
  if ("pattern" in rule) {
    return rule.pattern.test(given);
  }
  if ("sizeList" in rule) {
    return (
      /^\d+(,\d+)*$/.test(given) &&
      given
        .split(",")
        .map(Number)
        .every((size) => size >= rule.sizeList.min && size <= rule.sizeList.max)
    );
  }
  const pattern = rule.wholeNumber ? /^-?\d+$/ : /^-?\d+(\.\d+)?$/;
  if (!pattern.test(given)) {
    return false;
  }
  const number = Number(given);
  return (
    (rule.min === undefined || number >= rule.min) &&
    (rule.max === undefined || number <= rule.max)
  );
}
