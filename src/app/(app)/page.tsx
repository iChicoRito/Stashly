"use client";

import type { ReactNode } from "react";

import { FilePlus, FolderPlus, Link2, NotebookPen, Vault } from "lucide-react";

import { StorageProbeCard } from "@/components/dev/storage-probe-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { useVaultStore } from "@/stores/vault/vault-store";

// The vault Dashboard: T-01's first screen after setup, and the only route that reads the
// vault for display. It reads `vault-store` rather than the API because `OnboardingGate` has
// already booted it — asking Rust again here would be a second round trip for an answer that
// is already in memory.

/** T-01's empty state, quoted from the spec. */
const EMPTY_TITLE = "Your Stash is looking a little empty.";
const EMPTY_DESCRIPTION = "Start adding the things that matter to you.";

/**
 * T-01's four quick actions, in T-01's order, all inert.
 *
 * Phase 1 has no item model, so there is nothing for them to write to. Inventing item creation
 * would put records in front of the user as if they were saved. The reason they are disabled is
 * a line of text on the page rather than a `title`, because `title` on a disabled button is not
 * reliably exposed to assistive technology.
 */
const QUICK_ACTIONS = [
  { id: "note", label: "Add Note", icon: NotebookPen },
  { id: "file", label: "Add File", icon: FilePlus },
  { id: "link", label: "Save Link", icon: Link2 },
  { id: "collection", label: "Create Collection", icon: FolderPlus },
] as const;

const QUICK_ACTIONS_NOTE = "Quick actions arrive in the next phase.";

export default function DashboardPage() {
  const startup = useVaultStore((state) => state.startup);

  // `null` for every answer but `ready`. The gate hands this page only a booted, ready vault,
  // so this is the honest shape rather than a second opinion about whether one exists.
  const vault = startup?.status === "ready" ? startup : null;

  if (vault === null) {
    return (
      <p role="status" className="text-muted-foreground text-sm">
        Reading your vault&hellip;
      </p>
    );
  }

  const collectionCount = vault.collections.length;
  const greeting = `Welcome, ${vault.user_name}. ${vault.vault_name} is ready on this device.`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl leading-none tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">{greeting}</p>
      </header>

      <section aria-label="Vault summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Vault name">
          <p className="font-medium">{vault.vault_name}</p>
        </SummaryCard>
        <SummaryCard label="Collections">
          <p className="font-medium tabular-nums">{collectionCountLabel(collectionCount)}</p>
        </SummaryCard>
        <SummaryCard label="Storage">
          {/* T-01's indicator, glyph and words in one run so it reads as the single line it is. */}
          <p className="text-muted-foreground">● This Device</p>
        </SummaryCard>
        <SummaryCard label="Protection">
          <p className="font-medium">{vault.protection_enabled ? "Password protected" : "No password set"}</p>
        </SummaryCard>
      </section>

      <Card>
        <CardContent className="flex flex-col gap-6">
          {collectionCount === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Vault aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle role="heading" aria-level={2}>
                  {EMPTY_TITLE}
                </EmptyTitle>
                <EmptyDescription>{EMPTY_DESCRIPTION}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <p className="text-muted-foreground text-sm">
              {collectionCountLabel(collectionCount)} in this vault. Notes, files, and links arrive in the next phase.
            </p>
          )}

          <section aria-label="Quick actions" className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              {QUICK_ACTIONS.map(({ id, label, icon: Icon }) => (
                <Button key={id} type="button" variant="outline" disabled>
                  <Icon data-icon="inline-start" aria-hidden="true" />
                  {label}
                </Button>
              ))}
            </div>
            <p className="text-muted-foreground text-sm">{QUICK_ACTIONS_NOTE}</p>
          </section>
        </CardContent>
      </Card>

      {/* The probe's commands exist only in a debug build, so neither does its panel. */}
      {import.meta.env.DEV && <StorageProbeCard />}
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  children: ReactNode;
}

/** One vault fact. The label is a heading, so the four cards read as a labelled set. */
function SummaryCard({ label, children }: SummaryCardProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle
          role="heading"
          aria-level={2}
          className="font-semibold text-muted-foreground text-xs uppercase tracking-wider"
        >
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Reads as a phrase rather than as a bare number: "0 collections", "1 collection". */
function collectionCountLabel(count: number): string {
  return `${count} ${count === 1 ? "collection" : "collections"}`;
}
