import { StarterCollections } from "@/components/onboarding/starter-collections";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CollectionsStepProps {
  selected: readonly string[];
  disabled: boolean;
  onToggle: (name: string) => void;
  onSkip: () => void;
}

/**
 * T-01's page 3, quoted from the spec: the title and description, then the starter
 * collections the user may take or leave. The choice itself is `StarterCollections`.
 *
 * Nothing here is required — T-01 sets no minimum selection, so skipping is as complete an
 * answer as ticking all six boxes.
 */
export function CollectionsStep({ selected, disabled, onToggle, onSkip }: CollectionsStepProps) {
  return (
    <>
      <CardHeader>
        <CardTitle role="heading" aria-level={1} className="text-2xl">
          What will you keep in Stashly?
        </CardTitle>
        <CardDescription>
          Choose anything that applies. Stashly can prepare some starter collections for you.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <StarterCollections selected={selected} disabled={disabled} onToggle={onToggle} onSkip={onSkip} />
      </CardContent>
    </>
  );
}
