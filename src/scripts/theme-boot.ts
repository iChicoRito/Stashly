/**
 * Applies saved preferences (theme mode, theme preset, font, layout options) to
 * `<html>` before the first render.
 *
 * This replaces the inline boot `<script>` that used to sit in the root
 * layout: a SPA has no server-rendered HTML, so running this from the
 * entry module is early enough to avoid a theme or layout flash.
 */
import { PREFERENCE_DEFAULTS, PREFERENCE_PERSISTENCE } from "@/lib/preferences/preferences-config";

type PreferenceKey = keyof typeof PREFERENCE_DEFAULTS;

function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((entry) => entry.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function readLocal(name: string): string | null {
  try {
    return window.localStorage.getItem(name);
  } catch {
    return null;
  }
}

function readPreference(key: PreferenceKey): string | null {
  const mode = PREFERENCE_PERSISTENCE[key];

  if (mode === "localStorage") {
    return readLocal(key);
  }

  if (mode === "client-cookie" || mode === "server-cookie") {
    return readCookie(key);
  }

  return null;
}

export function applyBootPreferences() {
  try {
    const root = document.documentElement;

    const rawMode = readPreference("theme_mode") ?? PREFERENCE_DEFAULTS.theme_mode;
    const mode =
      rawMode === "dark" || rawMode === "light" || rawMode === "system" ? rawMode : PREFERENCE_DEFAULTS.theme_mode;
    const resolvedMode =
      mode === "system" && window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : mode;

    root.classList.toggle("dark", resolvedMode === "dark");
    root.setAttribute("data-theme-mode", mode);
    root.setAttribute("data-theme-preset", readPreference("theme_preset") ?? PREFERENCE_DEFAULTS.theme_preset);
    root.setAttribute("data-font", readPreference("font") ?? PREFERENCE_DEFAULTS.font);
    root.setAttribute("data-content-layout", readPreference("content_layout") ?? PREFERENCE_DEFAULTS.content_layout);
    root.setAttribute("data-navbar-style", readPreference("navbar_style") ?? PREFERENCE_DEFAULTS.navbar_style);
    root.setAttribute("data-sidebar-variant", readPreference("sidebar_variant") ?? PREFERENCE_DEFAULTS.sidebar_variant);
    root.setAttribute(
      "data-sidebar-collapsible",
      readPreference("sidebar_collapsible") ?? PREFERENCE_DEFAULTS.sidebar_collapsible,
    );

    root.style.colorScheme = resolvedMode === "dark" ? "dark" : "light";
  } catch (error) {
    console.warn("applyBootPreferences error:", error);
  }
}
