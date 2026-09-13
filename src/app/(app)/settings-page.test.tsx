import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import SettingsPage from "@/app/(app)/settings/page";
import { getStorageProbePaths } from "@/lib/vault/api";
import { VaultCommandError } from "@/lib/vault/error";
import type { StorageProbePaths, VaultStartup } from "@/lib/vault/types";
import { useVaultStore } from "@/stores/vault/vault-store";

vi.mock("@/lib/vault/api", () => ({
  getVaultStartup: vi.fn(),
  completeOnboarding: vi.fn(),
  getStorageProbePaths: vi.fn(),
  readStorageProbe: vi.fn(),
  writeStorageProbe: vi.fn(),
}));

const getStorageProbePathsMock = vi.mocked(getStorageProbePaths);

/**
 * The reply `vault_get_state` gives for a vault that finished setup with a password. Every
 * field is snake_case, exactly as Rust produces it, and none of it is re-fetched here.
 */
const READY: VaultStartup = {
  status: "ready",
  user_name: "Mark Adrianne",
  vault_name: "Mark Adrianne's Stash",
  storage_mode: "local",
  protection_enabled: true,
  onboarding_completed_at: "2026-09-13T09:00:00.000Z",
  collections: [],
};

/** Where the vault actually is, under the identifier `tauri.conf.json` configures. */
const PATHS: StorageProbePaths = {
  vaultRoot: "C:\\Users\\marka\\AppData\\Roaming\\com.stashly.desktop",
  dbPath: "C:\\Users\\marka\\AppData\\Roaming\\com.stashly.desktop\\db\\stashly.db",
  filesDir: "C:\\Users\\marka\\AppData\\Roaming\\com.stashly.desktop\\files",
};

const UNAVAILABLE = "Not available in this build.";

/** Renders Settings the way the router does: behind a gate that already booted the store. */
function renderSettings() {
  useVaultStore.setState({ status: "ready", startup: READY, errorCode: null, errorMessage: null });

  return render(<SettingsPage />);
}

describe("SettingsPage", () => {
  // Block-bodied: a concise arrow would return `mockReset`'s value, which vitest reads as a
  // teardown function and then calls after every test.
  beforeEach(() => {
    getStorageProbePathsMock.mockReset();
    getStorageProbePathsMock.mockResolvedValue(PATHS);

    useVaultStore.setState({ status: "loading", startup: null, errorCode: null, errorMessage: null });
  });

  test("names the vault, its owner, and the day it was created", () => {
    renderSettings();

    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Mark Adrianne's Stash")).toBeInTheDocument();
    expect(screen.getByText("Mark Adrianne")).toBeInTheDocument();
    expect(screen.getByText("13 September 2026")).toBeInTheDocument();

    // The prototype's session-only claim is now false, and a false claim about where a vault
    // lives is worse than no claim at all.
    expect(screen.queryByText(/session-only defaults/i)).not.toBeInTheDocument();
  });

  test("shows storage as This Device and the vault root Tauri resolved", async () => {
    renderSettings();

    expect(screen.getByText("● This Device")).toBeInTheDocument();
    expect(await screen.findByText(PATHS.vaultRoot)).toBeInTheDocument();
  });

  test("says so on the page when the vault root cannot be read", async () => {
    getStorageProbePathsMock.mockRejectedValue(new VaultCommandError("internal", "no probe in this build"));

    renderSettings();

    // A rejected read must leave a visible answer rather than an empty line that reads as a
    // vault with no path, and it must not take the ready page down with it.
    expect(await screen.findByText(UNAVAILABLE)).toBeInTheDocument();
    expect(screen.getByText("Mark Adrianne's Stash")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
  });

  test("states Vault Lock, inert, with the reason connected to the control", () => {
    renderSettings();

    const lock = screen.getByRole("switch", { name: "Vault Lock" });

    expect(lock).toBeDisabled();
    expect(lock).toBeChecked();
    expect(lock).toHaveAttribute("aria-describedby", "vault-lock-note");
    expect(screen.getByText(/locking arrives in a later phase/i)).toBeInTheDocument();
    expect(screen.getByText(/stored as a salted hash/i)).toBeInTheDocument();
  });
});
