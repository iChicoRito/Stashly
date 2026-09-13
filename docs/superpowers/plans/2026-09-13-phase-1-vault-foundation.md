# Phase 1 — Cross-platform local foundation and first-run vault setup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stashly opens on Windows and macOS, creates a local vault (SQLite records + a vault folder of files), persists completed setup, and skips onboarding on every later launch.

**Architecture:** Rust owns all storage behind named Tauri commands (`rusqlite` + a versioned schema); a single frontend module (`src/lib/vault/api.ts`) is the only code that imports `@tauri-apps/api`. An `OnboardingGate` at each Stashly route calls `vault_get_state` and routes to the wizard or the Dashboard without remounting.

**Tech Stack:** Tauri 2.11.5, Rust (rusqlite 0.40 bundled, argon2 0.5, serde), React 19 + TypeScript, Vite 8, Shadcn UI, Tailwind v4, zustand, vitest + Testing Library.

**Roadmap:** `ANALYSIS - STASHLY DESKTOP APP/05 - ROADMAP.md` §"Phase 1", capabilities **R-01** and **R-02**.

**Approval-gate note (deviation from `brainstorming`):** the skill's architectural path wants a standalone spec committed to `docs/superpowers/specs/`. Execution is gated on this plan document, which already carries the decisions, schema, IPC contract, and acceptance criteria — a second document would duplicate it. Not writing `task_plan.md`/`findings.md`/`progress.md` either; the SDD ledger at `.superpowers/sdd/<plan>/progress.md` is the execution record.

---

## 1. Verified starting state

Everything below was read, not assumed.

| Fact | Evidence |
|---|---|
| Tauri 2.11.5, `tauri` features `[]`, no plugins | `src-tauri/Cargo.lock`, `Cargo.toml` |
| **Zero** `#[tauri::command]` in the repo; `lib.rs` is the stock 8-line template | `src-tauri/src/lib.rs` |
| **Zero** SQLite crates; no `rusqlite`/`libsqlite3-sys`/`plugin-sql` in the lock | recon |
| `@tauri-apps/api` **absent** from `package.json`, lock, and `node_modules` | recon |
| Capabilities grant only `core:default` | `src-tauri/capabilities/default.json` |
| `bundle.targets: ["nsis"]` — Windows-only | `src-tauri/tauri.conf.json` |
| Host is Windows; only `x86_64-pc-windows-msvc` target installed | `rustc -vV`, `rustup target list --installed` |
| Windows build path proven: `target/release/stashly.exe` + `Stashly_0.1.0_x64-setup.exe` exist; `dist/` present | recon |
| `src/app/(app)/` is a session-only demo prototype (`sampleStashItems`, hardcoded `"Jun 18, 2026"`) | `src/stores/stash/stash-store.ts`, `src/components/stash/add-item-dialog.tsx:61` |
| Hash router; `PreferencesStoreProvider` wraps every route; no route guard anywhere | `src/router.tsx`, `src/app/layout.tsx` |
| Shadcn has `field`, `empty`, `sidebar`, `switch`, `progress`, `alert`; theme via `radix-ui` | `src/components/ui/` (55 files) |
| Biome lints new `src/**` with `useSortedClasses`, kebab-case filenames, `noNestedComponentDefinitions`, `noFloatingPromises`, `noUndeclaredDependencies` | `biome.json` (`src/components/ui` is excluded) |
| `sidebar-items.test.ts` locks group 0 to exactly `Inventory → /`, `Settings → /settings` | `src/navigation/sidebar/sidebar-items.test.ts` |

## 2. Decisions taken (confirmed with the user)

| # | Decision | Rationale |
|---|---|---|
| D1 | **Custom Rust commands over `rusqlite` (bundled)** — no `tauri-plugin-sql` | Phase 5 (backup, relocation, encryption) and Q-10's coordinated record+file writes need one Rust-side seam; keeps raw SQL and absolute paths out of the webview. |
| D2 | **Vault root = Tauri `app_data_dir()`** (`%APPDATA%\com.stashly.app` on Windows, `~/Library/Application Support/com.stashly.app` on macOS) | T-01 hides storage paths and says "default local application storage"; `C:\Users\marka\AppData\Local\com.stashly.app` already exists on this machine, so Tauri's real resolution must be *verified*, not assumed (see Task 5). Phase 5 relocation moves this one directory. |
| D3 | **Delete the `stash` prototype**; real Dashboard at `/` | Demo rows would contradict a fresh vault, and Phase 2's item model (R-03/R-04) replaces it. |
| D4 | **Hash the optional master password with Argon2id now; no locking** | R-02's password step and completion screen become real; the hash + salt columns are exactly what R-17 needs. |
| D5 | E2E and macOS evidence limits are **documented, not faked** | macOS cannot be built on this host. This is a stated Phase 1 constraint, resolved in Task 12. |

## 3. Global constraints

- **Stack:** `tauri` 2 (already 2.11.5), React 19 + TypeScript, Vite 8, Shadcn UI, SQLite. No new frontend framework, no ORM, no state-persistence library.
- **New Rust deps (exact):** `rusqlite = { version = "0.40", features = ["bundled"] }`, `argon2 = "0.5"`, `serde = { version = "1", features = ["derive"] }`, `serde_json = "1"`, `rand = "0.8"`. `bundled` is mandatory — it compiles SQLite in, which is what makes one build work on Windows and macOS.
- **New JS dep (exact):** `@tauri-apps/api@^2.11.0` (latest 2.11.1; CLI is 2.11.4).
- **Storage split (D-07):** SQLite holds records; `<vault_root>/files/` holds documents and attachments. They never mix.
- **Onboarding rules (T-01):** user name is required and blocks progress when empty; vault name, starter collections, and master password are all skippable; storage is automatic and disclosed as `● This Device`; no theme, backup, import/export, shortcuts, search tutorial, storage path, advanced security, technical database, cloud, or advanced preference controls appear anywhere in the wizard.
- **Lint/format:** kebab-case filenames, double quotes, semicolons, 2-space indent, 120-col, import order `react` → packages → `@/…` → relative, Tailwind classes sorted.
- **Error contract:** the frontend **never** treats an IPC failure as "no vault exists". `not_initialized` is the only signal that means "show onboarding"; every other failure shows a retry screen.
- **Never log or return the master password** (plaintext or hash) to the frontend.

