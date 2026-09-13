# Phase 1 — Verification summary

**Plan:** `docs/superpowers/plans/2026-09-13-phase-1-vault-foundation.md`
**Branch:** `phase-1-vault-foundation` (off `main` at `2fe53be`)
**Implementation frozen at:** `b14b9ce` — `test(vault): prove the resolved vault path`
**Roadmap capabilities:** R-01 (cross-platform local desktop foundation), R-02 (first-run vault setup and launch decision)
**Execution ledger (git-ignored scratch):** `.superpowers/sdd/2026-09-13-phase-1-vault-foundation/progress.md`
**This document's own limits:** no native GUI was driven, so R-01 and R-02's manual walkthroughs are **NOT EXECUTED** and the four screenshots are **NOT PRODUCED**. Everything below that is marked ✅ comes from a captured command log or a direct filesystem listing, and is cited as such.

---

## 1. What Phase 1 shipped

### 1.1 Rust (storage owner)

| File | Role |
|---|---|
| `src-tauri/src/error.rs` | `VaultError { NotInitialized, Validation, Db, Io, Internal }` serialized as the frozen flat `{ code, message }` pair the frontend switches on |
| `src-tauri/src/db.rs` | `AppState { conn: Mutex<Connection> }`, `SCHEMA_VERSION = 1`, `open()` (creates parents, `foreign_keys = ON`, `journal_mode = WAL`), `migrate()` walking `PRAGMA user_version` forward inside transactions, `in_memory()` test helper |
| `src-tauri/src/vault_paths.rs` | `VaultPaths { root, db, files }` + free function `resolve(&app_data_dir)` → `root/db/stashly.db`, `root/files/`; `ensure()` creates all three |
| `src-tauri/src/vault_repo.rs` | Settings KV and collections over STRICT tables, atomic `save_onboarding`, `slugify`, `derive_vault_name`, argon2id hashing/verification, probe-record helpers |
| `src-tauri/src/vault.rs` | `validate_submission` (trimmed, code-point length rules), `VaultStartupResponse` (deliberately **no** container `rename_all` — the `ready` fields are snake_case by contract), the two production commands |
| `src-tauri/src/dev_storage.rs` | The three probe commands, compiled only under `#[cfg(debug_assertions)]` |
| `src-tauri/src/lib.rs` | `setup()` resolves `app_data_dir()`, ensures paths, opens and migrates the DB, manages `AppState`, and aborts loudly on failure; explicit per-branch `invoke_handler!` lists (2 commands production, 5 debug) |

Schema `user_version = 1`: `app_settings(key, value, updated_at)` and `collections(id, slug UNIQUE, name, created_at, is_starter)`, both `STRICT`. SQLite holds records; `<vault_root>/files/` holds documents. They never mix.

### 1.2 Frontend (single IPC seam, gate, wizard, pages)

