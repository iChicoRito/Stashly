# Stashly

Stashly is a local-first desktop app for organising a personal stash — the things you keep in drawers, cabinets, and workshops. It runs on **Tauri 2** with a **Vite + React** frontend built on the **Studio Admin** shadcn/ui template.

**Nothing leaves your machine.** There is no account, no sign-in, no cloud service, and no network request from Stashly's own routes. Your vault is two things on your own disk: a **SQLite database** holding records, and a **`files/` folder** holding documents and attachments.

Phase 1 built the vault foundation: a real on-disk vault, first-run setup that persists, a launch gate that decides between setup and the Dashboard, and a debug-only storage probe.

## Phase 1 status

| Area | State |
| --- | --- |
| Local storage | ✅ Live. SQLite (`rusqlite` with bundled SQLite, `STRICT` tables, `user_version = 1` migrations, WAL) plus a `files/` folder. Rust owns all storage behind named Tauri commands. |
| First-run setup | ✅ Live. A five-step wizard collects a required user name (starter collections and master password are both skippable; the vault is named after the user until it is renamed in Settings) and writes the whole submission in one transaction. |
| Onboarding persistence and gate | ✅ Live. `onboarding_completed = "1"` is stored, and one `OnboardingGate` wraps the dashboard shell: a vault that does not exist yet is asked for on a full-bleed page of its own instead of inside the sidebar, and later launches go straight to the Dashboard. |
| Launch decision safety | ✅ Live. A failed or unavailable vault call shows a retry screen and **never** renders the wizard — re-running first-run setup over a live vault is the one failure this design exists to prevent. |
| Vault protection | 🟨 Partial by design. An optional master password is stored as a **salted Argon2id PHC hash** (never plaintext, never returned to the UI, never logged). **Locking is not implemented** — the Settings card says so and its Vault Lock switch is disabled. |
| Dashboard and Settings | ✅ Live at `#/` and `#/settings`. The Dashboard shows the greeting, vault summary, a T-01 empty state, and four **disabled** quick actions (Add Note, Add File, Save Link, Create Collection) with the visible note "Quick actions arrive in the next phase." — Phase 1 has no item model, so nothing here fakes item creation. |
| Debug storage probe | ✅ Live but debug-only, at `#/dev/storage`. Writes one SQLite record and one vault file, then lists both back from disk along with the three resolved paths. The three Rust commands are `#[cfg(debug_assertions)]` and the UI is `import.meta.env.DEV`-gated, so a release build contains neither. |
| Cross-platform bundles | 🟨 Configured, unverified. `bundle.targets` is `["nsis","dmg","app"]` and `.github/workflows/build.yml` builds both platforms. See “Evidence status”. |

## Stack

| Layer | Choice |
| --- | --- |
| Runtime | Tauri 2 (Rust) |
| Storage | SQLite via `rusqlite` 0.40 with the `bundled` feature, plus `<vault root>/files/` |
| Passwords | `argon2` 0.5 (Argon2id, per-vault salt) |
| UI | React 19 + TypeScript |
| Build | Vite 8 + `@vitejs/plugin-react` |
| Styling | Tailwind CSS 4 via `@tailwindcss/vite`, shadcn/ui components |
| Routing | React Router 8 (`createHashRouter`) |
| State | zustand (module-level stores) |
| Tests | Vitest 5 + Testing Library + jsdom |
| Lint | Biome |

## Where your vault lives

Rust resolves the vault root from Tauri's `app_data_dir()`. On Windows that is the **Roaming** `%APPDATA%` variant:

```
%APPDATA%\com.stashly.desktop\          C:\Users\marka\AppData\Roaming\com.stashly.desktop
├── db\stashly.db                       SQLite: settings + collections (user_version = 1)
│   ├── stashly.db-wal                  normal WAL sidecar
│   └── stashly.db-shm
└── files\                              documents and attachments — never mixed with records
```

On macOS the same code path resolves under `~/Library/Application Support/com.stashly.desktop` — **stated from the code path, not observed**: no macOS build has been produced.

Two things worth knowing:

