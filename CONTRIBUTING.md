# Contributing to konvertoj

Thank you for helping. konvertoj is a local, private command-line converter, described in [Spec.md](Spec.md). [Features.md](Features.md) lists every feature in build order, with how it works and its tests.

## Setting up

You need [Node.js](https://nodejs.org/) 22 or newer.

```text
npm ci
npm run build
node dist/cli.js --help
```

Video and audio tests use FFmpeg. They run when FFmpeg 5 or newer is installed, or after `node dist/cli.js --install-video`, and are skipped otherwise.

## Checks

Run these before every pull request, and fix everything they report:

```text
npm run format
npm run check
npm test
npm run build
```

`npm run check` runs the type checks and ESLint, and `npm test` runs the whole Vitest suite, including every example in the README.

## The mode registry

Every mode is defined once, in `src/modes/registry.ts`, with its name, group, inputs, output, options, description and examples. The help text, `--list-modes`, input checks and the README all come from it, so never list modes anywhere else.

After changing the registry or the common options, run:

```text
npm run docs
```

This builds konvertoj and rewrites the generated parts of the README. The tests fail if you forget, once `dist/` has been rebuilt (CI always builds first).

## Adding a mode

1. Add the mode to `src/modes/registry.ts`, with its group, inputs, output, options, a plain description and at least one example.
2. Give it a `run` that loads its work only when the mode is used, so `konvertoj --help` stays instant.
3. Add tests for it in `test/`, following the tests listed for its feature in [Features.md](Features.md).
4. Run `npm run docs`. Every example of every mode is run by the test suite, so make sure your examples work.

## How konvertoj is built

- Features are built in the order in [Features.md](Features.md), each planned with [OpenSpec](https://github.com/Fission-AI/OpenSpec) in `openspec/`.
- Changes from a plan, and why they were made, are listed in [Decisions.md](Decisions.md).
- The coding rules are in [CLAUDE.md](CLAUDE.md): no comments unless the code is genuinely complicated, the simplest code that works, Node.js and existing libraries before new packages, errors in plain English that say how to fix them, heavy libraries loaded only when needed, and everything working on Windows, macOS and Linux.
- Your original files are never changed. New files are written to a temporary file and renamed when complete.

## The demo

The demo GIF at the top of the README is recorded with [vhs](https://github.com/charmbracelet/vhs) from `docs/demo.tape`:

```text
npm run demo
npm run docs
```
