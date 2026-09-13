import { invoke } from "@tauri-apps/api/core";

import { toVaultCommandError, VaultCommandError } from "@/lib/vault/error";
import type {
  OnboardingSubmission,
  StorageProbeListing,
  StorageProbePaths,
  StorageProbeResult,
  VaultStartup,
} from "@/lib/vault/types";

// The only module in `src/` allowed to import `@tauri-apps/api`. It makes no
// attempt to detect whether Tauri is present: a missing transport surfaces as a
// `VaultCommandError` with code `internal`, and the store decides what to do.

// Callers handle vault failures without reaching into `error.ts` themselves.
export { VaultCommandError };

export async function getVaultStartup(): Promise<VaultStartup> {
  try {
    return await invoke<VaultStartup>("vault_get_state");
  } catch (raw) {
    throw toVaultCommandError(raw);
  }
}

export async function completeOnboarding(submission: OnboardingSubmission): Promise<VaultStartup> {
  try {
    return await invoke<VaultStartup>("vault_complete_onboarding", { submission });
  } catch (raw) {
    throw toVaultCommandError(raw);
  }
}

export async function writeStorageProbe(label: string): Promise<StorageProbeResult> {
  try {
    return await invoke<StorageProbeResult>("vault_probe_write", { label });
  } catch (raw) {
    throw toVaultCommandError(raw);
  }
}

export async function readStorageProbe(limit?: number): Promise<StorageProbeListing> {
  try {
    // `null` rather than an omitted key, so Task 6's Rust side sees an explicit
    // "use the default (10)" instead of having to distinguish missing from null.
    return await invoke<StorageProbeListing>("vault_probe_read", { limit: limit ?? null });
  } catch (raw) {
    throw toVaultCommandError(raw);
  }
}

export async function getStorageProbePaths(): Promise<StorageProbePaths> {
  try {
    return await invoke<StorageProbePaths>("vault_probe_paths");
  } catch (raw) {
    throw toVaultCommandError(raw);
  }
}
