import { type ReactNode, useState } from "react";

import { TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router";

import { OnboardingScreen, ScreenActions } from "@/components/onboarding/onboarding-screen";
import { CollectionsStep } from "@/components/onboarding/steps/collections-step";
import { CompleteStep } from "@/components/onboarding/steps/complete-step";
import { IdentityStep } from "@/components/onboarding/steps/identity-step";
import { ProtectionStep } from "@/components/onboarding/steps/protection-step";
import { WelcomeStep } from "@/components/onboarding/steps/welcome-step";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  isStepComplete,
  ONBOARDING_STEPS,
  type OnboardingStepId,
  userNameProblem,
} from "@/stores/onboarding/onboarding-schema";
import { useOnboardingStore } from "@/stores/onboarding/onboarding-store";
import { useVaultStore } from "@/stores/vault/vault-store";

/**
 * The forward control on each screen. Plain words rather than arrows and an imperative: by
 * the last screen the user has answered everything, so "Submit" says the vault is about to
 * be written and "Proceed" says it already has been. One table rather than a button per step
 * file, so the last screen of the flow is the same code path as the first.
 */
const PRIMARY_ACTION: Record<OnboardingStepId, string> = {
  welcome: "Get Started",
  identity: "Continue",
  collections: "Continue",
  protection: "Submit",
  complete: "Proceed",
};

/** The two screens whose block is centred; the other three are ranged left and read as forms. */
const CENTERED_STEPS: ReadonlySet<OnboardingStepId> = new Set(["welcome", "complete"]);

/** How far the action row sits below whatever the screen put above it. */
const ACTION_GAP: Record<OnboardingStepId, string> = {
  welcome: "mt-4",
  identity: "mt-5",
  collections: "mt-6",
  protection: "mt-5",
  complete: "mt-4",
};

/**
 * Every control on this surface, at the component's own size: height, padding, type, radius,
 * focus ring, and disabled state all come from the `default` rung, so a button here is the
 * same button as everywhere else in Stashly.
 *
 * The one change is the weight. The button default is medium, and on these screens medium
 * belongs to titles alone — the fill already says which control is the way forward, and a
 * heavier label would say the same thing a second time.
 */
const BUTTON = "font-normal";

const SUBMITTING_LABEL = "Creating your vault…";
const OPENING_LABEL = "Opening Stashly…";

/**
 * T-01's five screens, wired to the onboarding store.
 *
 * The wizard owns the frame, the action row, and nothing else: no sidebar, no card, no
 * progress marks, and no step counter. A first-run flow is already a sequence the user can
 * feel, and marking the position on screen spends the top of every page telling them what
 * they can already tell.
 *
 * It is rendered by `OnboardingGate` on the route the user asked for, which is what keeps it
 * full-bleed — the dashboard shell is a sibling of this screen, not a parent of it.
 */