- `%LOCALAPPDATA%\com.stashly.desktop\EBWebView` is the **WebView2 profile**, not vault data. The vault is only the Roaming directory above.
- The bundle identifier is `com.stashly.desktop`. It was `com.stashly.app` during early development; the identifier is part of the app-data path, so that rename moved the vault root. The old `%LOCALAPPDATA%\com.stashly.app` directory holds only a WebView2 profile, and nothing continues from it.

The plan's Phase 5 work relocates this one directory; that capability (R-18) is not built.

## How it fits together

| Piece | Value | Why |
| --- | --- | --- |
| `index.html` + `src/main.tsx` | Vite entry | Owns `<html>`, `<body>`, and the `#root` mount |
| `src/lib/vault/api.ts` | the only module importing `@tauri-apps/api` | One seam between React and Rust; every command is typed here and its failures carry a `code` |
| `src-tauri/src/vault_repo.rs`, `db.rs`, `vault_paths.rs` | storage | Raw SQL and absolute paths stay out of the webview |
| `src/router.tsx` | single route table | Maps every page component to a URL |
| `src-tauri/tauri.conf.json` | `frontendDist: "../dist"` | Tauri embeds the built assets in the binary |
| `src-tauri/tauri.conf.json` | `devUrl: http://localhost:1420` | Must match `vite.config.ts`, which uses `strictPort` so the port cannot drift |

**A hash router is used on purpose.** The built app is loaded from Tauri's custom protocol, where no server can resolve a deep path like `/settings` back to `index.html`. With hashes, every route reloads safely.

**Stashly's own routes** are `#/` (Dashboard), `#/settings`, `#/dev/storage` (debug only), and the ungated `#/onboarding` wizard. The wizard sits outside the sidebar shell and deliberately outside the gate: its submit refreshes the vault store, and a gate there would replace the completion summary before it can be read.

Everything is offline by design: all 18 template fonts are self-hosted (`@fontsource-variable/*`, plus one woff2 in `public/fonts/`), and there are no runtime CDN calls on Stashly's own pages.

## What is Stashly versus the template

- **Stashly's pages**: `#/` (Dashboard) and `#/settings` in `src/app/(app)/`, plus the wizard in `src/components/onboarding/`, sharing the template's sidebar shell.
- **The template's pages** are all still here, reachable under `#/template/...` — 11 dashboards plus legacy variants, mail, chat, calendar, kanban, invoice, profile, users, roles, file manager, and the auth screens.
- **The sidebar** has a "Stashly" group at the top (`src/navigation/sidebar/sidebar-items.ts`) holding exactly `Dashboard` and `Settings`. The debug probe entry lives in a separate `Developer` group that only exists in development builds.
- **Demo identity is rebranded**: `APP_CONFIG` is Stashly and `src/data/users.ts` is a single "Local session" identity. The old session-only demo prototype (fake inventory rows and its store) has been deleted.

## Commands

```powershell
npm install          # install dependencies
npm run dev          # Vite dev server on http://localhost:1420 (browser only: no Tauri, so vault calls fail and the gate shows its retry screen)
npm run tauri dev    # the native desktop app, hot reloading
npm run typecheck    # tsc --noEmit
npm test             # vitest run — 150 tests in 14 files
npm run build        # tsc --noEmit && vite build, into dist/
npm run tauri build  # native bundles, filtered to what the host platform can produce
npm run check        # biome check, repo-wide (see the note below — this is RED today)
```

`npm run check` is **not** a clean gate in this repo. The template tree carries pre-existing Biome debt that Phase 1 does not own: a bare `npx biome check src/app` reports 1 error, 19 warnings and 4 infos across 216 files and exits 1. Use the scoped command instead — the same one CI runs, which is green over 38 files:

```powershell
npx biome check src/lib/vault src/stores/onboarding src/stores/vault src/components/onboarding `
  src/components/dev src/navigation/sidebar src/test `
  "src/app/(app)/page.tsx" "src/app/(app)/settings/page.tsx" `
  "src/app/(app)/dashboard-page.test.tsx" "src/app/(app)/settings-page.test.tsx" `
  src/router.tsx src/router.test.tsx src/app/not-found.tsx `
  "src/app/(template)/template/(main)/dashboard/_components/sidebar/app-sidebar.tsx"