## 4. Architecture

```
React route tree (hash router)
  ├─ /onboarding/*   → OnboardingGate → OnboardingWizard → 5 steps → completion screen
  ├─ /              → OnboardingGate → DashboardPage
  └─ /settings      → OnboardingGate → SettingsPage

src/lib/vault/api.ts   ← the ONLY module that imports @tauri-apps/api
        │  invoke("vault_get_state" | "vault_complete_onboarding" | "dev_storage_probe_*")
        ▼
src-tauri/src/vault.rs (#[tauri::command])
  ├─ db.rs          → AppState { conn: Mutex<Connection> }, PRAGMA user_version migrations
  ├─ vault_repo.rs  → settings KV + collections, all in transactions
  └─ vault_paths.rs → <app_data_dir>/db/stashly.db, <app_data_dir>/files/

src/stores/vault/vault-store.ts   ← boot + refresh (zustand, module-level)
src/stores/onboarding/onboarding-store.ts ← step + draft + validation (zustand, module-level)
src/stores/onboarding/onboarding-schema.ts ← pure, unit-tested validation
```

### 4.1 Database schema (migration `user_version = 1`)

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS collections (
  id         INTEGER PRIMARY KEY,
  slug       TEXT    NOT NULL UNIQUE,
  name       TEXT    NOT NULL,
  created_at TEXT    NOT NULL,
  is_starter INTEGER NOT NULL DEFAULT 0
) STRICT;
```

Settings keys: `onboarding_completed` (`"0"`/`"1"`), `user_name`, `vault_name`, `storage_mode` (`"local"`), `protection_enabled`, `password_salt`, `password_hash`, `schema_note`.
Timestamps are ISO-8601 UTC text written by SQLite's `strftime('%Y-%m-%dT%H:%M:%fZ','now')` (no chrono dependency; the frontend formats with `date-fns`, already installed).

`STRICT` tables + `PRAGMA user_version` give Phase 2+ a clean forward-migration path.

### 4.2 IPC contract (frozen — frontend and Rust must agree exactly)

```ts
// src/lib/vault/types.ts
export type StorageMode = "local";

export interface VaultIdentity { userName: string; vaultName: string; }
export interface VaultCollection { id: number; slug: string; name: string; createdAt: string; isStarter: boolean; }
export type VaultStartup =
  | { status: "not_initialized" }
  | { status: "ready";
      user_name: string; vault_name: string; storage_mode: StorageMode;
      protection_enabled: boolean; onboarding_completed_at: string; collections: VaultCollection[]; };
export interface OnboardingSubmission {
  userName: string;            // required, trimmed, non-empty
  vaultName: string | null;    // null → derive `${userName}'s Stash`
  starterCollections: string[];// may be empty; each name is the collection name, slug derived
  masterPassword: string | null;
}
export interface StorageProbeResult {
  dbRecordId: number; dbRecordLabel: string; dbRecordCreatedAt: string;
  dbPath: string; vaultRoot: string; filePath: string; fileName: string; fileBytes: number;
}
```

| Command | Argument | Returns | Errors |
|---|---|---|---|
| `vault_get_state` | — | `VaultStartup` | `not_initialized` \| `db` \| `internal` |
| `vault_complete_onboarding` | `{ submission }` (`camelCase` on the wire; `#[serde(rename_all = "camelCase")]`) | `{ status: "ready", … }` | `validation`, `db` |
| `vault_probe_write` *(debug only)* | `{ label }` | `StorageProbeResult` | `io`, `db` |
| `vault_probe_read` *(debug only)* | `{ limit?: number }` | `{ records, files }` | `db`, `io` |
| `vault_probe_paths` *(debug only)* | — | `{ vaultRoot, dbPath, filesDir }` | `internal` |

Error shape crossing the boundary: `{ code, message }` where `code ∈ {not_initialized, validation, db, io, internal}`. Frontend `VaultCommandError extends Error` carries `code`.

## 5. File structure

**Rust (create)** — `src-tauri/src/error.rs`, `db.rs`, `vault_paths.rs`, `vault_repo.rs`, `vault.rs`, `dev_storage.rs`.
**Rust (modify)** — `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`.
**TS (create)** — `src/lib/vault/{types,error,api}.ts`, `src/stores/vault/vault-store.ts`, `src/stores/onboarding/{onboarding-schema,onboarding-store}.ts`, `src/components/onboarding/{onboarding-gate,onboarding-wizard,review-step,starter-collections}.tsx` + `steps/{welcome,identity,collections,protection,complete}-step.tsx`, `src/app/(app)/dev/storage/page.tsx`, `src/components/dev/storage-probe-card.tsx`.
**TS (modify)** — `vitest.config.ts`, `package.json`, `src/router.tsx`, `src/app/(app)/page.tsx`, `src/app/(app)/settings/page.tsx`, `src/navigation/sidebar/sidebar-items.ts`, `src/navigation/sidebar/sidebar-items.test.ts`, `src/app/not-found.tsx`, `src/app/(template)/…/sidebar/app-sidebar.tsx` (brand link only), `src/config/app-config.ts` (delete the `src/server/` empty dir).
**TS (delete)** — `src/app/(app)/layout.tsx`, `src/data/stash-items.ts`, `src/stores/stash/*`, `src/components/stash/*`, `src/server/`.

