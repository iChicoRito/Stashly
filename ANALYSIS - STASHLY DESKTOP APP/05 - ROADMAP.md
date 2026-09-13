# 05 - ROADMAP

[00 - START HERE](00%20-%20START%20HERE.md) · Previous: [04 - DIAGRAMS](04%20-%20DIAGRAMS.md) · Next: [07 - WORD LIST](07%20-%20WORD%20LIST.md)

## What this covers

Capability order for the intended desktop vault. It covers building work only. This roadmap was first written from supplied material alone, with nothing marked finished, in progress, or already there; Phase 1 has since been built on the `phase-1-vault-foundation` branch, so R-01 and R-02 now carry 🟨 with the evidence and the remaining limits recorded in “Phase 1 implementation record” below. No other status changed.

## Where the plan came from

This roadmap is *drawn from* [02 - FINDINGS](02%20-%20FINDINGS.md), `MATERIAL/T-01.md`, “Onboarding State,” lines 410–438, and `MATERIAL/T-02.md`, “Supporting Tasks,” lines 42–97.

## Where everything stands

| Status | How many |
|---|---:|
| ✅ Finished | 0 |
| 🟨 Being worked on | 2 |
| ⭕ Not started | 10 |
| ❌ Blocked | 13 |
| 🔵 Already there | 0 |
| ⬜ Dropped | 0 |
| ❓ Unclear | 0 |
| **Total** | **25** |

Two capabilities (R-01 and R-02) are built on the `phase-1-vault-foundation` branch and are waiting on the cross-platform CI run before they can be called finished. Ten are unstarted. Thirteen have a named unanswered question blocking their definition or safe completion.

## Phase 1 — Cross-platform local foundation and first-run vault setup

**The goal:** Stashly opens on Windows and macOS, creates a local vault, and remembers completed setup.

**Why it comes first:** Every later capability needs the required desktop foundation, local stores, and a vault that can open. This starting position is derived sequencing. (*Drawn from* `MATERIAL/T-00.md`, “Application Flow,” lines 58–64, and `MATERIAL/T-01.md`, “Onboarding State,” lines 410–438)

| # | Capability | Depends on | Source | Status | Done when |
|---|---|---|---|---|---|
| R-01 | Cross-platform local desktop foundation | — | `MATERIAL/T-00.md`, “Description,” lines 9–11; “Constraints,” lines 25–30 | 🟨 Built — awaiting macOS CI | On both Windows and macOS, an installed Stashly app opens a React and TypeScript screen prepared with Vite and using a visible Shadcn UI control; that screen asks Tauri to save one test record in SQLite and one test file in the local Stashly folder, then reopens and displays both after restart. |
| R-02 | First-run vault setup and launch decision | R-01 | `MATERIAL/T-01.md`, “Onboarding Data to Save” and “Onboarding State,” lines 395–438 | 🟨 Built — awaiting macOS CI | On a fresh vault, required name blocks progress when empty; vault name, starter collections, and password can be skipped; completion opens the Dashboard; closing and reopening goes straight to the Dashboard. |

**Blockers:** None stated for capability definition.

## Phase 1 implementation record

**Status: 🟨 built, not yet finished.** Both capabilities are implemented and unit-verified on Windows at commit `b14b9ce` on the `phase-1-vault-foundation` branch. Neither is ✅, because the native walkthroughs were not executed and the macOS bundle has never been produced — see the limits below.

**Verification summary:** [../docs/verification/phase-1/00-summary.md](../docs/verification/phase-1/00-summary.md) — the implementation inventory, the captured gate evidence with its precision caveats, the two walkthrough tables (marked NOT EXECUTED), the four screenshots (NOT PRODUCED), and the durable table of all 41 execution rulings plus every deferred minor.

**Where the vault lives now.** Tauri's `app_data_dir()` resolves to the **Roaming** `%APPDATA%` variant, so the final vault root is:

