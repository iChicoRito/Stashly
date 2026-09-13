# Stashly Desktop Starter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a beginner-friendly Stashly Tauri 2 desktop starter with a Windows NSIS installer.

**Architecture:** Use the official React TypeScript Tauri scaffold, Tailwind CSS 4 through Vite, and copied shadcn/ui primitives. Keep native Rust minimal and all starter interactions in typed React memory.

**Tech Stack:** Tauri 2, Rust stable, React, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, Vitest, Testing Library, npm.

**Spec:** `docs/superpowers/specs/2026-06-18-stashly-desktop-starter-design.md`

## Global Constraints

- Use latest stable mutually compatible releases at implementation time and commit `package-lock.json`.
- Product and window title: `Stashly`; identifier: `com.stashly.app`.
- Main window: centered, resizable, 1200×760 default, approximately 800×560 minimum.
- Vite/Tauri dev URL: `http://127.0.0.1:1420` with a strict port.
- Windows installer target: NSIS only.
- No authentication, APIs, cloud, database, persistence, router, state library, custom Rust command, signing, updater, or analytics.
- Use system fonts, monochrome semantic tokens, Lucide icons, visible focus, keyboard support, and reduced-motion handling.
- Feature behavior is implemented test-first; generated scaffolding and configuration are exempt.

---

### Task 1: Scaffold and UI Tooling

**Files:**
- Create/modify: root Vite/npm/TypeScript files, `components.json`, `src/index.css`, `src/components/ui/*`, `src/lib/utils.ts`, `src-tauri/*`

**Interfaces:**
- Produces: installable npm project, Vite alias `@` → `src`, shadcn Button/Card/Input/Dialog/Table, Tauri build hooks and window configuration.

- [ ] Scaffold the official Tauri 2 `react-ts` npm project in the current directory and remove demo content.
- [ ] Install latest stable mutually compatible Tailwind/shadcn/testing dependencies.
- [ ] Configure Tailwind CSS 4, aliases, strict Vite port 1420, Vitest jsdom setup, and monochrome CSS variables.
- [ ] Initialize shadcn/ui and add Button, Card, Input, Dialog, and Table source components.
- [ ] Configure Tauri for `Stashly`, `com.stashly.app`, 1200×760 centered resizable window, minimum 800×560, and NSIS only.
- [ ] Run dependency and configuration checks and commit.

### Task 2: Application Features via TDD

**Files:**
- Create: `src/data/stash-items.ts`, `src/components/app-shell.tsx`, `src/components/app-sidebar.tsx`, `src/components/app-header.tsx`, `src/components/add-item-dialog.tsx`, `src/pages/dashboard-page.tsx`, `src/pages/settings-page.tsx`, tests
- Modify: `src/App.tsx`, `src/main.tsx`, `src/index.css`

**Interfaces:**
- Consumes: shadcn primitives and `@` alias from Task 1.
- Produces: `type Page = "dashboard" | "settings"`, accessible two-page shell, in-memory inventory interactions, and session-only settings.

- [ ] Write and run failing shell/navigation tests.
- [ ] Implement the typed App shell, sidebar, header, skip link, and page switching; run tests green.
- [ ] Write and run failing Dashboard search/no-results tests.
- [ ] Implement typed sample records, derived Cards, labeled search, and semantic Table; run tests green.
- [ ] Write and run failing Dialog validation/create/reset tests.
- [ ] Implement the controlled Add item Dialog and in-memory append flow; run tests green.
- [ ] Write and run failing Settings editing/save-feedback test.
- [ ] Implement session-only Settings Cards and save feedback; run all tests green.
- [ ] Refactor only after green, run `npm test -- --run` and `npm run build`, then commit.

### Task 3: Native Prerequisites, Documentation, and Release Verification

**Files:**
- Modify: `README.md`; native config only if verification exposes a real defect.

**Interfaces:**
- Consumes: complete frontend and Tauri configuration.
- Produces: documented commands, verified development workflows, and Windows NSIS artifact.

- [ ] Install/check Rust stable, `x86_64-pc-windows-msvc`, Visual Studio C++ Build Tools workload, Windows SDK, and WebView2.
- [ ] Verify `rustc --version`, `cargo --version`, MSVC availability, `cargo check`, and `npm run tauri info`.
- [ ] Run `npm run tauri dev` as a managed process and verify the native Stashly window and core interactions without console/Rust errors.
- [ ] Run `npm run tauri build` and confirm the release executable and NSIS `setup.exe` paths and sizes.
- [ ] Write `README.md` with prerequisites, project structure, current installed versions, commands for install/browser dev/native dev/web build/Windows build, output path, state-reset note, unsigned-build note, and macOS/Linux prerequisite links.
- [ ] Run the complete frontend/native verification set again and commit.
