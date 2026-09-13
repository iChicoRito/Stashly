"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { StashItem } from "@/data/stash-items";

type FieldName = "name" | "category" | "location";
type Values = Record<FieldName, string>;
type Errors = Partial<Record<FieldName, string>>;

const emptyValues: Values = { name: "", category: "", location: "" };
const fields: FieldName[] = ["name", "category", "location"];

interface AddItemDialogProps {
  onAdd: (item: StashItem) => void;
  children: React.ReactNode;
}

export function AddItemDialog({ onAdd, children }: AddItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>(emptyValues);
  const [errors, setErrors] = useState<Errors>({});

  function reset() {
    setValues(emptyValues);
    setErrors({});
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) reset();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = Object.fromEntries(Object.entries(values).map(([field, value]) => [field, value.trim()])) as Values;
    const nextErrors = Object.fromEntries(
      fields.filter((field) => !trimmed[field]).map((field) => [field, "Required"]),
    ) as Errors;

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onAdd({
      id: crypto.randomUUID(),
      ...trimmed,
      quantity: 1,
      updated: "Jun 18, 2026",
    });
    handleOpenChange(false);
  }

  function update(field: FieldName, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <p className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">
            New record / Current session
          </p>
          <DialogTitle>Add item</DialogTitle>
          <DialogDescription>Add an item to this session&rsquo;s inventory. Quantity starts at one.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate>
          <FieldGroup>
            {fields.map((field) => {
              const label = field[0].toUpperCase() + field.slice(1);
              const errorId = `${field}-error`;
              return (
                <Field key={field} data-invalid={Boolean(errors[field])}>
                  <FieldLabel htmlFor={field}>{label}</FieldLabel>
                  <Input
                    id={field}
                    value={values[field]}
                    onChange={(event) => update(field, event.target.value)}
                    aria-invalid={Boolean(errors[field])}
                    aria-describedby={errors[field] ? errorId : undefined}
                  />
                  {errors[field] && <FieldError id={errorId}>{errors[field]}</FieldError>}
                </Field>
              );
            })}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">Add item</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
