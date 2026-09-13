interface ReviewStepProps {
  userName: string;
  vaultName: string;
  collectionCount: number;
  protectionEnabled: boolean;
}

/**
 * T-01's setup summary, read-only: the answers the vault was created from, in the spec's own
 * labels and wording.
 *
 * A `dl` rather than a table of inputs — this screen confirms, it does not edit. Changing an
 * answer here would mean writing the vault a second time.
 */
export function ReviewStep({ userName, vaultName, collectionCount, protectionEnabled }: ReviewStepProps) {
  return (
    <section aria-label="Setup summary" className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-4">
      <p className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">Your Stash</p>

      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        <SummaryRow label="Name" value={userName.trim()} />
        <SummaryRow label="Vault" value={vaultName} />
        <SummaryRow label="Collections" value={collectionCount === 0 ? "None yet" : `${collectionCount} Created`} />
        <SummaryRow label="Storage" value="● This Device" />
        <SummaryRow label="Vault Protection" value={protectionEnabled ? "Enabled" : "Not Enabled"} />
      </dl>

      {!protectionEnabled && <p className="text-muted-foreground text-sm">You can enable it anytime from Settings.</p>}
    </section>
  );
}

interface SummaryRowProps {
  label: string;
  value: string;
}

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </>
  );
}
