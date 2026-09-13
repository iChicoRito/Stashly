# Stashly

Stashly is a local-first desktop app for organising a personal stash — the things you keep in drawers, cabinets, and workshops. It runs on **Tauri 2** with a **Vite + React** frontend built on the **Studio Admin** shadcn/ui template.

Nothing leaves your machine. There is no account, no network request, no database, and no cloud service. The inventory and settings live in memory and reset when the app closes.

## Stack

| Layer | Choice |
| --- | --- |
| Runtime | Tauri 2 (Rust) |
| UI | React 19 + TypeScript |
| Build | Vite 8 + `@vitejs/plugin-react` |
| Styling | Tailwind CSS 4 via `@tailwindcss/vite`, shadcn/ui components |
| Routing | React Router 8 (`createHashRouter`) |
| Tests | Vitest 5 + Testing Library + jsdom |
| Lint | Biome |

## How it fits together

| Piece | Value | Why |
| --- | --- | --- |
| `index.html` + `src/main.tsx` | Vite entry | Owns `<html>`, `<body>`, and the `#root` mount |
| `src/router.tsx` | single route table | Maps every page component to a URL |
| `src-tauri/tauri.conf.json` | `frontendDist: "../dist"` | Tauri embeds the built assets in the binary |
| `src-tauri/tauri.conf.json` | `devUrl: http://localhost:1420` | Must match `vite.config.ts`, which uses `strictPort` so the port cannot drift |

**A hash router is used on purpose.** The built app is loaded from Tauri's custom protocol, where no server can resolve a deep path like `/settings` back to `index.html`. With hashes, every route reloads safely.

Everything is offline by design: all 18 template fonts are self-hosted (`@fontsource-variable/*`, plus one woff2 in `public/fonts/`), and there are no runtime CDN calls on Stashly's own pages.

## What is Stashly versus the template

- **Stashly's pages**: `/` (Inventory) and `/settings`, in `src/app/(app)/`, sharing the template's sidebar shell.
- **The template's pages** are all still here, reachable under `#/template/...` — 11 dashboards plus legacy variants, mail, chat, calendar, kanban, invoice, profile, users, roles, file manager, and the auth screens.
- **The sidebar** has a "Stashly" group at the top (`src/navigation/sidebar/sidebar-items.ts`) above the template's own groups.
- **Demo identity is rebranded**: `APP_CONFIG` is Stashly, `src/data/users.ts` is a single "Local session" identity, and the sidebar's promo card explains the session-only behaviour.

## Commands

```powershell
npm install          # install dependencies
npm run dev          # Vite dev server on http://localhost:1420
npm run tauri dev    # the native desktop app, hot reloading
npm test             # vitest + jsdom suite (21 tests)
npm run build        # production build into dist/
npm run tauri build  # Windows app + NSIS installer
npm run check        # biome lint + format check
```

Built artifacts:

| Artifact | Path |
| --- | --- |
| Application | `src-tauri/target/release/stashly.exe` |
| Installer | `src-tauri/target/release/bundle/nsis/Stashly_0.1.0_x64-setup.exe` |

The installer is unsigned, so Windows SmartScreen warns on other machines. `src-tauri/target/` is git-ignored and does not rebuild itself — run `npm run tauri build` after every frontend change.

## Prerequisites

Windows (primary target): Node.js 20.19+, Rust stable with the MSVC target, Microsoft C++ Build Tools with **Desktop development with C++**, and the WebView2 runtime. The full checklist is at <https://v2.tauri.app/start/prerequisites/>.

macOS and Linux should work once their Tauri prerequisites are installed, but no binaries have been produced there; `bundle.targets` is currently `nsis` only.

## Known follow-ups

- **The bundle is one large chunk** (~2.5 MB JS, 687 kB gzipped) because every template demo page is imported eagerly in `src/router.tsx`. Splitting the `/template` routes behind `React.lazy` would cut startup parse time.
- **React Compiler is not enabled.** The template used it through a Babel pipeline; enabling it here means adding `babel-plugin-react-compiler` to the React plugin config.
- **Two demo pages use the network**: the Logistics map fetches a world-atlas GeoJSON from jsDelivr, and the Profile page loads a GitHub avatar. Stashly's own routes are fully offline.

## Credits and license

The frontend is built on **Studio Admin** by [arhamkhnz](https://github.com/arhamkhnz/next-shadcn-admin-dashboard), via [iChicoRito/NextJS-Shadcn-Template](https://github.com/iChicoRito/NextJS-Shadcn-Template). Its license is kept in `LICENSE`.