---

## 6. Task breakdown

Execution order is 1 → 12; each task ends with an independently testable deliverable and its own commit.

### Task 1 — Toolchain plumbing: make the JS layer able to reach Rust

Folds dependency install, IPC wrapper, and its test into one reviewable unit.

**Files:** `package.json`, `src-tauri/Cargo.toml`, `src/lib/vault/types.ts`, `src/lib/vault/error.ts`, `src/lib/vault/api.ts`, `src/lib/vault/vault-api.test.ts`, `vitest.config.ts`.

- [ ] Install JS dep: `npm i @tauri-apps/api@^2.11.0`. Add Rust deps to `src-tauri/Cargo.toml` `[dependencies]`: `rusqlite = { version = "0.40", features = ["bundled"] }`, `argon2 = "0.5"`, `serde = { version = "1", features = ["derive"] }`, `serde_json = "1"`, `rand = "0.8"`.
- [ ] Write `src/lib/vault/types.ts` exactly as §4.2.
- [ ] Write the failing test `vault-api.test.ts`. `vitest.config.ts` gets an explicit alias so `vi.mock("@tauri-apps/api/core")` resolves inside `api.ts`:
  ```ts
  resolve: { alias: { "@": path.resolve(process.cwd(), "src"), "@tauri-apps/api/core": path.resolve(process.cwd(), "src/test/mocks/tauri-core.ts") } }
  ```
  with `src/test/mocks/tauri-core.ts` exporting `export const invoke = vi.fn()`. (Mocking at the module alias keeps `api.ts` unchanged and is more faithful than injecting a fake transport.)
  ```ts
  import { beforeEach, describe, expect, test, vi } from "vitest";
  import { invoke } from "@tauri-apps/api/core";
  import { VaultCommandError, getVaultStartup, completeOnboarding } from "@/lib/vault/api";

  vi.mock("@tauri-apps/api/core", async () => await import("@/test/mocks/tauri-core"));

  const invokeMock = vi.mocked(invoke);
  // A block body, not `() => invokeMock.mockReset()`: the concise arrow RETURNS the mock, and
  // vitest treats a value returned from a hook as teardown, so it would call `invoke()` for real
  // after every test. Any `mockRejectedValue` still configured then surfaces as an unhandled
  // rejection attributed to a test whose assertions are actually correct.
  beforeEach(() => {
    invokeMock.mockReset();
  });

  test("returns the not_initialized startup state unchanged", async () => {
    invokeMock.mockResolvedValue({ status: "not_initialized" });
    await expect(getVaultStartup()).resolves.toEqual({ status: "not_initialized" });
    expect(invokeMock).toHaveBeenCalledWith("vault_get_state");
  });

  test("maps a structured Rust rejection to VaultCommandError with its code", async () => {
    invokeMock.mockRejectedValue({ code: "db", message: "unable to open database file" });
    await expect(getVaultStartup()).rejects.toMatchObject({ name: "VaultCommandError", code: "db" });
  });

  test("never reports a failed call as not_initialized", async () => {
    invokeMock.mockRejectedValue("boom");
    await expect(getVaultStartup()).rejects.toBeInstanceOf(VaultCommandError);
  });

  test("passes the onboarding submission through as camelCase", async () => {
    invokeMock.mockResolvedValue({ status: "ready" });
    await completeOnboarding({ userName: "Mark Adrianne", vaultName: null, starterCollections: ["Projects"], masterPassword: null });
    expect(invokeMock).toHaveBeenCalledWith("vault_complete_onboarding", {
      submission: { userName: "Mark Adrianne", vaultName: null, starterCollections: ["Projects"], masterPassword: null },
    });
  });
  ```
- [ ] Run `npm test -- src/lib/vault/vault-api.test.ts` → FAIL (module missing).
- [ ] Implement `error.ts` (`VaultCommandError extends Error` with `code: VaultErrorCode`, plus `toVaultCommandError(raw: unknown)`), then `api.ts` with **all five** command wrappers — `getVaultStartup`, `completeOnboarding`, `writeStorageProbe`, `readStorageProbe`, `getStorageProbePaths` — since each is a two-line `invoke` wrapper and splitting them across tasks would only create a second writer of one file. Every one wraps `invoke` in try/catch and rethrows via `toVaultCommandError`. `api.ts` stays unconditional (no environment check); deciding "no Tauri here" is the store's job in Task 8, and the module is always mocked in tests.
- [ ] Run the test → PASS. Then `npm run typecheck` and `npx biome check src/lib/vault` → clean.
- [ ] **Commit:** `feat(vault): add the typed Tauri IPC layer for vault commands`

### Task 2 — Rust core: error type, connection, migrations

**Files:** `src-tauri/src/error.rs`, `src-tauri/src/db.rs`, `src-tauri/src/lib.rs` (module decls only).

- [ ] Failing tests in `db.rs` `#[cfg(test)]`: `in_memory()` opens a schema at `user_version = 1`; `app_settings` and `collections` exist and are STRICT; calling `migrate()` twice is a no-op (`user_version` stays 1 and no data is lost). **Do not assert that `journal_mode` is `wal` on an in-memory database** — SQLite silently keeps `memory` mode for `:memory:` databases and cannot use WAL without a file. Assert WAL only in the file-backed test, where it is genuinely true.
- [ ] `cargo test` in `src-tauri` → FAIL.
- [ ] Implement `error.rs`:
  ```rust
  #[derive(Debug)]
  pub enum VaultError { NotInitialized, Validation(String), Db(String), Io(String), Internal(String) }
  impl VaultError { pub fn code(&self) -> &'static str { /* not_initialized|validation|db|io|internal */ } }
  impl serde::Serialize for VaultError { /* serialize_struct("VaultError", 2) -> code, message */ }
  impl std::fmt::Display for VaultError { /* message() */ }
  impl std::error::Error for VaultError {}
  impl From<rusqlite::Error> for VaultError { /* => Db */ }
  impl From<std::io::Error> for VaultError { /* => Io */ }
  pub type VaultResult<T> = Result<T, VaultError>;
  ```
