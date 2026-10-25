# Design

## Context

The repository has only planning documents (`Spec.md`, `Features.md`, `CLAUDE.md`) and no commits. The tech stack and the four check commands are fixed by `CLAUDE.md`. The developer machine runs Node.js 23 and npm 11, while CI targets Node.js 22 as the supported minimum. See proposal.md for why, and the specs for the required behaviour.

## Goals / Non-Goals

**Goals:**
- A layout every later feature can drop into without reworking config.
- Tests that check the built output (shebang, exit code, packed files), not just the source.
- Nothing in the setup that only works on Unix.

**Non-Goals:**
- Any command-line parsing, help text or mode registry (feature 2).
- `npm run docs`, README content, publishing and provenance (features 19 and 20).
- Node.js version matrix and install-size checks (feature 18). CI uses Node.js 22 only, plus the old-Node check below.
- Runtime dependencies such as sharp. Each feature adds its own.

## Decisions

### Version check in a tiny module, loaded first
`src/cli.ts` imports only `src/node-version.ts`, which exports a pure function taking a version string and returning the error message, or nothing when the version is supported. `cli.ts` prints the message to standard error and sets `process.exitCode = 1` when there is one. Later features will add `await import("./main.js")` after the check, so heavy code is never parsed on an old Node.js and `--help` stays fast.

- *Why not a static import of the whole app?* ES module imports are all loaded before any code runs, so an old Node.js could fail while loading a later module before the check prints anything.
- *Why a separate module?* It can be unit-tested with any version string, which a check reading `process.versions.node` directly can't be.
- Both files use only plain syntax, so the message works on any Node.js version that can load ES modules (14 and newer). Older ones fail before konvertoj runs at all, which is accepted.

### Two tsconfig files
`tsconfig.json` covers `src/`, `test/` and config files with `noEmit`, and is what `npm run check` type-checks. `tsconfig.build.json` extends it, includes only `src/`, sets `rootDir: src`, `outDir: dist` and turns emitting back on. Both use `strict`, `module`/`moduleResolution: NodeNext`, `target: ES2023` and `verbatimModuleSyntax`. This keeps tests type-checked without compiling them into `dist/`.

### Tests run against a fresh build
A Vitest `globalSetup` file runs the TypeScript compiler (`process.execPath` with `node_modules/typescript/bin/tsc -p tsconfig.build.json`, no shell) before the suite, so `npm test` works in CI before `npm run build` and never tests a stale `dist/`. Tests for the built output then:
- read the first line of `dist/cli.js`,
- run `process.execPath dist/cli.js` and check exit code `0` and empty standard error,
- run npm's own CLI script (`process.env.npm_execpath`, set when run through `npm test`) with `pack --dry-run --json` and check every listed path.

Running npm through its script path with `process.execPath` avoids `npm.cmd` and a shell on Windows.

### Old Node.js checked in CI for real
Unit tests cover the version function. In addition, one Ubuntu CI job builds on Node.js 22, switches to Node.js 20 and runs `node dist/cli.js`, expecting exit code `1` and the message. This proves the real file never crashes on an old version.

### ESLint and Prettier
ESLint flat config (`eslint.config.js`) with `@eslint/js` recommended and `typescript-eslint` recommended, ignoring `dist/` and `coverage/`. Neither preset includes formatting rules, so `eslint-config-prettier` isn't needed. Prettier uses default settings, with `.prettierignore` for `dist/`, `coverage/`, `package-lock.json`, `openspec/`, `.claude/`, `.idea/` and Markdown files, so `npm run format` doesn't rewrite the hand-written docs.

Scripts:
- `format`: `prettier --write .`
- `check`: `tsc --noEmit && eslint .`
- `test`: `vitest run`
- `build`: `tsc -p tsconfig.build.json`

### CI workflow
`.github/workflows/ci.yml` runs on `push` and `pull_request`. A matrix job over `ubuntu-latest`, `macos-latest` and `windows-latest` with `fail-fast: false` runs `npm ci`, `npm run check`, `npm test` and `npm run build` on Node.js 22 with the npm cache. A separate `old-node` job does the check above. Any failing job fails the run.

### Dependency versions
Dev dependencies are installed at their current releases with caret ranges, and `package-lock.json` is committed so `npm ci` is reproducible.

## Risks / Trade-offs

- [`npm_execpath` is missing when tests run outside npm, e.g. `npx vitest`] → The pack test fails with a message saying to run it through `npm test`, rather than guessing where npm is.
- [`tsc` doesn't delete files removed from `src/`, so stale files could end up in `dist/` and be published] → Accepted for now with one source file. Revisit when files are moved or removed; feature 20's publish dry run also lists the files.
- [Building in `globalSetup` adds a second or two to each test run] → Acceptable, and much less risky than testing a stale build.
- [Markdown is excluded from Prettier, so docs aren't auto-formatted] → Deliberate, to keep the hand-written planning docs as written.
- [`@eslint/js` and `typescript-eslint` aren't listed in the tech stack] → Approved by the user on 2026-10-25 and recorded in the proposal.
