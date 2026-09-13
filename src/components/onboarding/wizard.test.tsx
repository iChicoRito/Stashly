import { render, screen, waitFor } from "@testing-library/react";
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
import { useVaultStore } from "@/stores/vault/vault-store";

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

/** The headline each of the five screens is recognised by. */
const STEP_HEADINGS: Record<OnboardingStepId, string> = {
  welcome: "Everything important, in one place.",
  identity: "Make Stashly yours",
  collections: "What will you keep in Stashly?",
  protection: "Keep your vault private",
  complete: "Congrats! Your vault has been created",
};

describe("OnboardingWizard", () => {
  beforeEach(() => {
    completeOnboardingMock.mockReset();
    getVaultStartupMock.mockReset();
    getVaultStartupMock.mockResolvedValue(ready);
    useOnboardingStore.setState({ step: "welcome", draft: emptyDraft(), status: "idle", error: null });
    useVaultStore.setState({ status: "onboarding", startup: null, errorCode: null, errorMessage: null });
  });

  test("walks the five screens in order and writes the vault on the last of them", async () => {
    const user = userEvent.setup();
    completeOnboardingMock.mockResolvedValue(ready);
    renderWizardAt("welcome");

    expect(screen.getByRole("heading", { name: STEP_HEADINGS.welcome })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Get Started" }));
    expect(screen.getByRole("heading", { name: STEP_HEADINGS.identity })).toBeInTheDocument();

    await user.type(screen.getByLabelText("What should we call you?"), "Mark Adrianne");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: STEP_HEADINGS.collections })).toBeInTheDocument();

    // T-01 sets no minimum, so Continue works with nothing selected.
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: STEP_HEADINGS.protection })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("heading", { name: STEP_HEADINGS.complete })).toBeInTheDocument();
    expect(completeOnboardingMock).toHaveBeenCalledTimes(1);
  });

  test("counts no steps and marks no progress", () => {
    renderWizardAt("collections", NAMED);

    // The flow is a sequence the user can feel. A row of numbered marks spends the top of
    // every screen saying so, which is what the design takes away.
    expect(screen.queryByRole("list", { name: /progress/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/step \d/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d of \d/)).not.toBeInTheDocument();
  });

  test("has nothing to go back to on the first screen", () => {
    renderWizardAt("welcome");

    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  test("goes back to the screen before it", async () => {
    const user = userEvent.setup();
    renderWizardAt("collections", NAMED);

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(useOnboardingStore.getState().step).toBe("identity");
    expect(screen.getByRole("heading", { name: STEP_HEADINGS.identity })).toBeInTheDocument();
  });

  test("offers no way back from the completion screen, because the vault exists", () => {
    renderWizardAt("complete", THREE_COLLECTIONS);

    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip for now" })).not.toBeInTheDocument();
  });

  test("carries the ticked collections forward from the collections screen", async () => {
    const user = userEvent.setup();
    renderWizardAt("collections", NAMED);

    // The six cards come from `StarterCollections`; this proves the wizard really renders it.
    expect(screen.getAllByRole("checkbox")).toHaveLength(6);

    await user.click(screen.getByRole("checkbox", { name: "Projects" }));
    await user.click(screen.getByRole("checkbox", { name: "Work" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(useOnboardingStore.getState().draft.starterCollections).toEqual(["Projects", "Work"]);
    expect(screen.getByRole("heading", { name: STEP_HEADINGS.protection })).toBeInTheDocument();
  });

  test("skipping the collections screen creates none of the ticked collections", async () => {
    const user = userEvent.setup();
    renderWizardAt("collections", THREE_COLLECTIONS);

    await user.click(screen.getByRole("button", { name: "Skip for now" }));

    // "Skip" is not "leave the ticked ones behind": a user who chose to skip would otherwise
    // find three collections waiting in a vault they were told they had skipped.
    expect(useOnboardingStore.getState().draft.starterCollections).toEqual([]);
    expect(useOnboardingStore.getState().step).toBe("protection");
  });

  test("keeps the completion screen on screen after the vault is written", async () => {
    const user = userEvent.setup();
    completeOnboardingMock.mockResolvedValue(ready);
    renderWizardAt("protection", NAMED);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("heading", { name: STEP_HEADINGS.complete })).toBeInTheDocument();

    // Re-reading the vault here would flip the screen the user is reading into the
    // dashboard. The read belongs to Proceed, which is the control that asks to leave.
    expect(getVaultStartupMock).not.toHaveBeenCalled();
  });

  test("keeps the user on the protection screen with a visible error when the write fails", async () => {
    const user = userEvent.setup();
    completeOnboardingMock.mockRejectedValue(new VaultCommandError("db", "database or disk is full"));
    renderWizardAt("protection", NAMED);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText(/database or disk is full/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Your vault was not created.");
    expect(screen.getByRole("heading", { name: STEP_HEADINGS.protection })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: STEP_HEADINGS.complete })).not.toBeInTheDocument();

    // The retry path is the control the user already knows, and it still works.
    completeOnboardingMock.mockResolvedValue(ready);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: STEP_HEADINGS.complete })).toBeInTheDocument();
    });
    expect(completeOnboardingMock).toHaveBeenCalledTimes(2);
  });

  test("opens the dashboard from the completion screen, and reads the vault on the way", async () => {
    const user = userEvent.setup();
    useOnboardingStore.setState({ step: "complete", draft: THREE_COLLECTIONS, status: "complete", error: null });

    render(
      <MemoryRouter initialEntries={["/setup"]}>
        <Routes>
          <Route path="/setup" element={<OnboardingWizard />} />
          <Route path="/" element={<h1>Your Stash is looking a little empty.</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Proceed" }));

    expect(await screen.findByRole("heading", { name: "Your Stash is looking a little empty." })).toBeInTheDocument();
    expect(getVaultStartupMock).toHaveBeenCalledTimes(1);
    expect(useVaultStore.getState().status).toBe("ready");
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