```
%APPDATA%\com.stashly.desktop            →  C:\Users\marka\AppData\Roaming\com.stashly.desktop
  db\stashly.db                          →  SQLite (STRICT tables, user_version = 1) + -wal/-shm
  files\                                 →  vault documents and attachments (separate from records)
```

`%LOCALAPPDATA%\com.stashly.desktop\EBWebView` exists too, but it is the WebView2 profile and holds no vault data. The earlier identifier `com.stashly.app` is **superseded**: the rename to `com.stashly.desktop` moved the vault root, the old `%LOCALAPPDATA%\com.stashly.app` directory contains only a WebView2 profile, and **no continuity with any pre-rename directory is claimed**.

**Windows evidence:** typecheck clean, 150/150 frontend tests, the scoped Biome run green over 38 files (the repo-wide run stays red on pre-existing `src/app/(template)/**` debt this phase does not own), 64/64 Rust tests, `cargo clippy --all-targets -- -D warnings` clean, and `npm run tauri build`'s frontend preflight (`tsc --noEmit` + `vite build`) succeeding. **Not evidenced:** the installer — the captured `tauri build` log stops mid-compile with no final line.

**Remaining limits, stated plainly:**

| Limit | Detail |
|---|---|
| GUI walkthroughs | No native window was driven. R-01's probe-and-restart walkthrough and R-02's seven-step first-run walkthrough are **NOT EXECUTED**, so neither capability's manual gate has passed. |
| Screenshots | All four planned images are **NOT PRODUCED**; no placeholders were committed. |
| `tauri build` | The run did not complete, so no Windows installer is evidenced for `b14b9ce`. |
| macOS | Never built or run: Windows host, only `x86_64-pc-windows-msvc` installed, no macOS toolchain. `.github/workflows/build.yml` (matrix `windows-latest` + `macos-latest`) is the declared mechanism and **has never been executed** — no CI result exists for either platform. |
| Release-artifact check | The Rust release binary was byte-scanned and contains none of the three probe commands, but the matching scan of the built frontend output for the DEV-only probe nav entry and route was not performed (Ruling 37). |
| Known limitations | A crash between the record write and the file write cannot be made atomic across the two stores (Q-10, **deferred to Phase 2**); the JS/Rust `trim()` divergence on U+0085 is parked (Ruling 31); `toggleCollection` leaves a stale error (Ruling 35); the `migrate` guard for a vault newer than `SCHEMA_VERSION` is a **Phase 2 obligation** the v2 author must add *before* the loop (Ruling 9). |

These are also carried as explicit deferrals in the plan's §8 edge-case table. The macOS matrix arm is the one remaining path to ✅ for R-01 and R-02's two-platform wording.

## Phase 2 — Core content and organization

**The goal:** A person can save core item types and organize them locally.

**Why it comes here:** Core content needs an opened local vault but does not need later views, search, protection, or cloud features. This is derived sequencing. (*Drawn from* `MATERIAL/T-01.md`, “First Dashboard Experience,” lines 361–391, and `MATERIAL/T-02.md`, “Content and Organization Modules,” lines 101–103)

| # | Capability | Depends on | Source | Status | Done when |
|---|---|---|---|---|---|
| R-03 | Create and maintain notes | R-02 | `MATERIAL/T-02.md`, “Content Management,” lines 51–53 | ❌ Q-01 | After Q-01 selects the note format, a person creates a note, edits it, closes and reopens Stashly, and sees the saved title and content. |
| R-04 | Save links and add local files | R-02 | `MATERIAL/T-02.md`, “Content Management,” lines 54–57 | ❌ Q-10 | A person saves a URL with its documented details and adds each agreed file type; after restart, every item opens its matching details or file; a forced failure leaves neither a broken record nor an untracked copied file under the agreed Q-10 rule. |
| R-05 | Organize items with collections | R-03, R-04 | `MATERIAL/T-02.md`, “Organization and Item Lifecycle,” lines 59–64 | ❌ Q-03 | Under the Q-03 rules, a person creates, renames, deletes, and reorganizes collections or folders and sees assigned items in the expected places after restart. |
| R-06 | Organize and filter items with tags | R-03, R-04 | `MATERIAL/T-02.md`, “Organization and Item Lifecycle,” lines 59–64 | ⭕ | A person creates, assigns, filters by, renames, and deletes a tag; item results and assignments update after each action and remain correct after restart. |
| R-07 | Show consistent item details | R-03, R-04 | `MATERIAL/T-02.md`, “Content Management,” lines 54–57 | ⭕ | Opening a note, link, or file shows its title, description where supported, type, tags, collection, dates, and file path where relevant. |

