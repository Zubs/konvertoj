# Proposal

## Why

konvertoj has a spec and a feature list but no code yet. Every later feature (command-line basics, conversions, PDF, video) needs a TypeScript project that builds, a test suite, and CI on Windows, macOS and Linux, so that cross-platform problems are caught from the first feature rather than at release.

## What Changes

- Add a TypeScript (strict, ES modules) project for Node.js 22 or newer, compiled by `tsc` from `src/` to `dist/` with `"module": "NodeNext"`.
- Add `src/cli.ts`, an entry point that starts with `#!/usr/bin/env node`, checks the Node.js version, and otherwise exits successfully doing nothing yet. On Node.js older than 22 it prints "konvertoj needs Node.js 22 or newer" and exits with code `1` instead of crashing.
- Add `package.json` with the name `konvertoj`, `"type": "module"`, `"bin": { "konvertoj": "dist/cli.js" }`, `"engines": { "node": ">=22" }`, a `files` list limited to `dist/`, `README.md` and `LICENSE`, and the scripts `format`, `check`, `test` and `build`.
- Add Vitest with one sample test and a `test/fixtures/` folder (empty for now, kept in git) for files that tests can't generate.
- Add ESLint (flat config, with TypeScript support) and Prettier.
- Add a GitHub Actions workflow that runs `npm run check`, `npm test` and `npm run build` on Ubuntu, macOS and Windows for every push and pull request, where a failure on any system fails the run.
- Add an MIT `LICENSE` and a placeholder `README.md` (the full README comes in feature 19).
- Extend `.gitignore` with `node_modules/`, `dist/` and coverage output.
- Tick "1. Project setup" in `Features.md` once everything passes.

## Capabilities

### New Capabilities

- `cli-startup`: How the `konvertoj` executable starts: the shebang line, the Node.js version check and its message, and exiting cleanly.
- `package-distribution`: What the published npm package contains and declares: name, `bin`, `engines`, licence and the exact file list.
- `development-workflow`: The developer scripts (`format`, `check`, `test`, `build`) and the CI that runs the checks on Windows, macOS and Linux.

### Modified Capabilities

None.

## Impact

- New files: `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.build.json`, `eslint.config.js`, `.prettierignore`, `vitest.config.ts`, `src/cli.ts`, `src/node-version.ts`, `test/` (build setup, tests, `fixtures/.gitkeep`), `.github/workflows/ci.yml`, `LICENSE`, `README.md`.
- Changed files: `.gitignore`, `Features.md` (progress tick).
- Dev dependencies only, no runtime dependencies: `typescript`, `@types/node`, `vitest`, `eslint`, `@eslint/js`, `typescript-eslint`, `prettier`. `@eslint/js` and `typescript-eslint` aren't named in the tech stack but are needed for ESLint to lint TypeScript; the user approved adding them on 2026-10-25. Image, PDF and video libraries are added by the features that use them.
