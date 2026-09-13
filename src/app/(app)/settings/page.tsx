"use client";

import { useEffect, useState } from "react";

import { format, parseISO } from "date-fns";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { getStorageProbePaths } from "@/lib/vault/api";
import type { StorageProbePaths } from "@/lib/vault/types";
import { useVaultStore } from "@/stores/vault/vault-store";

// Settings reads the same `vault-store` the Dashboard does, which the gate has already booted.
// Nothing here writes: every control that could change the vault is Phase 2's, and the two cards
// below say so rather than pretending otherwise.

const LOCK_NOTE = "Locking arrives in a later phase — your password is stored as a salted hash.";

export default function SettingsPage() {
  const startup = useVaultStore((state) => state.startup);
  const vault = startup?.status === "ready" ? startup : null;

  if (vault === null) {
    return (
      <p role="status" className="text-muted-foreground text-sm">
        Reading your vault&hellip;
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl leading-none tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">What this vault is, where it lives, and what protects it.</p>
      </div>

      <Card>
        <CardHeader>
          <p className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">Vault / Identity</p>
          <CardTitle role="heading" aria-level={2} className="text-lg">
            Vault identity
          </CardTitle>
          <CardDescription>The answers given when this vault was created. They are stored in it.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <dt className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">Vault name</dt>
              <dd>{vault.vault_name}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">Owner</dt>
              <dd>{vault.user_name}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">Created</dt>
              <dd>{formatCompletedAt(vault.onboarding_completed_at)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <p className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">Vault / Storage</p>
            <CardTitle role="heading" aria-level={2} className="text-lg">
              Storage
            </CardTitle>
            <CardDescription>Where this vault&rsquo;s records and files are kept.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              {/* T-01's indicator: storage is automatic, and disclosed rather than chosen. */}
              <p className="text-muted-foreground text-sm">● This Device</p>
              <FieldDescription>
                Stashly uses its default local application storage. There is no folder or location to pick.
              </FieldDescription>
            </div>
            {/* The probe's commands exist only in a debug build, so neither does this path. */}
            {import.meta.env.DEV && <DevVaultRoot />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">Vault / Protection</p>
            <CardTitle role="heading" aria-level={2} className="text-lg">
              Vault Lock
            </CardTitle>
            <CardDescription>Locking Stashly when you step away is not part of this phase.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="vault-lock">Vault Lock</FieldLabel>
              <FieldDescription id="vault-lock-note">{LOCK_NOTE}</FieldDescription>
            </div>
            <Switch id="vault-lock" aria-describedby="vault-lock-note" checked={vault.protection_enabled} disabled />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * The vault root as Tauri resolved it, development builds only.
 *
 * `vault_probe_paths` is registered only in a debug build, so the branch that renders this is
 * also what keeps a release build from calling a command it does not have.
 */
function DevVaultRoot() {
  const [root, setRoot] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    // A fact about this launch, read once. The failure is shown rather than swallowed: a path
    // that silently stays blank is indistinguishable from one that was never asked for.
    void getStorageProbePaths()
      .then((paths: StorageProbePaths) => {
        setRoot(paths.vaultRoot);
      })
      .catch(() => {
        setUnavailable(true);
      });
  }, []);

  return (
    <div className="flex flex-col gap-1">
      <p className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">
        Vault root / development only
      </p>
      <p className="break-all font-mono text-muted-foreground text-xs">
        {root ?? (unavailable ? "Not available in this build." : "Reading\u2026")}
      </p>
    </div>
  );
}

/** The stored timestamp in words, or as it was stored if it is not a date this build can read. */
function formatCompletedAt(value: string): string {
  const date = parseISO(value);

  return Number.isNaN(date.getTime()) ? value : format(date, "d MMMM yyyy");
}
