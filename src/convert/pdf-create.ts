import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, type PDFImage } from "pdf-lib";
import { damagedFile, isUserError, UserError } from "../errors.js";
import type { InputFile } from "../inputs.js";
import type { RunContext } from "../modes/registry.js";
import { openImage } from "./decode.js";

const pageSizes: Record<string, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};
const pointsPerMillimetre = 72 / 25.4;
const defaultMarginMillimetres = 10;
const embeddedJpegSpaces = ["srgb", "b-w"];

async function embed(
  document: PDFDocument,
  input: InputFile,
): Promise<{ image: PDFImage; width: number; height: number }> {
  const opened = await openImage(input, {}, false, { fit: "inside" });
  const { isOpaque } = await opened.image.clone().stats();
  const { width, height } = opened;
  const metadata = opened.metadata;
  const unchanged =
    input.format === "jpg" &&
    (metadata?.orientation ?? 1) === 1 &&
    embeddedJpegSpaces.includes(metadata?.space ?? "");
  if (unchanged) {
    return {
      image: await document.embedJpg(await readFile(input.path)),
      width,
      height,
    };
  }
  if (!isOpaque) {
    const png = await opened.image.clone().png().toBuffer();
    return { image: await document.embedPng(png), width, height };
  }
  const jpeg = await opened.image
    .clone()
    .flatten({ background: "white" })
    .toColourspace("srgb")
    .jpeg({ quality: 90 })
    .toBuffer();
  return { image: await document.embedJpg(jpeg), width, height };
}

function pageFor(
  options: RunContext["options"],
  width: number,
  height: number,
): { pageWidth: number; pageHeight: number; margin: number } {
  const size =
    typeof options["page-size"] === "string"
      ? options["page-size"].toLowerCase()
      : "a4";
  const fit = size === "fit";
  const marginMillimetres =
    typeof options.margin === "string"
      ? Number(options.margin)
      : fit
        ? 0
        : defaultMarginMillimetres;
  const margin = marginMillimetres * pointsPerMillimetre;
  if (fit) {
    return {
      pageWidth: width + 2 * margin,
      pageHeight: height + 2 * margin,
      margin,
    };
  }
  const [shorter, longer] = pageSizes[size] ?? pageSizes.a4 ?? [595.28, 841.89];
  const orientation =
    typeof options.orientation === "string"
      ? options.orientation.toLowerCase()
      : "auto";
  const landscape =
    orientation === "landscape" || (orientation === "auto" && width > height);
  return landscape
    ? { pageWidth: longer, pageHeight: shorter, margin }
    : { pageWidth: shorter, pageHeight: longer, margin };
}

export async function createPdf(context: RunContext): Promise<void> {
  const document = await PDFDocument.create();
  for (const input of context.inputs) {
    try {
      const { image, width, height } = await embed(document, input);
      const { pageWidth, pageHeight, margin } = pageFor(
        context.options,
        width,
        height,
      );
      const scale = Math.min(
        1,
        (pageWidth - 2 * margin) / width,
        (pageHeight - 2 * margin) / height,
      );
      const drawnWidth = width * scale;
      const drawnHeight = height * scale;
      document.addPage([pageWidth, pageHeight]).drawImage(image, {
        x: (pageWidth - drawnWidth) / 2,
        y: (pageHeight - drawnHeight) / 2,
        width: drawnWidth,
        height: drawnHeight,
      });
    } catch (error) {
      const problem = isUserError(error) ? error : damagedFile(error);
      if (context.inputs.length > 1) {
        throw new UserError(
          `${path.relative(process.cwd(), input.path)} ${problem.message}`,
          { cause: error },
        );
      }
      throw problem;
    }
  }
  const bytes = await document.save();
  await context.save((temporaryPath) => writeFile(temporaryPath, bytes));
}
