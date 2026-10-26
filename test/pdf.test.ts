import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { makeFolder } from "./support/folders.js";
import { pixels, truncate, writeImage, writeNoise } from "./support/images.js";
import { runIn as run } from "./support/run-main.js";

const fixtures = path.resolve("test", "fixtures");
const red = { r: 255, g: 0, b: 0, alpha: 1 };
const a4 = [595.28, 841.89];

async function writePdf(
  folder: string,
  name: string,
  pageCount: number,
  size: [number, number] = [200, 100],
) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const png = await document.embedPng(
    await sharp({
      create: { width: 20, height: 20, channels: 3, background: "blue" },
    })
      .png()
      .toBuffer(),
  );
  for (let page = 1; page <= pageCount; page++) {
    const sheet = document.addPage(size);
    sheet.drawRectangle({
      x: 10,
      y: 10,
      width: 50,
      height: 30,
      color: rgb(1, 0, 0),
    });
    sheet.drawText(`Page ${page}`, {
      x: 80,
      y: 60,
      size: 18,
      font,
      color: rgb(0, 0, 0),
    });
    sheet.drawImage(png, { x: 150, y: 10, width: 20, height: 20 });
  }
  const file = path.join(folder, name);
  writeFileSync(file, await document.save({ addDefaultPage: pageCount > 0 }));
  return file;
}

async function pageSizes(file: string) {
  const document = await PDFDocument.load(readFileSync(file));
  return document.getPages().map((page) => {
    const { width, height } = page.getSize();
    return [Math.round(width), Math.round(height)];
  });
}

async function colourAt(file: string, x: number, y: number) {
  const { data, info } = await pixels(file);
  const index = (y * info.width + x) * 3;
  return [...data.subarray(index, index + 3)];
}

const isRed = (colour: number[]) =>
  (colour[0] ?? 0) > 200 && (colour[1] ?? 255) < 60 && (colour[2] ?? 255) < 60;
const isWhite = (colour: number[]) => colour.every((value) => value > 230);

