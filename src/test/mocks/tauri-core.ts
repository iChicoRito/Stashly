import { vi } from "vitest";

// Test-only stand-in for `@tauri-apps/api/core`. vitest.config.ts aliases that
// specifier to this file for the whole suite, so every module under test that
// imports it lands here, not just `src/lib/vault/api.ts`.
//
// It exports only `invoke` today. When another `@tauri-apps/api/core` symbol is
// needed, add it here — the failure to look for is a confusing "does not provide
// an export named …" from the alias, not a missing dependency.
export const invoke = vi.fn();