- [ ] Implement `db.rs`: `pub struct AppState { pub conn: Mutex<Connection> }` (a `std::sync::Mutex` — commands stay synchronous, so Tauri runs them off the main thread without an async runtime requirement); `pub const SCHEMA_VERSION: i64 = 1;`; `pub fn open(path: &Path) -> VaultResult<Connection>` (creates parent dirs, sets `PRAGMA foreign_keys = ON` and `journal_mode = WAL`); `pub fn migrate(conn: &Connection) -> VaultResult<()>` reading `PRAGMA user_version` and applying version 1 in a transaction; `#[cfg(test)] pub fn in_memory() -> VaultResult<Connection>`.
- [ ] `cargo test` → PASS.
- [ ] **Commit:** `feat(vault): add the Rust error type, connection, and versioned schema`

### Task 3 — Rust core: vault paths and the settings/collections repository

**Files:** `src-tauri/src/vault_paths.rs`, `src-tauri/src/vault_repo.rs`.

- [ ] Failing tests in `vault_repo.rs` (`#[cfg(test)]`, using `db::in_memory()` and a temp dir from `std::env::temp_dir().join(format!("stashly-test-{}", <unique>))`):
  - `set_setting`/`get_setting` round-trips and overwrites (upsert).
  - `create_collections` inserts the given names and returns them sorted by name.
  - `create_collections` called twice with the same names leaves the row count unchanged and does not change the first `created_at` (idempotent by slug).
  - `save_onboarding` writes all settings **and** collections **and** `onboarding_completed=1` in one transaction; with a deliberately over-long user name (5000 chars) the whole call fails as `Validation` and **no** settings row was created (proves atomicity). Validation happens **before** the transaction opens, so no write can leak.
  - `save_onboarding` accepts its already-validated submission without re-validating; the 8-character password minimum is enforced in `validate_submission` (Task 4), not here. Repository tests call `save_onboarding` with an already-valid submission and assert the resulting rows, not the rejection path.
  - `vault_state` on an empty DB returns `None` (not an error); after `save_onboarding` it returns the name, derived vault name, `protection_enabled`, and collections.
  - `hash_master_password` produces a PHC string starting `$argon2id$`, differs across two calls for the same password (distinct salts), and `verify_master_password` accepts the right password and rejects a wrong one.
  - `derive_vault_name("Mark Adrianne") == "Mark Adrianne's Stash"`; `derive_vault_name("  Mark  ") == "Mark's Stash"`; an empty name yields `"My Stash"`.
  - `slugify("Learning & References") == "learning-references"`; `slugify("Personal Documents") == "personal-documents"`; two names slugifying identically keep both rows by suffixing `-2`.
- [ ] `cargo test` → FAIL.
- [ ] Implement `vault_paths.rs`: `pub struct VaultPaths { pub root: PathBuf, pub db: PathBuf, pub files: PathBuf }` with `pub fn resolve(app_data_dir: &Path) -> VaultPaths` (`root/<db>/stashly.db`, `root/files/`) and `pub fn ensure(&self) -> VaultResult<()>` (`create_dir_all` on all three).
- [ ] Implement `vault_repo.rs`: `get_setting`/`set_setting`/`get_settings_page`, `vault_state(conn) -> VaultResult<Option<VaultStartup>>`, `save_onboarding(conn, submission) -> VaultResult<VaultStartup>`, `list_collections`, `create_collections`, `slugify`, `derive_vault_name`, `hash_master_password`, `verify_master_password`, and `list_probe_records(conn, limit)` / `insert_probe_record(conn, label)` over the same `app_settings` table (keys `probe.<n>.label` / `probe.<n>.created_at`, so no schema change is needed for the R-01 probe).
- [ ] `cargo test` → PASS. `cargo clippy -- -D warnings` → clean.
- [ ] **Commit:** `feat(vault): add the settings and collections repository with argon2 password hashing`

### Task 4 — Rust commands + wire the builder

**Files:** `src-tauri/src/vault.rs`, `src-tauri/src/lib.rs`.

- [ ] Failing test in `vault.rs`: `validate_submission` rejects an empty / whitespace-only `userName` as `Validation`, accepts a `None` vault name, accepts an empty `starterCollections`, rejects a `masterPassword` shorter than 8 characters and one over 1024, and accepts a submission with no password. (Pure function, no Tauri runtime needed.)
- [ ] `cargo test` → FAIL.
- [ ] Implement `vault.rs`: `#[derive(Deserialize)] #[serde(rename_all = "camelCase")] pub struct OnboardingSubmission`, `#[derive(Serialize)] #[serde(rename_all = "camelCase")] pub struct VaultStartupResponse` shaped exactly per §4.2, and the `#[tauri::command]` functions `vault_get_state`, `vault_complete_onboarding`. Both take `State<'_, AppState>`, lock the mutex, and map a poisoned lock to `VaultError::Internal("vault state lock poisoned")`.
- [ ] Rewrite `src-tauri/src/lib.rs`:
  ```rust
  pub fn run() {
      tauri::Builder::default()
          .setup(|app| {
              let root = app.path().app_data_dir()?;      // D2: verified, not assumed (Task 5)
              let paths = VaultPaths::resolve(&root);
              paths.ensure()?;
              let conn = db::open(&paths.db)?;
              db::migrate(&conn)?;
              app.manage(AppState { conn: Mutex::new(conn) });
              Ok(())
          })
          .invoke_handler(tauri::generate_handler![
              vault::vault_get_state,
              vault::vault_complete_onboarding,
          ])
          .run(tauri::generate_context!())
          .expect("error while running tauri application");
  }
  ```
  A failed `open`/`migrate` aborts startup loudly rather than degrading silently.
