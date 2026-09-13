import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { completeOnboarding } from "@/lib/vault/api";
import type { VaultStartup } from "@/lib/vault/types";
import { emptyDraft, type OnboardingDraft, type OnboardingStepId } from "@/stores/onboarding/onboarding-schema";
import { useOnboardingStore } from "@/stores/onboarding/onboarding-store";

vi.mock("@/lib/vault/api", () => ({ getVaultStartup: vi.fn(), completeOnboarding: vi.fn() }));

const completeOnboardingMock = vi.mocked(completeOnboarding);

const ready: VaultStartup = {
  status: "ready",
  user_name: "Mark Adrianne",
  vault_name: "Mark Adrianne's Stash",
  storage_mode: "local",
  protection_enabled: true,
  onboarding_completed_at: "2026-09-13T00:00:00.000Z",
  collections: [],
};

const PASSWORD_LABEL = "Master Password";
const CONFIRM_LABEL = "Confirm Password";
const CREATE = "Create My Vault →";
/** The step's one message for any answer the shared `isStepComplete` rejects. */
const PASSWORD_ERROR = "Use 8–1024 characters and matching passwords, or leave both fields empty to skip.";

/** The wizard parked on a step, which is how the app reaches every step but the first. */
function renderWizardAt(step: OnboardingStepId, draft: Partial<OnboardingDraft> = {}) {
  useOnboardingStore.setState({ step, draft: { ...emptyDraft(), ...draft }, status: "idle", error: null });

  return render(
    <MemoryRouter>
      <OnboardingWizard />
    </MemoryRouter>,
  );
}

/** Opens the protection step with a password already typed into both fields. */
async function typeMatchingPasswords(user: ReturnType<typeof userEvent.setup>, password: string) {
  await user.type(screen.getByLabelText(PASSWORD_LABEL), password);
  await user.type(screen.getByLabelText(CONFIRM_LABEL), password);
}

/**
 * Every id in `aria-describedby` resolved to its text.
 *
 * Resolving them rather than reading the attribute is the point: an association pointing at
 * an element that does not exist describes nothing, and would still look correct as a string.
 */