**Blockers:** Editor choice Q-01, collection rules Q-03, and coordinated record and file failure behavior Q-10.

## Phase 3 — Dashboard, lifecycle, and exact search

**The goal:** People can navigate active and removed content, recover earlier note content, and find exact matches.

**Why it comes here:** These views, lifecycle actions, history, and search need saved content to act on. They do not require preview, protection, backup, or cloud work. This is derived sequencing. (*Drawn from* `MATERIAL/T-02.md`, “Content and Organization Modules,” lines 101–103, and module table, lines 123–159)

| # | Capability | Depends on | Source | Status | Done when |
|---|---|---|---|---|---|
| R-08 | Dashboard, all-items, favorites, recent, and activity views | R-03, R-04, R-05, R-06 | `MATERIAL/T-02.md`, “Core Navigation and Overview” and “Organization and Item Lifecycle,” lines 44–65 | ⭕ | With prepared items covering each documented state, Dashboard shortcuts open; All Items can switch view, sort, filter, and select more than one item; favorites, recent, and activity views show only their matching items and open the selected item. |
| R-09 | Trash lifecycle | R-03, R-04 | `MATERIAL/T-02.md`, “Organization and Item Lifecycle,” lines 59–65 | ❌ Q-10 | A deleted note, link, and file disappears from active views; each can be restored; permanent deletion and empty-trash remove both records and related files without leaving either side behind under the Q-10 rule. |
| R-10 | Exact search across documented item information | R-03, R-04, R-05, R-06 | `MATERIAL/T-02.md`, “Search and Document Processing,” lines 109–111 | ⭕ | Prepared exact terms find their matching titles, note content, URLs, filenames, tags, and collections, while a missing term returns no item. |
| R-11 | Recover previous note content | R-03 | `MATERIAL/T-02.md`, module table, lines 149–159 | ❌ Q-14 | Under the Q-14 rules, an eligible edit creates a visible previous version; reopening the note lists it; recovery restores or copies the chosen old content as specified. |

**Blockers:** Trash failure handling Q-10 and Version History behavior Q-14.

## Phase 4 — Previews, indexed search, productivity, and preferences

**The goal:** Supported files can be previewed, supported content can be searched internally, common actions are faster, and everyday behavior and appearance can be adjusted.

**Why it comes here:** Preview needs stored files. Search inside documents needs saved content plus exact search. Productivity and preferences improve an already usable local vault and have no strict need to wait for indexing. This is derived sequencing. (*Drawn from* `MATERIAL/T-01.md`, “Do Not Include During Onboarding,” lines 457–472, and `MATERIAL/T-02.md`, “Storage and Data Management,” lines 67–79; “Search and Document Processing,” lines 109–111)