| Surface | Role |
|---|---|
| `src/lib/vault/{types,error,api}.ts` | The **only** module importing `@tauri-apps/api`; five `invoke` wrappers (`getVaultStartup`, `completeOnboarding`, `writeStorageProbe`, `readStorageProbe`, `getStorageProbePaths`), each rethrowing through `VaultCommandError` |
| `src/stores/vault/vault-store.ts` | `loading → ready \| onboarding \| unavailable`. A rejected `getVaultStartup()` can never resolve to `onboarding` — the one failure that would re-run first-run setup over a live vault |
| `src/stores/onboarding/{onboarding-schema,onboarding-store}.ts` | Pure validation (`isStepComplete`, `toSubmission`, `derivedVaultName`, `STARTER_COLLECTION_OPTIONS`) plus the five-step wizard store; every length rule counts code points via `[...value].length` |
| `src/components/onboarding/**` | `OnboardingGate` at each Stashly route, the wizard, the five steps, the read-only review step, and the extracted `starter-collections.tsx` |
| `src/app/(app)/page.tsx` | Dashboard: greeting, vault summary cards, T-01 empty state, four **disabled** quick actions with the visible helper "Quick actions arrive in the next phase.", and the storage card only under `import.meta.env.DEV` |
| `src/app/(app)/settings/page.tsx` | Vault identity, storage (`● This Device`, plus the resolved `vaultRoot` in DEV), and a **disabled** Vault Lock switch whose note states that locking arrives in a later phase and the password is stored as a salted hash |
| `src/app/(app)/dev/storage/page.tsx` + `src/components/dev/storage-probe-card.tsx` | The debug-only probe UI (write a record + a file, reload from disk, list both, show the three resolved paths) |
| `src/router.tsx` | `#/`, `#/settings`, `#/dev/storage` each wrapped in `OnboardingGate`; `#/onboarding` registered **ungated** outside `DashboardShell` (a correctness requirement: the wizard's `refresh()` on success would otherwise replace the completion summary before it can be read); template demo routes preserved |
| `src/navigation/sidebar/sidebar-items.ts` | Group 0 is `Dashboard → /` and `Settings → /settings`; the probe entry lives in its own `Developer` group appended by a conditional `import.meta.env.DEV` spread, so the production group shape is build-independent |

Deleted with the prototype: `src/app/(app)/layout.tsx`, `src/data/stash-items.ts`, `src/stores/stash/*`, all six `src/components/stash/*` files, and the empty `src/server/` directory.

### 1.3 Bundle and CI configuration

- `src-tauri/tauri.conf.json`: `identifier: "com.stashly.desktop"`, `bundle.targets: ["nsis", "dmg", "app"]`, `windows.nsis.installMode: "currentUser"`.
- `.github/workflows/build.yml` (new): a `fail-fast: false` matrix over `windows-latest` and `macos-latest` running `npm ci`, `cargo test --manifest-path src-tauri/Cargo.toml`, `npm run typecheck`, `npm test`, the **scoped** Biome step, and `npm run tauri build`, then uploading the bundles with `if-no-files-found: error`.
- The macOS arm of that matrix is the only macOS evidence path; it has not run.

---

## 2. Fresh gate evidence

Captured at `b14b9ce` into `.superpowers/sdd/2026-09-13-phase-1-vault-foundation/task-12-logs/` (git-ignored scratch, so the results are restated here rather than linked). Gate 09's verdict rests on a later fresh run, logged beside them as `task-12-final-tauri-build.log`.

| # | Gate | Command | Observed result | Verdict |
|---|---|---|---|---|
| 01 | Typecheck | `npm run typecheck` (`tsc --noEmit`) | No diagnostics; log's final line is `EXIT_CODE=0` | ✅ |
| 02 | Frontend tests | `npm test` (`vitest run`) | `Test Files 14 passed (14)` / `Tests 150 passed (150)`; `EXIT_CODE=0` | ✅ |
| 03 | Lint (Phase 1 scope) | the exact expanded CI command in §2.1 | `Checked 38 files in 644ms. No fixes applied.`; `EXIT_CODE=0` | ✅ scoped only |
| 04 | Rust tests | `cargo test` (`src-tauri`) | `test result: ok. 64 passed; 0 failed; 0 ignored` for the lib target, `0 passed` for `main.rs`, `0 passed` for doc-tests; `EXIT_CODE=0` | ✅ |
| 05 | Clippy | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | `Finished dev profile [unoptimized + debuginfo] target(s) in 0.45s`; `EXIT_CODE=0` | ✅ |
| 06 | Bundler-less frontend build | `npm run build` (`tsc --noEmit && vite build`) | `✓ 3969 modules transformed`, `✓ built in 1.49s`, `dist/assets/index-Z45NkSW-.js 2,554.39 kB │ gzip: 695.64 kB`; only the over-500 kB chunk advisory; `EXIT_CODE=0` | ✅ |
| 08 | Tauri environment | `npm run tauri -- info` | Exit 0. tauri 2.11.5, tauri-build 2.6.3, wry 0.55.1, tao 0.35.3, `@tauri-apps/api` 2.11.1, CLI 2.11.4; `frontendDist: ../dist`, `devUrl: http://localhost:1420/`, CSP unset; **no identifier warning** (the pre-rename `.app`-suffix advisory is gone) | ✅ |
| 09 | Native bundle build | `npm run tauri build` | The Task 12 capture at `b14b9ce` stopped mid-compile — 123 lines, no final line and no `EXIT_CODE` marker, ending at `Compiling stashly v0.1.0` / `Compiling tauri v2.11.5`. A **fresh controller run after `be1bfbe` completed with exit 0**, ending `Finished 1 bundle at: ...\bundle\nsis\Stashly_0.1.0_x64-setup.exe` and `=== EXIT_CODE=0 ===`, and produced `src-tauri\target\release\stashly.exe` (9,185,280 B) and `src-tauri\target\release\bundle\nsis\Stashly_0.1.0_x64-setup.exe` (5,500,433 B, 2026-09-13 19:14:57) | ✅ |

### 2.1 The exact scoped Biome command

```powershell
npx biome check src/lib/vault src/stores/onboarding src/stores/vault src/components/onboarding `
  src/components/dev src/navigation/sidebar src/test `
  "src/app/(app)/page.tsx" "src/app/(app)/settings/page.tsx" `
  "src/app/(app)/dashboard-page.test.tsx" "src/app/(app)/settings-page.test.tsx" `
  src/router.tsx src/router.test.tsx src/app/not-found.tsx `
  "src/app/(template)/template/(main)/dashboard/_components/sidebar/app-sidebar.tsx"
```

`Checked 38 files`, 0 fixes applied, exit 0. This is the same command the CI workflow runs, and it is the command the README documents.

### 2.2 Precision notes about this evidence

- **The Task 12 capture of `npm run tauri build` was incomplete; a fresh run of the same command completed.** The captured log contains 123 lines and no `EXIT_CODE=` line at all, unlike the other seven logs, and ends mid-compile. A controller-run `npm run tauri build` performed after `be1bfbe` then finished with **exit 0** — `Finished 1 bundle at: ...\bundle\nsis\Stashly_0.1.0_x64-setup.exe`, `=== EXIT_CODE=0 ===` (log `task-12-final-tauri-build.log`) — and produced `src-tauri\target\release\stashly.exe` (9,185,280 B) and `src-tauri\target\release\bundle\nsis\Stashly_0.1.0_x64-setup.exe` (5,500,433 B, modified 2026-09-13 19:14:57). So the plan's engineering gate "`npm run tauri build` succeeds on Windows" **is satisfied** and a Windows installer **is** evidenced. The earlier capture's frontend half had already succeeded with no TypeScript diagnostics and no Vite errors, and that history is kept here rather than erased.
- **`cargo clippy`'s log contains a PowerShell `NativeCommandError` block.** That is cargo writing progress to stderr, which PowerShell renders as an error record under `*>&1` redirection; the harness recorded `EXIT_CODE=0` and the only cargo line is `Finished`. It is a redirection artifact, not a clippy finding.
- **`tauri info` never prints the app identifier.** It reports the environment, packages, plugins, and build settings; the identifier `com.stashly.desktop` is authoritative from `src-tauri/tauri.conf.json` and from the workflow's own validation. The relevant part of the log is the *absence* of the pre-rename macOS advisory warning.
- **The number series skips `07`.** `task-12-logs/` holds `01`–`06`, `08`, `09`; there is no seventh capture, so nothing is implied for it.
- **`npm test` reached 150 tests in 14 files**, including `router.test.tsx` (2), `wizard.test.tsx` (9), `protection-step.test.tsx` (12), `identity-step.test.tsx` (7), `onboarding-gate.test.tsx` (7), `starter-collections.test.tsx` (6), `dashboard-page.test.tsx` (6), `settings-page.test.tsx` (4), `storage-probe-card.test.tsx` (6), and the four store/API suites. These verify the contracts and the gate's branches; they are **not** a substitute for the manual walkthroughs in §4.
- **The repo-wide ``npx biome check`` is still red**, on pre-existing `src/app/(template)/**` debt that Phase 1 does not own: the control run over `src/app` reports 1 error, 19 warnings and 4 infos across 216 files and exits 1. The scoped run above is green. This is Ruling 30, and it is a deliberate, documented limit rather than a Phase 1 regression.

---

## 3. Final resolved paths on this host

Observed by direct filesystem listing at `b14b9ce` (Windows 10.0.26200, `x86_64-pc-windows-msvc`, Node 24.15.0, rustc 1.98.1).

| What | Path | Present |
|---|---|---|
| **Vault root** (final, authoritative) | `C:\Users\marka\AppData\Roaming\com.stashly.desktop` | ✅ directory |
| Database | `C:\Users\marka\AppData\Roaming\com.stashly.desktop\db\stashly.db` | ✅ 4,096 B, beside `stashly.db-shm` (32,768 B) and `stashly.db-wal` (20,632 B) |
| Vault files | `C:\Users\marka\AppData\Roaming\com.stashly.desktop\files\` | ✅ directory, empty |
| WebView2 profile (not vault data) | `C:\Users\marka\AppData\Local\com.stashly.desktop\EBWebView` | ✅ the only thing under `%LOCALAPPDATA%\com.stashly.desktop` |

Two things this settles:

1. **Tauri 2's `app_data_dir()` resolves to the Roaming `%APPDATA%` variant, not `%LOCALAPPDATA%`.** Task 5's brief expected `%LOCALAPPDATA%\com.stashly.desktop\db`; the real layout is the Roaming one. Ruling 15 (`resolve` returns `root == app_data_dir`, with `db/` and `files/` beneath) is confirmed by observation, and the `%LOCALAPPDATA%` directory is WebView2-only.
2. **The non-empty WAL** shows the database was opened by a running build, but **no probe record and no probe file exist** — `files\` is empty. There is therefore no persisted probe row to point at, and no restart-survival observation was made.

**Not observed:** the vault root for a fresh profile under a different user, macOS's `~/Library/Application Support/com.stashly.desktop`, and path stability across two launches (the plan's Task 5 gate). Path stability is evidenced only by the path being derived from `app_data_dir()` at runtime.

---

## 4. Manual walkthroughs — NOT EXECUTED

The native GUI could not be driven in this session. **No probe row was created, no restart-persistence walkthrough was performed, and no screenshots exist.** Every GUI step below is recorded as *not executed* rather than as a pass. The only two R-01 rows carrying evidence are non-GUI artefacts — step 7 (filesystem listing, §3) and step 9 (the Windows installer produced by the fresh build, §2 gate 09) — and neither substitutes for a driven window. The plan's Task 12 acceptance gates for R-01 and R-02 remain open, and R-02 is entirely NOT EXECUTED apart from its absence assertion.

### 4.1 R-01 — cross-platform local foundation

| # | Step | Status | Note |
|---|---|---|---|
| 1 | App opens a React/TypeScript/Vite screen with a visible Shadcn control | NOT EXECUTED | Component-level rendering is covered by tests; no window was observed |
| 2 | Open the debug probe and click **Write test record and file** | NOT EXECUTED | Command exists and is debug-gated (byte-scan evidence in Task 6); never invoked from a GUI |
| 3 | Note the returned `dbRecordId` and `filePath` | NOT EXECUTED | No live return value captured |
| 4 | Quit the app entirely | NOT EXECUTED | — |
| 5 | Relaunch and confirm the record and the file both still appear | NOT EXECUTED | No restart-persistence walkthrough |
| 6 | Confirm the file exists on disk under the resolved `vaultRoot` | NOT EXECUTED | `files\` is empty, consistent with step 2 never running |
| 7 | The DB file and `files/` exist under the resolved root | ✅ observed | Filesystem listing in §3 — one of only two R-01 rows carrying evidence, both non-GUI (the other is step 9) |
| 8 | The resolved path is identical across two launches | NOT EXECUTED | — |
| 9 | Windows produces `Stashly_0.1.0_x64-setup.exe` | ✅ observed | Fresh `npm run tauri build` exit 0 (§2 gate 09): `src-tauri\target\release\bundle\nsis\Stashly_0.1.0_x64-setup.exe`, 5,500,433 B, modified 2026-09-13 19:14:57. The installer was never *run*, so this is artifact evidence, not an install-and-launch observation |
| 10 | macOS bundle | NOT EXECUTED | CI matrix defined, never run (§6) |
| 11 | `DashboardShell` renders on the Dashboard route | NOT EXECUTED | Covered by `router.test.tsx` at the component level, not in a window |

### 4.2 R-02 — first-run vault setup and launch decision

| # | Step | Status | Note |
|---|---|---|---|
| 1 | Fresh profile → onboarding appears | NOT EXECUTED | A vault already exists under the resolved root, so a truly fresh profile would need a wiped/relocated directory |
| 2 | Empty name blocks Continue with a field error | NOT EXECUTED | Behaviour is pinned by `identity-step.test.tsx`; not clicked |
| 3 | Vault name skipped successfully | NOT EXECUTED | — |
| 4 | Starter collections skipped successfully | NOT EXECUTED | — |
| 5 | Password skipped successfully | NOT EXECUTED | — |
| 6 | **Create My Vault →** shows the summary | NOT EXECUTED | — |
| 7 | **Open Stashly →** lands on the Dashboard | NOT EXECUTED | — |
| 8 | Close and reopen → the Dashboard appears directly and onboarding never returns | NOT EXECUTED | `onboarding_completed = "1"` was never written by a real run; `get_settings_page`/`vault_get_state` behaviour is covered by Rust tests only |
| 9 | The wizard contains no theme, backup, import/export, shortcut, search-tutorial, storage-path, advanced-security, technical-database, cloud, or advanced-preference control | ✅ covered by test | `wizard.test.tsx` asserts none of those labels exist in the rendered tree |

### 4.3 Screenshots — NOT PRODUCED

| Filename | Status |
|---|---|
| `docs/verification/phase-1/01-onboarding-welcome.png` | **NOT PRODUCED** |
| `docs/verification/phase-1/02-onboarding-complete.png` | **NOT PRODUCED** |
| `docs/verification/phase-1/03-dashboard-after-restart.png` | **NOT PRODUCED** |
| `docs/verification/phase-1/04-storage-probe.png` | **NOT PRODUCED** |

No placeholder, stand-in, or generated image was committed in their place. `docs/verification/phase-1/` intentionally contains this summary and nothing else.

---

## 5. Bundle identifier: `com.stashly.app` is superseded

- The identifier was `com.stashly.app` until Task 9. Tauri emits a macOS-only advisory warning for identifiers ending in `.app`, and the user approved the rename to **`com.stashly.desktop`** while no real Phase 1 vault existed (Rulings 38–39).
- **The identifier is part of the app-data path**, so the rename moved the vault root. Task 9's one-line config change is the only place it happened; Task 11's workflow and target configuration preserved it, and Task 11's review left it out of scope on purpose.
- The pre-rename directory `C:\Users\marka\AppData\Local\com.stashly.app` still exists on this machine but contains **only `EBWebView`** — a WebView2 profile, no `stashly.db` and no vault files. **No continuity with any pre-rename `com.stashly.app` directory is claimed**; that data is intentionally orphaned.
- The final `tauri info` run (log 08, exit 0) shows no identifier warning, which was the point of the rename.

---

## 6. Limits

### 6.1 macOS — not built, not run

- The host is Windows; the only installed Rust target is `x86_64-pc-windows-msvc`; there is no Xcode toolchain. `rustup target add aarch64-apple-darwin` would not change this, because Tauri's macOS bundling needs macOS to link and sign.
- **macOS is therefore unverified.** The evidence path is `.github/workflows/build.yml`'s `macos-latest` matrix arm, which has **never been executed** — no Actions run exists for this branch. It is a declared mechanism, not a result.
- Consequently: no `.dmg`, no `.app`, and no macOS runtime screenshot exist for this phase.

### 6.2 CI — configured, never run

`.github/workflows/build.yml` has been structurally validated locally (60 assertions, including rejection of broad `src/app`/`src/components` Biome scopes) and its Biome step was reproduced locally with the exact expanded command (38 files, exit 0, and a bare-`src/app` control that stays red at 216 files). No workflow run has been triggered, so **no CI result exists for either platform**.

### 6.3 Native GUI — not driven

No window was opened, no control clicked, no restart performed, no screenshot taken. Every "✅" in §2 is a command result or a filesystem observation; every GUI claim in §4 is explicitly NOT EXECUTED.

### 6.4 Installer — produced on Windows; never run

`npm run tauri build` exited 0 in a controller run after `be1bfbe`, producing `src-tauri\target\release\stashly.exe` (9,185,280 B) and the NSIS installer `src-tauri\target\release\bundle\nsis\Stashly_0.1.0_x64-setup.exe` (5,500,433 B, modified 2026-09-13 19:14:57). The installer was **not executed**: nothing was installed, and no launch from an installed copy was observed — that remains part of the §4 walkthrough gap. The Task 12 capture of the same command at `b14b9ce` is still incomplete mid-compile (123 lines, no `EXIT_CODE=` line); the fresh run supersedes it as gate evidence, so the installer no longer counts as an open Windows gate. No macOS installer or disk image exists (§6.1).

### 6.5 Release-artifact containment — partially evidenced

The debug-only probe has strong evidence on the **Rust** side: Task 6's implementer compiled a release binary and byte-searched it — `vault_probe_write`/`vault_probe_read`/`vault_probe_paths` are absent from the release binary while `vault_get_state` and `vault_complete_onboarding` are still present, which rules out symbol stripping as the explanation. The **frontend** half of Ruling 37 — scanning the built `dist/` output for the DEV-only `Developer` sidebar entry and route strings — was not performed, because vitest pins `import.meta.env.DEV === true` even under `--mode production` and no artifact scan replaced that gap. It remains open (see the deferred table).

---

## 7. Durable record of rulings and deferred minors

Carried forward from the execution ledger so the decisions and parked items survive the git-ignored scratch workspace. Statuses: **Resolved** = settled and honoured in the shipped code; **Remaining** = deliberately open, with the owner named.

**Coverage caveat:** this table is complete as to *rulings*, but not every minor could be itemised from the ledger. Task 1 recorded **4 parked minors** and named only 1; Task 3 recorded **4 parked minors** and named none before promoting a fifth item into fix round 1. Those unlisted minors exist as counts only, and §7.2 states that plainly rather than implying a complete list. No missing detail was reconstructed or invented.

### 7.1 Rulings 1–41

| # | Ruling (condensed) | Status |
|---:|---|---|
| 1 | Task 5 does not depend on Task 6 | Resolved — **superseded in execution by Ruling 27** (Task 6 landed first) |
| 2 | Task 6 owns the final `invoke_handler!` list (2 production / 5 debug) | Resolved — verified in Task 6's review, including the release-binary byte scan |
| 3 | The DEV-only probe nav entry lives in its own `Developer` group | Resolved — Task 10; `sidebar-items.test.ts` asserts it by label, so the production shape is build-independent |
| 4 | `db.rs` must not assert WAL on `:memory:` | Resolved — WAL asserted only in the file-backed test |
| 5 | Password length validation lives in `validate_submission`, not the repository | Resolved — the repository still validates the user name so Task 3's atomicity proof holds |
| 6 | Quick-action buttons use visible helper text, not a `title` attribute | Resolved — "Quick actions arrive in the next phase." rendered once beneath the row |
| 7 | `beforeEach` uses a block body; `VaultIdentity` normative but not required | Resolved — hook fixed; `VaultIdentity` later deleted by Ruling 19 |
| 8 | `lib.rs` keeps `pub mod db; pub mod error;` | Resolved |
| 9 | **A vault whose `user_version` is newer than `SCHEMA_VERSION` is accepted silently in Phase 1; the v2 author must add a `version > SCHEMA_VERSION` guard before the migrate loop** | **REMAINING — Phase 2 obligation.** Nothing else will catch it; `migrate` walks `while version < SCHEMA_VERSION`, so a v2 vault skips the loop and returns `Ok(())` |
| 10 | Task 2's three extra tests are in scope | Resolved — they pin the frozen flat `{code,message}` serialization |
| 11 | `NotInitialized`'s fixed message is accepted | Resolved — never shown in the normal flow |
| 12 | `derive_vault_name` uses the WHOLE trimmed user name | Resolved — `"Mark Adrianne" → "Mark Adrianne's Stash"`, `"" → "My Stash"` |
| 13 | `create_collections` keys repeat-detection on the exact stored name | Resolved — slug collisions get `-2` without breaking idempotency |
| 14 | **`get_settings_page` is correctly omitted; the plan's Task 3 checklist line is superseded** | Resolved — no caller and no specified signature in Phase 1; Phase 4 (R-15/R-16) defines its real shape |
| 15 | `VaultPaths::resolve` returns `root == app_data_dir` | Resolved — **confirmed by observation**: the real root is Roaming `%APPDATA%\com.stashly.desktop` |
| 16 | Hashing runs before the write transaction; `password_salt` repeats the PHC salt | Resolved — keeps argon2id off the SQLite write lock; a Phase 5 affordance |
| 17 | `insert_probe_record` writes two rows without a transaction | Resolved as an accepted **debug-only** limitation — an inner join means a crash loses the record rather than corrupting it |
| 18 | `modifiedAt` is the correct field name; both probe element shapes pinned in §4.2 | Resolved — the alternative was a silent `undefined`/`Invalid Date` cell with no type error |
| 19 | `VaultIdentity` is deleted from §4.2 rather than added to `types.ts`; the stale `schema_note` key is removed | Resolved — no speculative frozen surface |
| 20 | `slugify` documents Unicode pass-through; ASCII folding rejected | Resolved — pinned by `assert_eq!(slugify("Café"), "café")`; folding would collapse genuinely different names |
| 21 | `readStorageProbe`'s rejection test is restored after a fold removed live coverage | Resolved — a distinct `io` payload keeps the two branches genuinely different |
| 22 | Test fixtures are annotated with their real imported types | Resolved — a rename now fails `tsc` instead of yielding a runtime `undefined` |
| 23 | `vault_paths::resolve(&root)` is the free function; the plan's `VaultPaths::resolve` snippet was a defect | Resolved — plan text corrected |
| 24 | `validate_submission` measured the raw, whitespace-spanning name | Resolved — **superseded by Ruling 25** |
| 25 | `validate_submission` measures the TRIMMED user name, with a boundary test | Resolved — trims once into a binding read by both rules; the submission is not rewritten |
| 26 | Count Unicode code points, not UTF-16 units, and mirror Rust's trim | Resolved for code points — every rule routes through `[...value].length`, falsified in Task 7 by switching to `value.length` (exactly two failures, both directions). **The trim-set parity half remains open: see Ruling 31** |
| 27 | Task 6 is implemented before Task 5, and Task 5 runs once against the finished app | Resolved — a recorded deviation from the plan's 1→12 order |
| 28 | The `dev/storage` route belongs to Task 9 and the sidebar entry to Task 10 | Resolved — Task 6 created only the unrouted page, so the panel could not precede the gate |
| 29 | Task 6's untested ordering plus its inverted tie-break are load-bearing, not polish | Resolved — the sort is now `(modified_at, id)` and `files[0]` is asserted; the old comparator yields `9,8,…,2,10,1` |
| 30 | **`npx biome check` is NOT a repo-wide clean gate**; report the scoped result and state the repo-wide red plainly | Resolved as a reporting rule — §2.2 and the README both state it. The pre-existing template debt itself is **REMAINING by design** (Phase 1 does not own it) |
| 31 | **The JS/Rust `trim()` divergence on U+0085 (NEL) is parked as a documented limitation** | **REMAINING** — JS `trim()` keeps U+0085 and removes U+FEFF; Rust's does the opposite. A user name of exactly `"\u0085"` passes the wizard and is then rejected by the command. The failure is safe and honest (Rust is the authority, nothing persists), but closing it needs a hand-written Unicode `White_Space` table in TypeScript |
| 32 | Task 5 cannot run until Task 9 lands, because the app does not build before then | Resolved — the prototype deletion and index rewiring landed in Task 9 |
| 33 | Routing is consolidated into Task 9; neither Task 6 nor Task 8 registers a route | Resolved — one writer of `router.tsx`; the gate exists before the surfaces it guards |
| 34 | Task 7's `setField` keeps its unconditional `status: "idle"` reset; the double-submit wedge is fixed in Task 8's UI | Resolved — while submitting, both password inputs, show/hide, Skip, Back and Create are disabled and the primary relabels to "Creating your vault…" |
| 35 | **`toggleCollection` not clearing a stale `error` is left as written** | **REMAINING** — one-line consistency change with no reachable Phase 1 bug; a user who returns to the collections step after a failed submit still sees the protection step's error |
| 36 | The plan's "retain the Inventory-absence assertion" was simply wrong; the original asserted the opposite | Resolved — the implementer implemented the evident intent (a new absence test) and flagged it |
| 37 | **`import.meta.env.DEV`'s release branch is asserted by construction, not exercised; the release-artifact check is deferred to Task 12** | **REMAINING** — vitest pins `DEV === true` even under `--mode production`. Task 6's release-**binary** byte scan covers the Rust commands, but the frontend `dist/` scan for the probe nav entry and route strings was not performed (§6.5) |
| 38 | Task 9 owns the approved identifier rename `com.stashly.app` → `com.stashly.desktop` | Resolved — one config line; the final config carries `com.stashly.desktop` |
| 39 | The old `.app`-suffix warning is a Task 11 observation, not a Phase 1 blocker | Resolved — the final `tauri info` run is clean and exits 0; pre-rename data is intentionally orphaned |
| 40 | Task 8's missing `starter-collections.tsx` is a real plan-mandated gap | Resolved — extracted in fix round 1 (`b4ad1c1`) with six direct tests |
| 41 | Task 8's UI must consume the Task 7 schema predicate rather than duplicate validation | Resolved — `isStepComplete` is the only validation predicate; the exact-8-character + blank-confirmation regression is pinned |

### 7.2 Deferred minors from the execution ledger

| Source | Minor | Status |
|---|---|---|
| Task 1 (4 parked; 1 named) | Report prose nit: "each with a distinct code path" is loose, since `writeStorageProbe`/`readStorageProbe` share the structured-valid branch and differ only by wrapper catch | Remaining — wording only, no code implication. The other three were not itemised in the ledger |
| Task 2 (all six parked) | (a) no test reads or writes `collections`, so a column typo would pass all nine tests while Task 3 depends on `UNIQUE (slug)`; (b) `migrate_twice_keeps_the_version_and_the_data` promises more than its body can check; (c) `From<rusqlite::Error>` collapses to `Db(error.to_string())`, discarding `ErrorCode`, and `source()` is unimplemented; (d) `remove_dir_all` runs only on the success path, so a failing assertion leaves a `stashly-db-*` directory in `%TEMP%`; (e) `NotInitialized`'s message is hardcoded English that can reach the UI through `VaultCommandError.message`; (f) no `busy_timeout`, so a second instance racing the migration gets an immediate `database is locked` → retry screen rather than waiting | Remaining — (f) is worth remembering for Phase 5 relocation/backup concurrency; (a) is partially offset by Task 3's repository tests |
| Task 3 (4 parked) | The ledger records the count only; the one ⚠️ it names (`MAX_USER_NAME_LEN` private while Task 7 validates only non-empty) was **promoted into fix round 1** | Mixed — the promoted item is Resolved (`MAX_USER_NAME_LEN` is `pub`); the four unnamed minors remain Remaining and are not itemised anywhere |
| Task 4 (comment-only, a–c) | (a) `vault.rs:7` claims `validate_submission` "is the only place the rest of the rules live", which `vault_repo.rs:151-156` contradicts — a **wrong** comment, and load-bearing because Task 7's author read this file; **the ledger assigned this fix to Task 12 and it is NOT done** (this task's authorized scope was documentation only, no source staged) | **Remaining — open.** Needs a one-comment source change; flagged as a concern in `task-12-report.md` |
| Task 4 (b) | The same bullet says the TypeScript side "re-reads `vault_repo::MAX_USER_NAME_LEN`", which cannot happen — the wizard must duplicate the literal | Remaining — Task 7 duplicated the literal; the comment is still misleading |
| Task 4 (c) | `vault.rs:286`'s test name keeps "without rewriting it" while the test now asserts only acceptance | Remaining — the name is not false (non-rewrite is compile-guaranteed) but no longer asserted |
| Task 6 (14 parked; 3 named a–c) | (a) the foreign-file test doesn't pin the `Option` ordering — a foreign name sorting *after* a probe name (`z-notes.txt`) is uncovered, so it passes even if the id tie-break were deleted; (b) `storage-probe-card.tsx:206` hardcodes the literal `"10"`, duplicating `vault_repo.rs:40`'s `PROBE_DEFAULT_LIMIT` and drifting silently if the default changes; (c) `task-6-report.md` prints the negative-control diffs with `"…"` elisions rather than verbatim, exactly where the raw output is the evidence | Remaining — (a) was suggested for Task 12's cleanup if cheap; it was not done (source scope) |
| Task 6 (d) | `cargo test --release` skips the probe's 13 tests, a direct consequence of `#[cfg(debug_assertions)]` gating the module: stronger release hygiene, weaker release-profile coverage | Remaining — recorded so the next maintainer finds it |
| Task 7 (process) | The review ran against a diff file that was never generated; the reviewer read the four committed files directly instead, so scope confirmation was impossible | Remaining as a **process** lesson — the diff was generated afterwards and scope confirmed. Lesson: generate the review package in the same turn the implementer reports |
| Task 9 (evidence limits) | Git diffs cannot prove the deletion of an empty `src/server/` directory, and report-only command output is not independent evidence | Partially addressed — the captured `task-12-logs/` outputs are independent captures, and the `<vaultRoot>` layout was re-observed; the empty-directory deletion remains unprovable by diff |
| Task 10 (process) | The `task-10-brief.md` the implementer was told to read **did not exist**; the dispatch carried the requirements inline, so the work was correct | Remaining as a **process** lesson — the brief was backfilled. Same class as Task 7's missing package: missing per-task artefacts degrade a seat silently |
| Ruling 30 (debt) | The repo-wide ``npx biome check`` stays red on pre-existing `src/app/(template)/**` debt (1 error, 19 warnings, 4 infos over 216 files) | Remaining by design — Phase 1 does not own it and CI is scoped deliberately |
| Plan §8 (deferral) | A crash between the record write and the file write cannot be made atomic across two stores; Q-10 defines that rule | Remaining — **deferred to Phase 2**, recorded here so it is a known gap rather than a silent one |

### 7.3 Open gates for the next phase or the final review

1. **Execute the R-01 and R-02 walkthroughs** with a driven GUI and capture the four screenshots.
2. **Run the CI matrix** (`windows-latest` + `macos-latest`) — the only macOS evidence path.
3. **Scan the built frontend output** for the DEV-only probe nav entry and probe route strings (Ruling 37).
4. **Fix the wrong `vault.rs:7` comment** and the other Task 4 comment/test-name minors (Ruling 9 stays a Phase 2 obligation).
5. **Add the `version > SCHEMA_VERSION` guard** in `migrate` before the v2 arm is written (Ruling 9).

**Closed since the first capture — not a remaining gate:** the Windows `npm run tauri build`. A controller run after `be1bfbe` exited 0 and produced `src-tauri\target\release\stashly.exe` and `src-tauri\target\release\bundle\nsis\Stashly_0.1.0_x64-setup.exe` (§2 gate 09, §6.4). The installer artifact is evidenced; what is still missing on Windows is a *driven* run, which gate 1 above covers.
