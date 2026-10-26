import { Buffer } from "node:buffer";
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import exifr from "exifr";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { acceptedOptions, modes } from "../src/modes/registry.js";
import { makeFolder } from "./support/folders.js";
import { pixels, writeImage, writeNoise } from "./support/images.js";
import { runIn as run } from "./support/run-main.js";

const camera = {
  IFD0: { Make: "Canon", Model: "EOS R5" },
  IFD2: { DateTimeOriginal: "2025:05:01 12:00:00" },
  IFD3: {
    GPSLatitudeRef: "N",
    GPSLatitude: "51/1 30/1 0/1",
    GPSLongitudeRef: "W",
    GPSLongitude: "0/1 7/1 0/1",
  },
};

async function writeCameraPhoto(
  folder: string,
  name: string,
  format = "jpeg",
): Promise<string> {
  const file = path.join(folder, name);
  await sharp({
    create: { width: 30, height: 20, channels: 3, background: "teal" },
  })
    .withExif(camera)
    .toFormat(format as "jpeg")
    .toFile(file);
  return file;
}

async function details(file: string): Promise<Record<string, unknown>> {
  const { exif } = await sharp(file).metadata();
  if (!exif) {
    return {};
  }
  const tiff =
    exif.subarray(0, 6).toString("latin1") === "Exif\0\0"
      ? exif.subarray(6)
      : exif;
  return (await exifr.parse(tiff, { gps: true, reviveValues: false })) ?? {};
}

function expectCameraDetails(found: Record<string, unknown>) {
  expect(found.Make).toBe("Canon");
  expect(found.Model).toBe("EOS R5");
  expect(found.DateTimeOriginal).toBe("2025:05:01 12:00:00");
  expect(found.GPSLatitudeRef).toBe("N");
}

function expectNoDetails(found: Record<string, unknown>) {
  expect(found.Make).toBeUndefined();
  expect(found.DateTimeOriginal).toBeUndefined();
  expect(found.GPSLatitude).toBeUndefined();
}

function corruptExif(file: string, howMuch: number) {
  const contents = readFileSync(file);
  const start = contents.indexOf(Buffer.from("Exif\0\0", "latin1")) + 6;
  contents.fill(0xab, start + 10, start + 10 + howMuch);
  writeFileSync(file, contents);
}

