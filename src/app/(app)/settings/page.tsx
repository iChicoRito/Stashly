"use client";

import { StashSettingsForm } from "@/components/stash/stash-settings-form";
import { useStashStore } from "@/stores/stash/stash-store";

export default function Page() {
  const settings = useStashStore((state) => state.settings);
  const settingsSaved = useStashStore((state) => state.settingsSaved);
  const updateSettings = useStashStore((state) => state.updateSettings);
  const saveSettings = useStashStore((state) => state.saveSettings);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl leading-none tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Session-only defaults for this stash.</p>
      </div>
      <StashSettingsForm values={settings} saved={settingsSaved} onChange={updateSettings} onSave={saveSettings} />
    </div>
  );
}
