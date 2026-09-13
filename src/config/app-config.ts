import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "Stashly",
  version: packageJson.version,
  copyright: `© ${currentYear}, Stashly.`,
  meta: {
    title: "Stashly",
    description:
      "Stashly is a local-first desktop starter for organising a personal stash, built with Tauri 2, Vite, React, Tailwind CSS v4, and shadcn/ui.",
  },
};
