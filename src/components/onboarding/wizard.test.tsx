import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { completeOnboarding, getVaultStartup } from "@/lib/vault/api";
import { VaultCommandError } from "@/lib/vault/error";
import type { VaultStartup } from "@/lib/vault/types";
import {
  emptyDraft,
  ONBOARDING_STEPS,
  type OnboardingDraft,
  type OnboardingStepId,
} from "@/stores/onboarding/onboarding-schema";
import { useOnboardingStore } from "@/stores/onboarding/onboarding-store";

vi.mock("@/lib/vault/api", () => ({ getVaultStartup: vi.fn(), completeOnboarding: vi.fn() }));

const completeOnboardingMock = vi.mocked(completeOnboarding);
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

const NAMED: OnboardingDraft = { ...emptyDraft(), userName: "Mark Adrianne" };
const THREE_COLLECTIONS: OnboardingDraft = {
  ...NAMED,
  starterCollections: ["Personal Documents", "Projects", "Learning & References"],
};

function renderWizardAt(step: OnboardingStepId, draft: Partial<OnboardingDraft> = {}) {
  useOnboardingStore.setState({ step, draft: { ...emptyDraft(), ...draft }, status: "idle", error: null });

  return render(
    <MemoryRouter>
      <OnboardingWizard />
    </MemoryRouter>,
  );
}

/** T-01's headline for each of the five screens, in T-01's order. */
const STEP_HEADINGS: Record<OnboardingStepId, string> = {
  welcome: "Everything important, in one place.",
  identity: "Make Stashly yours",
  collections: "What will you keep in Stashly?",
  protection: "Keep your vault private",
  complete: "Your Stash is ready.",
};

