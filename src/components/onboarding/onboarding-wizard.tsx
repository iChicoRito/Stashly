import { type ReactNode, useRef, useState } from "react";

import { ArrowLeft, TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router";

import { CollectionsStep } from "@/components/onboarding/steps/collections-step";
import { CompleteStep } from "@/components/onboarding/steps/complete-step";
import { IdentityStep } from "@/components/onboarding/steps/identity-step";
import { ProtectionStep } from "@/components/onboarding/steps/protection-step";
import { WelcomeStep } from "@/components/onboarding/steps/welcome-step";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  derivedVaultName,
  isStepComplete,
  ONBOARDING_STEPS,
  type OnboardingStepId,
} from "@/stores/onboarding/onboarding-schema";
import { useOnboardingStore } from "@/stores/onboarding/onboarding-store";
import { useVaultStore } from "@/stores/vault/vault-store";

/**
 * T-01's forward control on each page, quoted from the spec. One table rather than a button
 * per step file, so the footer reads the same on every screen and a missing label is a type
 * error instead of a blank button.
 */
const PRIMARY_ACTION: Record<OnboardingStepId, string> = {
  welcome: "Get Started →",
  identity: "Continue →",
  collections: "Continue →",
  protection: "Create My Vault →",
  complete: "Open Stashly →",
};

/** Short names for the progress marks. T-01's flow is ordered, so the marks carry meaning. */
const STEP_LABELS: Record<OnboardingStepId, string> = {
  welcome: "Welcome",
  identity: "Your vault",
  collections: "Collections",
  protection: "Protection",
  complete: "Ready",
};

const SUBMITTING_LABEL = "Creating your vault…";

/**
 * T-01's five screens, wired to the onboarding store.
 *
 * The wizard owns the chrome — progress, Back, and the forward control — and each step owns
 * its own copy and fields. It is rendered only from `OnboardingGate`'s `onboarding` state,
 * which is reached only by a `not_initialized` vault.
 */
