import { defineConfig } from "vitest/config";

import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
      // Test-only: this replaces `@tauri-apps/api/core` for the whole suite with
      // src/test/mocks/tauri-core.ts, which currently exports only `invoke`.
      // Extend that mock rather than re-pointing this alias.
      "@tauri-apps/api/core": path.resolve(process.cwd(), "src/test/mocks/tauri-core.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
