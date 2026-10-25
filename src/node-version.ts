const minimumMajorVersion = 22;

export function unsupportedNodeVersionMessage(
  version: string,
): string | undefined {
  const majorVersion = Number(version.split(".")[0]);

  if (majorVersion >= minimumMajorVersion) {
    return undefined;
  }

  return `konvertoj needs Node.js ${minimumMajorVersion} or newer. You have Node.js ${version}. Install a newer version from https://nodejs.org`;
}
