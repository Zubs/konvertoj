#!/usr/bin/env node
import { unsupportedNodeVersionMessage } from "./node-version.js";

const versionMessage = unsupportedNodeVersionMessage(process.versions.node);
if (versionMessage) {
  console.error(versionMessage);
  process.exitCode = 1;
}
