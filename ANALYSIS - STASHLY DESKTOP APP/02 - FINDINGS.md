# 02 - FINDINGS

[00 - START HERE](00%20-%20START%20HERE.md) · Previous: [01 - OVERVIEW](01%20-%20OVERVIEW.md) · Next: [03 - SYSTEM ARCHITECTURE](03%20-%20SYSTEM%20ARCHITECTURE.md)

## What was read

| Document or file | Kind | How much was read |
|---|---|---|
| `MATERIAL/T-00.md` | Development documentation brief | All of it |
| `MATERIAL/T-01.md` | Onboarding specification | All of it |
| `MATERIAL/T-02.md` | Functional scope and module specification | All of it |

No source code was read. Findings below describe intended behavior only.

## Confirmed requirements

| # | Area | What the documents require | Where it says so |
|---|---|---|---|
| D-01 | Technology constraints | Use React and TypeScript with Vite, Shadcn UI, Tauri, SQLite, and local files. Support Windows and macOS. Avoid needless complexity. | `MATERIAL/T-00.md`, “Constraints” and “Context & Dependencies,” lines 25–40 |
| D-02 | Onboarding | First launch uses a short, practical, partly skippable setup focused on configuring a personal vault. | `MATERIAL/T-01.md`, “Overview,” lines 3–15 |
| D-03 | Saved setup data | Save the required user name and completion state locally. Vault name, starter collections, and master-password setup are optional. Local storage setup is automatic. | `MATERIAL/T-01.md`, “Onboarding Data to Save,” lines 395–407 |
| D-04 | Launch decision | At launch, show onboarding when setup is incomplete; otherwise open the Dashboard. Completed onboarding must not appear automatically again. | `MATERIAL/T-01.md`, “Onboarding State,” lines 410–438 |
| D-05 | Content types | Core content is notes, saved sources or links, and local files. Files may include PDFs, images, documents, ZIP files, and code files. | `MATERIAL/T-02.md`, “Content Management,” lines 51–57; “Content and Organization Modules,” lines 101–103 |
| D-06 | Lifecycle and organization | Items can use collections, nested folders, tags, favorites, recent views, activity history, and trash with restore and permanent deletion. | `MATERIAL/T-02.md`, “Organization and Item Lifecycle,” lines 59–65 |
| D-07 | Storage split | SQLite keeps notes, metadata, collections, tags, and settings. A dedicated Stashly folder keeps documents and attachments. | `MATERIAL/T-02.md`, “Local Storage Architecture,” lines 105–107 |
| D-08 | Search and indexing | Search covers titles, notes, URLs, filenames, tags, and collections. Full-text search covers notes and supported documents, including extracted PDF text. | `MATERIAL/T-02.md`, “Search and Document Processing,” lines 109–111 |
| D-09 | Security | Vault protection includes a master password, manual locking, an automatic lock timer, and encryption of sensitive vault data and selected local files. | `MATERIAL/T-02.md`, “Security and Vault Protection,” lines 81–83 |
| D-10 | Backup and transfer | Support manual backup, a configurable backup location, restore, and import or export of selected content or the full vault. | `MATERIAL/T-02.md`, “Backup and Data Transfer,” lines 85–88 |
| D-11 | Productivity | Intended aids include Dashboard quick actions, grid and list views, sorting, filtering, multi-select, a command palette, keyboard shortcuts, autosave, and pinning. | `MATERIAL/T-02.md`, “Core Navigation and Overview” and “Content Management,” lines 44–57 |
| D-12 | Advanced features | The description explicitly treats semantic search, automatic tag suggestions, document summaries, cloud synchronization, and multi-device conflict handling as advanced capabilities. | `MATERIAL/T-02.md`, “Description,” lines 9–11; “Search, Preview, and Indexing,” lines 74–79; “Intelligent Content Features” and “Cross-Device Data Management,” lines 90–97 |
| D-13 | Settings and appearance | Settings cover storage location, startup behavior, and general preferences. Appearance covers light and dark themes, layout density, and sidebar preferences. These choices stay outside onboarding. | `MATERIAL/T-01.md`, “Do Not Include During Onboarding,” lines 457–472; `MATERIAL/T-02.md`, “Storage and Data Management,” lines 67–72; module table, lines 138–141 |
| D-14 | Version History | Keep previous versions of notes and allow recovery of old content. | `MATERIAL/T-02.md`, module table, lines 149–159 |

## Confirmed onboarding rules

