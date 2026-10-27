import { readFile, writeFile } from "node:fs/promises";
import sharp from "./sharp.js";
import type { RunContext } from "../modes/registry.js";
import { convertImage } from "./image.js";
import { isLosslessWebp, removeJpegDetails } from "./metadata.js";

export async function stripDetails(context: RunContext): Promise<void> {
  const [input] = context.inputs;
  if (!input) {
    return;
  }
  const contents = await readFile(input.path);
  if (input.format === "jpg") {
    const { orientation } = await sharp(contents).metadata();
    if (orientation === undefined || orientation === 1) {
      const stripped = removeJpegDetails(contents);
      await context.save((temporaryPath) => writeFile(temporaryPath, stripped));
      return;
    }
  }
  await convertImage(
    {
      ...context,
      options: {
        ...context.options,
        "strip-metadata": true,
        lossless: input.format === "webp" && isLosslessWebp(contents),
      },
    },
    input.format ?? "",
    { keepFormat: true },
  );
}
