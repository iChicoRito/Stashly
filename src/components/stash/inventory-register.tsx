"use client";

import { Plus, Search } from "lucide-react";

import { AddItemDialog } from "@/components/stash/add-item-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StashItem } from "@/data/stash-items";

interface InventoryRegisterProps {
  items: StashItem[];
  query: string;
  onQueryChange: (query: string) => void;
  onAddItem: (item: StashItem) => void;
}

export function InventoryRegister({ items, query, onQueryChange, onAddItem }: InventoryRegisterProps) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredItems = items.filter((item) =>
    [item.name, item.category, item.location].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)),
  );
  const totalUnits = items.reduce((total, item) => total + item.quantity, 0);
  const locations = new Set(items.map((item) => item.location)).size;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight">Inventory</h1>
          <p className="text-muted-foreground text-sm">
            Everything in the stash for this session. Nothing is written to disk.
          </p>
        </div>
        <AddItemDialog onAdd={onAddItem}>
          <Button type="button">
            <Plus data-icon="inline-start" />
            Add item
          </Button>
        </AddItemDialog>
      </div>

      <section aria-label="Inventory summary" className="grid gap-4 sm:grid-cols-3">
        <SummaryCard index="01" label="Items tracked" value={items.length} summary="items" />
        <SummaryCard index="02" label="Total units" value={totalUnits} summary="units" />
        <SummaryCard index="03" label="Locations" value={locations} summary="locations" />
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">
              Inventory / Current session
            </p>
            <CardTitle role="heading" aria-level={2} className="text-lg">
              Stash register
            </CardTitle>
          </div>
          <Field className="w-full lg:w-80">
            <FieldLabel htmlFor="inventory-search">Search inventory</FieldLabel>
            <Input
              id="inventory-search"
              type="search"
              placeholder="Name, category, or location"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </Field>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Item</TableHead>
                  <TableHead scope="col">Category</TableHead>
                  <TableHead scope="col">Location</TableHead>
                  <TableHead scope="col" className="text-right">
                    Quantity
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Updated
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.location}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{item.updated}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredItems.length === 0 && (
            <Empty className="m-4 border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>No items match &ldquo;{query.trim()}&rdquo;</EmptyTitle>
                <EmptyDescription>Try another name, category, or location.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button type="button" variant="outline" onClick={() => onQueryChange("")}>
                  Clear search
                </Button>
              </EmptyContent>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface SummaryCardProps {
  index: string;
  label: string;
  value: number;
  summary: string;
}

function SummaryCard({ index, label, value, summary }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3">
        <span aria-hidden="true" className="font-semibold text-muted-foreground text-xs tabular-nums">
          {index}
        </span>
        <CardTitle className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <strong data-summary={summary} className="font-semibold text-4xl tabular-nums">
          {value}
        </strong>
      </CardContent>
    </Card>
  );
}
