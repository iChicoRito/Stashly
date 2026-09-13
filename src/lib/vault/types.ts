// The frozen IPC contract between the frontend and Rust (Phase 1 §4.2).
//
// `VaultStartup.ready` deliberately keeps snake_case fields: they cross the
// boundary exactly as `vault_get_state` produces them, with no serde rename.
// `OnboardingSubmission` and `VaultCollection` are camelCase on the wire
// because the Rust side renames those.

export type StorageMode = "local";

export interface VaultCollection {
  id: number;
  slug: string;
  name: string;
  createdAt: string;
  isStarter: boolean;
}

export type VaultStartup =
  | { status: "not_initialized" }
  | {
      status: "ready";
      user_name: string;
      vault_name: string;
      storage_mode: StorageMode;
      protection_enabled: boolean;
      onboarding_completed_at: string;
      collections: VaultCollection[];
    };

export interface OnboardingSubmission {
  userName: string;
  vaultName: string | null;
  starterCollections: string[];
  masterPassword: string | null;
}

export type VaultErrorCode = "not_initialized" | "validation" | "db" | "io" | "internal";

export interface StorageProbeRecord {
  id: number;
  label: string;
  createdAt: string;
}

export interface StorageProbeFile {
  name: string;
  bytes: number;
  modifiedAt: string;
}

export interface StorageProbeResult {
  dbRecordId: number;
  dbRecordLabel: string;
  dbRecordCreatedAt: string;
  dbPath: string;
  vaultRoot: string;
  filePath: string;
  fileName: string;
  fileBytes: number;
}

export interface StorageProbeListing {
  records: StorageProbeRecord[];
  files: StorageProbeFile[];
}

export interface StorageProbePaths {
  vaultRoot: string;
  dbPath: string;
  filesDir: string;
}
