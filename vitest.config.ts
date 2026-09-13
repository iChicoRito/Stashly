import { defineConfig } from "vitest/config";

import path from "node:path";

export default defineConfig({
  // Next keeps `jsx: "preserve"` in tsconfig, which esbuild cannot transform,
  // so tests use the automatic runtime explicitly.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": path.resolve(process.cwd(), "src") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
