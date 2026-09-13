import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import DashboardPage from "@/app/(app)/page";
import { getStorageProbePaths, getVaultStartup, readStorageProbe } from "@/lib/vault/api";
import type { StorageProbeListing, StorageProbePaths, VaultStartup } from "@/lib/vault/types";
import { useVaultStore } from "@/stores/vault/vault-store";

vi.mock("@/lib/vault/api", () => ({
  getVaultStartup: vi.fn(),
  completeOnboarding: vi.fn(),
  getStorageProbePaths: vi.fn(),
  readStorageProbe: vi.fn(),
  writeStorageProbe: vi.fn(),
}));

const getVaultStartupMock = vi.mocked(getVaultStartup);
const getStorageProbePathsMock = vi.mocked(getStorageProbePaths);
const readStorageProbeMock = vi.mocked(readStorageProbe);

/** The reply `vault_get_state` gives for a vault that finished setup without collections. */
const READY: VaultStartup = {
  status: "ready",
  user_name: "Mark Adrianne",
  vault_name: "Mark Adrianne's Stash",
  storage_mode: "local",
  protection_enabled: true,
  onboarding_completed_at: "2026-09-13T09:00:00.000Z",
  collections: [],
};

const PATHS: StorageProbePaths = {
  vaultRoot: "C:\\Users\\marka\\AppData\\Roaming\\com.stashly.desktop",
  dbPath: "C:\\Users\\marka\\AppData\\Roaming\\com.stashly.desktop\\db\\stashly.db",
  filesDir: "C:\\Users\\marka\\AppData\\Roaming\\com.stashly.desktop\\files",
};

/**
 * What the probe reads back after an earlier run wrote two records and two files. The vault
 * lists the newest first, which is why the assertions below name the first entry.
 */
const PERSISTED: StorageProbeListing = {
  records: [
    { id: 2, label: "Second smoke test", createdAt: "2026-09-13T10:02:00.000Z" },
    { id: 1, label: "First smoke test", createdAt: "2026-09-13T10:01:00.000Z" },
  ],
  files: [
    { name: "probe-0002.txt", bytes: 42, modifiedAt: "2026-09-13T10:02:00.000Z" },
    { name: "probe-0001.txt", bytes: 21, modifiedAt: "2026-09-13T10:01:00.000Z" },
  ],
};

/** T-01's Dashboard empty state, quoted from the spec. */
const EMPTY_TITLE = "Your Stash is looking a little empty.";
const EMPTY_DESCRIPTION = "Start adding the things that matter to you.";

/** T-01's four quick actions, and the one line that explains why none of them do anything yet. */
const QUICK_ACTIONS = ["Add Note", "Add File", "Save Link", "Create Collection"] as const;
const QUICK_ACTIONS_NOTE = "Quick actions arrive in the next phase.";

/**
 * Renders the Dashboard the way the router does: the gate has already booted the store, so the
 * page reads a `ready` vault rather than issuing a read of its own.
 */
function renderDashboard() {
  useVaultStore.setState({ status: "ready", startup: READY, errorCode: null, errorMessage: null });

  return render(<DashboardPage />);
}

describe("DashboardPage", () => {
  // Block-bodied: a concise arrow would return `mockReset`'s value, which vitest reads as a
  // teardown function and then calls after every test.
  beforeEach(() => {
    getVaultStartupMock.mockReset();
    getStorageProbePathsMock.mockReset();
    readStorageProbeMock.mockReset();

    getStorageProbePathsMock.mockResolvedValue(PATHS);
    readStorageProbeMock.mockResolvedValue({ records: [], files: [] });

    useVaultStore.setState({ status: "loading", startup: null, errorCode: null, errorMessage: null });
  });

  test("renders its heading and a greeting naming the user and the vault", () => {
    renderDashboard();

    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();

    const greeting = screen.getByText(/welcome, mark adrianne/i);
    expect(greeting).toHaveTextContent("Mark Adrianne");
    expect(greeting).toHaveTextContent("Mark Adrianne's Stash");
  });

  test("reads the vault the gate already booted rather than asking Rust again", () => {
    renderDashboard();

    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(getVaultStartupMock).not.toHaveBeenCalled();
  });

  test("summarises the vault: its name, its collection count, its storage, and its protection", () => {
    renderDashboard();

    const summary = screen.getByRole("region", { name: "Vault summary" });

    expect(within(summary).getByText("Mark Adrianne's Stash")).toBeInTheDocument();
    expect(within(summary).getByText("0 collections")).toBeInTheDocument();
    expect(within(summary).getByText("● This Device")).toBeInTheDocument();
    expect(within(summary).getByText("Password protected")).toBeInTheDocument();
  });

  test("renders T-01's empty state, verbatim, when the vault has no collections", () => {
    renderDashboard();

    expect(screen.getByRole("heading", { name: EMPTY_TITLE })).toBeInTheDocument();
    expect(screen.getByText(EMPTY_DESCRIPTION)).toBeInTheDocument();
  });

  test("offers the four quick actions disabled, with the reason written once beneath them", () => {
    renderDashboard();

    for (const action of QUICK_ACTIONS) {
      expect(screen.getByRole("button", { name: action })).toBeDisabled();
    }

    // Once, and as content: `title` on a disabled button reaches assistive technology
    // unreliably, so the reason a control is dead has to be text on the page.
    const note = screen.getByText(QUICK_ACTIONS_NOTE);
    expect(screen.getAllByText(QUICK_ACTIONS_NOTE)).toHaveLength(1);

    const lastAction = screen.getByRole("button", { name: "Create Collection" });
    expect(lastAction.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  test("shows the newest probe record and file again after a restart", async () => {
    readStorageProbeMock.mockResolvedValue(PERSISTED);

    const first = renderDashboard();

    expect(await screen.findByText("Second smoke test")).toBeInTheDocument();
    expect(screen.getByText("probe-0002.txt")).toBeInTheDocument();

    // A restart, as far as this page can tell: the store is back at its launch state and the
    // component is fresh. The listing still comes back, because nothing held it but the vault.
    first.unmount();
    useVaultStore.setState({ status: "loading", startup: null, errorCode: null, errorMessage: null });

    renderDashboard();

    expect(await screen.findByText("Second smoke test")).toBeInTheDocument();
    expect(screen.getByText("probe-0002.txt")).toBeInTheDocument();
    expect(readStorageProbeMock).toHaveBeenCalledTimes(2);
  });
});
