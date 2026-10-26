import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { parseArgs } from "node:util";
import { commonOptionRows } from "../dist/help.js";
import { groups, modes } from "../dist/modes/registry.js";

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

function renderOptions() {
  const cell = (text) =>
    text.replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("|", "\\|");
  const rows = commonOptionRows().map(
    ({ name, explanation }) => `| \`${name}\` | ${cell(explanation)} |`,
  );
  return ["| Option | What it does |", "| --- | --- |", ...rows].join("\n");
}

function renderDemo(readmeFolder) {
  return existsSync(path.join(readmeFolder, "docs", "demo.gif"))
    ? "![konvertoj converting photos in a terminal](docs/demo.gif)"
    : "";
}

function replaceSection(readme, name, content) {
  const startMarker = `<!-- ${name}:start -->`;
  const endMarker = `<!-- ${name}:end -->`;
  const start = readme.indexOf(startMarker);
  const end = readme.indexOf(endMarker);
  if (start === -1 || end < start) {
    process.stderr.write(
      `README.md needs ${startMarker} and ${endMarker} markers around the ${name} section.\n`,
    );
    process.exit(1);
  }
  const body = content ? `\n${content}\n` : "\n";
  return `${readme.slice(0, start + startMarker.length)}${body}${readme.slice(end)}`;
}

const { values, positionals } = parseArgs({
  options: { check: { type: "boolean" } },
  allowPositionals: true,
});
const readmePath =
  positionals[0] ?? fileURLToPath(new URL("../README.md", import.meta.url));
const readme = readFileSync(readmePath, "utf8");
const updated = [
  ["demo", renderDemo(path.dirname(readmePath))],
  ["modes", renderModes()],
  ["options", renderOptions()],
].reduce(
  (text, [name, content]) => replaceSection(text, name, content),
  readme,
);
if (values.check) {
  if (updated !== readme) {
    process.stderr.write("README.md is out of date. Run npm run docs.\n");
    process.exit(1);
  }
} else {
  writeFileSync(readmePath, updated);
}
