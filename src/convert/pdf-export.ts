import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import sharp from "./sharp.js";
import { damagedFile, UserError } from "../errors.js";
import { background } from "../modes/options.js";
import type { RunContext } from "../modes/registry.js";
import { renderOpened } from "./image.js";
import { largestSide } from "./resize.js";

const defaultDpi = 150;
const mostPixels = 268_402_689;

function pdfjsFolder(name: string): string {
  const packageFile = createRequire(import.meta.url).resolve(
    "pdfjs-dist/package.json",
  );
  return `${path.join(path.dirname(packageFile), name).replaceAll("\\", "/")}/`;
}

export function pagesFrom(option: string, count: number): number[] {
  if (option.toLowerCase() === "all") {
    return Array.from({ length: count }, (_, index) => index + 1);
  }
  const pages = option.split(",").flatMap((part) => {
    const [first = 1, last = first] = part.split("-").map(Number);
    return Array.from(
      { length: last - first + 1 },
      (_, index) => first + index,
    );
  });
  const missing = pages.find((page) => page > count);
  if (missing !== undefined) {
    throw new UserError(
      `has ${count} page${count === 1 ? "" : "s"}, so there is no page ${missing}. Choose pages from 1 to ${count}.`,
    );
  }
  return [...new Set(pages)];
}

async function openPdf(file: string) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  try {
    return await pdfjs.getDocument({
      data: new Uint8Array(await readFile(file)),
      standardFontDataUrl: pdfjsFolder("standard_fonts"),
      cMapUrl: pdfjsFolder("cmaps"),
      cMapPacked: true,
      wasmUrl: pdfjsFolder("wasm"),
      verbosity: 0,
    }).promise;
  } catch (error) {
    if ((error as Error).name === "PasswordException") {
      throw new UserError(
        "is password-protected. Remove the password in a PDF app, then try again.",
        { cause: error },
      );
    }
    throw damagedFile(error);
  }
}

export async function exportPages(
  context: RunContext,
  target: string,
): Promise<void> {
  const [input] = context.inputs;
  if (!input) {
    return;
  }
  const { options } = context;
  const pdf = await openPdf(input.path);
  try {
    if (pdf.numPages === 0) {
      throw new UserError("has no pages.");
    }
    const pages = pagesFrom(
      typeof options.page === "string" ? options.page : "all",
      pdf.numPages,
    );
    const dpi =
      typeof options.dpi === "string" ? Number(options.dpi) : defaultDpi;
    const fill =
      typeof options.background === "string"
        ? options.background
        : (background.defaultValue ?? "white");
    const digits = String(pdf.numPages).length;
    const { createCanvas } = await import("@napi-rs/canvas");
    for (const number of pages) {
      const page = await pdf.getPage(number).catch((error: unknown) => {
        throw damagedFile(error);
      });
      const viewport = page.getViewport({ scale: dpi / 72 });
      const width = Math.ceil(viewport.width);
      const height = Math.ceil(viewport.height);
      if (
        Math.max(width, height) > largestSide ||
        width * height > mostPixels
      ) {
        throw new UserError(
          `page ${number} would be ${width} × ${height} pixels at ${dpi} dpi, which is too large. Choose a lower --dpi.`,
        );
      }
      const canvas = createCanvas(width, height);
      const drawing = canvas.getContext("2d");
      await page
        .render({
          canvas: canvas as unknown as HTMLCanvasElement,
          canvasContext: drawing as unknown as CanvasRenderingContext2D,
          viewport,
          background: fill,
        })
        .promise.catch((error: unknown) => {
          throw damagedFile(error);
        });
      const pixels = drawing.getImageData(0, 0, width, height).data;
      page.cleanup();
      const encoded = await renderOpened(
        context,
        {
          image: sharp(
            Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength),
            {
              raw: { width, height, channels: 4 },
            },
          ).removeAlpha(),
          width,
          height,
          pages: 1,
        },
        target,
      );
      await context.save((temporaryPath) => writeFile(temporaryPath, encoded), {
        suffix: `-${String(number).padStart(digits, "0")}`,
      });
    }
  } finally {
    await pdf.loadingTask.destroy();
  }
}
