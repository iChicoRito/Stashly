# 03 - SYSTEM ARCHITECTURE

[00 - START HERE](00%20-%20START%20HERE.md) · Previous: [02 - FINDINGS](02%20-%20FINDINGS.md) · Next: [04 - DIAGRAMS](04%20-%20DIAGRAMS.md)

## How to read this note

No current arrangement was verified because no source code was supplied. Everything below is proposed. It organizes the documented technology and capabilities without inventing ways parts talk, commands, tables, fields, file layout, data-protection methods, cloud provider, or rules for competing changes.

## The arrangement today

The supplied files establish intended scope, not a built system. Implementation status is unknown. (`MATERIAL/T-00.md`, “Primary Objective,” lines 13–15; `MATERIAL/T-02.md`, “Primary Objective,” lines 13–15)

## The proposed arrangement

### Parts and responsibilities

| Proposed part | What it is for | Basis |
|---|---|---|
| React and TypeScript screens | Present onboarding, Dashboard, content, organization, search, security, storage, and settings experiences. | `MATERIAL/T-00.md`, “Context & Dependencies,” lines 32–40; `MATERIAL/T-01.md`, “Page Summary,” lines 498–507; `MATERIAL/T-02.md`, module table, lines 123–159 |
| Shadcn UI controls | Supply consistent interface controls inside those screens. | `MATERIAL/T-00.md`, “Technology Stack Definition,” lines 51–56 |
| Tauri trusted desktop boundary | Host the screens and control their access to device capabilities, SQLite, and local files. This trust role is derived, not a confirmed implementation. | *Drawn from* `MATERIAL/T-00.md`, “Context & Dependencies” and “Application Flow,” lines 32–40 and 58–64 |
| SQLite structured store | Keep notes, metadata, collections, tags, settings, and saved setup state. Exact tables and fields remain unspecified. | `MATERIAL/T-02.md`, “Local Storage Architecture,” lines 105–107; `MATERIAL/T-01.md`, “Onboarding Data to Save,” lines 395–407 |
| Dedicated local Stashly folder | Keep documents and attachments on the user's device. Exact folder layout remains unspecified. | `MATERIAL/T-02.md`, “Local Storage Architecture,” lines 105–107 |
| Search and indexing | Find matches across documented item information and extract searchable content from supported documents. Their roadmap order is derived, not stated. | `MATERIAL/T-02.md`, “Search and Document Processing,” lines 109–111; *order drawn from* [02 - FINDINGS](02%20-%20FINDINGS.md) |
| Vault protection | Lock the vault manually or after a timer and protect selected sensitive data and files. Exact encryption behavior remains unspecified. | `MATERIAL/T-02.md`, “Security, Backup, and Recovery,” lines 113–115 |
| Backup, restore, and transfer | Recover a vault and move selected content or a complete vault. Exact backup and transfer formats remain unspecified. | `MATERIAL/T-02.md`, “Backup and Data Transfer,” lines 85–88 |
| Settings and appearance | Control storage location, startup behavior, general preferences, light or dark appearance, layout density, and sidebar preferences after onboarding. | `MATERIAL/T-01.md`, “Do Not Include During Onboarding,” lines 457–472; `MATERIAL/T-02.md`, “Storage and Data Management,” lines 67–72 |
| Version History | Keep previous note versions and recover old content. Version creation, retention, and recovery rules remain unspecified. | `MATERIAL/T-02.md`, module table, lines 149–159 |
| Optional later cloud and intelligence boundary | Add semantic discovery, tag suggestions, summaries, synchronization, and conflict handling without making them prerequisites for local use. This isolation is proposed. | *Drawn from* `MATERIAL/T-00.md`, “Constraints,” lines 25–30, and `MATERIAL/T-02.md`, “Description,” lines 9–11, and “Advanced and Multi-Device Capabilities,” lines 117–119 |

Vite belongs to the development setup that prepares the React and TypeScript screens. It is not a running storage or vault part. (`MATERIAL/T-00.md`, “Description” and “Context & Dependencies,” lines 9–11 and 32–40)

### How work would pass between the parts

The person acts through React and TypeScript screens built from Shadcn UI controls. Screens ask the Tauri boundary to perform trusted desktop work. That boundary coordinates structured records in SQLite with document or attachment files in the dedicated local folder. (*Drawn from* `MATERIAL/T-00.md`, “Application Flow,” lines 58–64, and `MATERIAL/T-02.md`, “Local Storage Architecture,” lines 105–107)

