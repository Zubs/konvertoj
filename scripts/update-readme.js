import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { URL } from "node:url";
import { parseArgs } from "node:util";
import { groups, modes } from "../dist/modes/registry.js";

const startMarker = "<!-- modes:start -->";
const endMarker = "<!-- modes:end -->";

function renderModes() {
  const sections = groups.map((group) => {
    const rows = modes
      .filter((mode) => mode.group === group)
      .map(
        (mode) =>
          `| \`${mode.name}\` | ${mode.description} | \`${mode.examples[0]}\` |`,
      );
    return [
      `### ${group}`,
      "",
      "| Mode | What it does | Example |",
      "| --- | --- | --- |",
      ...rows,
    ].join("\n");
  });
  return sections.join("\n\n");
}

const { values, positionals } = parseArgs({
  options: { check: { type: "boolean" } },
  allowPositionals: true,
});
const readmePath = positionals[0] ?? new URL("../README.md", import.meta.url);
const readme = readFileSync(readmePath, "utf8");
const start = readme.indexOf(startMarker);
const end = readme.indexOf(endMarker);
if (start === -1 || end < start) {
  process.stderr.write(
    `README.md needs ${startMarker} and ${endMarker} markers around the mode section.\n`,
  );
  process.exit(1);
}

const updated = `${readme.slice(0, start + startMarker.length)}\n${renderModes()}\n${readme.slice(end)}`;
if (values.check) {
  if (updated !== readme) {
    process.stderr.write("README.md is out of date. Run npm run docs.\n");
    process.exit(1);
  }
} else {
  writeFileSync(readmePath, updated);
}
