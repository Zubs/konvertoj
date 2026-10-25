#!/usr/bin/env node
import { unsupportedNodeVersionMessage } from "./node-version.js";

const versionMessage = unsupportedNodeVersionMessage(process.versions.node);
if (versionMessage) {
  console.error(versionMessage);
  process.exitCode = 1;
} else {
  import("./main.js").then(({ main }) => {
    process.exitCode = main(process.argv.slice(2), {
      out: (text) => process.stdout.write(text),
      err: (text) => process.stderr.write(text),
    });
  });
}
