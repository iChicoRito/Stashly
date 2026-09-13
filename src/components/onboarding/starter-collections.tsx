import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { STARTER_COLLECTION_OPTIONS } from "@/stores/onboarding/onboarding-schema";

interface StarterCollectionsProps {
  selected: readonly string[];
  disabled: boolean;
  onToggle: (name: string) => void;
  onSkip: () => void;
}

/**
 * T-01 page 3's answer control: the six starter categories, what they are not, and the way
 * past them.
 *
 * The options come from `STARTER_COLLECTION_OPTIONS` rather than from a list of its own, so
 * the names the user sees, the names the review screen counts, and the names the vault is
 * asked to create cannot drift apart.
 */
export function StarterCollections({ selected, disabled, onToggle, onSkip }: StarterCollectionsProps) {
  return (
    <>
      <FieldDescription>Select all that apply. There is no minimum.</FieldDescription>

      <FieldGroup>
        {STARTER_COLLECTION_OPTIONS.map((name) => {
          const id = optionId(name);

          return (
            <Field key={name} orientation="horizontal">
              <Checkbox
                id={id}
                checked={selected.includes(name)}
                disabled={disabled}
                onCheckedChange={() => onToggle(name)}
              />
              <FieldLabel htmlFor={id}>{name}</FieldLabel>
            </Field>
          );
        })}
      </FieldGroup>

      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">These collections are only starting points. You can later:</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-sm">
          {STARTER_COLLECTION_FREEDOMS.map((freedom) => (
            <li key={freedom}>{freedom}</li>
          ))}
        </ul>
      </div>

      <div>
        <Button type="button" variant="ghost" disabled={disabled} onClick={onSkip}>
          Skip — I'll organize it myself
        </Button>
      </div>
    </>
  );
}

/** T-01's list of what a starter collection is not: permanent. */
const STARTER_COLLECTION_FREEDOMS = [
  "Rename them",
  "Delete them",
  "Reorganize them",
  "Create additional collections",
] as const;

/** A stable id per option, so every checkbox is labelled and none depends on its index. */
function optionId(name: string): string {
  return `starter-collection-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}
