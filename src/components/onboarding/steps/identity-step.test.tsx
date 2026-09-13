import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { IdentityStep } from "@/components/onboarding/steps/identity-step";
import { emptyDraft, type OnboardingDraft, type OnboardingStepId } from "@/stores/onboarding/onboarding-schema";
import { useOnboardingStore } from "@/stores/onboarding/onboarding-store";

vi.mock("@/lib/vault/api", () => ({ getVaultStartup: vi.fn(), completeOnboarding: vi.fn() }));

const USER_NAME_LABEL = "What should we call you?";
const VAULT_NAME_LABEL = "Name your vault";

/**
 * The wizard parked on one step with a draft behind it.
 *
 * The step's own Continue control is the wizard's shared footer (T-01 gives every page the
 * same `← Back / Continue →` row), so the step is exercised the way the app wires it rather
 * than through a button the test invented.
 */
function renderWizardAt(step: OnboardingStepId, draft: Partial<OnboardingDraft> = {}) {
  useOnboardingStore.setState({ step, draft: { ...emptyDraft(), ...draft }, status: "idle", error: null });

  return render(
    <MemoryRouter>
      <OnboardingWizard />
    </MemoryRouter>,
  );
}

describe("IdentityStep", () => {
  beforeEach(() => {
    useOnboardingStore.setState({ step: "welcome", draft: emptyDraft(), status: "idle", error: null });
  });

  test("blocks Continue on an empty name and says so on the field itself", async () => {
    const user = userEvent.setup();
    renderWizardAt("identity");

    await user.click(screen.getByRole("button", { name: "Continue →" }));

    const input = screen.getByLabelText(USER_NAME_LABEL);
    expect(input).toHaveAttribute("aria-invalid", "true");

    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(describedBy).toContain("onboarding-user-name-error");

    // The id really points at the message: an association that resolves to nothing reads as
    // no error at all to assistive technology.
    const error = document.getElementById("onboarding-user-name-error");
    expect(error).toHaveTextContent("The user's name is required.");

    expect(useOnboardingStore.getState().step).toBe("identity");
    expect(screen.getByRole("heading", { name: "Make Stashly yours" })).toBeInTheDocument();
  });

  test("treats a whitespace-only name as no name", async () => {
    const user = userEvent.setup();
    renderWizardAt("identity");

    await user.type(screen.getByLabelText(USER_NAME_LABEL), "   ");
    await user.click(screen.getByRole("button", { name: "Continue →" }));

    expect(useOnboardingStore.getState().step).toBe("identity");
    expect(document.getElementById("onboarding-user-name-error")).toHaveTextContent("The user's name is required.");
  });

  test("advances to the collections step once a name is typed", async () => {
    const user = userEvent.setup();
    renderWizardAt("identity");

    await user.type(screen.getByLabelText(USER_NAME_LABEL), "Mark Adrianne");
    await user.click(screen.getByRole("button", { name: "Continue →" }));

    expect(useOnboardingStore.getState().step).toBe("collections");
    expect(screen.getByRole("heading", { name: "What will you keep in Stashly?" })).toBeInTheDocument();
  });

  test("clears the error as soon as the name is no longer empty", async () => {
    const user = userEvent.setup();
    renderWizardAt("identity");

    await user.click(screen.getByRole("button", { name: "Continue →" }));
    expect(document.getElementById("onboarding-user-name-error")).not.toBeNull();

    await user.type(screen.getByLabelText(USER_NAME_LABEL), "M");

    expect(screen.queryByText("The user's name is required.")).not.toBeInTheDocument();
    expect(screen.getByLabelText(USER_NAME_LABEL)).toHaveAttribute("aria-invalid", "false");
  });

  test("derives the optional vault name from the name as it is typed", async () => {
    const user = userEvent.setup();
    renderWizardAt("identity");

    const vault = screen.getByLabelText(VAULT_NAME_LABEL);
    expect(vault).toHaveAttribute("placeholder", "My Stash");

    await user.type(screen.getByLabelText(USER_NAME_LABEL), "Mark Adrianne");

    expect(vault).toHaveAttribute("placeholder", "Mark Adrianne's Stash");
  });

  test("renders a typed vault name and the derivation of an empty one", () => {
    render(
      <IdentityStep
        userName="Mark Adrianne"
        vaultName=""
        showNameError={false}
        onUserNameChange={vi.fn()}
        onVaultNameChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(VAULT_NAME_LABEL)).toHaveValue("");
    expect(screen.getByLabelText(VAULT_NAME_LABEL)).toHaveAttribute("placeholder", "Mark Adrianne's Stash");
    expect(screen.getByText(/your vault is called Mark Adrianne's Stash/)).toBeInTheDocument();
  });
});