describe("OnboardingWizard", () => {
  beforeEach(() => {
    completeOnboardingMock.mockReset();
    getVaultStartupMock.mockReset();
    // The wizard refreshes the vault store once the vault exists; a resolved read keeps that
    // refresh out of the failure path this suite is not about.
    getVaultStartupMock.mockResolvedValue(ready);
    useOnboardingStore.setState({ step: "welcome", draft: emptyDraft(), status: "idle", error: null });
  });

  test("walks T-01's five screens in T-01's order", async () => {
    const user = userEvent.setup();
    completeOnboardingMock.mockResolvedValue(ready);
    renderWizardAt("welcome");

    expect(screen.getByRole("heading", { name: STEP_HEADINGS.welcome })).toBeInTheDocument();
    expect(screen.getByText("Stored locally on your device")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Get Started →" }));
    expect(screen.getByRole("heading", { name: STEP_HEADINGS.identity })).toBeInTheDocument();

    await user.type(screen.getByLabelText("What should we call you?"), "Mark Adrianne");
    await user.click(screen.getByRole("button", { name: "Continue →" }));
    expect(screen.getByRole("heading", { name: STEP_HEADINGS.collections })).toBeInTheDocument();

    // T-01 sets no minimum, so Continue works with nothing selected.
    await user.click(screen.getByRole("button", { name: "Continue →" }));
    expect(screen.getByRole("heading", { name: STEP_HEADINGS.protection })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create My Vault →" }));
    expect(await screen.findByRole("heading", { name: STEP_HEADINGS.complete })).toBeInTheDocument();
    expect(completeOnboardingMock).toHaveBeenCalledTimes(1);
  });

  test("marks the current screen in the progress list as the user moves through it", async () => {
    const user = userEvent.setup();
    renderWizardAt("welcome");

    const progress = screen.getByRole("list", { name: "Setup progress" });

    function currentStepLabel(): string {
      const items = within(progress).getAllByRole("listitem");
      const current = items.find((item) => item.getAttribute("aria-current") === "step");
      return current?.textContent ?? "";
    }

    expect(currentStepLabel()).toContain("Welcome");

    await user.click(screen.getByRole("button", { name: "Get Started →" }));

    expect(currentStepLabel()).toContain("Your vault");
    expect(within(progress).getAllByRole("listitem")).toHaveLength(5);
  });

  test("goes back to the previous screen, and has nowhere to go back to on the first", async () => {
    const user = userEvent.setup();
    const first = renderWizardAt("welcome");

    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    first.unmount();

    renderWizardAt("collections", NAMED);
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByRole("heading", { name: STEP_HEADINGS.identity })).toBeInTheDocument();
    expect(useOnboardingStore.getState().step).toBe("identity");
  });

  test("reports the setup on the completion screen the way T-01 wrote it", async () => {
    const user = userEvent.setup();
    completeOnboardingMock.mockResolvedValue(ready);
    renderWizardAt("protection", THREE_COLLECTIONS);

    await user.click(screen.getByRole("button", { name: "Create My Vault →" }));

    expect(await screen.findByText("Your Stash is ready.")).toBeInTheDocument();
    expect(
      screen.getByText("Everything is set up. You can start adding and organizing your important information."),
    ).toBeInTheDocument();

    // Scoped to the summary: the progress list carries some of the same words, and a row of
    // the summary is what this screen is being judged on.
    const summary = within(screen.getByRole("region", { name: "Setup summary" }));

    expect(summary.getByText("Name")).toBeInTheDocument();
    expect(summary.getByText("Mark Adrianne")).toBeInTheDocument();
    expect(summary.getByText("Vault")).toBeInTheDocument();
    expect(summary.getByText("Mark Adrianne's Stash")).toBeInTheDocument();
    expect(summary.getByText("Collections")).toBeInTheDocument();
    expect(summary.getByText("3 Created")).toBeInTheDocument();
    expect(summary.getByText("Storage")).toBeInTheDocument();
    expect(summary.getByText("● This Device")).toBeInTheDocument();
    expect(summary.getByText("Vault Protection")).toBeInTheDocument();
    expect(summary.getByText("Not Enabled")).toBeInTheDocument();
    expect(summary.getByText("You can enable it anytime from Settings.")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Open Stashly →" })).toBeInTheDocument();
  });

  test("reports a typed vault name and enabled protection instead of the skipped ones", async () => {
    const user = userEvent.setup();
    completeOnboardingMock.mockResolvedValue(ready);
    renderWizardAt("protection", {
      userName: "Mark Adrianne",
      vaultName: "The Archive",
      masterPassword: "correct horse",
      confirmPassword: "correct horse",
    });

    await user.click(screen.getByRole("button", { name: "Create My Vault →" }));

    const summary = within(await screen.findByRole("region", { name: "Setup summary" }));

    expect(summary.getByText("The Archive")).toBeInTheDocument();
    expect(summary.getByText("Enabled")).toBeInTheDocument();
    expect(summary.getByText("None yet")).toBeInTheDocument();
    expect(summary.queryByText("You can enable it anytime from Settings.")).not.toBeInTheDocument();
  });

  test("keeps the user on the protection screen with a visible error when the write fails", async () => {
    const user = userEvent.setup();
    completeOnboardingMock.mockRejectedValue(new VaultCommandError("db", "database or disk is full"));
    renderWizardAt("protection", NAMED);

    await user.click(screen.getByRole("button", { name: "Create My Vault →" }));

    expect(await screen.findByText(/database or disk is full/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Your vault was not created.");
    expect(screen.getByRole("heading", { name: STEP_HEADINGS.protection })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: STEP_HEADINGS.complete })).not.toBeInTheDocument();

    // The retry path is the control the user already knows, and it still works.
    completeOnboardingMock.mockResolvedValue(ready);
    await user.click(screen.getByRole("button", { name: "Create My Vault →" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: STEP_HEADINGS.complete })).toBeInTheDocument();
    });
    expect(completeOnboardingMock).toHaveBeenCalledTimes(2);
  });

  test("opens the dashboard from the completion screen", async () => {
    const user = userEvent.setup();
    useOnboardingStore.setState({ step: "complete", draft: THREE_COLLECTIONS, status: "complete", error: null });

    render(
      <MemoryRouter initialEntries={["/onboarding/complete"]}>
        <Routes>
          <Route path="/onboarding/complete" element={<OnboardingWizard />} />
          <Route path="/" element={<h1>Your Stash is looking a little empty.</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Open Stashly →" }));

    expect(screen.getByRole("heading", { name: "Your Stash is looking a little empty." })).toBeInTheDocument();
  });

  test("offers no control, and no wording, for anything T-01 keeps out of onboarding", () => {
    // T-01's "Do Not Include During Onboarding" list, as words no screen here may show. The
    // word boundaries matter: "important" contains "import" in the welcome description.
    const EXCLUDED_WORDING = [
      /\btheme\b/i,
      /\bappearance\b/i,
      /\bbackup\b/i,
      /\brestore\b/i,
      /\bimport\b/i,
      /\bexport\b/i,
      /\bkeyboard\b/i,
      /\bshortcut/i,
      /\btutorial/i,
      /storage path/i,
      /\bdatabase\b/i,
      /\badvanced\b/i,
      /\bpreferences\b/i,
      /\bcloud\b/i,
      /\bsynchroniz/i,
    ] as const;

    const CONTROL_ROLES = ["button", "textbox", "checkbox", "switch", "combobox", "radio", "slider"] as const;

    for (const step of ONBOARDING_STEPS) {
      const { unmount } = renderWizardAt(step, {
        ...THREE_COLLECTIONS,
        masterPassword: "correct horse",
        confirmPassword: "correct horse",
      });

      const rendered = document.body.textContent ?? "";

      for (const wording of EXCLUDED_WORDING) {
        expect(rendered).not.toMatch(wording);
      }

      for (const role of CONTROL_ROLES) {
        for (const wording of EXCLUDED_WORDING) {
          expect(screen.queryAllByRole(role, { name: wording })).toEqual([]);
        }
      }

      unmount();
    }
  });
});
