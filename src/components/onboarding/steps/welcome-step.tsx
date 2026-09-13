import { Check, FileText, Folder, Link, LockKeyhole, NotebookText } from "lucide-react";

import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * T-01's page 1, quoted from the spec: the title, the description, the four highlights, and
 * the illustration's ingredients (notes, files, folders, links, and a vault mark).
 *
 * The forward control is the wizard's, so this step is copy and nothing else.
 */

const HIGHLIGHTS = [
  "Stored locally on your device",
  "Organize with collections and tags",
  "Search everything quickly",
  "Keep important information in one place",
] as const;

/** The five ingredients T-01 asks the illustration to introduce, as Lucide marks. */
const STASH_KINDS = [
  { id: "notes", label: "Notes", Icon: NotebookText },
  { id: "files", label: "Files", Icon: FileText },
  { id: "folders", label: "Folders", Icon: Folder },
  { id: "links", label: "Links", Icon: Link },
] as const;

export function WelcomeStep() {
  return (
    <>
      <CardHeader>
        <CardTitle role="heading" aria-level={1} className="text-2xl">
          Everything important, in one place.
        </CardTitle>
        <CardDescription>
          Keep your notes, files, useful links, documents, and personal information organized inside your own private
          vault.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <StashlyMark />

        <ul className="grid gap-2 sm:grid-cols-2">
          {HIGHLIGHTS.map((highlight) => (
            <li key={highlight} className="flex items-start gap-2 text-muted-foreground text-sm">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
              {highlight}
            </li>
          ))}
        </ul>
      </CardContent>
    </>
  );
}

/**
 * T-01's illustration, composed from Lucide marks rather than from an asset: a vault tile
 * with the four kinds of thing it holds beside it, which is the sentence the picture is
 * meant to say ("different types of personal information in one organized space").
 *
 * Hidden from assistive technology on purpose — every word it draws is already in the
 * description and the highlights, and a screen reader announcing "Notes Files Folders
 * Links" would only repeat them.
 */
function StashlyMark() {
  return (
    <div aria-hidden="true" className="flex items-center justify-center gap-4 rounded-xl border bg-muted/40 px-6 py-8">
      <div className="grid size-20 shrink-0 place-content-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
        <LockKeyhole className="size-9" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {STASH_KINDS.map(({ id, label, Icon }) => (
          <div
            key={id}
            className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-muted-foreground"
          >
            <Icon className="size-4 shrink-0" />
            <span className="font-medium text-xs">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
