import { type ReactNode, useEffect, useRef } from "react";

import { TriangleAlert } from "lucide-react";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useVaultStore } from "@/stores/vault/vault-store";

interface OnboardingGateProps {
  children: ReactNode;
}

/**
 * Decides whether the app or the first-run wizard is on screen.
 *
 * It wraps the dashboard shell rather than sitting inside it, and that placement is the
 * whole reason onboarding looks like onboarding: a user with no vault yet gets one blank
 * page and one question, not a sidebar full of collections they have not created and a
 * header full of controls that do nothing. Wrapping the shell also means one gate rather
 * than one per route, so moving between pages no longer re-reads the vault.
 *
 * The rule this component exists to enforce: only a `not_initialized` reply opens the
 * wizard. A read that failed — a `db` or `io` error, a poisoned lock, a missing Tauri
 * transport — is a *failure*, not an empty vault, and it gets a retry screen. Walking a
 * user through first-run setup on top of a vault that already exists would create a second
 * vault over a live one, which is the worst thing this phase can do.
 */
export function OnboardingGate({ children }: OnboardingGateProps) {
  const status = useVaultStore((state) => state.status);
  const errorCode = useVaultStore((state) => state.errorCode);
  const errorMessage = useVaultStore((state) => state.errorMessage);
  const boot = useVaultStore((state) => state.boot);

  // React 19's StrictMode runs mount effects twice, and this gate outlives every route it
  // guards, so without the guard a development launch would ask Rust for the vault state
  // twice. A ref rather than a module-level flag: the flag would outlive the component and
  // stop a later mount (a fresh test, or a remount after the failure screen) from ever
  // booting again. Two named states rather than a boolean, which also keeps the guard
  // readable as "has the read been asked for yet".
  const request = useRef<"none" | "asked">("none");

  useEffect(() => {
    if (request.current === "asked") {
      return;
    }

    request.current = "asked";
    // The store reports the outcome; this effect has nothing to do with it afterwards.
    void boot();
  }, [boot]);

  if (status === "loading") {
    return <GateSkeleton />;
  }

  if (status === "onboarding") {
    return <OnboardingWizard />;
  }

  if (status === "ready") {
    // Handed back untouched: the gate must not re-key, wrap, or remount the page it guards.
    return children;
  }

  return <BootFailure code={errorCode} message={errorMessage} onRetry={boot} />;
}

/**
 * What is on screen while the vault is being read: the shape of a page, and nothing that
 * belongs to one of the answers the read can produce.
 *
 * The gate sits above the dashboard shell, so this is what the app shows before it knows
 * whether there is a vault — and on a first launch the next thing to appear is onboarding,
 * not a dashboard. A skeleton drawn as a dashboard would promise a screen that never comes.
 */
function GateSkeleton() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-6 py-16">
      <div className="flex w-full max-w-[52rem] flex-col gap-3">
        <p className="sr-only" role="status">
          Opening your vault…
        </p>
        <Skeleton className="h-10 w-2/5" />
        <Skeleton className="h-8 w-full" />
      </div>
    </main>
  );
}

interface BootFailureProps {
  code: string | null;
  message: string | null;
  onRetry: () => void;
}

/**
 * Told apart from onboarding in wording as well as in behaviour: the user needs to know
 * their vault was not touched, and that a fresh setup screen would be the wrong answer.
 */
function BootFailure({ code, message, onRetry }: BootFailureProps) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-xl items-center px-6 py-10">
      <Alert variant="destructive" className="w-full">
        <TriangleAlert aria-hidden="true" />
        <AlertTitle>Stashly could not read your vault.</AlertTitle>
        <AlertDescription>
          <p>
            Nothing was changed, and your vault was not deleted. Stashly could not reach it, so it will not start a new
            setup over the top of it.
          </p>
          <p className="font-mono text-xs">
            {code ?? "internal"}: {message ?? "No further detail was reported."}
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-1" onClick={onRetry}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