- [ ] `cargo build` → compiles. `cargo test` → PASS.
- [ ] **Commit:** `feat(vault): expose vault commands over Tauri IPC`

### Task 5 — Verify the real on-disk state against Tauri's actual path resolution

**Files:** `src-tauri/src/vault_paths.rs` tests.

This task exists because D2 assumes `app_data_dir()` resolves to a locally-created directory. That assumption must be observed, not inferred.

- [ ] Add `vault_paths.rs` unit tests using `std::env::temp_dir()` proving `resolve()` yields `root/db/stashly.db` and `root/files`, and `ensure()` creates all three.
- [ ] Launch the built app and observe the **actual** on-disk result directly — this task deliberately does not depend on Task 6's debug panel. Run `npm run tauri dev`, then from a separate shell list `<APPDATA>\com.stashly.app`, `<LOCALAPPDATA>\com.stashly.app`, and `<LOCALAPPDATA>\com.stashly.app\db`, and record which one holds `stashly.db`. (Recon found `C:\Users\marka\AppData\Local\com.stashly.app` already present; Tauri 2's `app_data_dir` resolves through `dirs::data_dir`, so it may be the Roaming `%APPDATA%` variant instead. Whichever it is, the confirmed value goes into Task 12's docs and into a `Ruling:` ledger line.)
- [ ] Re-run the app and confirm the same DB row survives, proving the path is stable across launches.
- [ ] **Commit:** `test(vault): prove the resolved vault path layout`

### Task 6 — Debug-only storage probe (R-01's owner of the file half)

**Files:** `src-tauri/src/dev_storage.rs`, `src-tauri/src/lib.rs`, `src/components/dev/storage-probe-card.tsx`, `src/app/(app)/dev/storage/page.tsx`, `src/lib/vault/api.ts` (three probe calls), `src/router.tsx`.

- [ ] Add the three probe commands in `dev_storage.rs`, registered **only** in debug builds:
  - `vault_probe_write(label)` → inserts a `probe.<n>.label`/`probe.<n>.created_at` record, writes `<files>/probe-<yyyyMMdd-HHmmss>-<n>.txt` containing the label, `dbPath`, and `vaultRoot` (timestamped name, so a repeat never overwrites an earlier probe and persistence is observable), returning `StorageProbeResult`.
  - `vault_probe_read(limit)` → the last `limit` (default 10, max 50) probe records plus the `files/` listing (name, bytes, modified), sorted newest first.
  - `vault_probe_paths()` → `{ vaultRoot, dbPath, filesDir }`.
  Register them under `#[cfg(debug_assertions)]` so release builds cannot expose an arbitrary file writer, keeping the `invoke_handler` lists explicit per branch (no runtime flag).
- [ ] Rust test for `write_probe_file(dir, label, stamp)`: creates the directory if absent, returns the byte count, and calling it twice with different stamps leaves two files.
- [ ] Implement `storage-probe-card.tsx` (`Card` + two `Button`s: "Write test record and file" / "Reload from disk", a `Table` of probe records, a `Table` of files, and the three resolved paths in a `<dl>`). Use the existing `Empty` component for both empty lists, and render failures in an `Alert` with `role="alert"` showing `error.code` and `error.message`.
- [ ] Create the page at route `dev/storage` inside the `DashboardShell` group, and gate the sidebar entry to `import.meta.env.DEV` so it never appears in a release build.
- [ ] **Test:** `storage-probe-card.test.tsx` — mock `@/lib/vault/api`; assert (a) clicking write calls `writeStorageProbe` with the typed label and then re-reads, (b) the returned record and file names appear, (c) a rejected `writeStorageProbe` shows an alert containing the error code and does **not** clear the previously listed rows.
- [ ] `npm test`, `cargo test`, `npm run typecheck`, `npx biome check` → clean.
- [ ] **Commit:** `feat(dev): add a debug-only SQLite and vault-file storage probe`

### Task 7 — Onboarding validation and the wizard state store

**Files:** `src/stores/onboarding/onboarding-schema.ts`, `src/stores/onboarding/onboarding-store.ts`, tests for both.

- [ ] Write `onboarding-schema.test.ts` first:
  - `emptyDraft()` has `userName: ""`, `vaultName: ""`, `starterCollections: []`, `masterPassword: ""`, `confirmPassword: ""`.
  - `isStepComplete("identity", { userName: "   " })` is `false`; `isStepComplete("identity", { userName: " Mark " })` is `true`.
  - `isStepComplete("collections", …)` is `true` for zero selections and for three; `isStepComplete("protection", …)` is `true` for both empty password fields, `false` when the password is under 8 characters, and `false` when the two fields differ.
  - `toSubmission(draft)` trims the name, maps `""` → `null` for vault name and password, and copies the collections.
  - `derivedVaultName("Mark Adrianne") === "Mark Adrianne's Stash"` in the pure TS path too.
