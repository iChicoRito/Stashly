import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  clearScreen: false,
  // Tauri's devUrl is fixed, so the port must not drift to a free one.
  server: { host: "localhost", port: 1420, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true },
});
