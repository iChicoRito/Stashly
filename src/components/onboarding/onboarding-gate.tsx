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
 * Decides, once per route, whether the app or the first-run wizard is on screen.
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

  // React 19's StrictMode runs mount effects twice, and every route carries this gate, so
  // without the guard a development launch would ask Rust for the vault state twice. A ref
  // rather than a module-level flag: the flag would outlive the component and stop a later
  // mount (a route change, or a fresh test) from ever booting again. Two named states rather
  // than a boolean, which also keeps the guard readable as "has the read been asked for yet".
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

/** Enough shape for the shell not to jump when the page it is waiting for arrives. */
function GateSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6 p-6">
      <p className="sr-only" role="status">
        Opening your vault…
      </p>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SKELETON_CARDS.map((card) => (
          <Skeleton key={card} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

/** Stable keys for the placeholder cards, so nothing here depends on an array index. */
const SKELETON_CARDS = ["identity", "collections", "storage", "protection"] as const;

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
