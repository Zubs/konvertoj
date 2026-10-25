import process from "node:process";
import { start } from "../../dist/start.js";
import { copyMode, explodeMode } from "./copy-mode.mjs";

await start(process.argv.slice(2), [copyMode, explodeMode]);
