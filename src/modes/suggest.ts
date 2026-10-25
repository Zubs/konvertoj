import { audioOutputs, imageInputs, videoInputs } from "./formats.js";

export type ModeSuggestion =
  | { kind: "input-only"; format: "HEIC" | "SVG"; suggestion?: string }
  | { kind: "closest"; suggestion?: string };

const knownFormats = new Set([
  ...imageInputs,
  "pdf",
  ...videoInputs,
  ...audioOutputs,
]);
const inputOnlyReplacements = { heic: "jpg", svg: "png" };

function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-_\s]/g, "")
    .replace(/2/g, "to")
    .replace(/jpeg/g, "jpg")
    .replace(/tif(?!f)/g, "tiff")
    .replace(/heif/g, "heic");
}

function editDistance(a: string, b: string): number {
  const distances = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0,
    ),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(
        distances[i - 1][j] + 1,
        distances[i][j - 1] + 1,
        distances[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, distances[i - 2][j - 2] + 1);
      }
      distances[i][j] = best;
    }
  }
  return distances[a.length][b.length];
}

export function suggestMode(name: string, modeNames: string[]): ModeSuggestion {
  const normalised = normalise(name);

  const inputOnly = /^(.*)to(heic|svg)$/.exec(normalised);
  if (inputOnly) {
    const from = inputOnly[1];
    const format = inputOnly[2] as "heic" | "svg";
    if (from === "" || knownFormats.has(from)) {
      const replacement = `${from}to${inputOnlyReplacements[format]}`;
      return {
        kind: "input-only",
        format: format === "heic" ? "HEIC" : "SVG",
        suggestion: modeNames.includes(replacement) ? replacement : undefined,
      };
    }
  }

  if (modeNames.includes(normalised)) {
    return { kind: "closest", suggestion: normalised };
  }

  let closest: string | undefined;
  let closestDistance = Infinity;
  for (const modeName of modeNames) {
    const distance = editDistance(normalised, modeName);
    if (distance < closestDistance) {
      closest = modeName;
      closestDistance = distance;
    }
  }
  const closeEnough =
    closestDistance <= 2 && closestDistance <= normalised.length / 3;
  return { kind: "closest", suggestion: closeEnough ? closest : undefined };
}
