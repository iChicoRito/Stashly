# 01 - OVERVIEW

[00 - START HERE](00%20-%20START%20HERE.md) · Next: [02 - FINDINGS](02%20-%20FINDINGS.md)

## What it is

Stashly is intended to be a personal desktop vault for keeping notes, saved links, files, and related information on the user's own device. The intended product is local-first: its core operation uses SQLite and a dedicated local folder rather than depending on an online service. (`MATERIAL/T-02.md`, “Description” and “Local Storage Architecture,” lines 9–11 and 105–107)

## Who uses it

| Who they are | What they come here to do | Basis |
|---|---|---|
| One person using their own vault | Save, organize, find, protect, back up, and transfer personal information | `MATERIAL/T-01.md`, “Overview,” lines 3–15; `MATERIAL/T-02.md`, “Description,” lines 9–11 |

The supplied material describes one user level. It does not define shared-vault roles or different access rights. (*Drawn from* `MATERIAL/T-01.md`, “Core Onboarding Goal,” lines 511–525, and `MATERIAL/T-02.md`, “Context & Dependencies,” lines 29–40)

## What it is intended to do

1. On first launch, guide the person through a short vault setup, save that setup locally, and open the Dashboard. (`MATERIAL/T-01.md`, “Onboarding Flow,” lines 19–33; “Onboarding Data to Save,” lines 395–407; “Onboarding State,” lines 410–438)
2. Let the person create notes, save links, add local files, and inspect item details. (`MATERIAL/T-02.md`, “Content Management,” lines 51–57)
3. Organize items with collections, folders, tags, favorites, recent views, activity history, trash, and recoverable previous note versions. (`MATERIAL/T-02.md`, “Organization and Item Lifecycle,” lines 59–65; module table, lines 123–159)
4. Find items through exact search, search inside supported documents, and preview supported files. The roadmap places exact search first as a derived sequence rather than a stated requirement. (`MATERIAL/T-02.md`, “Search, Preview, and Indexing,” lines 74–79; *sequence drawn from* `MATERIAL/T-02.md`, “Context & Dependencies,” lines 37–40, and “Search and Document Processing,” lines 109–111)
5. Protect, back up, restore, import, and export vault contents. (`MATERIAL/T-02.md`, “Security and Vault Protection” and “Backup and Data Transfer,” lines 81–88)
6. Let the person set storage location, startup behavior, general preferences, light or dark appearance, layout density, and sidebar preferences outside onboarding. (`MATERIAL/T-01.md`, “Do Not Include During Onboarding,” lines 457–472; `MATERIAL/T-02.md`, “Storage and Data Management,” lines 67–72; module table, lines 138–141)
7. Consider semantic search, automatic tagging, summaries, cloud synchronization, and conflict handling as advanced capabilities. (`MATERIAL/T-02.md`, “Search, Preview, and Indexing,” lines 74–79; “Intelligent Content Features” and “Cross-Device Data Management,” lines 90–97)

## What state it is in

The three supplied files describe intended scope, constraints, and flows. No source code or working application was supplied for this run. Therefore, these notes do not confirm that any feature exists or works. (`MATERIAL/T-00.md`, “Description,” lines 9–11; `MATERIAL/T-01.md`, full document; `MATERIAL/T-02.md`, “Primary Objective,” lines 13–15)

## What it does not establish

The material does not establish editor choice, stored-information tables or fields, file layout, data-protection method, backup format, cloud provider, or the rules for resolving competing changes. It also leaves transfer formats, interrupted backup behavior, coordinated record and file failures, offline cloud behavior, and Version History behavior open. Those gaps remain questions rather than design guesses. (*Drawn from* `MATERIAL/T-01.md`, “Protect Your Stash” and “Storage Information,” lines 237–297, and `MATERIAL/T-02.md`, “Security, Backup, and Recovery,” “Advanced and Multi-Device Capabilities,” and module table, lines 113–119 and 145–159)

It also does not prove implementation status because only documents were analyzed. See [02 - FINDINGS](02%20-%20FINDINGS.md) for confirmed and derived statements.

## Where the details are

[03 - SYSTEM ARCHITECTURE](03%20-%20SYSTEM%20ARCHITECTURE.md) presents a proposed arrangement without claiming it exists. [04 - DIAGRAMS](04%20-%20DIAGRAMS.md) gives four plain-read process pictures. [05 - ROADMAP](05%20-%20ROADMAP.md) orders intended capabilities and records blockers.
