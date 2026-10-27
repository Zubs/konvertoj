import path from "node:path";

export function displayPath(cwd: string, file: string): string {
  const relative = path.relative(cwd, file);
  const outside =
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative);
  return outside ? path.resolve(cwd, file) : relative;
}