| # | Capability | Depends on | Source | Status | Done when |
|---|---|---|---|---|---|
| R-12 | Preview supported files | R-04 | `MATERIAL/T-02.md`, “Search, Preview, and Indexing,” lines 74–79 | ❌ Q-04 | For every preview format agreed in Q-04, opening a prepared file shows its content inside Stashly; an unsupported file shows a clear unsupported message without changing the file. |
| R-13 | Search inside supported notes and documents | R-03, R-04, R-10 | `MATERIAL/T-02.md`, “Search, Preview, and Indexing,” lines 74–79; “Search and Document Processing,” lines 109–111 | ❌ Q-04 | For every searchable format agreed in Q-04, a term found only inside prepared note or document content returns that item; an unsupported format is not presented as internally searchable. |
| R-14 | Quick actions, command palette, keyboard shortcuts, autosave, and pinning | R-03, R-04, R-08 | `MATERIAL/T-02.md`, “Core Navigation and Overview” and “Content Management,” lines 44–57 | ⭕ | Dashboard quick actions create the documented item types; the command palette opens with `Ctrl + K` and runs each documented quick action; documented shortcuts work; an edited note survives closing without a manual save; pin and unpin change its visible state. |
| R-15 | Startup behavior and general settings | R-02 | `MATERIAL/T-02.md`, “Storage and Data Management,” lines 67–72; module table, lines 138–141 | ⭕ | A person changes each documented startup and general preference, restarts Stashly, and observes and retains each selected behavior. |
| R-16 | Appearance and layout preferences | R-02 | `MATERIAL/T-02.md`, “Storage and Data Management,” lines 67–72; module table, lines 138–141 | ⭕ | A person switches light and dark themes, changes layout density, and changes sidebar preferences; each choice is visible immediately and remains after restart. |

**Blockers:** Preview and searchable formats Q-04.

## Phase 5 — Protection, storage control, recovery, and transfer

**The goal:** People can protect, inspect, relocate, recover, and transfer their local vault without losing data.

**Why it comes here:** These capabilities need real local records and files but do not need preview, indexed search, or productivity work. Phase 5 is a branch from Phase 2, not a strict follower of Phase 4. This is derived sequencing. (*Drawn from* `MATERIAL/T-02.md`, “Local Storage Architecture,” lines 105–107, and “Security, Backup, and Recovery,” lines 113–115)

| # | Capability | Depends on | Source | Status | Done when |
|---|---|---|---|---|---|
| R-17 | Vault lock and protection of agreed content | R-03, R-04 | `MATERIAL/T-02.md`, “Security and Vault Protection,” lines 81–83 | ❌ Q-02 | Under Q-02, manual lock and the agreed idle timer hide protected content; the correct master password restores access; the agreed records and selected files are unreadable through ordinary file viewing while locked; forgotten-password behavior matches the decided rule. |
| R-18 | Storage visibility and safe relocation | R-03, R-04 | `MATERIAL/T-02.md`, “Storage and Data Management,” lines 67–72 | ❌ Q-06, Q-10 | Storage view shows file count, stored-record size, total usage, and largest files for prepared data; changing location follows Q-06; after success and restart every item opens; an interrupted move follows Q-10 without splitting the usable vault. |
| R-19 | Backup and restore | R-03, R-04 | `MATERIAL/T-02.md`, “Backup and Data Transfer,” lines 85–88 | ❌ Q-05, Q-11 | A backup at the chosen location contains the scope agreed in Q-05 and passes its check; restoring into a test vault reproduces that scope; overwrite, interrupted backup, and interrupted restore follow Q-11 and leave a named usable copy. |
| R-20 | Import and export | R-03, R-04 | `MATERIAL/T-02.md`, “Backup and Data Transfer,” lines 85–88 | ❌ Q-13 | Each format agreed in Q-13 imports its supported notes, files, collections, or full vault and exports them for a second clean Stashly vault to read; unsupported content produces the agreed visible result. |

**Blockers:** Protection and password behavior Q-02, relocation Q-06, coordinated write failures Q-10, backup scope Q-05, backup overwrite and interruption Q-11, and transfer formats Q-13.

## Phase 6 — Advanced intelligence and multi-device use

**The goal:** Optional later capabilities add related-content discovery, content assistance, and use across devices without preventing core local work.

**Why it comes here:** The documents label these capabilities advanced. Semantic search needs searchable content, tagging and summaries need saved content, and cloud conflict handling needs changes on more than one device. Their later placement is derived sequencing. It is not a requirement that backup or all Phase 5 work finish first. (*Drawn from* `MATERIAL/T-02.md`, “Description,” lines 9–11; “Context & Dependencies,” lines 37–40; and “Advanced and Multi-Device Capabilities,” lines 117–119)

