import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { STARTER_COLLECTION_BLURBS, STARTER_COLLECTION_OPTIONS } from "@/stores/onboarding/onboarding-schema";

interface StarterCollectionsProps {
  selected: readonly string[];
  disabled: boolean;
  onToggle: (name: string) => void;
}

/**
 * The starter categories as a grid of cards, each one a checkbox with a name and one line
 * saying what belongs in it.
 *
 * The options come from `STARTER_COLLECTION_OPTIONS` and their lines from
 * `STARTER_COLLECTION_BLURBS`, so the names the user sees, the names the vault is asked to
 * create, and the sentence under each one cannot drift apart. Nothing here is required and
 * nothing here is the only way past the screen — the wizard owns the way to skip it.
 */
export function StarterCollections({ selected, disabled, onToggle }: StarterCollectionsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {STARTER_COLLECTION_OPTIONS.map((name) => {
        const id = optionId(name);
        const checked = selected.includes(name);

        return (
          <Field
            key={name}
            orientation="horizontal"
            // The highlight is what makes the card the click target rather than the small
            // box inside it, so a ticked card is legible at a glance from across the grid.
            className={cn(
              // Tight across, roomy down: the box and its two lines are all the card holds, and
              // every pixel of side padding is width taken from the line that sits beside it.
              "items-center rounded-xl border px-2 py-4 transition-colors",
              checked ? "border-foreground/25 bg-muted/40" : "border-border",
            )}
          >
            <Checkbox
              id={id}
              checked={checked}
              disabled={disabled}
              // Named and described by the two lines beside it: read together as one string,
              // the name would be "Personal Documents IDs and legal papers".
              aria-labelledby={`${id}-name`}
              aria-describedby={`${id}-blurb`}
              onCheckedChange={() => onToggle(name)}
            />
            <FieldLabel htmlFor={id} className="flex-col items-start gap-0 font-normal">
              <span id={`${id}-name`} className="font-medium">
                {name}
              </span>
              <span id={`${id}-blurb`} className="text-muted-foreground">
                {STARTER_COLLECTION_BLURBS[name]}
              </span>
            </FieldLabel>
          </Field>
        );
      })}
    </div>
  );
}

/** A stable id per option, so every checkbox is labelled and none depends on its index. */
function optionId(name: string): string {
  return `starter-collection-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}
