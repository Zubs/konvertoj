import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/build.setup.ts"],
    setupFiles: ["test/sharp.setup.ts"],
    testTimeout: 30_000,
  },
});
