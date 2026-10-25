import type { Mode } from "../../src/modes/registry.js";

export const copyStats: { running: number; mostAtOnce: number };
export function resetCopyStats(): void;
export const copyMode: Mode;
export const explodeMode: Mode;
