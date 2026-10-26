export class UserError extends Error {
  override name = "UserError";
}

export function isUserError(error: unknown): error is Error {
  return error instanceof Error && error.name === "UserError";
}

export function damagedFile(): UserError {
  return new UserError(
    "looks damaged and can't be read. Try opening it in another app, or get a fresh copy.",
  );
}
