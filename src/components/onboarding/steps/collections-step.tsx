import { ScreenHeading } from "@/components/onboarding/onboarding-screen";
import { StarterCollections } from "@/components/onboarding/starter-collections";

interface CollectionsStepProps {
  selected: readonly string[];
  disabled: boolean;
  onToggle: (name: string) => void;
}

/**
 * The screen that asks what the user expects to keep, and offers to set those categories up
 * as collections before they arrive.
 *
 * Nothing here is required — T-01 sets no minimum selection — and the way to skip it lives
 * in the wizard's action row rather than among the cards, so "none of these" is offered
 * where the user looks for a way forward, not at the bottom of a list they must read first.
 */
export function CollectionsStep({ selected, disabled, onToggle }: CollectionsStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <ScreenHeading
        title="What will you keep in Stashly?"
        description="Choose anything that applies. Stashly can prepare some starter collections for you."
      />

      <StarterCollections selected={selected} disabled={disabled} onToggle={onToggle} />
    </div>
  );
}
