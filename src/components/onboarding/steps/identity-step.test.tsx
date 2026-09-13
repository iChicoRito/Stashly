import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { IdentityStep } from "@/components/onboarding/steps/identity-step";
import {
  emptyDraft,
  MAX_USER_NAME_LEN,
  type OnboardingDraft,
  type OnboardingStepId,
} from "@/stores/onboarding/onboarding-schema";
import { useOnboardingStore } from "@/stores/onboarding/onboarding-store";

vi.mock("@/lib/vault/api", () => ({ getVaultStartup: vi.fn(), completeOnboarding: vi.fn() }));

const NAME_LABEL = "What should we call you?";
const CONTINUE = "Continue";

/**
 * The two sentences the field can be given. They are different on purpose: an empty field
 * is not told its answer is too long.
 */
const EMPTY_NAME_ERROR = "Enter your name to continue.";
const LONG_NAME_ERROR = `Use ${MAX_USER_NAME_LEN} characters or fewer.`;

/**
 * The wizard parked on a step, which is how the app reaches every step but the first.
 *
 * The step is exercised through the wizard rather than alone because its Continue control
 * belongs to the wizard's action row, so driving the real screen is the only way to test
 * the path the user actually takes.
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

  test("blocks Continue on an empty name, and says the field is empty", async () => {
    const user = userEvent.setup();
    renderWizardAt("identity");

    await user.click(screen.getByRole("button", { name: CONTINUE }));

    const input = screen.getByLabelText(NAME_LABEL);
    expect(input).toHaveAttribute("aria-invalid", "true");

    // The id really points at the message: an association that resolves to nothing reads as
    // no error at all to assistive technology.
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(describedBy).toContain("onboarding-user-name-error");
    expect(document.getElementById("onboarding-user-name-error")).toHaveTextContent(EMPTY_NAME_ERROR);

    expect(useOnboardingStore.getState().step).toBe("identity");
    expect(screen.getByRole("heading", { name: "Make Stashly yours" })).toBeInTheDocument();
  });

  test("treats a whitespace-only name as no name", async () => {
    const user = userEvent.setup();
    renderWizardAt("identity");

    await user.type(screen.getByLabelText(NAME_LABEL), "   ");
    await user.click(screen.getByRole("button", { name: CONTINUE }));

    expect(useOnboardingStore.getState().step).toBe("identity");
    expect(document.getElementById("onboarding-user-name-error")).toHaveTextContent(EMPTY_NAME_ERROR);
  });

  test("advances to the collections step once a name is typed", async () => {
    const user = userEvent.setup();
    renderWizardAt("identity");

    await user.type(screen.getByLabelText(NAME_LABEL), "Mark Adrianne");
    await user.click(screen.getByRole("button", { name: CONTINUE }));

    expect(useOnboardingStore.getState().step).toBe("collections");
    expect(screen.getByRole("heading", { name: "What will you keep in Stashly?" })).toBeInTheDocument();
  });

  test("clears the error as soon as the name is no longer empty", async () => {
    const user = userEvent.setup();
    renderWizardAt("identity");

    await user.click(screen.getByRole("button", { name: CONTINUE }));
    expect(document.getElementById("onboarding-user-name-error")).not.toBeNull();

    await user.type(screen.getByLabelText(NAME_LABEL), "M");

    expect(screen.queryByText(EMPTY_NAME_ERROR)).not.toBeInTheDocument();
    expect(screen.getByLabelText(NAME_LABEL)).toHaveAttribute("aria-invalid", "false");
  });

  test("reports the schema's length bound on a name that is too long", async () => {
    const user = userEvent.setup();
    renderWizardAt("identity", { userName: "M".repeat(MAX_USER_NAME_LEN + 1) });

    await user.click(screen.getByRole("button", { name: CONTINUE }));

    // The bound is the schema's, not this component's: 121 code points is longer than
    // `MAX_USER_NAME_LEN`, so the shared predicate rejects it and the field says so.
    expect(useOnboardingStore.getState().step).toBe("identity");
    expect(document.getElementById("onboarding-user-name-error")).toHaveTextContent(LONG_NAME_ERROR);
  });

  test("asks for the name and nothing else", () => {
    // The vault is called after the user until they rename it in Settings, so this screen
    // has no second field, no helper line under the first one, and no storage disclosure.
    renderWizardAt("identity");

    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByLabelText(/vault/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/this device/i)).not.toBeInTheDocument();
  });

  test("renders the name it is given", () => {
    render(<IdentityStep userName="Mark Adrianne" nameError={null} onUserNameChange={vi.fn()} />);

    expect(screen.getByLabelText(NAME_LABEL)).toHaveValue("Mark Adrianne");
  });

  test("reports every keystroke to the caller", async () => {
    const user = userEvent.setup();
    const onUserNameChange = vi.fn();

    render(<IdentityStep userName="" nameError={null} onUserNameChange={onUserNameChange} />);

    await user.type(screen.getByLabelText(NAME_LABEL), "Mark");

    // The step owns no state: each keystroke goes to the store and comes back as the value.
    expect(onUserNameChange).toHaveBeenCalledTimes(4);
    expect(onUserNameChange).toHaveBeenLastCalledWith("k");
  });
});