describe("images to PDF", () => {
  it("needs images", async () => {
    const result = await run(makeFolder(), "-m", "jpgtopdf");
    expect(result.stderr).toContain("No input files given");
  });

  it("puts one JPG on an A4 page, centred inside a 10 mm margin", async () => {
    const folder = makeFolder();
    await writeImage(folder, "big.jpg", "jpg", {
      width: 2000,
      height: 2000,
      colour: red,
    });
    const result = await run(folder, "-m", "jpgtopdf", "big.jpg");
    expect(result.exitCode).toBe(0);
    const pdf = path.join(folder, "big.pdf");
    expect(await pageSizes(pdf)).toEqual([[595, 842]]);
    await run(
      folder,
      "-m",
      "pdftopng",
      "big.pdf",
      "--dpi",
      "72",
      "-o",
      "check",
    );
    const page = path.join(folder, "check", "big-1.png");
    expect(isWhite(await colourAt(page, 20, 421))).toBe(true);
    expect(isRed(await colourAt(page, 35, 421))).toBe(true);
    expect(isRed(await colourAt(page, 560, 421))).toBe(true);
    expect(isWhite(await colourAt(page, 575, 421))).toBe(true);
  });

  it("keeps the given order, and natural order for folders", async () => {
    const folder = makeFolder();
    for (const [name, width] of [
      ["c.jpg", 30],
      ["a.jpg", 10],
      ["b.jpg", 20],
    ] as const) {
      await writeImage(folder, name, "jpg", { width, height: 50 });
    }
    await run(
      folder,
      "-m",
      "jpgtopdf",
      "c.jpg",
      "a.jpg",
      "b.jpg",
      "--page-size",
      "fit",
    );
    expect(
      (await pageSizes(path.join(folder, "c.pdf"))).map(([width]) => width),
    ).toEqual([30, 10, 20]);
    mkdirSync(path.join(folder, "pages"));
    for (const [name, width] of [
      ["page10.jpg", 100],
      ["page2.jpg", 20],
      ["page1.jpg", 10],
    ] as const) {
      await writeImage(path.join(folder, "pages"), name, "jpg", {
        width,
        height: 50,
      });
    }
    await run(
      folder,
      "-m",
      "jpgtopdf",
      "pages",
      "--page-size",
      "fit",
      "-o",
      "book",
    );
    expect(
      (await pageSizes(path.join(folder, "book.pdf"))).map(([width]) => width),
    ).toEqual([10, 20, 100]);
  });

  it("scales a large image down and centres a small one without stretching", async () => {
    const folder = makeFolder();
    await writeImage(folder, "large.png", "png", {
      width: 4000,
      height: 3000,
      colour: red,
    });
    await writeImage(folder, "small.png", "png", {
      width: 100,
      height: 100,
      colour: red,
    });
    await run(folder, "-m", "pngtopdf", "large.png", "small.png", "-o", "both");
    await run(
      folder,
      "-m",
      "pdftopng",
      "both.pdf",
      "--dpi",
      "72",
      "-o",
      "check",
    );
    const large = path.join(folder, "check", "both-1.png");
    const small = path.join(folder, "check", "both-2.png");
    expect((await sharp(large).metadata()).width).toBe(842);
    expect(isRed(await colourAt(large, 421, 297))).toBe(true);
    expect(isWhite(await colourAt(large, 421, 10))).toBe(true);
    expect(isWhite(await colourAt(large, 30, 297))).toBe(true);
    expect(isRed(await colourAt(large, 70, 297))).toBe(true);
    expect(isRed(await colourAt(small, 297, 421))).toBe(true);
    expect(isWhite(await colourAt(small, 297 - 55, 421))).toBe(true);
    expect(isRed(await colourAt(small, 297 - 45, 421))).toBe(true);
  });

  it("fits pages to images, or makes them US letter", async () => {
    const folder = makeFolder();
    await writeImage(folder, "photo.jpg", "jpg", { width: 300, height: 200 });
    await run(
      folder,
      "-m",
      "jpgtopdf",
      "photo.jpg",
      "--page-size",
      "fit",
      "-o",
      "fit",
    );
    await run(
      folder,
      "-m",
      "jpgtopdf",
      "photo.jpg",
      "--page-size",
      "letter",
      "--orientation",
      "portrait",
      "-o",
      "letter",
    );
    expect(await pageSizes(path.join(folder, "fit.pdf"))).toEqual([[300, 200]]);
    expect(await pageSizes(path.join(folder, "letter.pdf"))).toEqual([
      [612, 792],
    ]);
  });

  it("turns pages to suit each image with --orientation auto", async () => {
    const folder = makeFolder();
    await writeImage(folder, "wide.jpg", "jpg", { width: 300, height: 200 });
    await writeImage(folder, "tall.jpg", "jpg", { width: 200, height: 300 });
    await run(folder, "-m", "jpgtopdf", "wide.jpg", "tall.jpg", "-o", "mixed");
    expect(await pageSizes(path.join(folder, "mixed.pdf"))).toEqual([
      [842, 595],
      [595, 842],
    ]);
  });

  it("accepts margins of 0 and 50, and refuses half the page", async () => {
    const folder = makeFolder();
    await writeImage(folder, "big.jpg", "jpg", {
      width: 2000,
      height: 2000,
      colour: red,
    });
    for (const margin of ["0", "50"]) {
      expect(
        (
          await run(
            folder,
            "-m",
            "jpgtopdf",
            "big.jpg",
            "--margin",
            margin,
            "-o",
            `m${margin}`,
          )
        ).exitCode,
      ).toBe(0);
    }
    await run(
      folder,
      "-m",
      "pdftopng",
      "m0.pdf",
      "m50.pdf",
      "--dpi",
      "72",
      "-o",
      "check",
    );
    expect(
      isRed(await colourAt(path.join(folder, "check", "m0-1.png"), 1, 421)),
    ).toBe(true);
    expect(
      isWhite(
        await colourAt(path.join(folder, "check", "m50-1.png"), 130, 421),
      ),
    ).toBe(true);
    expect(
      isRed(await colourAt(path.join(folder, "check", "m50-1.png"), 150, 421)),
    ).toBe(true);
    const tooBig = await run(
      folder,
      "-m",
      "jpgtopdf",
      "big.jpg",
      "--margin",
      "110",
    );
    expect(tooBig.exitCode).toBe(1);
    expect(tooBig.stderr).toContain("is half the page or more");
  });

  it("shows the page through a transparent PNG, on white or the chosen background", async () => {
    const folder = makeFolder();
    await writeImage(folder, "clear.png", "png", {
      width: 100,
      height: 100,
      colour: { r: 0, g: 0, b: 0, alpha: 0 },
    });
    await run(folder, "-m", "pngtopdf", "clear.png", "--page-size", "fit");
    await run(
      folder,
      "-m",
      "pdftopng",
      "clear.pdf",
      "--dpi",
      "72",
      "-o",
      "white",
    );
    await run(
      folder,
      "-m",
      "pdftopng",
      "clear.pdf",
      "--dpi",
      "72",
      "--background",
      "#ff8800",
      "-o",
      "orange",
    );
    expect(
      isWhite(
        await colourAt(path.join(folder, "white", "clear-1.png"), 50, 50),
      ),
    ).toBe(true);
    expect(
      await colourAt(path.join(folder, "orange", "clear-1.png"), 50, 50),
    ).toEqual([255, 136, 0]);
  });

  it("includes HEIC, WebP and AVIF images", async () => {
    const folder = makeFolder();
    copyFileSync(
      path.join(fixtures, "iphone.heic"),
      path.join(folder, "a.heic"),
    );
    await writeImage(folder, "b.webp", "webp");
    await writeImage(folder, "c.avif", "avif");
    const result = await run(
      folder,
      "-m",
      "topdf",
      "a.heic",
      "b.webp",
      "c.avif",
      "-o",
      "all",
    );
    expect(result.exitCode).toBe(0);
    expect(await pageSizes(path.join(folder, "all.pdf"))).toHaveLength(3);
  });

  it("mixes formats with topdf, and suggests it for jpgtopdf", async () => {
    const folder = makeFolder();
    await writeImage(folder, "a.jpg", "jpg");
    await writeImage(folder, "b.png", "png");
    expect(
      (await run(folder, "-m", "topdf", "a.jpg", "b.png", "-o", "mixed"))
        .exitCode,
    ).toBe(0);
    const refused = await run(folder, "-m", "jpgtopdf", "a.jpg", "b.png");
    expect(refused.stderr).toContain("Try: -m topdf");
  });

  it("stops the PDF at a damaged image, naming it", async () => {
    const folder = makeFolder();
    await writeImage(folder, "a.jpg", "jpg");
    truncate(await writeNoise(folder, "b.jpg", "jpg"));
    await writeImage(folder, "c.jpg", "jpg");
    const result = await run(
      folder,
      "-m",
      "jpgtopdf",
      "a.jpg",
      "b.jpg",
      "c.jpg",
      "-o",
      "out",
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("b.jpg looks damaged");
    expect(readdirSync(folder).some((name) => name.endsWith(".pdf"))).toBe(
      false,
    );
  });

  it("leaves out an earlier PDF when a folder is turned into a PDF again", async () => {
    const folder = makeFolder();
    mkdirSync(path.join(folder, "scans"));
    for (const name of ["page1.jpg", "page2.jpg"]) {
      await writeImage(path.join(folder, "scans"), name, "jpg");
    }
    expect((await run(folder, "-m", "jpgtopdf", "scans")).exitCode).toBe(0);
    const again = await run(folder, "-m", "jpgtopdf", "scans", "-o", "again");
    expect(again.exitCode).toBe(0);
    expect(again.stdout).toContain(
      "Note: left out scans/page1.pdf, which is already a PDF",
    );
    expect(await pageSizes(path.join(folder, "again.pdf"))).toHaveLength(2);
  });

  it("turns receipt photos into one A4 PDF", async () => {
    const folder = makeFolder();
    mkdirSync(path.join(folder, "receipts"));
    for (const name of ["IMG_1.heic", "IMG_2.heic", "IMG_3.heic"]) {
      copyFileSync(
        path.join(fixtures, "iphone.heic"),
        path.join(folder, "receipts", name),
      );
    }
    expect(
      (await run(folder, "-m", "heictopdf", "./receipts", "-o", "scanned"))
        .exitCode,
    ).toBe(0);
    expect(await pageSizes(path.join(folder, "scanned.pdf"))).toEqual(
      Array(3).fill([Math.round(a4[0] ?? 0), Math.round(a4[1] ?? 0)]),
    );
  });
});

describe("PDF to images", () => {
  it("refuses a PDF with no pages", async () => {
    const folder = makeFolder();
    await writePdf(folder, "empty.pdf", 0);
    const result = await run(folder, "-m", "pdftopng", "empty.pdf");
    expect(result.stderr).toContain("has no pages");
  });

  it("exports one image per page, numbered in order", async () => {
    const folder = makeFolder();
    await writePdf(folder, "one.pdf", 1);
    await writePdf(folder, "two.pdf", 2);
    await run(folder, "-m", "pdftopng", "one.pdf", "two.pdf", "-o", "pages");
    expect(readdirSync(path.join(folder, "pages")).sort()).toEqual([
      "one-1.png",
      "two-1.png",
      "two-2.png",
    ]);
  });

  it("draws text, images and shapes", async () => {
    const folder = makeFolder();
    await writePdf(folder, "drawing.pdf", 1);
    await run(folder, "-m", "pdftopng", "drawing.pdf", "--dpi", "144");
    const page = path.join(folder, "drawing-1.png");
    const { data, info } = await pixels(page);
    let dark = 0;
    for (let index = 0; index < data.length; index += 3) {
      if (
        (data[index] ?? 255) < 80 &&
        (data[index + 1] ?? 255) < 80 &&
        (data[index + 2] ?? 255) < 80
      ) {
        dark++;
      }
    }
    expect(dark).toBeGreaterThan(100);
    expect(isRed(await colourAt(page, 60, info.height - 50))).toBe(true);
    const blue = await colourAt(page, 320, info.height - 40);
    expect(blue[2]).toBeGreaterThan(200);
    expect(blue[0]).toBeLessThan(60);
  });

  it("exports only the chosen pages", async () => {
    const folder = makeFolder();
    await writePdf(folder, "two.pdf", 2);
    await run(
      folder,
      "-m",
      "pdftopng",
      "two.pdf",
      "--page",
      "2",
      "-o",
      "second",
    );
    await run(
      folder,
      "-m",
      "pdftopng",
      "two.pdf",
      "--page",
      "1-2",
      "-o",
      "both",
    );
    expect(readdirSync(path.join(folder, "second"))).toEqual(["two-2.png"]);
    expect(readdirSync(path.join(folder, "both")).sort()).toEqual([
      "two-1.png",
      "two-2.png",
    ]);
  });

  it("names the page count for a missing page, and rejects bad page lists", async () => {
    const folder = makeFolder();
    await writePdf(folder, "two.pdf", 2);
    const missing = await run(
      folder,
      "-m",
      "pdftopng",
      "two.pdf",
      "--page",
      "3",
    );
    expect(missing.stderr).toContain("has 2 pages");
    for (const value of ["0", "2-1", "abc"]) {
      const result = await run(
        folder,
        "-m",
        "pdftopng",
        "two.pdf",
        "--page",
        value,
      );
      expect(result.exitCode).toBe(1);
    }
  });

  it("doubles the size at twice the DPI, and keeps DPI in range", async () => {
    const folder = makeFolder();
    await writePdf(folder, "page.pdf", 1);
    await run(
      folder,
      "-m",
      "pdftopng",
      "page.pdf",
      "--dpi",
      "150",
      "-o",
      "normal",
    );
    await run(
      folder,
      "-m",
      "pdftopng",
      "page.pdf",
      "--dpi",
      "300",
      "-o",
      "sharp",
    );
    const normal = await sharp(
      path.join(folder, "normal", "page-1.png"),
    ).metadata();
    const crisp = await sharp(
      path.join(folder, "sharp", "page-1.png"),
    ).metadata();
    expect(Math.abs(crisp.width - normal.width * 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(crisp.height - normal.height * 2)).toBeLessThanOrEqual(1);
    for (const dpi of ["35", "601"]) {
      expect(
        (await run(folder, "-m", "pdftopng", "page.pdf", "--dpi", dpi))
          .exitCode,
      ).toBe(1);
    }
  });

  it("refuses a page too large to draw", async () => {
    const folder = makeFolder();
    await writePdf(folder, "poster.pdf", 1, [3000, 3000]);
    const result = await run(
      folder,
      "-m",
      "pdftopng",
      "poster.pdf",
      "--dpi",
      "600",
    );
    expect(result.stderr).toContain("Choose a lower --dpi");
  });

  it("pads page numbers so they sort", async () => {
    const folder = makeFolder();
    await writePdf(folder, "report.pdf", 12, [50, 50]);
    await run(
      folder,
      "-m",
      "pdftopng",
      "report.pdf",
      "--dpi",
      "36",
      "-o",
      "pages",
    );
    const names = readdirSync(path.join(folder, "pages")).sort();
    expect(names[0]).toBe("report-01.png");
    expect(names.at(-1)).toBe("report-12.png");
    expect(names).toHaveLength(12);
  });

  it("isn't put off by an unrelated file with the base name", async () => {
    const folder = makeFolder();
    await writePdf(folder, "report.pdf", 1);
    writeFileSync(path.join(folder, "report.png"), "not a page");
    await run(folder, "-m", "pdftopng", "report.pdf");
    expect(readdirSync(folder)).toContain("report-1.png");
  });

  it("reads back the PDFs konvertoj makes", async () => {
    const folder = makeFolder();
    await writeImage(folder, "a.png", "png", { colour: red });
    await writeImage(folder, "b.png", "png");
    await run(folder, "-m", "pngtopdf", "a.png", "b.png", "-o", "made");
    expect(await pageSizes(path.join(folder, "made.pdf"))).toHaveLength(2);
    const result = await run(
      folder,
      "-m",
      "pdftojpg",
      "made.pdf",
      "-o",
      "back",
    );
    expect(result.exitCode).toBe(0);
    expect(readdirSync(path.join(folder, "back"))).toHaveLength(2);
  });

  it("explains protected and damaged PDFs", async () => {
    const folder = makeFolder();
    copyFileSync(
      path.join(fixtures, "locked.pdf"),
      path.join(folder, "locked.pdf"),
    );
    writeFileSync(
      path.join(folder, "broken.pdf"),
      "%PDF-1.7\nthis is not really a pdf",
    );
    const locked = await run(folder, "-m", "pdftopng", "locked.pdf");
    expect(locked.stderr).toContain("is password-protected");
    const broken = await run(folder, "-m", "pdftopng", "broken.pdf");
    expect(broken.stderr).toContain("looks damaged");
    expect(broken.stderr).not.toMatch(/^\s+at /m);
  });

  it("skips earlier page images when a folder is exported again", async () => {
    const folder = makeFolder();
    mkdirSync(path.join(folder, "docs"));
    await writePdf(path.join(folder, "docs"), "report.pdf", 2);
    expect((await run(folder, "-m", "pdftopng", "docs")).exitCode).toBe(0);
    const again = await run(folder, "-m", "pdftopng", "docs");
    expect(again.exitCode).toBe(0);
    expect(again.stdout).toContain("skipped: already a PNG");
  });

  it("exports page 3 of a report for a slide", async () => {
    const folder = makeFolder();
    await writePdf(folder, "report.pdf", 5);
    expect(
      (await run(folder, "-m", "pdftopng", "report.pdf", "--page", "3"))
        .exitCode,
    ).toBe(0);
    expect(readdirSync(folder).filter((name) => name.endsWith(".png"))).toEqual(
      ["report-3.png"],
    );
  });
});
