# Stashly Desktop Starter Design

## Purpose

Stashly is a beginner-friendly, local-first desktop starter that demonstrates a clean Tauri application shell without committing to a backend or persistence model. Its initial subject is a personal stash organizer: users can browse sample inventory, filter it, add an item for the current session, and edit session-only settings.

## Scope

The project uses the latest stable mutually compatible releases available at implementation time of Tauri 2, React, TypeScript, Vite, Tailwind CSS, and shadcn/ui. It targets Windows first while keeping frontend and Tauri configuration portable to macOS and Linux.

Included:
- React + TypeScript + Vite frontend.
- Thin Tauri 2 native shell with one resizable window.
- Tailwind CSS 4 through the official Vite plugin.
- shadcn/ui Button, Card, Input, Dialog, and Table components.
- Sidebar, shared header, Dashboard, and Settings pages.
- In-memory sample data and interactions.
- Frontend tests, production build verification, native development verification, and a Windows NSIS installer.

Excluded:
- Authentication, cloud services, APIs, databases, persistent storage, auto-update, signing, analytics, routing libraries, and custom Rust commands.

## Architecture

The official `create-tauri-app` React TypeScript template supplies the supported Tauri/Vite baseline. npm is the only package manager. Vite builds the web assets consumed by Tauri; the Rust layer remains the generated minimal entry point.

`App.tsx` owns a typed `"dashboard" | "settings"` page state. `AppShell` composes the sidebar, header, and main content. Dashboard and Settings are focused page components. Static typed data lives in a small data module. Added items and edited settings exist only in React state and reset when the process closes.

shadcn/ui components are copied into `src/components/ui` and remain editable project source. No full dashboard block is imported because the requested two-page starter is smaller and clearer when composed from primitives.

## Interface Design

The visual direction is a monochrome inventory ledger:
- Warm-white application canvas and white cards.
- Near-black text and primary actions.
- Cool-gray borders and muted surfaces.
- Restrained radii and shadows.
- System UI fonts for offline, cross-platform reliability.
- Lucide outline icons with consistent sizing.
- Tabular figures in inventory cells.

The signature element is a narrow indexed sidebar rail paired with ledger-like table rules. The rest of the interface remains quiet and functional. A 4/8px spacing rhythm and compact desktop density keep the application useful at 1200×760.

The sidebar contains icon-and-text controls for Dashboard and Settings with a visible active state. At narrow supported widths, it compacts while retaining accessible names. The header names the current page and shows Add item only on Dashboard.

## Dashboard

The Dashboard contains summary Cards derived from deterministic sample inventory, a labeled search Input, and an inventory Table. Search is case-insensitive, trims surrounding whitespace, and matches item name, category, or location. No results produces a useful empty row and Clear search action.

An Add item Button opens a shadcn Dialog with visible labels for name, category, and location. Empty or whitespace-only fields are rejected after submission with inline errors. A valid submission appends an in-memory row, closes and resets the dialog, and updates derived Dashboard content.

## Settings

Settings uses Cards, labeled Inputs, helper text, and a Save changes Button. Values and save feedback are local to the current session. The interface explains that values reset when Stashly closes.

## Accessibility and Interaction

- Sequential heading hierarchy and semantic table headers.
- Skip-to-content link and focusable main region.
- DOM/tab order follows the visual order.
- Visible focus indicators and keyboard-operable navigation.
- `aria-current="page"` on active navigation.
- Visible form labels, connected inline errors, and dialog focus management.
- Decorative icons are hidden from assistive technology when adjacent to visible text.
- Normal text meets at least WCAG AA contrast.
- Motion is limited to short state transitions and disabled or reduced under `prefers-reduced-motion`.
- Text wraps rather than forcing horizontal overflow.

## Tauri and Bundling

The application product name and window title are `Stashly`; the identifier is `com.stashly.app`. The centered main window defaults to 1200×760, is resizable, and has a conservative minimum near 800×560.

Tauri uses:
- `beforeDevCommand`: `npm run dev`
- `beforeBuildCommand`: `npm run build`
- `devUrl`: `http://127.0.0.1:1420`
- `frontendDist`: `../dist`

The Vite port is strict to prevent Tauri from connecting to an unintended server. Windows bundling targets NSIS only. MSI, signing, elevation, updater, and Store-specific configuration are excluded.

## Verification

Frontend tests cover initial rendering, page navigation, filtering, empty search results, dialog cancellation/validation/item creation/reset, and Settings save feedback. Verification runs the frontend tests, TypeScript/Vite build, Cargo check, Tauri info, native Tauri development application, and Tauri release build. The Windows acceptance artifact is an unsigned NSIS `setup.exe` under `src-tauri/target/release/bundle/nsis/`.

Windows native prerequisites are Rust stable with `x86_64-pc-windows-msvc`, Microsoft C++ Build Tools with Desktop development with C++, a Windows SDK, and WebView2. macOS and Linux portability is documented but binaries are not cross-built on Windows.
