import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  completeOnboarding,
  getStorageProbePaths,
  getVaultStartup,
  readStorageProbe,
  VaultCommandError,
  writeStorageProbe,
} from "@/lib/vault/api";
import type { OnboardingSubmission } from "@/lib/vault/types";

vi.mock("@tauri-apps/api/core", async () => await import("@/test/mocks/tauri-core"));

const invokeMock = vi.mocked(invoke);

const submission: OnboardingSubmission = {
  userName: "Mark Adrianne",
  vaultName: null,
  starterCollections: ["Projects"],
  masterPassword: null,
};

describe("vault api", () => {
  // A concise arrow here would return the mock, and Vitest treats a function
  // returned from a hook as teardown — it would call `invoke()` after each test
  // and leak that call's rejection into the next test.
  beforeEach(() => {
    invokeMock.mockReset();
  });

  test("returns the not_initialized startup state unchanged", async () => {
    invokeMock.mockResolvedValue({ status: "not_initialized" });

    await expect(getVaultStartup()).resolves.toEqual({ status: "not_initialized" });
    expect(invokeMock).toHaveBeenCalledWith("vault_get_state");
  });

  test("returns the ready state unchanged and passes the submission as camelCase", async () => {
    const ready = {
      status: "ready",
      user_name: "Mark Adrianne",
      vault_name: "Mark Adrianne's Stash",
      storage_mode: "local",
      protection_enabled: false,
      onboarding_completed_at: "2026-09-13T00:00:00.000Z",
      collections: [
        {
          id: 1,
          slug: "projects",
          name: "Projects",
          createdAt: "2026-09-13T00:00:00.000Z",
          isStarter: true,
        },
      ],
    };
    invokeMock.mockResolvedValue(ready);

    await expect(completeOnboarding(submission)).resolves.toEqual(ready);
    expect(invokeMock).toHaveBeenCalledWith("vault_complete_onboarding", {
      submission: {
        userName: "Mark Adrianne",
        vaultName: null,
        starterCollections: ["Projects"],
        masterPassword: null,
      },
    });
  });

  test("maps a structured Rust rejection to VaultCommandError with its code", async () => {
    invokeMock.mockRejectedValue({ code: "db", message: "unable to open database file" });

    await expect(getVaultStartup()).rejects.toMatchObject({ name: "VaultCommandError", code: "db" });
  });

  test("maps a rejected onboarding submission to a validation VaultCommandError", async () => {
    invokeMock.mockRejectedValue({ code: "validation", message: "user name is required" });

    await expect(completeOnboarding(submission)).rejects.toBeInstanceOf(VaultCommandError);
    await expect(completeOnboarding(submission)).rejects.toMatchObject({ code: "validation" });
  });

  test("writes a storage probe with the typed label and returns the result unchanged", async () => {
    const result = {
      dbRecordId: 1,
      dbRecordLabel: "Smoke test",
      dbRecordCreatedAt: "2026-09-13T00:00:00.000Z",
      dbPath: "/vault/db/stashly.db",
      vaultRoot: "/vault",
      filePath: "/vault/files/probe-20260913-120000-1.txt",
      fileName: "probe-20260913-120000-1.txt",
      fileBytes: 42,
    };
    invokeMock.mockResolvedValue(result);

    await expect(writeStorageProbe("Smoke test")).resolves.toEqual(result);
    expect(invokeMock).toHaveBeenCalledWith("vault_probe_write", { label: "Smoke test" });
  });

  test("reads storage probes with a null limit so Rust applies its default", async () => {
    const listing = {
      records: [{ id: 1, label: "Smoke test", createdAt: "2026-09-13T00:00:00.000Z" }],
      files: [{ name: "probe-20260913-120000-1.txt", bytes: 42, modifiedAt: "2026-09-13T00:00:00.000Z" }],
    };
    invokeMock.mockResolvedValue(listing);

    await expect(readStorageProbe()).resolves.toEqual(listing);
    expect(invokeMock).toHaveBeenCalledWith("vault_probe_read", { limit: null });
  });

  test("reads storage probes with the caller's limit", async () => {
    const listing = { records: [], files: [] };
    invokeMock.mockResolvedValue(listing);

    await expect(readStorageProbe(25)).resolves.toEqual(listing);
    expect(invokeMock).toHaveBeenCalledWith("vault_probe_read", { limit: 25 });
  });

  test("reads the storage probe paths and returns them unchanged", async () => {
    const paths = { vaultRoot: "/vault", dbPath: "/vault/db/stashly.db", filesDir: "/vault/files" };
    invokeMock.mockResolvedValue(paths);

    await expect(getStorageProbePaths()).resolves.toEqual(paths);
    expect(invokeMock).toHaveBeenCalledWith("vault_probe_paths");
  });

  test("maps a structured probe rejection to VaultCommandError with its code", async () => {
    invokeMock.mockRejectedValue({ code: "io", message: "read-only file system" });

    await expect(writeStorageProbe("Smoke test")).rejects.toMatchObject({
      name: "VaultCommandError",
      code: "io",
    });
  });

  test("turns an Error rejection into an internal VaultCommandError", async () => {
    invokeMock.mockRejectedValue(new Error("window.__TAURI_INTERNALS__ is undefined"));

    await expect(getStorageProbePaths()).rejects.toMatchObject({
      name: "VaultCommandError",
      code: "internal",
    });
  });

  test("keeps a structured not_initialized rejection as not_initialized", async () => {
    invokeMock.mockRejectedValue({ code: "not_initialized", message: "no vault yet" });

    await expect(getVaultStartup()).rejects.toMatchObject({
      name: "VaultCommandError",
      code: "not_initialized",
    });
  });

  test("never accepts a bare string as a vault error code", async () => {
    invokeMock.mockRejectedValue("not_initialized");

    await expect(getVaultStartup()).rejects.toBeInstanceOf(VaultCommandError);
    await expect(getVaultStartup()).rejects.toMatchObject({ name: "VaultCommandError", code: "internal" });
  });

  test("maps every other rejection shape to an internal VaultCommandError", async () => {
    for (const payload of [null, undefined, {}, { code: 42 }, { code: "unknown" }]) {
      invokeMock.mockRejectedValue(payload);

      await expect(getVaultStartup()).rejects.toMatchObject({
        name: "VaultCommandError",
        code: "internal",
      });
    }
  });
});