- [ ] Run → FAIL. Implement `onboarding-schema.ts` with those exports plus `STARTER_COLLECTION_OPTIONS` = the six T-01 categories in order (`Personal Documents`, `Projects`, `Work`, `Learning & References`, `Important Records`, `Images & Media`).
- [ ] Write `onboarding-store.test.ts`: `start()` sets step 0; `next()` refuses while the current step is incomplete (step stays put); `next()` advances when valid; `back()` is a no-op on step 0; `toggleCollection("Projects")` adds then removes; `setField` resets `submitting`/`error`; `submit()` on success sets `status: "complete"` and calls `completeOnboarding` once with the trimmed submission; `submit()` on a `VaultCommandError` leaves `status: "error"`, stores the message, and does not advance; a second `submit()` while `submitting` is true is ignored.
- [ ] Implement `onboarding-store.ts` (zustand `create`, module-level, mirroring the existing `src/stores/stash` reset style). Exports: `useOnboardingStore`, `ONBOARDING_STEPS = ["welcome","identity","collections","protection","complete"] as const`, `OnboardingStepId`, `OnboardingStatus = "idle" | "submitting" | "complete" | "error"`.
- [ ] `npm test` → PASS.
- [ ] **Commit:** `feat(onboarding): add wizard validation and state store`

### Task 8 — Gate, wizard, and the five steps

**Files:** `src/components/onboarding/onboarding-gate.tsx`, `onboarding-wizard.tsx`, `review-step.tsx`, `starter-collections.tsx`, `steps/*.tsx`, `src/stores/vault/vault-store.ts`, tests.

- [ ] `vault-store.test.ts` first: `boot()` sets `status: "loading"` then `"ready"` with the payload; a rejected `getVaultStartup()` sets `status: "unavailable"` with the error code and **never** `"ready"`/`"onboarding"`; `refresh()` re-reads after `completeOnboarding`.
- [ ] Implement `vault-store.ts` with `VaultStatus = "loading" | "ready" | "onboarding" | "unavailable"`.
- [ ] `onboarding-gate.test.tsx` (mock `@/lib/vault/api`):
  - `{status:"not_initialized"}` → onboarding header **"Everything important, in one place."** is rendered and the Dashboard heading is not.
  - `{status:"ready", userName:"Mark Adrianne", vaultName:"Mark's Stash", …}` → the Dashboard renders and onboarding does not appear again.
  - a rejected boot call → an `Alert` with `role="alert"` and a "Try again" button; **no** onboarding form is rendered.
  - `status:"loading"` → a `Skeleton`, neither onboarding nor Dashboard.
- [ ] Implement `onboarding-gate.tsx`: calls `boot()` once on mount, then switches on `vaultStatus`, rendering children when `ready`, `<OnboardingWizard />` when `onboarding`, the boot-failure alert when `unavailable`, and a `Skeleton` when `loading`.
- [ ] `identity-step.test.tsx`: the user-name field is required — clicking **Continue** with it empty shows the field error and does not advance; typing a name and clicking Continue advances to the collections step; the vault-name field is optional and its placeholder is derived from the typed name.
- [ ] `protection-step.test.tsx`: clicking **Skip for now** advances with no password; a password mismatch shows a field error; the show/hide toggle is a `Button` with `aria-pressed` and an accessible name that flips between "Show password" and "Hide password", and switching it changes both inputs' `type` between `password` and `text`; the "You can enable Vault Lock anytime from Settings → Security." note is present.
- [ ] `wizard.test.tsx`: renders each of the five steps in order, `← Back` returns to the previous step, **Create My Vault →** on the protection step calls `submit()` and, on success, the completion screen shows "Your Stash is ready." with the name, derived vault name, collection count (`3 Created` / `None yet`), `● This Device`, and `Enabled`/`Not Enabled` for vault protection; a failed submit keeps the wizard on the protection step and shows the error; **Open Stashly →** navigates to `/`. Also assert that no theme, backup, import/export, shortcut, search-tutorial, storage-path, advanced-security, technical-database, cloud, or advanced-preference control is rendered.
- [ ] Implement `onboarding-wizard.tsx` plus the five step components, `review-step.tsx` (the read-only summary `dl`), and `starter-collections.tsx` (six `Checkbox` + `Label` rows in a `FieldGroup`, a "Select all that apply" `FieldDescription`, and a "Skip — I'll organize it myself" `Button variant="ghost"`).
- [ ] `npm test`, `npm run typecheck`, `npx biome check` → clean.
- [ ] **Commit:** `feat(onboarding): add the first-run wizard and launch gate`

### Task 9 — Dashboard at `/`, Settings, and deleting the prototype

**Files:** `src/app/(app)/page.tsx` (rewrite), `src/app/(app)/settings/page.tsx` (rewrite), `src/router.tsx`, and deletes.

- [ ] `dashboard-page.test.tsx` (mock the API): renders a heading; shows the greeting with the user name and the vault name; when there are no collections, renders the `Empty` component with **"Your Stash is looking a little empty."** and the description **"Start adding the things that matter to you."**; the four quick actions **Add Note**, **Add File**, **Save Link**, **Create Collection** are present, each `disabled`, with the helper text **"Quick actions arrive in the next phase."** rendered once beneath the row (Phase 1 has no item model — do not build fake item creation, and do not rely on a `title` attribute for this, since `title` on a `disabled` button is not exposed to assistive technology); when the probe returned records, the most recent probe record and file names appear after a refresh, proving persistence across restart.
- [ ] Implement the Dashboard: a greeting header, a row of `Card`s summarising the vault (name, collections count, storage `● This Device`, protection state), the `Empty` + quick-action block, and a "Storage" card that renders `<StorageProbeCard />` only when `import.meta.env.DEV`.
- [ ] Rewrite the Settings page: a vault identity card (reads the same `vault-store`), a Storage card showing `● This Device` and the resolved `vaultRoot` in DEV only, and a Vault Lock card whose switch is `disabled` with the note "Locking arrives in a later phase — your password is stored as a salted hash." Fix the current page's "Session-only defaults for this stash." copy, which becomes false.
- [ ] Update `router.tsx`: index → `DashboardPage` wrapped by `OnboardingGate`; `settings` and `dev/storage` likewise; register `onboarding/*` as a full-bleed route **outside** the `DashboardShell` group (the wizard owns its own chrome).
- [ ] Delete: `src/app/(app)/layout.tsx` (dead — the router mounts `DashboardShell` directly), `src/data/stash-items.ts`, `src/stores/stash/stash-store.ts`, `src/stores/stash/stash-store.test.tsx`, `src/components/stash/*` (6 files), and the empty `src/server/` directory.
- [ ] `npm test`, `npm run typecheck`, `npx biome check` (this catches now-unused imports and any `noUndeclaredDependencies` fallout) → clean.
- [ ] **Commit:** `feat(app): add the vault Dashboard and replace the demo prototype`