export function OnboardingWizard() {
  const navigate = useNavigate();

  const step = useOnboardingStore((state) => state.step);
  const draft = useOnboardingStore((state) => state.draft);
  const status = useOnboardingStore((state) => state.status);
  const error = useOnboardingStore((state) => state.error);
  const setField = useOnboardingStore((state) => state.setField);
  const toggleCollection = useOnboardingStore((state) => state.toggleCollection);
  const next = useOnboardingStore((state) => state.next);
  const back = useOnboardingStore((state) => state.back);
  const submit = useOnboardingStore((state) => state.submit);
  const refreshVault = useVaultStore((state) => state.refresh);

  // The step that was asked to continue with an answer it cannot continue from. Held as the
  // step id rather than as a boolean so the message cannot follow the user onto the next
  // screen, and each step's own rule decides whether it has anything to complain about.
  const [attemptedStep, setAttemptedStep] = useState<OnboardingStepId | null>(null);
  const refreshed = useRef(false);

  /**
   * Creating the vault is a one-shot write, so everything that could fire it a second time
   * is switched off while it is in flight. Typing in a disabled field is impossible and a
   * second click finds the control disabled, which closes the wedge where a duplicate
   * `vault_complete_onboarding` fails, reports an error, and leaves the user staring at the
   * protection step although the vault now exists on disk.
   */
  const submitting = status === "submitting";
  const currentIndex = ONBOARDING_STEPS.indexOf(step);
  const canGoBack = currentIndex > 0 && step !== "complete" && !submitting;

  /** T-01's skip affordance for the protection step: no password, and no half-typed one either. */
  async function skipProtection() {
    setField("masterPassword", "");
    setField("confirmPassword", "");
    await createVault();
  }

  async function createVault() {
    await submit();

    if (useOnboardingStore.getState().status !== "complete" || refreshed.current) {
      return;
    }

    refreshed.current = true;
    // The vault exists now, so the gate is told to re-read: that is what moves the app off
    // the wizard. Deliberately not awaited — the completion screen is already on screen and
    // must not be held back by a second round trip.
    void refreshVault();
  }

  /** Advances only from a complete answer; otherwise the step shows what is missing. */
  function advance() {
    if (!isStepComplete(step, draft)) {
      setAttemptedStep(step);
      return;
    }

    next();
  }

  async function handlePrimary() {
    if (submitting) {
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

        await createVault();
        return;
      case "complete":
        // Awaited because react-router v8's `navigate` resolves once the navigation is done.
        await navigate("/");
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
          vaultName={draft.vaultName}
          showNameError={attemptedStep === "identity"}
          onUserNameChange={(value) => setField("userName", value)}
          onVaultNameChange={(value) => setField("vaultName", value)}
        />
      );
      break;
    case "collections":
      stepBody = (
        <CollectionsStep
          selected={draft.starterCollections}
          disabled={submitting}
          onToggle={toggleCollection}
          onSkip={advance}
        />
      );
      break;
    case "protection":
      stepBody = (
        <ProtectionStep
          password={draft.masterPassword}
          confirmPassword={draft.confirmPassword}
          showPasswordError={attemptedStep === "protection"}
          disabled={submitting}
          onPasswordChange={(value) => setField("masterPassword", value)}
          onConfirmPasswordChange={(value) => setField("confirmPassword", value)}
          onSkip={() => {
            void skipProtection();
          }}
        />
      );
      break;
    case "complete":
      stepBody = (
        <CompleteStep
          userName={draft.userName}
          vaultName={draft.vaultName.trim() === "" ? derivedVaultName(draft.userName) : draft.vaultName.trim()}
          collectionCount={draft.starterCollections.length}
          protectionEnabled={draft.masterPassword !== ""}
        />
      );
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-10">
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <WizardProgress current={step} />

        <Card>
          {stepBody}

          <CardFooter className="flex-col items-stretch gap-4">
            {status === "error" && error !== null && (
              <Alert variant="destructive">
                <TriangleAlert aria-hidden="true" />
                <AlertTitle>Your vault was not created.</AlertTitle>
                <AlertDescription>
                  <p>{error}</p>
                  <p>Your answers are still here. Nothing was lost — try again when you are ready.</p>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between gap-3">
              <Button type="button" variant="ghost" onClick={back} disabled={!canGoBack}>
                <ArrowLeft aria-hidden="true" />
                Back
              </Button>
              <Button
                type="button"
                disabled={submitting}
                onClick={() => {
                  void handlePrimary();
                }}
              >
                {submitting ? (
                  <>
                    <Spinner aria-hidden="true" />
                    {SUBMITTING_LABEL}
                  </>
                ) : (
                  PRIMARY_ACTION[step]
                )}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}

interface WizardProgressProps {
  current: OnboardingStepId;
}

/**
 * The five screens as T-01 numbers them.
 *
 * A numbered marker is decoration on a page that has no order; this flow *is* an order, and
 * T-01 draws it as one, so the position is information the user is entitled to.
 */
function WizardProgress({ current }: WizardProgressProps) {
  const currentIndex = ONBOARDING_STEPS.indexOf(current);

  return (
    <ol aria-label="Setup progress" className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {ONBOARDING_STEPS.map((id, index) => {
        const isCurrent = index === currentIndex;
        const isDone = index < currentIndex;

        return (
          <li
            key={id}
            aria-current={isCurrent ? "step" : undefined}
            className={cn(
              "flex items-center gap-1.5 text-xs",
              isCurrent ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid size-5 shrink-0 place-content-center rounded-full border text-[0.6875rem]",
                isCurrent && "border-primary bg-primary text-primary-foreground",
                isDone && "border-primary/40 text-primary",
              )}
            >
              {isDone ? "✓" : index + 1}
            </span>
            {STEP_LABELS[id]}
          </li>
        );
      })}
    </ol>
  );
}
