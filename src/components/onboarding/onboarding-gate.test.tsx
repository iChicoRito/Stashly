import { StrictMode } from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { OnboardingGate } from "@/components/onboarding/onboarding-gate";
import { getVaultStartup } from "@/lib/vault/api";
import { VaultCommandError } from "@/lib/vault/error";
import type { VaultStartup } from "@/lib/vault/types";
import { emptyDraft } from "@/stores/onboarding/onboarding-schema";
import { useOnboardingStore } from "@/stores/onboarding/onboarding-store";
import { useVaultStore } from "@/stores/vault/vault-store";

vi.mock("@/lib/vault/api", () => ({ getVaultStartup: vi.fn(), completeOnboarding: vi.fn() }));

const getVaultStartupMock = vi.mocked(getVaultStartup);

const ready: VaultStartup = {
  status: "ready",
  user_name: "Mark Adrianne",
  vault_name: "Mark Adrianne's Stash",
  storage_mode: "local",
  protection_enabled: false,
  onboarding_completed_at: "2026-09-13T00:00:00.000Z",
  collections: [],
};

const notInitialized: VaultStartup = { status: "not_initialized" };

/** T-01's welcome headline, which only the wizard renders. */
const WELCOME_TITLE = "Everything important, in one place.";

function DashboardStub() {
  return <h1>Dashboard</h1>;
}

function renderGate() {
  return render(
    <MemoryRouter>
      <OnboardingGate>
        <DashboardStub />
      </OnboardingGate>
    </MemoryRouter>,
  );
}

describe("OnboardingGate", () => {
  beforeEach(() => {
    getVaultStartupMock.mockReset();
    useVaultStore.setState({ status: "loading", startup: null, errorCode: null, errorMessage: null });
    useOnboardingStore.setState({ step: "welcome", draft: emptyDraft(), status: "idle", error: null });
  });

  test("renders the onboarding wizard for a vault that was never initialized", async () => {
    getVaultStartupMock.mockResolvedValue(notInitialized);

    renderGate();

    expect(await screen.findByText(WELCOME_TITLE)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Dashboard" })).not.toBeInTheDocument();
  });

  test("renders its children untouched once the vault is ready", async () => {
    getVaultStartupMock.mockResolvedValue(ready);

    renderGate();

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.queryByText(WELCOME_TITLE)).not.toBeInTheDocument();
  });

  test("renders the boot failure and not the wizard when the vault read rejects", async () => {
    getVaultStartupMock.mockRejectedValue(new VaultCommandError("db", "unable to open database file"));

    renderGate();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("db");
    expect(alert).toHaveTextContent("unable to open database file");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();

    // The whole point of this gate: a failed read must not walk the user through first-run
    // setup on top of a vault that may well exist.
    expect(screen.queryByText(WELCOME_TITLE)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Master Password")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Dashboard" })).not.toBeInTheDocument();
  });

  test("renders the boot failure and not the wizard when the transport itself fails", async () => {
    getVaultStartupMock.mockRejectedValue("no tauri here");

    renderGate();

    expect(await screen.findByRole("alert")).toHaveTextContent("internal");
    expect(screen.queryByText(WELCOME_TITLE)).not.toBeInTheDocument();
  });

  test("renders neither the wizard nor the app while the vault is still being read", () => {
    getVaultStartupMock.mockImplementation(() => new Promise<VaultStartup>(() => undefined));

    const { container } = renderGate();

    expect(useVaultStore.getState().status).toBe("loading");
    expect(container.querySelector("[data-slot='skeleton']")).not.toBeNull();
    expect(screen.queryByText(WELCOME_TITLE)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Dashboard" })).not.toBeInTheDocument();
  });

  test("boots exactly once under StrictMode's double-invoked effects", async () => {
    getVaultStartupMock.mockResolvedValue(ready);

    render(
      <StrictMode>
        <MemoryRouter>
          <OnboardingGate>
            <DashboardStub />
          </OnboardingGate>
        </MemoryRouter>
      </StrictMode>,
    );

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(getVaultStartupMock).toHaveBeenCalledTimes(1);
  });

  test("Try again re-reads the vault and leaves the failure screen on success", async () => {
    const user = userEvent.setup();
    getVaultStartupMock.mockRejectedValue(new VaultCommandError("internal", "vault state lock poisoned"));

    renderGate();
    await screen.findByRole("alert");

    getVaultStartupMock.mockResolvedValue(ready);
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(getVaultStartupMock).toHaveBeenCalledTimes(2);
  });
});
