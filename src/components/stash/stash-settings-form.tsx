"use client";

import type { FormEvent } from "react";

import { CircleCheck, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { StashSettings } from "@/stores/stash/stash-store";

interface StashSettingsFormProps {
  values: StashSettings;
  saved: boolean;
  onChange: (values: StashSettings) => void;
  onSave: () => void;
}

export function StashSettingsForm({ values, saved, onChange, onSave }: StashSettingsFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave();
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <p className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">
            Profile / Inventory defaults
          </p>
          <CardTitle role="heading" aria-level={2} className="text-lg">
            Collection details
          </CardTitle>
          <CardDescription>These labels make new inventory records quicker to organize.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="max-w-xl">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="collection-name">Collection name</FieldLabel>
                <Input
                  id="collection-name"
                  aria-describedby="collection-name-help"
                  value={values.collectionName}
                  onChange={(event) => onChange({ ...values, collectionName: event.target.value })}
                />
                <FieldDescription id="collection-name-help">
                  Shown as the name of your current inventory.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="default-location">Default location</FieldLabel>
                <Input
                  id="default-location"
                  aria-describedby="default-location-help"
                  value={values.defaultLocation}
                  onChange={(event) => onChange({ ...values, defaultLocation: event.target.value })}
                />
                <FieldDescription id="default-location-help">
                  A starting point for items you add most often.
                </FieldDescription>
              </Field>
            </FieldGroup>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button type="submit">Save changes</Button>
              <p role="status" className="flex items-center gap-1.5 text-muted-foreground text-sm">
                {saved && (
                  <>
                    <CircleCheck aria-hidden="true" className="size-4" />
                    Changes saved for this session.
                  </>
                )}
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Info aria-hidden="true" className="size-4 text-muted-foreground" />
          <CardTitle role="heading" aria-level={2} className="text-base">
            Session-only settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Your settings reset when Stashly closes. This starter does not write data to disk.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
