import { vi } from "vitest";

// Stands in for `@tauri-apps/api/core` through the alias in vitest.config.ts, so
// `src/lib/vault/api.ts` can keep its real import and still be observable here.
export const invoke = vi.fn();
