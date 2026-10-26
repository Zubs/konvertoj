export class UserError extends Error {
  override name = "UserError";
}

export function isUserError(error: unknown): error is Error {
  return error instanceof Error && error.name === "UserError";
}

export function isFileSystemError(error: unknown): boolean {
  return (
    error instanceof Error &&
    typeof (error as NodeJS.ErrnoException).code === "string" &&
    "syscall" in error
  );
}

export function damagedFile(cause?: unknown): UserError {
  return new UserError(
    "looks damaged and can't be read. Try opening it in another app, or get a fresh copy.",
    { cause },
  );
}
