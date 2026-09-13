import { ReviewStep } from "@/components/onboarding/review-step";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CompleteStepProps {
  userName: string;
  vaultName: string;
  collectionCount: number;
  protectionEnabled: boolean;
}

/**
 * T-01's completion screen: the confirmation, then the summary of what was set up.
 *
 * The values are the answers that were just written, so the screen can render the moment
 * `completeOnboarding` resolves instead of waiting for a second read of the vault. The
 * vault itself is authoritative, and the Dashboard shows it from the store.
 */
export function CompleteStep({ userName, vaultName, collectionCount, protectionEnabled }: CompleteStepProps) {
  return (
    <>
      <CardHeader>
        <CardTitle role="heading" aria-level={1} className="text-2xl">
          Your Stash is ready.
        </CardTitle>
        <CardDescription>
          Everything is set up. You can start adding and organizing your important information.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ReviewStep
          userName={userName}
          vaultName={vaultName}
          collectionCount={collectionCount}
          protectionEnabled={protectionEnabled}
        />
      </CardContent>
    </>
  );
}
