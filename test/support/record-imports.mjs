import module from "node:module";
import process from "node:process";

if (typeof module.registerHooks !== "function") {
  process.stderr.write(
    "Recording imports needs module.registerHooks, from Node.js 22.15 or newer.\n",
  );
  process.exit(1);
}

module.registerHooks({
  resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context);
    process.stderr.write(`LOADED ${result.url}\n`);
    return result;
  },
});
