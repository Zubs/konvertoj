export const imageInputs = [
  "jpg",
  "png",
  "webp",
  "avif",
  "gif",
  "tiff",
  "bmp",
  "ico",
  "heic",
  "svg",
];
export const imageOutputs = [
  "jpg",
  "png",
  "webp",
  "avif",
  "gif",
  "tiff",
  "bmp",
  "ico",
];
export const videoInputs = ["mov", "mkv", "avi", "webm", "m4v", "mp4"];
export const audioOutputs = ["mp3", "wav", "m4a", "ogg", "flac"];

export const formatLabels: Record<string, string> = {
  jpg: "JPG",
  png: "PNG",
  webp: "WebP",
  avif: "AVIF",
  gif: "GIF",
  tiff: "TIFF",
  bmp: "BMP",
  ico: "ICO (icon)",
  heic: "HEIC (iPhone photo)",
  svg: "SVG",
  pdf: "PDF",
  mov: "MOV",
  mkv: "MKV",
  avi: "AVI",
  webm: "WebM",
  m4v: "M4V",
  mp4: "MP4",
  mp3: "MP3",
  wav: "WAV",
  m4a: "M4A",
  ogg: "OGG",
  flac: "FLAC",
};

export const extensionAliases: Record<string, string[]> = {
  jpg: ["jpg", "jpeg", "jfif", "jpe"],
  tiff: ["tif", "tiff"],
  heic: ["heic", "heif"],
};

export function extensionsFor(format: string): string[] {
  return extensionAliases[format] ?? [format];
}

export const sampleFiles: Record<string, string> = {
  jpg: "photo.jpg",
  png: "image.png",
  webp: "image.webp",
  avif: "image.avif",
  gif: "animation.gif",
  tiff: "scan.tiff",
  bmp: "image.bmp",
  ico: "favicon.ico",
  heic: "holiday.heic",
  svg: "logo.svg",
  pdf: "report.pdf",
  mov: "clip.mov",
  mkv: "video.mkv",
  avi: "video.avi",
  webm: "video.webm",
  m4v: "video.m4v",
  mp4: "video.mp4",
};