describe("keeping details", () => {
  it("adds nothing to an image without details", async () => {
    const folder = makeFolder();
    await writeImage(folder, "plain.png", "png");
    const result = await run(folder, "-m", "pngtojpg", "plain.png");
    expect(result.exitCode).toBe(0);
    expectNoDetails(await details(path.join(folder, "plain.jpg")));
  });

  it.each([
    ["jpgtowebp", "photo.jpg", "jpeg", "photo.webp"],
    ["jpgtopng", "photo.jpg", "jpeg", "photo.png"],
    ["jpgtoavif", "photo.jpg", "jpeg", "photo.avif"],
    ["pngtojpg", "photo.png", "png", "photo.jpg"],
  ])(
    "keeps camera, date and GPS with %s",
    async (mode, name, format, output) => {
      const folder = makeFolder();
      await writeCameraPhoto(folder, name, format);
      await run(folder, "-m", mode, name);
      expectCameraDetails(await details(path.join(folder, output)));
    },
  );

  it("carries a HEIC's details into the JPG", async () => {
    const folder = makeFolder();
    copyFileSync(
      path.join("test", "fixtures", "iphone.heic"),
      path.join(folder, "iphone.heic"),
    );
    await run(folder, "-m", "heictojpg", "iphone.heic");
    const output = path.join(folder, "iphone.jpg");
    const found = await details(output);
    expect(found.Make).toBe("Apple");
    expect(found.Model).toBe("iPhone 15 Pro");
    expect(found.DateTimeOriginal).toBe("2026:07:14 10:30:00");
    expect(found.GPSLatitudeRef).toBe("N");
    expect(found.GPSLongitudeRef).toBe("W");
    expect((found.GPSLatitude as number[])[0]).toBe(51);
    expect((await sharp(output).metadata()).orientation ?? 1).toBe(1);
    expect((await sharp(output).metadata()).density).toBe(72);
  });

  it.each(["bmp", "gif", "ico"])(
    "says with --verbose that %s drops details",
    async (target) => {
      const folder = makeFolder();
      await writeCameraPhoto(folder, "photo.jpg");
      const result = await run(
        folder,
        "-m",
        `jpgto${target}`,
        "photo.jpg",
        "--verbose",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("details were dropped");
      const quiet = await run(
        folder,
        "-m",
        `jpgto${target}`,
        "photo.jpg",
        "-o",
        "again",
      );
      expect(quiet.stdout).not.toContain("details were dropped");
    },
  );

  it("keeps XMP in TIFF and says camera details were dropped", async () => {
    const folder = makeFolder();
    const file = path.join(folder, "photo.jpg");
    await sharp({
      create: { width: 10, height: 10, channels: 3, background: "teal" },
    })
      .withExif(camera)
      .withXmp(
        '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></x:xmpmeta>',
      )
      .jpeg()
      .toFile(file);
    const result = await run(
      folder,
      "-m",
      "jpgtotiff",
      "photo.jpg",
      "--verbose",
    );
    expect(result.stdout).toContain("can't write them into TIFF files");
    expect(
      (await sharp(path.join(folder, "photo.tiff")).metadata()).xmp,
    ).toBeDefined();
  });
});

describe("--strip-metadata", () => {
  it("removes camera, date and GPS but keeps the sRGB profile", async () => {
    const folder = makeFolder();
    await writeCameraPhoto(folder, "photo.jpg");
    await run(folder, "-m", "jpgtopng", "photo.jpg", "--strip-metadata");
    const output = path.join(folder, "photo.png");
    expectNoDetails(await details(output));
    const profile = (await sharp(output).metadata()).icc;
    expect(profile?.toString("latin1").replaceAll("\0", "")).toContain("sRGB");
  });

  it("leaves a HEIC's details out", async () => {
    const folder = makeFolder();
    copyFileSync(
      path.join("test", "fixtures", "iphone.heic"),
      path.join(folder, "iphone.heic"),
    );
    await run(folder, "-m", "heictojpg", "iphone.heic", "--strip-metadata");
    expect(
      (await details(path.join(folder, "iphone.jpg"))).Make,
    ).toBeUndefined();
  });

  it("is accepted by every image, PDF and tool mode", () => {
    const imageModes = modes.filter((mode) =>
      ["Image", "PDF", "Tools"].includes(mode.group),
    );
    for (const mode of imageModes) {
      expect(
        acceptedOptions(mode).some(
          (option) => option.name === "strip-metadata",
        ),
        mode.name,
      ).toBe(true);
    }
  });
});

describe("strip", () => {
  it("removes a JPG's details and keeps its pixels exactly", async () => {
    const folder = makeFolder();
    const source = await writeCameraPhoto(folder, "photo.jpg");
    await run(folder, "-m", "strip", "photo.jpg");
    const output = path.join(folder, "photo-stripped.jpg");
    expect((await sharp(output).metadata()).format).toBe("jpeg");
    expectNoDetails(await details(output));
    expect(
      (await pixels(output)).data.equals((await pixels(source)).data),
    ).toBe(true);
  });

  it("turns a sideways photo upright and drops its orientation", async () => {
    const folder = makeFolder();
    await sharp({
      create: { width: 60, height: 40, channels: 3, background: "white" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toFile(path.join(folder, "phone.jpg"));
    await run(folder, "-m", "strip", "phone.jpg");
    const metadata = await sharp(
      path.join(folder, "phone-stripped.jpg"),
    ).metadata();
    expect([metadata.width, metadata.height]).toEqual([40, 60]);
    expect(metadata.orientation).toBeUndefined();
  });

  it.each([
    ["png", "png"],
    ["webp", "webp"],
    ["avif", "heif"],
    ["tiff", "tiff"],
  ])(
    "removes details from a %s and keeps its format",
    async (format, sharpName) => {
      const folder = makeFolder();
      await writeCameraPhoto(folder, `photo.${format}`, format);
      const result = await run(folder, "-m", "strip", `photo.${format}`);
      expect(result.exitCode).toBe(0);
      const output = path.join(folder, `photo-stripped.${format}`);
      const metadata = await sharp(output).metadata();
      expect([metadata.format, metadata.width, metadata.height]).toEqual([
        sharpName,
        30,
        20,
      ]);
      expectNoDetails(await details(output));
    },
  );

  it("keeps a lossless WebP lossless", async () => {
    const folder = makeFolder();
    const source = await writeNoise(folder, "detail.png", "png");
    await sharp(source)
      .withExif(camera)
      .webp({ lossless: true })
      .toFile(path.join(folder, "art.webp"));
    await run(folder, "-m", "strip", "art.webp");
    const output = path.join(folder, "art-stripped.webp");
    expect(
      (await pixels(output)).data.equals((await pixels(source)).data),
    ).toBe(true);
    expectNoDetails(await details(output));
  });

  it("removes a hidden image stored after the JPG", async () => {
    const folder = makeFolder();
    const main = await writeImage(folder, "main.jpg", "jpg");
    const hidden = await writeCameraPhoto(folder, "hidden.jpg");
    const plain = readFileSync(main);
    writeFileSync(
      path.join(folder, "photo.jpg"),
      Buffer.concat([plain, readFileSync(hidden)]),
    );
    await run(folder, "-m", "strip", "photo.jpg");
    const output = readFileSync(path.join(folder, "photo-stripped.jpg"));
    expect(output.includes(Buffer.from("Canon", "latin1"))).toBe(false);
    expect(output.length).toBeLessThanOrEqual(plain.length);
  });

  it("strips a folder before posting and leaves the originals alone", async () => {
    const folder = makeFolder();
    mkdirSync(path.join(folder, "holiday"));
    for (const name of ["beach.jpg", "dinner.jpg"]) {
      await writeCameraPhoto(path.join(folder, "holiday"), name);
    }
    const result = await run(
      folder,
      "-m",
      "strip",
      "./holiday",
      "-o",
      "./to-share",
    );
    expect(result.exitCode).toBe(0);
    for (const name of readdirSync(path.join(folder, "to-share"))) {
      expect(
        (await details(path.join(folder, "to-share", name))).GPSLatitude,
      ).toBeUndefined();
    }
    expect(readdirSync(path.join(folder, "to-share")).sort()).toEqual([
      "beach-stripped.jpg",
      "dinner-stripped.jpg",
    ]);
    expectCameraDetails(
      await details(path.join(folder, "holiday", "beach.jpg")),
    );
  });
});

describe("damaged details", () => {
  it.each([
    ["fully", 120],
    ["partly", 8],
  ])(
    "converts a JPG with %s corrupted details, leaving them out",
    async (_, howMuch) => {
      const folder = makeFolder();
      const file = await writeCameraPhoto(folder, "photo.jpg");
      corruptExif(file, howMuch);
      const result = await run(folder, "-m", "jpgtopng", "photo.jpg");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(
        "Note: the photo's details looked damaged, so they were left out",
      );
      const { exif } = await sharp(path.join(folder, "photo.png")).metadata();
      expect(exif).toBeUndefined();
    },
  );
});
