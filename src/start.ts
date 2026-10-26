import { rmSync } from "node:fs";
import { isUserError } from "./errors.js";
import { main } from "./main.js";
import type { Mode } from "./modes/registry.js";
import { pendingTemporaryFiles } from "./output-files.js";

export function coloursAllowed(
  isTerminal: boolean | undefined,
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  const noColour = environment.NO_COLOR;
  return isTerminal === true && (noColour === undefined || noColour === "");
}

function reportUnexpected(error: unknown, args: string[]): void {
  if (isUserError(error)) {
    process.stderr.write(`${error.message}\n`);
    return;
  }
  const message = (
    error instanceof Error ? error.message : String(error)
  ).replace(/\.$/, "");
  process.stderr.write(
    `konvertoj hit an unexpected problem: ${message}. Run again with --verbose for details.\n`,
  );
  if (args.includes("-v") || args.includes("--verbose")) {
    process.stderr.write(
      `${error instanceof Error ? error.stack : String(error)}\n`,
    );
  }
}

function writerFor(stream: NodeJS.WriteStream): (text: string) => void {
  let closed = false;
  stream.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code !== "EPIPE") {
      throw error;
    }
    closed = true;
  });
  return (text) => {
    if (!closed) {
      stream.write(text);
    }
  };
}

export async function start(
  args: string[],
  extraModes: Mode[] = [],
): Promise<void> {
  const controller = new AbortController();
  const onInterrupt = () => {
    if (controller.signal.aborted) {
      for (const file of pendingTemporaryFiles) {
        rmSync(file, { force: true });
      }
      process.off("SIGINT", onInterrupt);
      process.kill(process.pid, "SIGINT");
      return;
    }
    controller.abort();
    process.stderr.write(
      "\nStopping after the files already in progress. Press Ctrl+C again to stop at once.\n",
    );
  };
  process.on("SIGINT", onInterrupt);
  try {
    process.exitCode = await main(
      args,
      {
        out: writerFor(process.stdout),
        err: writerFor(process.stderr),
        errIsTerminal: process.stderr.isTTY === true,
        colours: {
          out: coloursAllowed(process.stdout.isTTY),
          err: coloursAllowed(process.stderr.isTTY),
        },
      },
      { extraModes, signal: controller.signal },
    );
  } catch (error) {
    reportUnexpected(error, args);
    process.exitCode = 1;
  } finally {
    process.off("SIGINT", onInterrupt);
  }
}
