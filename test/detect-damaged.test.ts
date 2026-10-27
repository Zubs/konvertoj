import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { detectFormat } from "../src/detect.js";
import { makeFolder } from "./support/folders.js";
import { writeSample } from "./support/samples.js";

vi.mock("file-type", () => ({
  fileTypeFromFile: () => Promise.reject(new RangeError("offset is outside")),
}));

describe("detectFormat with malformed contents", () => {
  it("says the file looks damaged", async () => {
    const folder = makeFolder();
    const file = writeSample(folder, "broken.mkv", "mkv");
    await expect(detectFormat(file)).rejects.toThrow("looks damaged");
    await expect(
      detectFormat(path.join(folder, "missing.mkv")),
    ).rejects.toThrow("ENOENT");
  });
});
