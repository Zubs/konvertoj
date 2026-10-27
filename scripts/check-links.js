import console from "node:console";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  options: { offline: { type: "boolean" } },
  allowPositionals: true,
});
const readmePath =
  positionals[0] ?? fileURLToPath(new URL("../README.md", import.meta.url));
const readme = readFileSync(readmePath, "utf8");
const prose = readme.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");

function slug(heading) {
  return heading
    .replace(/[`*]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .replaceAll(" ", "-");
}

const slugs = new Set();
const seen = new Map();
for (const [, heading] of readme
  .replace(/```[\s\S]*?```/g, "")
  .matchAll(/^#{1,6} (.+)$/gm)) {
  const base = slug(heading.trim());
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  slugs.add(count === 0 ? base : `${base}-${count}`);
}

async function problemWith(target) {
  if (target.startsWith("mailto:")) {
    return undefined;
  }
  if (target.startsWith("#")) {
    return slugs.has(target.slice(1)) ? undefined : "no such heading";
  }
  if (/^https?:\/\//.test(target)) {
    if (values.offline) {
      return undefined;
    }
    let problem;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await globalThis.fetch(target, {
          headers: { "user-agent": "konvertoj-link-check" },
          redirect: "follow",
          signal: globalThis.AbortSignal.timeout(15_000),
        });
        if (response.ok) {
          return undefined;
        }
        problem = `answered ${response.status}`;
      } catch (error) {
        problem = `couldn't be reached (${error.message})`;
      }
    }
    return problem;
  }
  const file = path.join(path.dirname(readmePath), target.split("#")[0]);
  return existsSync(file) ? undefined : "no such file";
}

const targets = [
  ...new Set(
    [...prose.matchAll(/\]\(([^)\s]+)\)/g)].map(([, target]) => target),
  ),
];
let broken = 0;
for (const target of targets) {
  const problem = await problemWith(target);
  if (problem) {
    broken++;
    console.error(`Broken link: ${target} (${problem})`);
  }
}
if (broken > 0) {
  process.exit(1);
}
console.log(`All ${targets.length} links work.`);
