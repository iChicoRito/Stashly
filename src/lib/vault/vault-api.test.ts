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

vi.mock("@tauri-apps/api/core", async () => await import("@/test/mocks/tauri-core"));

const invokeMock = vi.mocked(invoke);

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

  test("maps a structured Rust rejection to VaultCommandError with its code", async () => {
    invokeMock.mockRejectedValue({ code: "db", message: "unable to open database file" });

    await expect(getVaultStartup()).rejects.toMatchObject({ name: "VaultCommandError", code: "db" });
  });

  test("never reports a failed call as not_initialized", async () => {
    invokeMock.mockRejectedValue("boom");

    await expect(getVaultStartup()).rejects.toBeInstanceOf(VaultCommandError);
    await expect(getVaultStartup()).rejects.not.toMatchObject({ code: "not_initialized" });
  });

  test("passes the onboarding submission through as camelCase", async () => {
    invokeMock.mockResolvedValue({ status: "ready" });

    await completeOnboarding({
      userName: "Mark Adrianne",
      vaultName: null,
      starterCollections: ["Projects"],
      masterPassword: null,
    });

    expect(invokeMock).toHaveBeenCalledWith("vault_complete_onboarding", {
      submission: {
        userName: "Mark Adrianne",
        vaultName: null,
        starterCollections: ["Projects"],
        masterPassword: null,
      },
    });
  });

  test("writes a storage probe with the typed label", async () => {
    invokeMock.mockResolvedValue({ dbRecordId: 1, fileName: "probe-1.txt" });

    await writeStorageProbe("Smoke test");

    expect(invokeMock).toHaveBeenCalledWith("vault_probe_write", { label: "Smoke test" });
  });

  test("reads storage probes with a null limit so Rust applies its default", async () => {
    invokeMock.mockResolvedValue({ records: [], files: [] });

    await readStorageProbe();

    expect(invokeMock).toHaveBeenCalledWith("vault_probe_read", { limit: null });
  });

  test("reads storage probes with the caller's limit", async () => {
    invokeMock.mockResolvedValue({ records: [], files: [] });

    await readStorageProbe(25);

    expect(invokeMock).toHaveBeenCalledWith("vault_probe_read", { limit: 25 });
  });

  test("reads the storage probe paths", async () => {
    invokeMock.mockResolvedValue({ vaultRoot: "/vault", dbPath: "/vault/db", filesDir: "/vault/files" });

    await getStorageProbePaths();

    expect(invokeMock).toHaveBeenCalledWith("vault_probe_paths");
  });

  test("maps a structured probe rejection to VaultCommandError with its code", async () => {
    invokeMock.mockRejectedValue({ code: "io", message: "read-only file system" });

    await expect(writeStorageProbe("Smoke test")).rejects.toMatchObject({
      name: "VaultCommandError",
      code: "io",
    });
  });

  test("turns a bare string rejection into a VaultCommandError", async () => {
    invokeMock.mockRejectedValue("boom");

    await expect(readStorageProbe(5)).rejects.toBeInstanceOf(VaultCommandError);
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

  test("does not accept a bare string as a vault error code", async () => {
    invokeMock.mockRejectedValue("not_initialized");

    await expect(getVaultStartup()).rejects.toMatchObject({ code: "internal" });
  });
});