export function OnboardingWizard() {
  const navigate = useNavigate();

  const step = useOnboardingStore((state) => state.step);
  const draft = useOnboardingStore((state) => state.draft);
  const status = useOnboardingStore((state) => state.status);
  const error = useOnboardingStore((state) => state.error);
  const setField = useOnboardingStore((state) => state.setField);
  const toggleCollection = useOnboardingStore((state) => state.toggleCollection);
  const clearCollections = useOnboardingStore((state) => state.clearCollections);
  const next = useOnboardingStore((state) => state.next);
  const back = useOnboardingStore((state) => state.back);
  const submit = useOnboardingStore((state) => state.submit);
  const refreshVault = useVaultStore((state) => state.refresh);

  // The step that was asked to continue with an answer it cannot continue from. Held as the
  // step id rather than as a boolean so the message cannot follow the user onto the next
  // screen, and each step's own rule decides whether it has anything to complain about.
  const [attemptedStep, setAttemptedStep] = useState<OnboardingStepId | null>(null);

  // The vault was written a moment ago and is being read back before the dashboard renders.
  // Separate from the store's `submitting` because that one is about the write.
  const [opening, setOpening] = useState(false);

  /**
   * Creating the vault is a one-shot write, so everything that could fire it a second time
   * is switched off while it is in flight. Typing in a disabled field is impossible and a
   * second click finds the control disabled, which closes the wedge where a duplicate
   * `vault_complete_onboarding` fails, reports an error, and leaves the user staring at the
   * protection screen although the vault now exists on disk.
   */
  const submitting = status === "submitting";
  const busy = submitting || opening;
  const currentIndex = ONBOARDING_STEPS.indexOf(step);
  const centered = CENTERED_STEPS.has(step);
  // The completion screen has nowhere to go back to: the vault exists, and the previous
  // screen's control would ask Rust to create a second one.
  const canGoBack = currentIndex > 0 && step !== "complete";
  const canSkip = step === "collections" || step === "protection";

  /** T-01's skip affordance for the protection screen: no password, and no half-typed one either. */
  async function skipProtection() {
    setField("masterPassword", "");
    setField("confirmPassword", "");
    await submit();
  }

  /** Skipping the collections screen means creating none of them, not the ones already ticked. */
  function skipCollections() {
    clearCollections();
    advance();
  }

  /** Advances only from a complete answer; otherwise the screen shows what is missing. */
  function advance() {
    if (!isStepComplete(step, draft)) {
      setAttemptedStep(step);
      return;
    }

    next();
  }

  /**
   * Leaves the wizard for the vault.
   *
   * The dashboard is asked for first, so the URL is right whichever screen the wizard was
   * standing in for. The read that follows is what moves the gate off the wizard — which is
   * why nothing re-reads the vault when the write succeeds: doing it there would take the
   * completion screen away before the user had read it.
   */
  async function openVault() {
    setOpening(true);
    await navigate("/");
    await refreshVault();
  }

  async function handlePrimary() {
    if (busy) {
      return;
    }

    switch (step) {
      case "welcome":
      case "identity":
      case "collections":
        advance();
        return;
      case "protection":
        if (!isStepComplete("protection", draft)) {
          setAttemptedStep("protection");
          return;
        }

        await submit();
        return;
      case "complete":
        await openVault();
    }
  }

  let stepBody: ReactNode;

  switch (step) {
    case "welcome":
      stepBody = <WelcomeStep />;
      break;
    case "identity":
      stepBody = (
        <IdentityStep
          userName={draft.userName}
          // Both halves matter: the user asked to continue, and the answer still is not one
          // the vault can be created from. Measuring the draft again is what lets the error
          // clear itself the moment the field is fixed, and what lets a blank field be told
          // it is blank rather than told it is too long.
          nameError={attemptedStep === "identity" ? userNameProblem(draft.userName) : null}
          onUserNameChange={(value) => setField("userName", value)}
        />
      );
      break;
    case "collections":
      stepBody = (
        <CollectionsStep selected={draft.starterCollections} disabled={submitting} onToggle={toggleCollection} />
      );
      break;
    case "protection":
      stepBody = (
        <ProtectionStep
          password={draft.masterPassword}
          confirmPassword={draft.confirmPassword}
          showPasswordError={attemptedStep === "protection" && !isStepComplete("protection", draft)}
          disabled={submitting}
          onPasswordChange={(value) => setField("masterPassword", value)}
          onConfirmPasswordChange={(value) => setField("confirmPassword", value)}
        />
      );
      break;
    case "complete":
      stepBody = <CompleteStep />;
  }

  const primaryLabel = busy ? (submitting ? SUBMITTING_LABEL : OPENING_LABEL) : PRIMARY_ACTION[step];

  return (
    <OnboardingScreen centered={centered}>
      {stepBody}

      {status === "error" && error !== null && <WriteFailure message={error} />}

      <ScreenActions align={centered ? "center" : canSkip ? "split" : "start"} className={ACTION_GAP[step]}>
        {canGoBack && (
          <Button
            type="button"
            variant="ghost"
            className={cn(BUTTON, "text-muted-foreground")}
            disabled={busy}
            onClick={back}
          >
            Back
          </Button>
        )}

        {/* Skip sits beside the control that commits, which is where a user looks for a way
            past a screen — not at the foot of a list they would have to read first. */}
        <div className="flex items-center gap-2">
          {canSkip && (
            <Button
              type="button"
              variant="ghost"
              className={BUTTON}
              disabled={busy}
              onClick={() => {
                void (step === "collections" ? skipCollections() : skipProtection());
              }}
            >
              Skip for now
            </Button>
          )}

          <Button
            type="button"
            className={BUTTON}
            disabled={busy}
            onClick={() => {
              void handlePrimary();
            }}
          >
            {busy ? (
              <>
                <Spinner aria-hidden="true" />
                {primaryLabel}
              </>
            ) : (
              primaryLabel
            )}
          </Button>
        </div>
      </ScreenActions>
    </OnboardingScreen>
  );
}

interface WriteFailureProps {
  message: string;
}

/**
 * The vault could not be written. The user stays on the screen they were on, with every
 * answer still in the fields behind this notice, so the only thing being asked of them is
 * to read one sentence and press the control they already pressed.
 */
function WriteFailure({ message }: WriteFailureProps) {
  return (
    <div
      role="alert"
      className="mt-5 flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4"
    >
      <TriangleAlert aria-hidden="true" className="mt-1 size-5 shrink-0 text-destructive" />

      <div className="flex flex-col gap-1">
        <p className="font-medium">Your vault was not created.</p>
        <p className="text-muted-foreground">{message}</p>
        <p className="text-muted-foreground">
          Your answers are still here. Nothing was lost — try again when you are ready.
        </p>
      </div>
    </div>
  );
}