```

The parenthesised paths are quoted because the default shell on the GitHub Windows runner is PowerShell.

A successful `npm run tauri build` writes its output here:

| Artifact | Path |
| --- | --- |
| Application | `src-tauri/target/release/stashly.exe` |
| Windows installer | `src-tauri/target/release/bundle/nsis/Stashly_0.1.0_x64-setup.exe` |
| macOS bundle / disk image | `src-tauri/target/release/bundle/macos/Stashly.app`, `.../dmg/*.dmg` (macOS hosts only) |

Tauri filters `bundle.targets` down to what the host can actually produce before bundling, so `["nsis","dmg","app"]` becomes `[nsis]` on Windows and `[app, dmg]` on macOS. The installer is unsigned, so Windows SmartScreen warns on other machines. `src-tauri/target/` is git-ignored and does not rebuild itself — run `npm run tauri build` after every frontend change.

## Evidence status

Phase 1's verification record, including the deferred items handed to later phases, is [`docs/verification/phase-1/00-summary.md`](docs/verification/phase-1/00-summary.md).

| Claim | Evidence |
| --- | --- |
| Typecheck, 150/150 frontend tests, scoped Biome over 38 files, 64/64 Rust tests, and `cargo clippy --all-targets -- -D warnings` | Captured command logs at commit `b14b9ce`, all exit 0 |
| The vault layout above | Direct filesystem listing: `db\stashly.db` plus WAL/SHM, and an empty `files\` |
| Tauri resolves the Roaming `%APPDATA%` root | Observed on disk, with `npm run tauri -- info` exit 0 and no identifier warning |
| Windows installer | ✅ **Evidenced.** A controller-run `npm run tauri build` after `be1bfbe` exited 0 and wrote `src-tauri/target/release/stashly.exe` (9,185,280 B) and `src-tauri/target/release/bundle/nsis/Stashly_0.1.0_x64-setup.exe` (5,500,433 B, modified 2026-09-13 19:14:57). The installer itself was never run — installing it and launching from it is still part of the manual walkthrough below. |
| The R-01 and R-02 manual walkthroughs | ❌ **Not executed.** No native window was driven, so no probe record, no restart-persistence check, and no screenshots exist. The four planned screenshots were not produced and no placeholders were committed. |
| macOS | ❌ **Unverified.** This is a Windows host with only `x86_64-pc-windows-msvc` installed and no macOS toolchain, so no `.app` or `.dmg` can be built here. The `macos-latest` arm of `.github/workflows/build.yml` is the only macOS evidence path, and it has not been run. |
| CI | 🟨 Configured and locally validated, never executed. No workflow run exists for this branch. |

## Prerequisites

Windows (primary target): Node.js 20.19+, Rust stable with the MSVC target, Microsoft C++ Build Tools with **Desktop development with C++**, and the WebView2 runtime. The full checklist is at <https://v2.tauri.app/start/prerequisites/>.

macOS: the Tauri prerequisites plus the Xcode toolchain. The configuration supports it and CI is set up to build it, but **no macOS binary has been produced or run**.

## Known follow-ups

- **The bundle is one large chunk** (~2.55 MB JS, ~696 kB gzipped) because every template demo page is imported eagerly in `src/router.tsx`. Splitting the `/template` routes behind `React.lazy` would cut startup parse time.
- **React Compiler is not enabled.** The template used it through a Babel pipeline; enabling it here means adding `babel-plugin-react-compiler` to the React plugin config.
- **Two demo pages use the network**: the Logistics map fetches a world-atlas GeoJSON from jsDelivr, and the Profile page loads a GitHub avatar. Stashly's own routes are fully offline.
- **Phase 2 carries a migration obligation**: `migrate` walks `PRAGMA user_version` forward with `while version < SCHEMA_VERSION`, so a database *newer* than the binary is currently accepted silently. The author of the v2 migration must add a `version > SCHEMA_VERSION` guard before that loop — see the deferral table in the Phase 1 summary.

## Credits and license

The frontend is built on **Studio Admin** by [arhamkhnz](https://github.com/arhamkhnz/next-shadcn-admin-dashboard), via [iChicoRito/NextJS-Shadcn-Template](https://github.com/iChicoRito/NextJS-Shadcn-Template). Its license is kept in `LICENSE`.