function describedText(input: HTMLElement): string {
  return (input.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");
}

describe("ProtectionStep", () => {
  beforeEach(() => {
    completeOnboardingMock.mockReset();
    useOnboardingStore.setState({ step: "welcome", draft: emptyDraft(), status: "idle", error: null });
  });

  test("Skip for now creates the vault with no password at all", async () => {
    const user = userEvent.setup();
    completeOnboardingMock.mockResolvedValue(ready);
    renderWizardAt("protection", { userName: "Mark Adrianne" });

    await user.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(completeOnboardingMock).toHaveBeenCalledWith({
      userName: "Mark Adrianne",
      vaultName: null,
      starterCollections: [],
      masterPassword: null,
    });
    expect(useOnboardingStore.getState().step).toBe("complete");
  });

  test("Skip for now discards a half-typed password rather than saving it", async () => {
    const user = userEvent.setup();
    completeOnboardingMock.mockResolvedValue(ready);
    renderWizardAt("protection", { userName: "Mark Adrianne" });

    await user.type(screen.getByLabelText(PASSWORD_LABEL), "correct horse");
    await user.type(screen.getByLabelText(CONFIRM_LABEL), "correct hors");
    await user.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(completeOnboardingMock).toHaveBeenCalledWith(expect.objectContaining({ masterPassword: null }));
  });

  test("blocks Create My Vault on a mismatched confirmation, with the error on the fields", async () => {
    const user = userEvent.setup();
    renderWizardAt("protection", { userName: "Mark Adrianne" });

    await user.type(screen.getByLabelText(PASSWORD_LABEL), "correct horse");
    await user.type(screen.getByLabelText(CONFIRM_LABEL), "correct hors");
    await user.click(screen.getByRole("button", { name: CREATE }));

    expect(completeOnboardingMock).not.toHaveBeenCalled();
    expect(useOnboardingStore.getState().step).toBe("protection");
    expect(describedText(screen.getByLabelText(PASSWORD_LABEL))).toContain(PASSWORD_ERROR);

    // Both fields share the message: the pair is what is wrong, and the step cannot tell
    // which half the user meant to change.
    const confirm = screen.getByLabelText(CONFIRM_LABEL);
    expect(confirm).toHaveAttribute("aria-invalid", "true");
    expect(describedText(confirm)).toContain(PASSWORD_ERROR);
  });

  test("blocks Create My Vault when the password is long enough but the confirmation is blank", async () => {
    const user = userEvent.setup();
    renderWizardAt("protection", { userName: "Mark Adrianne" });

    // Exactly the minimum, and nothing in the confirmation: a pair the command would reject,
    // which the step has to point at before it is ever sent.
    await user.type(screen.getByLabelText(PASSWORD_LABEL), "12345678");
    await user.click(screen.getByRole("button", { name: CREATE }));

    expect(completeOnboardingMock).not.toHaveBeenCalled();
    expect(useOnboardingStore.getState().step).toBe("protection");

    const password = screen.getByLabelText(PASSWORD_LABEL);
    const confirm = screen.getByLabelText(CONFIRM_LABEL);
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(confirm).toHaveAttribute("aria-invalid", "true");
    expect(describedText(password)).toContain(PASSWORD_ERROR);
    expect(describedText(confirm)).toContain(PASSWORD_ERROR);
  });

  test("blocks Create My Vault on a password under the command's minimum", async () => {
    const user = userEvent.setup();
    renderWizardAt("protection", { userName: "Mark Adrianne" });

    await typeMatchingPasswords(user, "short");
    await user.click(screen.getByRole("button", { name: CREATE }));

    expect(completeOnboardingMock).not.toHaveBeenCalled();
    const password = screen.getByLabelText(PASSWORD_LABEL);
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(describedText(password)).toContain(PASSWORD_ERROR);
  });

  test("clears the error as soon as the pair is one the vault can be created from", async () => {
    const user = userEvent.setup();
    completeOnboardingMock.mockResolvedValue(ready);
    renderWizardAt("protection", { userName: "Mark Adrianne" });

    await user.type(screen.getByLabelText(PASSWORD_LABEL), "correct horse");
    await user.type(screen.getByLabelText(CONFIRM_LABEL), "correct hors");
    await user.click(screen.getByRole("button", { name: CREATE }));
    expect(screen.queryByText(PASSWORD_ERROR)).toBeInTheDocument();

    await user.type(screen.getByLabelText(CONFIRM_LABEL), "e");

    expect(screen.queryByText(PASSWORD_ERROR)).not.toBeInTheDocument();
    expect(screen.getByLabelText(CONFIRM_LABEL)).toHaveAttribute("aria-invalid", "false");
  });

  test("counts characters, not UTF-16 units, so an emoji password is measured like Rust measures it", async () => {
    const user = userEvent.setup();
    renderWizardAt("protection", { userName: "Mark Adrianne" });

    // Four characters, eight UTF-16 units: `vault_complete_onboarding` rejects this, so the
    // shared predicate has to reject it too rather than measuring `.length`.
    await typeMatchingPasswords(user, "🔒🔒🔒🔒");
    await user.click(screen.getByRole("button", { name: CREATE }));

    expect(completeOnboardingMock).not.toHaveBeenCalled();
    expect(describedText(screen.getByLabelText(PASSWORD_LABEL))).toContain(PASSWORD_ERROR);
  });

  test("creates the vault once both passwords match", async () => {
    const user = userEvent.setup();
    completeOnboardingMock.mockResolvedValue(ready);
    renderWizardAt("protection", { userName: "Mark Adrianne" });

    await typeMatchingPasswords(user, "correct horse");
    await user.click(screen.getByRole("button", { name: CREATE }));

    expect(completeOnboardingMock).toHaveBeenCalledWith(expect.objectContaining({ masterPassword: "correct horse" }));
    expect(useOnboardingStore.getState().step).toBe("complete");
  });

  test("flips aria-pressed, its own name, and both inputs between password and text", async () => {
    const user = userEvent.setup();
    renderWizardAt("protection", { userName: "Mark Adrianne" });

    const password = screen.getByLabelText(PASSWORD_LABEL);
    const confirm = screen.getByLabelText(CONFIRM_LABEL);
    expect(password).toHaveAttribute("type", "password");
    expect(confirm).toHaveAttribute("type", "password");

    const show = screen.getByRole("button", { name: "Show password" });
    expect(show).toHaveAttribute("aria-pressed", "false");

    await user.click(show);

    const hide = screen.getByRole("button", { name: "Hide password" });
    expect(hide).toHaveAttribute("aria-pressed", "true");
    expect(hide).toHaveAttribute("type", "button");
    expect(password).toHaveAttribute("type", "text");
    expect(confirm).toHaveAttribute("type", "text");

    await user.click(hide);

    expect(screen.getByRole("button", { name: "Show password" })).toHaveAttribute("aria-pressed", "false");
    expect(password).toHaveAttribute("type", "password");
    expect(confirm).toHaveAttribute("type", "password");
  });

  test("shows the Vault Lock note and the storage indicator it discloses", () => {
    renderWizardAt("protection", { userName: "Mark Adrianne" });

    expect(screen.getByText("You can enable Vault Lock anytime from Settings → Security.")).toBeInTheDocument();
    expect(screen.getByText("● This Device")).toBeInTheDocument();
    expect(screen.getByText("Storage")).toBeInTheDocument();
  });

  test("turns every way of creating the vault off while the write is in flight", async () => {
    const user = userEvent.setup();
    let settle: (startup: VaultStartup) => void = () => undefined;
    completeOnboardingMock.mockImplementation(
      () =>
        new Promise<VaultStartup>((resolve) => {
          settle = resolve;
        }),
    );
    renderWizardAt("protection", { userName: "Mark Adrianne" });

    await typeMatchingPasswords(user, "correct horse");
    await user.click(screen.getByRole("button", { name: CREATE }));

    expect(useOnboardingStore.getState().status).toBe("submitting");

    // The primary control re-labels while it works, so it is found by its in-flight name.
    const creating = screen.getByRole("button", { name: /creating your vault/i });
    expect(creating).toBeDisabled();
    expect(screen.getByLabelText(PASSWORD_LABEL)).toBeDisabled();
    expect(screen.getByLabelText(CONFIRM_LABEL)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Skip for now" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Show password" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();

    // `fireEvent`, not `userEvent`: a disabled control inherits `pointer-events: none`, which
    // userEvent refuses to click at all. What matters here is that a click that does reach
    // the handler cannot start a second write.
    fireEvent.click(creating);
    fireEvent.click(creating);

    expect(completeOnboardingMock).toHaveBeenCalledTimes(1);

    settle(ready);
    await waitFor(() => {
      expect(useOnboardingStore.getState().status).toBe("complete");
    });
  });

  test("re-enables the controls once the write fails, so the retry is not blocked", async () => {
    const user = userEvent.setup();
    completeOnboardingMock.mockRejectedValue({ code: "db", message: "database or disk is full" });
    renderWizardAt("protection", { userName: "Mark Adrianne" });

    await typeMatchingPasswords(user, "correct horse");
    await user.click(screen.getByRole("button", { name: CREATE }));

    await waitFor(() => {
      expect(useOnboardingStore.getState().status).toBe("error");
    });

    expect(screen.getByLabelText(PASSWORD_LABEL)).toBeEnabled();
    expect(screen.getByLabelText(CONFIRM_LABEL)).toBeEnabled();
    expect(screen.getByRole("button", { name: CREATE })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
  });
});
