export const THEME_MODE_OPTIONS = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
  { label: "System", value: "system" },
] as const;

export const THEME_MODE_VALUES = THEME_MODE_OPTIONS.map((o) => o.value);
export type ThemeMode = (typeof THEME_MODE_VALUES)[number];
export type ResolvedThemeMode = "light" | "dark";

// --- generated:themePresets:start ---

export const THEME_PRESET_OPTIONS = [
  {
    label: "Default",
    value: "default",
    primary: {
      light: "oklch(0.205 0 0)",
      dark: "oklch(0.922 0 0)",
    },
  },
  {
    label: "Claude",
    value: "claude",
    primary: {
      light: "oklch(0.6171 0.1375 39.0427)",
      dark: "oklch(0.6724 0.1308 38.7559)",
    },
  },
  {
    label: "Lime",
    value: "lime",
    primary: {
      light: "oklch(0.841 0.238 128.85)",
      dark: "oklch(0.768 0.233 130.85)",
    },
  },
  {
    label: "Purple",
    value: "purple",
    primary: {
      light: "oklch(0.491 0.27 292.581)",
      dark: "oklch(0.432 0.232 292.759)",
    },
  },
  {
    label: "Red",
    value: "red",
    primary: {
      light: "oklch(0.505 0.213 27.518)",
      dark: "oklch(0.444 0.177 26.899)",
    },
  },
  {
    label: "Sky",
    value: "sky",
    primary: {
      light: "oklch(0.5 0.134 242.749)",
      dark: "oklch(0.443 0.11 240.79)",
    },
  },
  {
    label: "Supabase",
    value: "supabase",
    primary: {
      light: "oklch(0.5568 0.1355 155.812)",
      dark: "oklch(0.5568 0.1355 155.812)",
    },
  },
  {
    label: "Teal",
    value: "teal",
    primary: {
      light: "oklch(0.511 0.096 186.391)",
      dark: "oklch(0.437 0.078 188.216)",
    },
  },
  {
    label: "TikTok",
    value: "tiktok",
    primary: {
      light: "oklch(0.6473 0.2381 17.7125)",
      dark: "oklch(0.6473 0.2381 17.7125)",
    },
  },
  {
    label: "VS Code",
    value: "vscode",
    primary: {
      light: "oklch(0.5296 0.1506 255.1121)",
      dark: "oklch(0.5296 0.1506 255.1121)",
    },
  },
  {
    label: "Yellow",
    value: "yellow",
    primary: {
      light: "oklch(0.852 0.199 91.936)",
      dark: "oklch(0.795 0.184 86.047)",
    },
  },
] as const;

export const THEME_PRESET_VALUES = THEME_PRESET_OPTIONS.map((p) => p.value);

export type ThemePreset = (typeof THEME_PRESET_OPTIONS)[number]["value"];

// --- generated:themePresets:end ---
