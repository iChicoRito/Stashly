"use client";

import { Suspense } from "react";

import { Link } from "react-router";
import { useSearchParams } from "react-router";

import { FolderPlus, Grid2X2, List, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { type FileManagerView, files, folders } from "./_components/data";
import { FileGridView } from "./_components/file-grid-view";
import { FileListView } from "./_components/file-list-view";
import { FileManagerToolbar } from "./_components/file-manager-toolbar";
import { FoldersSection } from "./_components/folders-section";

/**
 * The view is read with `useSearchParams` instead of the `searchParams` prop,
 * because a static export prerenders every route and cannot await request data.
 */
function FileManagerContent() {
  const [searchParams] = useSearchParams();
  const activeView: FileManagerView = searchParams.get("view") === "list" ? "list" : "grid";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight">My files</h1>
          <p className="text-muted-foreground text-sm">Organize, share, and find workspace files.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <FolderPlus data-icon="inline-start" />
            New folder
          </Button>
          <Button>
            <Upload data-icon="inline-start" />
            Upload
          </Button>
        </div>
      </div>
      <FileManagerToolbar />
      <FoldersSection folders={folders} />
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-medium text-lg">All files</h2>
          <ToggleGroup type="single" variant="outline" size="sm" spacing={0} value={activeView} aria-label="File view">
            <ToggleGroupItem value="grid" asChild>
              <Link to="?view=grid" replace>
                <Grid2X2 />
                Grid View
              </Link>
            </ToggleGroupItem>
            <ToggleGroupItem value="list" asChild>
              <Link to="?view=list" replace>
                <List />
                List View
              </Link>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        {activeView === "list" ? <FileListView files={files} /> : <FileGridView files={files} />}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <FileManagerContent />
    </Suspense>
  );
}
