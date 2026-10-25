# Tasks

## 1. Package and tooling scaffold

- [x] 1.1 Create `package.json` with `name: konvertoj`, `type: module`, `license: MIT`, `bin.konvertoj: dist/cli.js`, `engines.node: >=22`, `files: ["dist"]` and the scripts `format`, `check`, `test` and `build` from design.md; verify with `node -e` reading the file that each field has the specified value
- [x] 1.2 Install the dev dependencies `typescript`, `@types/node`, `vitest`, `eslint`, `@eslint/js`, `typescript-eslint` and `prettier`; verify `npm install` succeeds and `package-lock.json` is created
- [x] 1.3 Add `tsconfig.json` (strict, NodeNext, ES2023, `verbatimModuleSyntax`, `noEmit`, covering `src/`, `test/` and config files) and `tsconfig.build.json` (only `src/`, `rootDir: src`, `outDir: dist`, emitting); verify `npx tsc -p tsconfig.build.json --showConfig` shows those settings
- [x] 1.4 Add `eslint.config.js` (`@eslint/js` and `typescript-eslint` recommended, ignoring `dist/` and `coverage/`) and `.prettierignore` (`dist/`, `coverage/`, `package-lock.json`, `openspec/`, `.claude/`, `.idea/`, `*.md`); verify `npx eslint .` and `npx prettier --check .` run without configuration errors
- [x] 1.5 Extend `.gitignore` with `node_modules/`, `dist/` and `coverage/`, keeping `.idea`; verify `git status` no longer lists `node_modules/`
- [x] 1.6 Add `LICENSE` with the MIT text for 2026, Zubair Idris Aweda, and a short placeholder `README.md` saying what konvertoj is and that full docs are coming; verify both files exist

## 2. Entry point and Node.js version check

- [x] 2.1 Add `src/node-version.ts` exporting a function that takes a version string and returns the message "konvertoj needs Node.js 22 or newer. You have Node.js <version>. Install a newer version from https://nodejs.org" for versions below 22, and nothing otherwise; add `test/node-version.test.ts` covering 20.11.0, 21.99.0, 22.0.0, 23.7.0 and 24.0.0, and verify it passes with `npx vitest run test/node-version.test.ts`
- [x] 2.2 Add `src/cli.ts` starting with `#!/usr/bin/env node`, importing only `./node-version.js`, printing the message to standard error and setting `process.exitCode = 1` when there is one; verify `npm run build` produces `dist/cli.js` and `node dist/cli.js` exits with code `0`

## 3. Test suite against the built output

- [x] 3.1 Add `vitest.config.ts` (tests in `test/**/*.test.ts`) and `test/build.setup.ts` as `globalSetup`, running `process.execPath` with `node_modules/typescript/bin/tsc -p tsconfig.build.json` without a shell and failing the run if the build fails; verify `rm -rf dist && npm test` recreates `dist/cli.js`
- [x] 3.2 Add `test/fixtures/.gitkeep`; verify `git status` shows the folder as trackable
- [x] 3.3 Add `test/cli.test.ts` checking that the first line of `dist/cli.js` is `#!/usr/bin/env node`, and that running it with `process.execPath` exits with code `0` and empty standard error; verify it passes with `npm test`
- [x] 3.4 Add `test/package.test.ts` running `process.env.npm_execpath` with `pack --dry-run --json` through `process.execPath`, failing with "run this through npm test" when `npm_execpath` is missing, and checking every packed path is `package.json`, `README.md`, `LICENSE` or under `dist/`, with no `src/` or `test/` paths; verify it passes with `npm test`

## 4. Continuous integration

- [x] 4.1 Add `.github/workflows/ci.yml` triggered on `push` and `pull_request`, with a `check` job over `ubuntu-latest`, `macos-latest` and `windows-latest` (`fail-fast: false`, Node.js 22, npm cache) running `npm ci`, `npm run check`, `npm test` and `npm run build`; verify the YAML parses and the matrix lists all three systems
- [x] 4.2 Add an `old-node` job on `ubuntu-latest` that runs `npm ci` and `npm run build` on Node.js 22, switches to Node.js 20, runs `node dist/cli.js` and fails unless the exit code is `1` and standard error contains "konvertoj needs Node.js 22 or newer"; verify the step logic locally by running the same shell check against a fake failing command and a passing one

## 5. Final checks

- [x] 5.1 Run `npm run format`, `npm run check`, `npm test` and `npm run build`, fixing every issue until all four pass
- [x] 5.2 From a fresh clone of the working tree (`git clone` into the scratchpad after committing, or a copy without `node_modules/` and `dist/`), run `npm install`, `npm run check`, `npm test` and `npm run build` and verify all pass
- [x] 5.3 Tick "1. Project setup" in the `Features.md` progress list; verify the line reads `- [x] 1. Project setup`

## Workflow follow-up

- Push to GitHub and confirm the CI run passes on Ubuntu, macOS and Windows and in the `old-node` job; this needs a GitHub remote, which the repository doesn't have yet.
- Archive the change once CI has passed.
