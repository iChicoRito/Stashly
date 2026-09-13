import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { STARTER_COLLECTION_OPTIONS } from "@/stores/onboarding/onboarding-schema";

interface CollectionsStepProps {
  selected: readonly string[];
  disabled: boolean;
  onToggle: (name: string) => void;
  onSkip: () => void;
}

/** T-01's page 3: the six starter categories, each one optional, with a way past all of them. */
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
      </CardContent>
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
