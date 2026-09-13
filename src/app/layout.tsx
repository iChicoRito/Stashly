import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PREFERENCE_DEFAULTS } from "@/lib/preferences/preferences-config";
import { PreferencesStoreProvider } from "@/stores/preferences/preferences-provider";

import "./globals.css";

/**
 * Root providers.
 *
 * This file used to render `<html>` and `<body>` and export page
 * metadata. A SPA owns those in `index.html`, so what remains is the
 * provider stack; the theme attributes are applied by `applyBootPreferences()`
 * from `src/main.tsx` before the first render.
 */
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const { theme_mode, theme_preset, content_layout, navbar_style, font } = PREFERENCE_DEFAULTS;

  return (
    <TooltipProvider>
      <PreferencesStoreProvider
        themeMode={theme_mode}
        themePreset={theme_preset}
        contentLayout={content_layout}
        navbarStyle={navbar_style}
        font={font}
      >
        {children}
        <Toaster />
      </PreferencesStoreProvider>
    </TooltipProvider>
  );
}
