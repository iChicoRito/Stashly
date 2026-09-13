# 04 - DIAGRAMS

[00 - START HERE](00%20-%20START%20HERE.md) · Previous: [03 - SYSTEM ARCHITECTURE](03%20-%20SYSTEM%20ARCHITECTURE.md) · Next: [05 - ROADMAP](05%20-%20ROADMAP.md)

These four diagrams describe proposed behavior, not verified implementation. They are drawn from `MATERIAL/T-00.md`, “Application Flow,” lines 58–64; `MATERIAL/T-01.md`, “Final User Flow,” lines 476–494; and `MATERIAL/T-02.md`, “Detailed Breakdown,” lines 99–119.

## 1. Big picture

```mermaid
flowchart LR
    person["One vault owner"]
    screens["React and TypeScript screens"]
    controls["Shadcn UI controls"]
    desktop["Tauri desktop boundary"]
    records["SQLite structured records"]
    files["Dedicated local Stashly folder"]
    searcher["Search and indexing"]
    protection["Lock backup and restore"]
    later["Optional later cloud and intelligence"]

    person --> screens
    controls --> screens
    screens --> desktop
    desktop --> records
    desktop --> files
    desktop --> searcher
    protection --> records
    protection --> files
    later --> desktop
```

**Reading this:** One person uses screens made with the named screen controls. The proposed Tauri boundary reaches structured records and local files. Search, protection, and recovery work across those local stores. Cloud and intelligence remain optional later additions. Matches [03 - SYSTEM ARCHITECTURE](03%20-%20SYSTEM%20ARCHITECTURE.md).

## 2. First launch and onboarding

```mermaid
flowchart TD
    opened(["Application opens"])
    completed{"Is onboarding complete"}
    welcome["Show welcome"]
    identity["Save required name and optional vault name"]
    collections["Choose or skip starter collections"]
    password["Set or skip master password"]
    local["Use default local storage"]
    summary["Show setup summary"]
    dashboard(["Open Dashboard"])

    opened --> completed
    completed -->|"yes"| dashboard
    completed -->|"no"| welcome
    welcome --> identity
    identity --> collections
    collections --> password
    password --> local
    local --> summary
    summary --> dashboard
```

**Reading this:** Returning users go straight to the Dashboard. New users move through identity, optional collections, optional protection, automatic local storage, and a summary. This follows `MATERIAL/T-01.md`, “Onboarding Flow,” lines 19–33, and “Onboarding State,” lines 410–438.

## 3. Save an item

```mermaid
flowchart TD
    beginSave(["Person chooses an item type"])
    kind{"Is it a note or saved link"}
    structured["Prepare structured information"]
    localFile["Place document or attachment in local folder"]
    metadata["Prepare file information"]
    persist["Save structured record in SQLite"]
    searchable["Make documented item information searchable"]
    finishSave(["Show saved item"])

    beginSave --> kind
    kind -->|"yes"| structured
    kind -->|"no"| localFile
    localFile --> metadata
    metadata --> persist
    structured --> persist
    persist --> searchable
    searchable --> finishSave
```

**Reading this:** Notes and saved links need structured records. Files also need local file storage plus a related structured record. The exact stored shape and failure handling are open because the documents do not define them. This is *drawn from* `MATERIAL/T-02.md`, “Content Management,” lines 51–57, and “Local Storage Architecture,” lines 105–107.

## 4. Phase order

```mermaid
flowchart LR
    p1["Phase 1 - Local foundation and vault setup"]
    p2["Phase 2 - Core content and organization"]
    p3["Phase 3 - Views lifecycle and exact search"]
    p4preview["Phase 4 - File preview"]
    p4search["Phase 4 - Search inside documents"]
    p4prod["Phase 4 - Productivity"]
    p4prefs["Phase 4 - Preferences"]
    p5["Phase 5 - Protection storage recovery and transfer"]
    p6semantic["Phase 6 - Semantic search"]
    p6assist["Phase 6 - Tag suggestions and summaries"]
    p6cloud["Phase 6 - Cloud synchronization"]
    p6conflict["Phase 6 - Conflict handling"]

    p1 --> p2
    p2 --> p3
    p2 --> p4preview
    p2 --> p4search
    p3 --> p4search
    p2 --> p4prod
    p3 --> p4prod
    p1 --> p4prefs
    p2 --> p5
    p4search --> p6semantic
    p2 --> p6assist
    p2 --> p6cloud
    p6cloud --> p6conflict
```

**Reading this:** This is derived sequencing, not an order stated by the documents. Phase 5 branches from core content and does not wait for Phase 4. Preview needs files. Search inside documents needs exact search. Productivity needs the main views. Preferences need only the foundation and completed setup. Semantic search waits for searchable document content. Tag suggestions, summaries, and cloud work draw from core content instead of backup. Conflict handling waits for cloud synchronization. Matches item-level dependencies in [05 - ROADMAP](05%20-%20ROADMAP.md). (*Drawn from* `MATERIAL/T-02.md`, “Context & Dependencies,” lines 29–40; “Search and Document Processing,” lines 109–111; “Security, Backup, and Recovery,” lines 113–115; and “Advanced and Multi-Device Capabilities,” lines 117–119)