Search reads documented item information. Indexing extracts searchable text from supported documents. Preview reads supported local files without changing the core storage split. The roadmap orders exact search before indexed search as a derived sequence. (`MATERIAL/T-02.md`, “Search and Document Processing,” lines 109–111; *order drawn from* [02 - FINDINGS](02%20-%20FINDINGS.md))

Vault protection, backup, restore, and transfer operate across whichever structured records and local files their final scope includes. The documents do not define the exact coverage, so those boundaries must be decided before implementation. (*Drawn from* `MATERIAL/T-02.md`, “Security, Backup, and Recovery,” lines 113–115, and “Backup and Data Transfer,” lines 85–88)

### Where things would be kept

| Place | Intended contents | Important limit |
|---|---|---|
| SQLite | Notes, metadata, collections, tags, settings, and saved onboarding state | No table or field design is stated. (`MATERIAL/T-02.md`, “Local Storage Architecture,” lines 105–107; `MATERIAL/T-01.md`, “Onboarding Data to Save,” lines 395–407) |
| Dedicated local Stashly folder | Documents and attachments | No folder layout or relocation rule is stated. (`MATERIAL/T-02.md`, “Local Storage Architecture,” lines 105–107) |
| Configurable backup location | Manual backups | No archive shape, verification rule, or overwrite behavior is stated. (`MATERIAL/T-02.md`, “Backup and Data Transfer,” lines 85–88) |
| Optional later cloud location | Synchronized data on supported devices | No provider or included-data boundary is stated. (`MATERIAL/T-02.md`, “Cross-Device Data Management,” lines 95–97) |

### Outside-world contact

Windows and macOS are required target systems. The material names no other required online service for core operation. (`MATERIAL/T-00.md`, “Platform Compatibility,” lines 66–69; `MATERIAL/T-00.md`, “Constraints,” lines 25–30)

Cloud synchronization would be an optional later outside connection. Provider choice and behavior when unavailable remain open. (*Drawn from* `MATERIAL/T-02.md`, “Cross-Device Data Management,” lines 95–97)

### What holds the proposal together

1. Local storage remains the default and first-run setup hides technical storage choices. (`MATERIAL/T-01.md`, “Storage Information,” lines 283–297)
2. Structured records and actual files remain separate, as required by the storage description. (`MATERIAL/T-02.md`, “Local Storage Architecture,” lines 105–107)
3. Windows and macOS share the same Tauri-based product boundary. (`MATERIAL/T-00.md`, “Platform Compatibility,” lines 66–69)
4. Advanced intelligence and cloud work stay outside the core local path. Their later placement is derived from the documents calling them advanced; only each capability's stated needs should gate it. (*Drawn from* `MATERIAL/T-02.md`, “Description,” lines 9–11, and “Advanced and Multi-Device Capabilities,” lines 117–119)

### What it would take to get there

The roadmap starts with the cross-platform shell and first-run vault setup, then adds content and organization before views and exact search. Preview can follow stored files; search inside documents needs exact search plus text extraction. Protection, storage control, recovery, and transfer form a separate branch after core content and do not depend on preview or indexing. Intelligence and cloud are later branches: semantic search needs indexed searchable content, while automatic tagging, summaries, cloud synchronization, and conflict handling have their own stated needs. This entire sequence is derived, not stated by the documents. (*Drawn from* `MATERIAL/T-01.md`, “Onboarding State,” lines 410–438, and `MATERIAL/T-02.md`, “Context & Dependencies,” lines 29–40; “Search and Document Processing,” lines 109–111; “Security, Backup, and Recovery,” lines 113–115; and “Advanced and Multi-Device Capabilities,” lines 117–119)

### Trade-offs and unresolved boundaries

The local split keeps core operation on-device but requires careful coordination between structured records and files. Optional cloud support later will add a second location and conflict cases. The documents do not choose the rules for either problem. (*Drawn from* `MATERIAL/T-02.md`, “Local Storage Architecture,” lines 105–107, and “Advanced and Multi-Device Capabilities,” lines 117–119)

See the open questions in [00 - START HERE](00%20-%20START%20HERE.md) before turning this proposal into an implementation plan.
