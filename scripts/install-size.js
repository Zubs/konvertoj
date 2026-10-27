import { lstatSync, readdirSync } from "node:fs";
import console from "node:console";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";

const megabyte = 1024 * 1024;

const { values, positionals } = parseArgs({
  options: { budget: { type: "string", default: "150" } },
  allowPositionals: true,
});

const [installFolder] = positionals;
if (!installFolder) {
  console.error(
    "Usage: node scripts/install-size.js <install folder> [--budget <MB>]",
  );
  process.exit(1);
}

const budget = Number(values.budget);
if (!(budget > 0)) {
  console.error(
    `--budget must be a number of megabytes, not ${values.budget}.`,
  );
  process.exit(1);
}

const modulesFolder = path.join(installFolder, "node_modules");
let bytes = 0;
for (const entry of readdirSync(modulesFolder, {
  recursive: true,
  withFileTypes: true,
})) {
  if (entry.isFile()) {
    bytes += lstatSync(path.join(entry.parentPath, entry.name)).size;
  }
}

const size = (bytes / megabyte).toFixed(1);
if (bytes > budget * megabyte) {
  console.error(
    `Installed size ${size} MB is over the budget of ${budget} MB.`,
  );
  process.exit(1);
}
console.log(`Installed size: ${size} MB (budget ${budget} MB)`);