### Task 10 — Navigation, brand links, and the shape test

**Files:** `src/navigation/sidebar/sidebar-items.ts`, `sidebar-items.test.ts`, `src/app/not-found.tsx`, `src/app/(template)/…/sidebar/app-sidebar.tsx`.

- [ ] Update `sidebar-items.test.ts` first: group 0 is labelled `Stashly` with exactly `Dashboard → /` and `Settings → /settings`; every remaining group's URLs start with `/template`, **except** a group whose `label` is `Developer`, which is asserted (when present) to contain only `/dev/storage` — this keeps the production-build contract exact while the DEV entry exists.
- [ ] Run → FAIL.
- [ ] Update `sidebar-items.ts`: group 0 becomes `{ id: "dashboard", title: "Dashboard", url: "/", icon: LayoutDashboard }` and `{ id: "stash-settings", title: "Settings", url: "/settings", icon: Settings }`. The DEV-only probe entry goes in its **own** group (`{ id: 2, label: "Developer", items: [{ id: "storage-probe", title: "Storage probe", url: "/dev/storage", icon: HardDrive }] }`, appended by a conditional spread) rather than inside the `Stashly` group, so the `Stashly` group's contents and their test stay identical in every build. Confirm `HardDrive` is exported by `lucide-react` before using it (the installed version is `^1.31.0`, newer than the template's icon set was written against); if it is not, use `Database`, which the existing charts pages already import.
- [ ] Fix the two stale links: `not-found.tsx`'s "Go back home" → `/`, and `app-sidebar.tsx`'s brand `Link` → `/`.
- [ ] `npm test`, `npm run typecheck`, `npx biome check` → clean.
- [ ] **Commit:** `fix(nav): point Stashly navigation at the vault Dashboard`

### Task 11 — Cross-platform bundle configuration

**Files:** `src-tauri/tauri.conf.json`, `.github/workflows/build.yml` (new), `.gitignore`.

- [ ] Change `bundle.targets` from `["nsis"]` to `["nsis", "dmg", "app"]`. Tauri only builds the targets its host can produce, so this changes nothing on Windows while making a macOS bundle possible on a macOS runner.
- [ ] `tauri.conf.json` also gets `"windows": { "nsis": { "installMode": "currentUser" } }` so the installer does not demand elevation; the existing `icons/icon.icns` is already listed.
- [ ] Add `.github/workflows/build.yml`: a matrix over `windows-latest` and `macos-latest` running `npm ci`, `cargo test --manifest-path src-tauri/Cargo.toml`, `npm run typecheck`, `npm test`, `npx biome check`, then `npm run tauri build`, uploading the bundles as artifacts. This is the mechanism that satisfies "on both Windows and macOS" — it is the only one available, since this host cannot produce a macOS binary.
- [ ] Verify `src-tauri/.gitignore` covers `/target/` and `/gen/schemas` (it does) and that the workflow adds no tracked binaries.
- [ ] **Commit:** `build: enable macOS bundles and add a cross-platform CI build`

### Task 12 — Verification capture and Phase 1 docs

**Files:** `docs/verification/phase-1/00-summary.md` (new) + four PNGs, `ANALYSIS - STASHLY DESKTOP APP/05 - ROADMAP.md` (status + handoff note), `README.md`.

- [ ] Run the full local gate and paste the real output into the summary: `npm run typecheck`, `npm test`, `npx biome check`, `(cd src-tauri; cargo test)`, `npm run tauri build`.
- [ ] Run the app twice and capture four screenshots into `docs/verification/phase-1/`: `01-onboarding-welcome.png`, `02-onboarding-complete.png`, `03-dashboard-after-restart.png`, `04-storage-probe.png`.
- [ ] Execute the R-02 walkthrough and record pass/fail per step: fresh profile → onboarding appears; empty name blocks Continue with a field error; vault name and starter collections skipped successfully; password skipped successfully; **Create My Vault →** shows the summary; **Open Stashly →** lands on the Dashboard; close and reopen → the Dashboard appears directly and onboarding never returns.
- [ ] Execute the R-01 walkthrough: on the debug probe page click **Write test record and file**, note both, quit the app entirely, relaunch, confirm both the record and the file still appear, and confirm the files exist on disk under the resolved `vaultRoot`.
- [ ] Write `docs/verification/phase-1/00-summary.md` with: the two walkthroughs and their observed results; the **confirmed** resolved vault root and DB path from Task 5; the exact `cargo`/`npm`/`biome` commands and results; and a plainly-worded limits section stating that **macOS was not built or run on this host** (Windows host, only `x86_64-pc-windows-msvc` installed, no macOS toolchain) and that macOS evidence comes from the Task 11 CI matrix.
- [ ] Update `ANALYSIS - STASHLY DESKTOP APP/05 - ROADMAP.md`: R-01 and R-02 from ⭕ to 🟨 with a note that the phase is built and awaiting the macOS CI run before ✅; refresh the "Where everything stands" counts; add a "Phase 1 implementation record" section linking `docs/verification/phase-1/00-summary.md` and naming the deferred items in §8.
- [ ] Update `README.md` with the Phase 1 status, the vault location, the debug probe's existence and debug-only gating, and the test commands.
- [ ] **Commit:** `docs: record Phase 1 verification evidence and update the roadmap`

