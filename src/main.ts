import { readFileSync } from "node:fs";
import { parseArgs, type ParseArgsOptionsConfig } from "node:util";
import { isUserError } from "./errors.js";
import { commandShape, mainHelp, modeHelp, modeList } from "./help.js";
import { describeRule, followsRule } from "./modes/options.js";
import {
  acceptedOptions,
  findMode,
  modes,
  needsFfmpeg,
  type Mode,
} from "./modes/registry.js";
import { suggestMode } from "./modes/suggest.js";
import type { OutputPlan } from "./outputs.js";
import type { DownloadSource, FoundFfmpeg } from "./video/ffmpeg.js";
import { Reporter, type Output } from "./report.js";
import { displayPath } from "./paths.js";

export type { Output } from "./report.js";

export interface MainOptions {
  extraModes?: Mode[];
  signal?: AbortSignal;
  ask?: (question: string, signal?: AbortSignal) => Promise<string>;
  interactive?: boolean;
  environment?: NodeJS.ProcessEnv;
  home?: string;
  ffmpegSource?: DownloadSource;
}

const commandOptions: ParseArgsOptionsConfig = {
  mode: { type: "string", short: "m" },
  help: { type: "boolean", short: "h" },
  version: { type: "boolean" },
  "list-modes": { type: "boolean" },
  "install-video": { type: "boolean" },
};

const parseOptions: ParseArgsOptionsConfig = { ...commandOptions };
for (const mode of modes) {
  for (const option of acceptedOptions(mode)) {
    parseOptions[option.name] = {
      type: option.kind === "flag" ? "boolean" : "string",
      ...(option.short ? { short: option.short } : {}),
    };
  }
}

function readVersion(): string {
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as {
    version: string;
  };
  return packageJson.version;
}

const modeHelpHint = (mode: Mode) =>
  `Run konvertoj -m ${mode.name} --help to see its options.`;
const listModesHint = "Run konvertoj --list-modes to see every mode.";
const usageHint = `Usage: ${commandShape}\n${listModesHint}`;

function unknownModeMessage(name: string): string {
  const result = suggestMode(
    name,
    modes.map((mode) => mode.name),
  );
  const lines = [`Unknown mode ${name}.`];
  if (result.kind === "input-only") {
    lines.push(
      `konvertoj can read ${result.format} files but can't create them.`,
    );
  }
  lines.push(
    result.suggestion ? `Did you mean ${result.suggestion}?` : listModesHint,
  );
  return lines.join(" ");
}

function optionProblem(
  mode: Mode,
  tokens: ReturnType<typeof parseArgs>["tokens"],
): string | undefined {
  const accepted = new Map(
    acceptedOptions(mode).map((option) => [option.name, option]),
  );
  for (const token of tokens ?? []) {
    if (token.kind !== "option" || Object.hasOwn(commandOptions, token.name)) {
      continue;
    }
    const flagName = `--${token.name}`;
    if (!Object.hasOwn(parseOptions, token.name)) {
      return `${token.rawName} isn't a konvertoj option. ${modeHelpHint(mode)}`;
    }
    const option = accepted.get(token.name);
    if (!option) {
      return `${flagName} can't be used with ${mode.name}. ${modeHelpHint(mode)}`;
    }
    if (option.kind === "value" && token.value === undefined) {
      return `${flagName} needs a value. ${modeHelpHint(mode)}`;
    }
    if (option.kind === "flag" && token.inlineValue) {
      return `${flagName} doesn't take a value. Use ${flagName} on its own.`;
    }
    if (
      option.rule &&
      token.value !== undefined &&
      !followsRule(option.rule, token.value)
    ) {
      return `${flagName} must be ${describeRule(option.rule)}. You gave ${token.value}.`;
    }
  }
  return undefined;
}

async function provideFfmpeg(
  output: Output,
  options: MainOptions,
  explicit: boolean,
): Promise<FoundFfmpeg | number> {
  const { defaultSettings, ensureFfmpeg } = await import("./video/ffmpeg.js");
  const defaults = defaultSettings();
  try {
    return await ensureFfmpeg({
      environment: options.environment ?? defaults.environment,
      home: options.home ?? defaults.home,
      interactive: options.interactive === true,
      explicit,
      ask: options.ask,
      err: output.err,
      errIsTerminal: output.errIsTerminal,
      source: options.ffmpegSource,
      signal: options.signal,
    });
  } catch (error) {
    if (options.signal?.aborted) {
      output.err("Stopped. Nothing was downloaded.\n");
      return 130;
    }
    if (isUserError(error)) {
      output.err(`${error.message}\n`);
      return 1;
    }
    throw error;
  }
}

const foundMessages: Record<string, (file: string) => string> = {
  chosen: (file) =>
    `FFmpeg is set with KONVERTOJ_FFMPEG_PATH (${file}), so there's nothing to download.`,
  installed: (file) =>
    `FFmpeg is already installed at ${file}, so there's nothing to download.`,
  cached: (file) => `The video add-on is already installed at ${file}.`,
};

