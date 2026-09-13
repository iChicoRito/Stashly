# 00 - START HERE

Next: [01 - OVERVIEW](01%20-%20OVERVIEW.md)

**What this is about:** Stashly Desktop App
**Depth:** Standard
**Written:** 13 September 2026
**Last updated:** 13 September 2026

## What was handed over

| What | Kind | Where it came from | Read? |
|---|---|---|---|
| `T-00.md` | Development documentation brief | `MATERIAL/T-00.md` — copied verbatim into this run | Yes — in full |
| `T-01.md` | Onboarding specification | `MATERIAL/T-01.md` — copied verbatim into this run | Yes — in full |
| `T-02.md` | Functional scope and module specification | `MATERIAL/T-02.md` — copied verbatim into this run | Yes — in full |

The material describes intended scope for a local-first personal desktop vault. It does not provide source code or prove implementation status. The three small documents were copied into `MATERIAL` so citations remain frozen.

## The short version

Stashly is intended to keep notes, links, documents, and attachments in a personal vault on the user's device. React, TypeScript, Vite, Shadcn UI, Tauri, SQLite, Windows, and macOS are stated constraints. SQLite holds structured records while a dedicated local folder holds documents and attachments. Cloud and intelligence features are advanced additions, not prerequisites for core local operation; their later roadmap placement is *drawn from* that label. No supplied evidence proves any feature is built. (`MATERIAL/T-00.md`, “Constraints,” lines 25–30; `MATERIAL/T-02.md`, “Description” and “Local Storage Architecture,” lines 9–11 and 105–107)

## Everything in this analysis

| File | What it holds |
|---|---|
| [01 - OVERVIEW](01%20-%20OVERVIEW.md) | Product purpose, user, scope, and evidence state |
| [02 - FINDINGS](02%20-%20FINDINGS.md) | Confirmed requirements, derived conclusions, tensions, and gaps |
| [03 - SYSTEM ARCHITECTURE](03%20-%20SYSTEM%20ARCHITECTURE.md) | Proposed parts, responsibilities, and hand-offs |
| [04 - DIAGRAMS](04%20-%20DIAGRAMS.md) | Four useful proposed-flow pictures |
| [05 - ROADMAP](05%20-%20ROADMAP.md) | Capability phases, dependencies, blockers, statuses, and done conditions |
| [07 - WORD LIST](07%20-%20WORD%20LIST.md) | Plain meanings for unavoidable terms and product names |

## Not made this time

| File | Why not |
|---|---|
| `06 - SCREENS BY ROLE` | Supplied material describes one user level, so a role comparison would add no value. (*Drawn from* `MATERIAL/T-01.md`, “Core Onboarding Goal,” lines 511–525, and `MATERIAL/T-02.md`, “Context & Dependencies,” lines 29–40) |

## Status legend

| Emoji | Means |
|---|---|
| ✅ | Finished — built, checked, working |
| 🟨 | Being worked on |
| ⭕ | Not started — waiting its turn |
| ❌ | Blocked — something is stopping it; tracker says what |
| 🔵 | Already there — found built in supplied material |
| ⬜ | Dropped — decided against |
| ❓ | Unclear — material does not say |

## Open questions

| # | Question | Why it matters | Who can answer | Status |
|---|---|---|---|---|
| Q-01 | Will notes use Markdown, rich text, or both? | Editor behavior and saved content cannot be settled. | Product owner | ⭕ |
| Q-02 | What data and files are encrypted, how does the master password control access, and what recovery exists if it is forgotten? | Security and data-loss behavior remain undefined. | Product and security owners | ⭕ |
| Q-03 | How deeply may collections or folders nest, and can an item belong to more than one? | Organization rules and interactions remain uncertain. | Product owner | ⭕ |
| Q-04 | Which formats must preview, contribute searchable text, or remain unsupported? | Preview and indexing completion cannot be measured. | Product owner | ⭕ |
| Q-05 | What does a backup contain and what format verifies and restores it? | Recovery scope and compatibility remain undefined. | Product owner | ⭕ |
| Q-06 | When storage location changes, are existing records and files moved, copied, or left in place, and how are failures handled? | Relocation could otherwise split or lose a vault. | Product owner | ⭕ |
| Q-07 | Which cloud provider, if any, should later synchronization use, and what data may leave the device? | Outside connection, privacy, and portability depend on it. | Product owner | ⭕ |
| Q-08 | What conflict policy applies when the same item changes on multiple devices? | Synchronization cannot be defined without it. | Product owner | ⭕ |
| Q-09 | Should a later pass compare these requirements with application source code? | Current implementation status remains unknown. | Project owner | ⭕ |
| Q-10 | If a structured record is saved but its related file write fails, or the reverse happens, what must Stashly undo or repair? | Notes about files could otherwise point to missing content, or untracked files could remain on the device. | Product and storage owners | ⭕ |
| Q-11 | May a new backup overwrite an existing backup, and what remains usable if backup creation or restore is interrupted? | Recovery must not destroy the last good copy or leave the vault partly restored. | Product owner | ⭕ |
| Q-12 | When cloud service is unavailable or the device is offline, which work remains available and how are pending changes shown and retried? | Local-first behavior and user expectations during outages remain undefined. | Product owner | ⭕ |
| Q-13 | Which formats must import and export support for notes, files, collections, and a full vault, and what happens to unsupported content? | Transfer completion and compatibility cannot be measured. | Product owner | ⭕ |
| Q-14 | Which note changes create a previous version, how many versions are kept, and can recovery replace or copy old content? | Version History storage, display, and recovery behavior remain undefined. | Product owner | ⭕ |

Central tensions and their citations are recorded in [02 - FINDINGS](02%20-%20FINDINGS.md). They cover optional password versus unspecified encryption, automatic default storage versus later relocation, Markdown versus rich text, and local-first operation versus later cloud synchronization.

## Changed

| Date | What prompted it | What it touched |
|---|---|---|
| 13 September 2026 | Documentation review corrections | Findings, proposed architecture, diagrams, roadmap, word list, dates, and open questions |
