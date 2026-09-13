"use client";

import { useCallback, useEffect, useState } from "react";

import { CircleCheck, Database, FileText, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStorageProbePaths, readStorageProbe, writeStorageProbe } from "@/lib/vault/api";
import { toVaultCommandError } from "@/lib/vault/error";
import type { StorageProbeListing, StorageProbePaths } from "@/lib/vault/types";

// R-01's debug panel: it proves the two halves of D-07 persist — a row in SQLite's
// `app_settings` and a file under `<vault root>/files/` — which is why nothing else in
// the app writes both at once. The three commands it calls exist only in a debug build.

/** A failed command, as the card shows it: the frontend's own `{ code, message }`. */
interface ProbeFailure {
  code: string;
  message: string;
}

/** What the vault holds before the first read comes back. */
const EMPTY_LISTING: StorageProbeListing = { records: [], files: [] };

/**
 * The storage probe, or a note that it is not in this build.
 *
 * The branch is what keeps the surface out of a release build: Vite folds
 * `import.meta.env.DEV` to `false`, so nothing here can call a probe command in a build
 * where those commands were not registered. The panel below owns the hooks, so the gate
 * never changes which hooks run in a given build.
 */
export function StorageProbeCard() {
  if (!import.meta.env.DEV) {
    return (
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="text-lg">
            Storage probe
          </CardTitle>
          <CardDescription>The storage probe is a development-only tool.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return <StorageProbePanel />;
}

function StorageProbePanel() {
  const [label, setLabel] = useState("");
  const [listing, setListing] = useState<StorageProbeListing>(EMPTY_LISTING);
  const [paths, setPaths] = useState<StorageProbePaths | null>(null);
  const [failure, setFailure] = useState<ProbeFailure | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Reads both halves back from disk. Every path into the vault goes through here, so the
  // card only ever shows what was read rather than what a command said it wrote.
  const load = useCallback(async () => {
    const [resolvedPaths, readListing] = await Promise.all([getStorageProbePaths(), readStorageProbe()]);

    setPaths(resolvedPaths);
    setListing(readListing);
    setFailure(null);
  }, []);

  useEffect(() => {
    void load().catch((raw: unknown) => {
      setFailure(toFailure(raw));
    });
  }, [load]);

  async function handleWrite() {
    setBusy(true);
    setFailure(null);
    setStatus(null);

    try {
      const written = await writeStorageProbe(label);

      // Re-read first, then report: if the read back fails, the catch below owns the panel
      // and it must not still be claiming the write succeeded.
      await load();
      setStatus(`Wrote ${written.fileName} (${written.fileBytes} bytes), record ${written.dbRecordId}.`);
    } catch (raw) {
      // The listing is deliberately left as it was: a write that failed says nothing
      // about the records and files that are already on disk.
      setFailure(toFailure(raw));
    } finally {
      setBusy(false);
    }
  }

  async function handleReload() {
    setBusy(true);
    setStatus(null);

    try {
      await load();
      setStatus("Re-read the vault from disk.");
    } catch (raw) {
      setFailure(toFailure(raw));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">
            Developer / Storage probe
          </p>
          <CardTitle role="heading" aria-level={2} className="text-lg">
            SQLite and vault-file probe
          </CardTitle>
          <CardDescription>
            Writes one record to SQLite and one timestamped file to the vault&rsquo;s files directory, then reads both
            back from disk.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              void handleWrite();
            }}
          >
            Write test record and file
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              void handleReload();
            }}
          >
            <RefreshCw data-icon="inline-start" />
            Reload from disk
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {failure && (
          <Alert variant="destructive" role="alert">
            <AlertTitle>Storage probe failed ({failure.code})</AlertTitle>
            <AlertDescription>{failure.message}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-4">
          <Field className="max-w-md">
            <FieldLabel htmlFor="probe-label">Probe label</FieldLabel>
            <Input
              id="probe-label"
              aria-describedby="probe-label-help"
              value={label}
              placeholder="Smoke test"
              onChange={(event) => setLabel(event.target.value)}
            />
            <FieldDescription id="probe-label-help">
              Stored as a probe setting and written into the file&rsquo;s contents.
            </FieldDescription>
          </Field>

          <p role="status" className="flex items-center gap-1.5 text-muted-foreground text-sm">
            {status && (
              <>
                <CircleCheck aria-hidden="true" className="size-4" />
                {status}
              </>
            )}
          </p>
        </div>

        <dl className="grid gap-3 font-mono text-muted-foreground text-xs sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <dt className="font-sans text-xs uppercase tracking-widest">Vault root</dt>
            <dd className="break-all">{paths?.vaultRoot ?? "not read yet"}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="font-sans text-xs uppercase tracking-widest">Database</dt>
            <dd className="break-all">{paths?.dbPath ?? "not read yet"}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="font-sans text-xs uppercase tracking-widest">Files directory</dt>
            <dd className="break-all">{paths?.filesDir ?? "not read yet"}</dd>
          </div>
        </dl>

        <section className="flex flex-col gap-2">
          <h3 className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">
            Probe records / SQLite
          </h3>
          <p className="text-muted-foreground text-xs">The newest 10 records are shown; every file is listed below.</p>

          {listing.records.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Database aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>No probe records yet</EmptyTitle>
                <EmptyDescription>Write a test record to store one in the vault database.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Id</TableHead>
                    <TableHead scope="col">Label</TableHead>
                    <TableHead scope="col">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listing.records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="tabular-nums">{record.id}</TableCell>
                      <TableCell className="font-medium">{record.label}</TableCell>
                      <TableCell className="font-mono text-muted-foreground text-xs">{record.createdAt}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">Probe files / Files</h3>
          <p className="text-muted-foreground text-xs">
            Every file in the vault&rsquo;s files directory, newest first.
          </p>

          {listing.files.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>No probe files yet</EmptyTitle>
                <EmptyDescription>
                  Write a test record to add one under the vault&rsquo;s files directory.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">File</TableHead>
                    <TableHead scope="col" className="text-right">
                      Bytes
                    </TableHead>
                    <TableHead scope="col">Modified</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listing.files.map((file) => (
                    <TableRow key={file.name}>
                      <TableCell className="font-mono">{file.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{file.bytes}</TableCell>
                      <TableCell className="font-mono text-muted-foreground text-xs">{file.modifiedAt}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

/** Any rejection from the probe commands, reduced to the code and message the card shows. */
function toFailure(raw: unknown): ProbeFailure {
  const error = toVaultCommandError(raw);

  return { code: error.code, message: error.message };
}
