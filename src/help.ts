import {
  commonOptions,
  describeRule,
  type OptionDefinition,
} from "./modes/options.js";
import {
  commonOptionsFor,
  describeFormats,
  describeOutput,
  findMode,
  groups,
  modes,
  type Mode,
} from "./modes/registry.js";

export const commandShape = "konvertoj -m <mode> <input> -o <output> [options]";

const helpOptions: OptionDefinition[] = [
  {
    name: "help",
    kind: "flag",
    short: "h",
    description: "Show this help, or a mode's help with -m <mode> --help",
  },
  { name: "version", kind: "flag", description: "Show the version" },
  { name: "list-modes", kind: "flag", description: "List every mode" },
];

const mainExampleModes = ["heictojpg", "compress", "jpgtopdf", "movtomp4"];

function optionName(option: OptionDefinition): string {
  const short = option.short ? `-${option.short}, ` : "    ";
  const placeholder = option.kind === "value" ? ` <${option.placeholder}>` : "";
  return `${short}--${option.name}${placeholder}`;
}

function optionExplanation(option: OptionDefinition): string {
  const hasLimits =
    option.rule &&
    ("choices" in option.rule ||
      ("wholeNumber" in option.rule &&
        (option.rule.min !== undefined || option.rule.max !== undefined)));
  const rule = option.rule && hasLimits ? `, ${describeRule(option.rule)}` : "";
  const defaultValue =
    option.defaultValue === undefined
      ? ""
      : ` (default: ${option.defaultValue})`;
  return `${option.description}${rule}${defaultValue}`;
}

function optionRows(options: OptionDefinition[]): string[] {
  const names = options.map(optionName);
  const width = Math.max(...names.map((name) => name.length));
  return options.map(
    (option, index) =>
      `  ${names[index]?.padEnd(width)}  ${optionExplanation(option)}`,
  );
}

export function mainHelp(): string {
  const examples = mainExampleModes.map(
    (name) => `  ${findMode(name)?.examples[0]}`,
  );
  return [
    "konvertoj converts and edits images, PDFs, video and audio on your own computer. Nothing is uploaded.",
    "",
    "Usage:",
    `  ${commandShape}`,
    "",
    "Examples:",
    ...examples,
    "",
    "Common options:",
    ...optionRows([...commonOptions, ...helpOptions]),
    "",
    "Run konvertoj --list-modes to see every mode, and konvertoj -m <mode> --help to see a mode's options.",
  ].join("\n");
}

export function modeList(): string {
  const width = Math.max(...modes.map((mode) => mode.name.length));
  return groups
    .map((group) => {
      const rows = modes
        .filter((mode) => mode.group === group)
        .map((mode) => `  ${mode.name.padEnd(width)}  ${mode.description}`);
      return [group, ...rows].join("\n");
    })
    .join("\n\n");
}

export function modeHelp(mode: Mode): string {
  const modeOptions =
    mode.options.length > 0
      ? ["", "Options:", ...optionRows(mode.options)]
      : [];
  return [
    `${mode.name}: ${mode.description}`,
    "",
    "Usage:",
    mode.output === "none"
      ? `  konvertoj -m ${mode.name} <input> [options]`
      : `  konvertoj -m ${mode.name} <input> -o <output> [options]`,
    "",
    `Input: ${describeFormats(mode.inputs)}`,
    `Output: ${describeOutput(mode)}`,
    ...modeOptions,
    "",
    "Common options:",
    ...optionRows(commonOptionsFor(mode)),
    "",
    "Examples:",
    ...mode.examples.map((example) => `  ${example}`),
  ].join("\n");
}