- A user name is required. A vault name is optional and may be generated from the user name. (`MATERIAL/T-01.md`, “User Name” and “Vault Name,” lines 84–140)
- Starter categories allow multiple choices and no minimum. A person may skip them, then rename, delete, reorganize, or add collections later. (`MATERIAL/T-01.md`, “Categories,” “Starter Collections,” and “Skip Option,” lines 164–225)
- A master password is optional during setup. The person can show or hide it while typing and enable Vault Lock later. (`MATERIAL/T-01.md`, “Protect Your Stash,” lines 237–279)
- Setup uses default local application storage. Folder and storage-path choices stay out of onboarding. (`MATERIAL/T-01.md`, “Storage Information,” lines 283–297)
- After setup, a confirmation leads to the Dashboard. Its empty state offers adding a note, file, link, or collection. (`MATERIAL/T-01.md`, “Setup Complete” and “First Dashboard Experience,” lines 307–391)
- Themes, backup, transfer, shortcuts, search tutorials, storage paths, advanced security, technical storage settings, cloud synchronization, and advanced preferences stay out of onboarding. (`MATERIAL/T-01.md`, “Do Not Include During Onboarding,” lines 457–472)

## Derived findings

| Area | Derived conclusion | Basis |
|---|---|---|
| Product boundary | Core use should keep working without cloud synchronization. | *Drawn from* `MATERIAL/T-00.md`, “Constraints,” lines 25–30, and `MATERIAL/T-02.md`, “Advanced and Multi-Device Capabilities,” lines 117–119 |
| Build order | Exact search should precede search inside extracted document text, and semantic search should follow a working searchable-content base. This is derived sequencing, not an order stated by the documents. | *Drawn from* `MATERIAL/T-02.md`, “Context & Dependencies,” lines 37–40; “Search and Document Processing,” lines 109–111; and “Description,” lines 9–11 |
| Storage responsibility | Structured records and file contents need coordinated lifecycle operations so moving or deleting an item does not leave one side behind. The documents require both stores but do not define that coordination. | *Drawn from* `MATERIAL/T-02.md`, “Files,” lines 54–57, and “Local Storage Architecture,” lines 105–107 |
| Trust boundary | Tauri should be the trusted desktop boundary between screens and device storage. This is a proposed interpretation, not a documented implementation. | *Drawn from* `MATERIAL/T-00.md`, “Context & Dependencies,” lines 32–40, and “Application Flow,” lines 58–64 |
| User levels | The supplied scope describes one person managing one personal vault, not separate user levels. | *Drawn from* `MATERIAL/T-01.md`, “Core Onboarding Goal,” lines 511–525, and `MATERIAL/T-02.md`, “Context & Dependencies,” lines 29–40 |

## Tensions the documents do not resolve

| # | One statement | Tension | Where |
|---|---|---|---|
| C-01 | A master password is optional during onboarding. | Encryption is required for sensitive vault data and selected files, but the relationship between password choice, lock behavior, and encryption is unspecified. | `MATERIAL/T-01.md`, “Protect Your Stash,” lines 237–279; `MATERIAL/T-02.md`, “Security and Vault Protection,” lines 81–83 |
| C-02 | Onboarding automatically uses default local storage and hides path choices. | Settings later offer storage-location control, but relocation behavior is unspecified. | `MATERIAL/T-01.md`, “Storage Information,” lines 283–297; `MATERIAL/T-02.md`, “Storage and Data Management,” lines 67–72 |
| C-03 | Notes support Markdown or rich text. | The material does not choose one editor model or say whether both must coexist. | `MATERIAL/T-02.md`, “Content Management,” lines 51–53 |
| C-04 | The core stores data locally on the device. | Cloud synchronization is also in scope later, but its provider, boundaries, and offline guarantees are unspecified. | `MATERIAL/T-00.md`, “Constraints,” lines 25–30; `MATERIAL/T-02.md`, “Cross-Device Data Management,” lines 95–97 |

## What the material leaves unsaid

The material does not settle the editor choice, encryption coverage, password recovery, collection nesting rules, supported preview and indexing formats, backup contents and format, backup overwrite or interruption behavior, storage relocation behavior, coordinated record and file write failures, import and export formats, cloud provider, offline cloud behavior, conflict policy, or Version History behavior. It also gives no source code evidence to compare against these requirements. Each gap appears as an open question in [00 - START HERE](00%20-%20START%20HERE.md).
