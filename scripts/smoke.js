import { execFile } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import http, { createServer } from "node:http";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import console from "node:console";
import path from "node:path";
import process from "node:process";
import { performance } from "node:perf_hooks";
import { fileURLToPath, URL } from "node:url";

const [installFolder] = process.argv.slice(2);
if (!installFolder) {
  console.error("Usage: node scripts/smoke.js <install folder>");
  process.exit(1);
}

const cli = path.resolve(
  installFolder,
  "node_modules",
  "konvertoj",
  "dist",
  "cli.js",
);
const fixtures = fileURLToPath(new URL("../test/fixtures/", import.meta.url));
const workFolder = path.join(
  mkdtempSync(path.join(tmpdir(), "konvertoj smoke ")),
  "my files",
);
mkdirSync(workFolder);
copyFileSync(
  path.join(fixtures, "iphone.heic"),
  path.join(workFolder, "iphone.heic"),
);
copyFileSync(
  path.join(fixtures, "clip.mov"),
  path.join(workFolder, "clip.mov"),
);
const inWork = (name) => path.join(workFolder, name);

function konvertoj(args, { cwd = workFolder, env = process.env } = {}) {
  return new Promise((resolve) => {
    const started = performance.now();
    execFile(
      process.execPath,
      [cli, ...args],
      { cwd, env },
      (error, stdout, stderr) => {
        resolve({
          code: error ? (error.code ?? 1) : 0,
          stdout,
          stderr,
          milliseconds: performance.now() - started,
        });
      },
    );
  });
}

function fail(step, args, result) {
  console.error(`✗ ${step}`);
  console.error(`  konvertoj ${args.join(" ")}`);
  if (result) {
    console.error(
      `  exit code ${result.code}\n${result.stdout}${result.stderr}`,
    );
  }
  process.exit(1);
}

async function step(name, args, check, options) {
  const result = await konvertoj(args, options);
  if (result.code !== 0 || !check(result)) {
    fail(name, args, result);
  }
  console.log(`✓ ${name}`);
  return result;
}

const startsWith = (file, text) =>
  existsSync(file) &&
  readFileSync(file).subarray(0, text.length).toString("latin1") === text;
const notEmpty = (file) => existsSync(file) && statSync(file).size > 0;

await konvertoj(["--help"]);
const times = [];
for (let run = 0; run < 5; run++) {
  const result = await konvertoj(["--help"]);
  if (result.code !== 0 || !result.stdout.includes("Usage:")) {
    fail("--help shows the help screen", ["--help"], result);
  }
  times.push(result.milliseconds);
}
const median = times.sort((a, b) => a - b)[2];
if (median >= 500) {
  fail(`--help responds in under 500 ms (median ${median.toFixed(0)} ms)`, [
    "--help",
  ]);
}
console.log(
  `✓ --help responds in under 500 ms (median ${median.toFixed(0)} ms)`,
);

await step(
  "Image: heictojpg with absolute paths",
  ["-m", "heictojpg", inWork("iphone.heic"), "-o", inWork("photo")],
  () => startsWith(inWork("photo.jpg"), "\xff\xd8"),
);
await step(
  "Image: heictojpg with relative paths",
  [
    "-m",
    "heictojpg",
    path.join("my files", "iphone.heic"),
    "-o",
    path.join("my files", "relative"),
  ],
  () => notEmpty(inWork("relative.jpg")),
  { cwd: path.dirname(workFolder) },
);
await step(
  "Image: heictojpg without -o",
  ["-m", "heictojpg", "iphone.heic"],
  () => notEmpty(inWork("iphone.jpg")),
);
await step("PDF: topdf", ["-m", "topdf", "photo.jpg", "-o", "document"], () =>
  startsWith(inWork("document.pdf"), "%PDF"),
);
await step(
  "GIF: togif from an image",
  ["-m", "togif", "photo.jpg", "-o", "still"],
  () => startsWith(inWork("still.gif"), "GIF8"),
);
await step(
  "Tools: info",
  ["-m", "info", "photo.jpg", "--json"],
  ({ stdout }) => JSON.parse(stdout)[0]?.width > 0,
);

const proxyTargets = [];
const proxy = createServer();
proxy.on("connect", (request, client, head) => {
  const target = request.url ?? "";
  proxyTargets.push(target);
  const [host, port] = target.split(":");
  const upstream = connect(Number(port), host, () => {
    client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    upstream.write(head);
    upstream.pipe(client);
    client.pipe(upstream);
  });
  upstream.on("error", () => client.destroy());
  client.on("error", () => upstream.destroy());
});
await new Promise((resolve) => proxy.listen(0, "127.0.0.1", resolve));

const home = path.join(path.dirname(workFolder), "home");
const videoEnvironment = {
  PATH: path.dirname(process.execPath),
  HOME: home,
  USERPROFILE: home,
  LOCALAPPDATA: path.join(home, "AppData", "Local"),
  XDG_CACHE_HOME: path.join(home, ".cache"),
  HTTPS_PROXY: `http://127.0.0.1:${proxy.address().port}`,
};
for (const name of ["SystemRoot", "TEMP", "TMP", "TMPDIR"]) {
  if (process.env[name]) {
    videoEnvironment[name] = process.env[name];
  }
}
if (!("setGlobalProxyFromEnv" in http)) {
  videoEnvironment.NODE_USE_ENV_PROXY = "1";
}
const video = { env: videoEnvironment };

await step(
  "Video & Audio: --install-video through HTTPS_PROXY",
  ["--install-video"],
  () => proxyTargets.includes("github.com:443"),
  video,
);
await step(
  "Video & Audio: movtomp4",
  ["-m", "movtomp4", "clip.mov", "-o", "clip"],
  () => notEmpty(inWork("clip.mp4")),
  video,
);
await step(
  "GIF: togif from a video",
  ["-m", "togif", "clip.mov", "-o", "moving"],
  () => startsWith(inWork("moving.gif"), "GIF8"),
  video,
);

proxy.closeAllConnections();
proxy.close();
rmSync(path.dirname(workFolder), { recursive: true, force: true });
console.log("All smoke tests passed.");