---

## 7. Acceptance criteria

**R-01** — the app opens a React/TypeScript/Vite screen using a visible Shadcn control; from the debug probe it asks Tauri to write one SQLite record and one vault file; after a full restart both are displayed.
- Gate: `vault_probe_write` returns a `dbRecordId` and a `filePath`; both the record row and the file row render after relaunch; the file exists on disk under the resolved `vaultRoot`.
- Gate: the DB file and the `files/` directory exist under Tauri's resolved `app_data_dir()` and the path is identical across two launches.
- Gate: Windows produces `Stashly_0.1.0_x64-setup.exe`; macOS is produced by the Task 11 CI matrix (not buildable on this host).
- Gate: `DashboardShell` renders on the Dashboard route, proving the shell is wired to the new index page.

**R-02** — on a fresh vault an empty required name blocks progress; vault name, starter collections, and password can all be skipped; completion opens the Dashboard; closing and reopening goes straight to the Dashboard.
- Gate: the seven-step walkthrough in Task 12 passes with observed results recorded.
- Gate: `onboarding_completed = "1"` in `app_settings` after completion, and `vault_get_state` returns `status: "ready"` on the next launch.
- Gate: the wizard contains **no** theme, backup, import/export, shortcut, search-tutorial, storage-path, advanced-security, technical-database, cloud, or advanced-preference control (verified by a `wizard.test.tsx` assertion that none of those labels exist in the rendered tree, and by review of the five step files against T-01's "Do Not Include During Onboarding").

**Engineering gates:** `npm run typecheck` clean; `npm test` green including the new suites; `npx biome check` clean; `cargo test` green; `cargo clippy -- -D warnings` clean; `npm run tauri build` succeeds on Windows.

## 8. Edge cases, failure modes, and explicit deferrals

| Case | Handling |
|---|---|
| IPC unavailable (browser/`vite` without Tauri) | `vault-store` → `unavailable` + retry alert. Never treated as "not onboarded" — the single most dangerous failure, because it would silently re-run onboarding over a live vault. |
| DB missing but `onboarding_completed` absent | Normal first run → onboarding. |
| `app_data_dir()` missing on first launch | `VaultPaths::ensure()` calls `create_dir_all`. |
| DB open or migration failure | `setup()` returns `Err` → the app fails loudly at startup rather than running against a half-built schema. |
| Empty/whitespace user name | Rejected in Rust (`Validation`) **and** in the TS schema; the wizard blocks on the step regardless of which side rejects. |
| Vault name left empty | Derived `${userName}'s Stash`; a whitespace-only name is treated as empty. |
| Duplicate starter collections | Idempotent by unique `slug`; a slug collision between two different names gets `-2` appended rather than silently dropping a collection. |
| Password mismatch / too short | Blocked on the protection step; Rust rejects < 8 chars as `Validation` as a second line of defence. |
| Password given but locking not implemented | Stored as an argon2id PHC hash with a per-vault salt; `protection_enabled = "1"`; the completion screen says `Enabled` per T-01 while the Settings card states plainly that locking arrives in a later phase. **No plaintext password is ever persisted, logged, or returned.** |
| Crash between the record write and the file write | **Deferred to Phase 2.** Record and file cannot yet be made atomic across two stores; Q-10 defines that rule. Task 12 records this limitation in the roadmap so it is a known gap, not a silent one. The probe never overwrites an earlier file, so no evidence is destroyed by a retry. |
| Crash mid-onboarding | The transaction is atomic, so settings and collections either all land or none do. `vault_complete_onboarding` is idempotent by slug except for an unknown-probing-name crash window, which is documented as a Phase 2 item. |
| `noUncheckedIndexedAccess` / array indexing | All list rendering uses `.map` with stable ids; the probe's `n` counter is derived from `SELECT COUNT(*)`, not from array length. |
| Biome `useSortedClasses` | Class strings are written pre-sorted; `npx biome check --write` is the fix when it disagrees. |
| Release build | All three probe commands and both probe UI surfaces are `#[cfg(debug_assertions)]` / `import.meta.env.DEV` gated; `invoke_handler` lists are explicit per branch so no probe command exists in a release binary. |
| macOS | Explicitly out of reach on this host. Handled by Task 11's CI matrix and disclosed in Task 12's limits section — **not** claimed as verified. |

### Assumptions
1. `@tauri-apps/api` on `core:default` alone can invoke custom commands (true for Tauri 2; the capability does not need a per-command permission).
2. Inline `#[cfg(test)]` Rust unit tests plus the manual E2E walkthrough are sufficient Phase 1 verification; no headless Tauri driver (`tauri-driver`/WebDriver) is introduced, since it would need a separate Rust component and a matching driver on this host.
3. `rusqlite` 0.40 with `bundled` builds and links on this Windows MSVC host (the SQLite C compile is a normal, expected build cost).
4. `app_data_dir()` resolves under `%APPDATA%` or `%LOCALAPPDATA%\com.stashly.app` on Windows — **verified in Task 5, not assumed**.

## 9. Subagent execution

Per the `subagent-driven-development` skill: a fresh implementer subagent per task; a mandatory task review (spec compliance + code quality) with the diff handed over as a file; resume-the-implementer fix rounds capped at 5, then adjudication with a recorded ruling; and a final whole-branch review on the most capable model, pointed at the deferred-minor list. The workspace is `.superpowers/sdd/<plan-basename>/progress.md` (git-ignored scratch, separate from this plan). Tasks 1–4 are sequential (shared `Cargo.toml` / `lib.rs`); 7, 9, 10 and 11 may be batched where same-shape, but never two implementers at once on a shared file. Work happens on branch `phase-1-vault-foundation` off `main` at `2fe53be`, not on `main`.
