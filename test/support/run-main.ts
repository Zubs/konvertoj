import { afterEach } from "vitest";
import { main } from "../../src/main.js";

const projectFolder = process.cwd();

afterEach(() => {
  process.chdir(projectFolder);
});

export async function runIn(folder: string, ...args: string[]) {
  process.chdir(folder);
  let stdout = "";
  let stderr = "";
  const exitCode = await main(args, {
    out: (text) => (stdout += text),
    err: (text) => (stderr += text),
    errIsTerminal: false,
    colours: { out: false, err: false },
  });
  return { exitCode, stdout, stderr };
}
