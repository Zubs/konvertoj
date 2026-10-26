import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { mainHelp } from "../src/help.js";

const scriptPath = path.join("scripts", "update-readme.js");
const linkScriptPath = path.join("scripts", "check-links.js");
const temporaryFolders: string[] = [];
const sections = (inside: string) =>
  ["demo", "modes", "options"]
    .map((name) => `<!-- ${name}:start -->\n${inside}<!-- ${name}:end -->`)
    .join("\n");

function runScript(...args: string[]) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: "utf8",
  });
}

function checkLinks(...args: string[]) {
  return spawnSync(process.execPath, [linkScriptPath, ...args], {
    encoding: "utf8",
  });
}

function temporaryReadme(contents: string): string {
  const folder = mkdtempSync(path.join(tmpdir(), "konvertoj-readme-"));
  temporaryFolders.push(folder);
  const readmePath = path.join(folder, "README.md");
  writeFileSync(readmePath, contents);
  return readmePath;
}

afterEach(() => {
  for (const folder of temporaryFolders.splice(0)) {
    rmSync(folder, { recursive: true, force: true });
  }
});

describe("README generated sections", () => {
  it("match the mode registry and the common options", () => {
    const result = runScript("--check");
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("keep the text outside the markers", () => {
    const readmePath = temporaryReadme(
      `Before\n${sections("STALE\n")}\nAfter\n`,
    );

    expect(runScript(readmePath).status).toBe(0);

    const updated = readFileSync(readmePath, "utf8");
    expect(updated.startsWith("Before\n<!-- demo:start -->\n")).toBe(true);
    expect(updated).toContain("<!-- modes:start -->\n### Image\n");
    expect(updated.endsWith("\n<!-- options:end -->\nAfter\n")).toBe(true);
    expect(updated).toContain("| `heictojpg` |");
    expect(updated).toContain("| `-o, --output <path>` |");
    expect(updated).not.toContain("STALE");
  });

  it("report an out-of-date README", () => {
    const readmePath = temporaryReadme(`${sections("STALE\n")}\n`);

    const result = runScript("--check", readmePath);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "README.md is out of date. Run npm run docs.",
    );
    expect(readFileSync(readmePath, "utf8")).toContain("STALE");
  });

  it("catch a changed option description", () => {
    const readme = readFileSync("README.md", "utf8").replace(
      "Only show errors",
      "Show nothing",
    );
    const result = runScript("--check", temporaryReadme(readme));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Run npm run docs.");
  });

  it("describe the same common options as --help", () => {
    const readme = readFileSync("README.md", "utf8");
    const section = readme.slice(
      readme.indexOf("<!-- options:start -->"),
      readme.indexOf("<!-- options:end -->"),
    );
    const tableRows = [...section.matchAll(/^\| `(.+?)` \| (.+) \|$/gm)].map(
      ([, name, explanation]) =>
        `${name} ${explanation?.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("\\|", "|")}`,
    );
    const help = mainHelp();
    const helpRows = help
      .slice(help.indexOf("Common options:"))
      .split("\n")
      .slice(1)
      .filter((line) => line.startsWith("  "))
      .map((line) => line.trim().replace(/ {2,}/, " "));
    expect(tableRows).toEqual(helpRows);
  });

  it("show the demo only once docs/demo.gif exists", () => {
    const readmePath = temporaryReadme(`${sections("")}\n`);
    runScript(readmePath);
    expect(readFileSync(readmePath, "utf8")).not.toContain("demo.gif");
    mkdirSync(path.join(path.dirname(readmePath), "docs"));
    writeFileSync(path.join(path.dirname(readmePath), "docs", "demo.gif"), "");
    runScript(readmePath);
    expect(readFileSync(readmePath, "utf8")).toContain(
      "<!-- demo:start -->\n![konvertoj converting photos in a terminal](docs/demo.gif)\n<!-- demo:end -->",
    );
  });
});

describe("README links", () => {
  it("all point to files and headings that exist", () => {
    const result = checkLinks("--offline");
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("name a missing file and a missing heading", () => {
    const readmePath = temporaryReadme(
      "# Title\n\n## Video & Audio\n\n[a](#title) [b](#video--audio) [c](missing.md) [d](#nowhere)\n\n`[e](ignored.md)`\n",
    );
    const result = checkLinks(readmePath, "--offline");
    expect(result.status).toBe(1);
    expect(result.stderr).toBe(
      "Broken link: missing.md (no such file)\nBroken link: #nowhere (no such heading)\n",
    );
  });
});