export async function main(
  args: string[],
  output: Output,
  options: MainOptions = {},
): Promise<number> {
  const { extraModes = [], signal = new AbortController().signal } = options;
  const mainOptions = { ...options, signal };
  const { values, positionals, tokens } = parseArgs({
    args,
    options: parseOptions,
    strict: false,
    allowPositionals: true,
    tokens: true,
  });
  const fail = (message: string) => {
    output.err(`${message}\n`);
    return 1;
  };

  if (values.version) {
    output.out(`${readVersion()}\n`);
    return 0;
  }
  if (values["install-video"]) {
    const found = await provideFfmpeg(output, mainOptions, true);
    if (typeof found === "number") {
      return found;
    }
    const message = foundMessages[found.source];
    if (message) {
      output.out(`${message(found.path)}\n`);
    }
    return 0;
  }
  if (values["list-modes"]) {
    output.out(`${modeList()}\n`);
    return 0;
  }

  const modeToken = tokens.find(
    (token) => token.kind === "option" && token.name === "mode",
  );
  if (!modeToken) {
    if (args.length === 0 || values.help) {
      output.out(`${mainHelp()}\n`);
      return 0;
    }
    return fail(
      `Choose a mode with -m, e.g. konvertoj -m heictojpg holiday.heic\n\n${usageHint}`,
    );
  }
  if (typeof values.mode !== "string") {
    return fail(`-m needs a mode name, e.g. -m heictojpg.\n\n${usageHint}`);
  }

  const modeName = values.mode;
  const mode =
    findMode(modeName) ?? extraModes.find((extra) => extra.name === modeName);
  if (!mode) {
    return fail(unknownModeMessage(values.mode));
  }
  if (values.help) {
    output.out(`${modeHelp(mode)}\n`);
    return 0;
  }

  if (mode.output === "none" && values.output !== undefined) {
    return fail(
      `${mode.name} doesn't create files, so -o can't be used. Remove -o to see the details.`,
    );
  }
  const problem = optionProblem(mode, tokens) ?? mode.checkOptions?.(values);
  if (problem) {
    return fail(problem);
  }
  if (values.quiet && values.verbose) {
    return fail("Use either --quiet or --verbose, not both.");
  }

  const { resolveInputs } = await import("./inputs.js");
  const { planOutputs } = await import("./outputs.js");
  const cwd = process.cwd();
  let plan: OutputPlan;
  try {
    const resolved = await resolveInputs(positionals, {
      recursive: values.recursive === true,
      cwd,
    });
    plan = planOutputs(mode, resolved.inputs, {
      output: typeof values.output === "string" ? values.output : undefined,
      overwrite: values.overwrite === true,
      cwd,
    });
    plan.warnings.unshift(...resolved.warnings);
  } catch (error) {
    if (isUserError(error)) {
      return fail(error.message);
    }
    throw error;
  }

  plan.warnings.push(...(mode.warnings?.(values) ?? []));
  for (const warning of plan.warnings) {
    output.err(`Warning: ${warning}\n`);
  }
  if (values["dry-run"]) {
    output.out(`${dryRunLines(plan, cwd).join("\n")}\n`);
    return 0;
  }
  const { run } = mode;
  if (!run) {
    return fail(`${mode.name} isn't available yet.`);
  }
  let ffmpeg: string | undefined;
  if (
    needsFfmpeg(
      mode,
      plan.items.flatMap((item) => item.inputs),
    )
  ) {
    const found = await provideFfmpeg(output, mainOptions, false);
    if (typeof found === "number") {
      return found;
    }
    ffmpeg = found.path;
  }

  const { exitCodeFor, runBatch } = await import("./runner.js");
  const reporter = new Reporter(
    output,
    {
      quiet: values.quiet === true,
      verbose: values.verbose === true,
      cwd,
      printing: mode.output === "none",
      json: values.json === true,
    },
    plan.items.length,
  );
  try {
    const result = await runBatch(
      { ...mode, run },
      plan,
      {
        options: values,
        overwrite: values.overwrite === true,
        cwd,
        signal,
        colours: output.colours.out,
        ffmpeg,
      },
      reporter,
    );
    return exitCodeFor(result, plan.items.length);
  } catch (error) {
    if (isUserError(error)) {
      return fail(error.message);
    }
    throw error;
  }
}

function dryRunLines(plan: OutputPlan, cwd: string): string[] {
  return plan.items.flatMap((item) =>
    item.inputs.map((input) => {
      const from = displayPath(cwd, input.path);
      if (input.unreadable) {
        return `${from} → can't be read (${input.unreadable})`;
      }
      if (!item.output) {
        return `${from} → (prints details, no file)`;
      }
      return `${from} → ${displayPath(cwd, item.output)}`;
    }),
  );
}