| # | Capability | Depends on | Source | Status | Done when |
|---|---|---|---|---|---|
| R-21 | Semantic search | R-13 | `MATERIAL/T-02.md`, “Description,” lines 9–11; “Search, Preview, and Indexing,” lines 74–79; “Search and Document Processing,” lines 109–111 | ⭕ | A prepared meaning-based search finds a relevant indexed item that does not contain the exact search words, and the person can open that result; exact search still works when this feature is unavailable. |
| R-22 | Automatic tag suggestions | R-03, R-04, R-06 | `MATERIAL/T-02.md`, “Intelligent Content Features,” lines 90–93 | ⭕ | A prepared item receives visible suggested tags; the person can accept or reject each suggestion; rejection leaves existing tags unchanged. |
| R-23 | Document summaries | R-03, R-04 | `MATERIAL/T-02.md`, “Intelligent Content Features,” lines 90–93 | ⭕ | A prepared long note and supported document each produce a visible summary linked to the source; a failed or unavailable summary leaves source content unchanged. |
| R-24 | Optional cloud synchronization | R-03, R-04 | `MATERIAL/T-02.md`, “Cross-Device Data Management,” lines 95–97 | ❌ Q-07, Q-12 | Through the provider and data boundary agreed in Q-07, a change on one supported device appears on another; when offline or service is unavailable, local work and pending-change behavior match Q-12. |
| R-25 | Multi-device conflict handling | R-24 | `MATERIAL/T-02.md`, “Context & Dependencies,” lines 39–40; “Cross-Device Data Management,” lines 95–97 | ❌ Q-08 | When the same prepared item changes on two offline devices, later synchronization shows or resolves the conflict exactly as Q-08 requires without silently discarding an unchosen change. |

**Blockers:** Provider and data boundary Q-07, offline cloud behavior Q-12, and conflict policy Q-08. No Phase 6 item is gated on backup R-19.

## Deliberately left out

| What | Why it is not here |
|---|---|
| Tables, fields, ways parts talk, commands, file layout, data-protection method, cloud provider, and rules for competing changes | The material does not define them. These belong to later decisions and implementation planning. |
| Source comparison | No source was supplied. See Q-09 in [00 - START HERE](00%20-%20START%20HERE.md). |

## Implementation handoff

**Phase 1 is built but not closed.** The next actions on R-01/R-02 are the ones listed in “Phase 1 implementation record”: drive the native R-01/R-02 walkthroughs and capture the four screenshots, complete a Windows `tauri build`, and let the `windows-latest` + `macos-latest` CI matrix run — that matrix is the only macOS evidence path, and it has not been executed. Do not mark either capability ✅ before the macOS arm reports, and do not treat the green scoped unit gates as a substitute for the manual walkthroughs.

For everything after that, select the earliest ⭕ item whose dependencies and blockers are clear. Read its supporting findings in [02 - FINDINGS](02%20-%20FINDINGS.md), proposed arrangement in [03 - SYSTEM ARCHITECTURE](03%20-%20SYSTEM%20ARCHITECTURE.md), relevant picture in [04 - DIAGRAMS](04%20-%20DIAGRAMS.md), and open questions in [00 - START HERE](00%20-%20START%20HERE.md). Phase 2's R-03, R-04, R-05 and R-09 are ❌ on unresolved questions Q-01, Q-03, Q-10 and Q-14, so they are not startable yet.

This roadmap says what to build and in what order. Separate implementation planning must decide how, define detailed checks, and hand work to coding agents.

## Status legend

| Emoji | Means |
|---|---|
| ✅ | Finished — built, checked, working |
| 🟨 | Being worked on |
| ⭕ | Not started — waiting its turn |
| ❌ | Blocked — something is stopping it |
| 🔵 | Already there — found built in supplied material |
| ⬜ | Dropped — decided against |
| ❓ | Unclear — material does not say |
