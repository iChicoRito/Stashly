//! The debug-only storage probe: the one place Phase 1 exercises both halves of D-07.
//!
//! `vault_repo` owns every read and write and `vault_paths` owns where the bytes live;
//! this module only composes them, so the probe cannot drift from what the app really
//! does. It is registered under `#[cfg(debug_assertions)]` in `lib.rs`, which is what
//! keeps an arbitrary file writer out of a release build.

use std::path::{Path, PathBuf};
use std::sync::MutexGuard;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::Connection;
use tauri::{AppHandle, Manager, State};

use crate::db::AppState;
use crate::error::{VaultError, VaultResult};
use crate::vault::LOCK_POISONED;
use crate::vault_paths::{self, VaultPaths};
use crate::vault_repo::{self, ProbeRecord};

/// One probe write, both halves: what SQLite stored and what landed in `files/`.
///
/// camelCase because that is what §4.2's `StorageProbeResult` declares; the frontend is
/// never type-checked against these names, so a rename here is a silent `undefined` there.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageProbeResult {
    pub db_record_id: i64,
    pub db_record_label: String,
    pub db_record_created_at: String,
    pub db_path: String,
    pub vault_root: String,
    pub file_path: String,
    pub file_name: String,
    pub file_bytes: u64,
}

/// One file in the vault's `files/` directory, camelCase for `StorageProbeFile`.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageProbeFile {
    pub name: String,
    pub bytes: u64,
    pub modified_at: String,
    /// The record id the file's name carries, or `None` for a file the probe did not write.
    ///
    /// Ordering only, and never serialized: `#[serde(skip)]` keeps the wire shape at
    /// §4.2's `{ name, bytes, modifiedAt }`, and a test asserts the JSON is exactly that.
    #[serde(skip)]
    pub record_id: Option<i64>,
}

/// The read half, shaped for `StorageProbeListing`.
///
/// No `rename_all` here: `records` and `files` are single words, and the nested types
/// carry their own attributes — `ProbeRecord` already serializes camelCase.
#[derive(Debug, Clone, serde::Serialize)]
pub struct StorageProbeListing {
    pub records: Vec<ProbeRecord>,
    pub files: Vec<StorageProbeFile>,
}

/// The three resolved locations the panel shows, camelCase for `StorageProbePaths`.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageProbePaths {
    pub vault_root: String,
    pub db_path: String,
    pub files_dir: String,
}

/// One probe file as it was written.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProbeFile {
    pub path: PathBuf,
    pub name: String,
    pub bytes: u64,
}

/// Writes one probe file into the vault's `files/` directory and reports what landed.
///
/// The name carries both the write's stamp and the record's id, so a second probe adds a
/// file instead of replacing the first — that is what makes persistence observable on
/// disk rather than only inside SQLite. The contents name the label and both resolved
/// paths, so a human who opens one can tell which vault wrote it.
///
/// The directory is created when it is missing, so the probe works on a vault that has
/// never been opened. Kept out of the command so it can be tested without a Tauri runtime.
pub fn write_probe_file(paths: &VaultPaths, label: &str, stamp: &str, id: i64) -> VaultResult<ProbeFile> {
    std::fs::create_dir_all(&paths.files)?;

    let name = format!("probe-{stamp}-{id}.txt");
    let path = paths.files.join(&name);
    let contents = format!(
        "Stashly storage probe\nlabel: {label}\nvaultRoot: {}\ndbPath: {}\n",
        paths.root.display(),
        paths.db.display()
    );

    std::fs::write(&path, &contents)?;

    Ok(ProbeFile { path, name, bytes: contents.len() as u64 })
}

/// Writes one probe record and one probe file, and answers with both halves.
#[tauri::command]
pub fn vault_probe_write(
    app: AppHandle,
    state: State<'_, AppState>,
    label: String,
) -> VaultResult<StorageProbeResult> {
    let paths = resolve_paths(&app)?;
    let conn = lock(&state)?;

    write_probe(&conn, &paths, &label)
}

/// One probe write: the record first, so the file's name can carry the record's own id.
///
/// Kept out of the command so both halves can be exercised together without a Tauri
/// runtime — that the two stay in step is the whole point of the probe.
fn write_probe(conn: &Connection, paths: &VaultPaths, label: &str) -> VaultResult<StorageProbeResult> {
    let record = vault_repo::insert_probe_record(conn, label)?;
    let file = write_probe_file(paths, &record.label, &compact_stamp(&record.created_at), record.id)?;

    Ok(StorageProbeResult {
        db_record_id: record.id,
        db_record_label: record.label,
        db_record_created_at: record.created_at,
        db_path: path_text(&paths.db),
        vault_root: path_text(&paths.root),
        file_path: path_text(&file.path),
        file_name: file.name,
        file_bytes: file.bytes,
    })
}

/// The newest probe records plus the vault's `files/` listing.
///
/// `limit` is `Option<u32>` because the frontend sends an explicit `null` to mean "use
/// the default": `None` and `Some(0)` both become the repository's own default limit, and
/// the repository clamps anything above its maximum. Neither number is repeated here.
#[tauri::command]
pub fn vault_probe_read(
    app: AppHandle,
    state: State<'_, AppState>,
    limit: Option<u32>,
) -> VaultResult<StorageProbeListing> {
    let paths = resolve_paths(&app)?;
    let conn = lock(&state)?;

    let records = vault_repo::list_probe_records(&conn, limit.unwrap_or(0))?;
    let files = list_probe_files(&conn, &paths.files)?;

    Ok(StorageProbeListing { records, files })
}

/// The three locations the probe reads and writes, resolved exactly as `setup()` resolves them.
#[tauri::command]
pub fn vault_probe_paths(app: AppHandle) -> VaultResult<StorageProbePaths> {
    let paths = resolve_paths(&app)?;

    Ok(StorageProbePaths {
        vault_root: path_text(&paths.root),
        db_path: path_text(&paths.db),
        files_dir: path_text(&paths.files),
    })
}

/// The vault's `files/` directory, newest first.
///
/// A directory that does not exist yet is an empty listing rather than an error: the first
/// probe creates it, and the card has to render before that. Only regular files are
/// listed, and only from `files/` — the database lives in the sibling `db/` directory,
/// which is never part of this listing.
fn list_probe_files(conn: &Connection, files_dir: &Path) -> VaultResult<Vec<StorageProbeFile>> {
    let entries = match std::fs::read_dir(files_dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(VaultError::Io(error.to_string())),
    };

    let mut files = Vec::new();
    for entry in entries {
        let entry = entry?;
        let metadata = entry.metadata()?;

        if !metadata.is_file() {
            continue;
        }

        let name = entry.file_name().to_string_lossy().into_owned();

        files.push(StorageProbeFile {
            record_id: probe_file_id(&name),
            name,
            bytes: metadata.len(),
            modified_at: iso8601_utc(conn, metadata.modified()?)?,
        });
    }

    // Newest first, matching the records. `modified_at` carries milliseconds, but two files
    // written in the same millisecond still need an order, and the record id in the name is
    // it — compared as a number, because "probe-…-10.txt" sorts *before* "probe-…-9.txt" as
    // text. A file that is not a probe file has no id and comes after the probe files it
    // ties with, ordered by name.
    files.sort_by(|left, right| {
        right
            .modified_at
            .cmp(&left.modified_at)
            .then_with(|| right.record_id.cmp(&left.record_id))
            .then_with(|| right.name.cmp(&left.name))
    });

    Ok(files)
}

/// The record id a probe file's name carries, or `None` when the probe did not write it.
///
/// `write_probe_file` writes `probe-<stamp>-<id>.txt`, so the last dash-separated segment
/// is the id. Anything a human drops into `files/` has no id to order by.
fn probe_file_id(name: &str) -> Option<i64> {
    name.strip_prefix("probe-")?.strip_suffix(".txt")?.rsplit('-').next()?.parse().ok()
}

/// A modification time as the ISO-8601 UTC text the rest of the vault writes.
///
/// SQLite formats it rather than this module: chrono is deliberately not a dependency, and
/// `strftime` here produces the same `%Y-%m-%dT%H:%M:%fZ` shape `insert_probe_record`
/// stores, so the card parses a file's timestamp and a record's timestamp the same way.
/// The millisecond part is kept, so two files written in the same second still order.
fn iso8601_utc(conn: &Connection, modified: SystemTime) -> VaultResult<String> {
    let elapsed = modified
        .duration_since(UNIX_EPOCH)
        .map_err(|error| VaultError::Io(format!("file modification time predates the Unix epoch: {error}")))?;
    let seconds = elapsed.as_secs() as f64 + f64::from(elapsed.subsec_millis()) / 1_000.0;

    let formatted = conn.query_row(
        "SELECT strftime('%Y-%m-%dT%H:%M:%fZ', ?1, 'unixepoch')",
        [seconds],
        |row| row.get::<_, String>(0),
    )?;

    Ok(formatted)
}

/// The `yyyyMMdd-HHmmss` half of a probe file's name, read out of the record's timestamp.
///
/// Deriving it from `created_at` rather than reading the clock again keeps the name and
/// the row describing the same instant. The digits are what SQLite's
/// `strftime('%Y-%m-%dT%H:%M:%fZ','now')` writes, so the first 14 are always the date and
/// time of day; the same-second id in the name still keeps two writes apart.
fn compact_stamp(created_at: &str) -> String {
    let digits: String = created_at.chars().filter(char::is_ascii_digit).collect();

    if digits.len() >= 14 {
        // `digits` holds ASCII only, so slicing on byte offsets cannot split a character.
        format!("{}-{}", &digits[0..8], &digits[8..14])
    } else {
        // Not the shape this module expects. The digits still make a usable file name,
        // where the raw text could contain a separator Windows forbids.
        digits
    }
}

/// A path as the frontend sees it, which is Tauri's own string form of it.
fn path_text(path: &Path) -> String {
    path.display().to_string()
}

/// The vault's paths, resolved with the same function `setup()` uses.
///
/// Sharing the resolver is the point: the panel cannot name a location the probe does not
/// actually write to.
fn resolve_paths(app: &AppHandle) -> VaultResult<VaultPaths> {
    let root = app.path().app_data_dir().map_err(|error| VaultError::Internal(error.to_string()))?;

    Ok(vault_paths::resolve(&root))
}

/// The vault connection, or `Internal` when a previous command panicked holding the lock.
fn lock(state: &AppState) -> VaultResult<MutexGuard<'_, Connection>> {
    state.conn.lock().map_err(|_| VaultError::Internal(LOCK_POISONED.to_string()))
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicUsize, Ordering};

    use rusqlite::Connection;

    use super::*;
    use crate::db;

    /// A distinct temp directory per test: the process id separates concurrent `cargo
    /// test` runs and the counter separates the tests inside this one. The directory is
    /// deliberately left uncreated, so the helper has to create the files directory.
    fn temp_dir(label: &str) -> PathBuf {
        static COUNTER: AtomicUsize = AtomicUsize::new(0);

        let unique = COUNTER.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("stashly-probe-{label}-{}-{unique}", std::process::id()))
    }

    fn open() -> Connection {
        db::in_memory().expect("an in-memory vault opens")
    }

    #[test]
    fn write_probe_file_creates_the_files_directory_and_reports_the_bytes_it_wrote() {
        let paths = vault_paths::resolve(&temp_dir("write"));
        assert!(!paths.files.exists(), "the test starts without a files directory");

        let file = write_probe_file(&paths, "Smoke test", "20260913-164512", 1).expect("the probe file is written");

        assert!(paths.files.is_dir(), "the files directory is created");
        assert_eq!(file.name, "probe-20260913-164512-1.txt");
        assert_eq!(file.path, paths.files.join("probe-20260913-164512-1.txt"));

        let contents = std::fs::read_to_string(&file.path).expect("the probe file is readable");
        assert!(contents.contains("Smoke test"), "the label is in the file: {contents}");
        assert!(contents.contains(&paths.root.display().to_string()), "the vault root is in the file");
        assert!(contents.contains(&paths.db.display().to_string()), "the db path is in the file");
        assert_eq!(
            file.bytes,
            std::fs::metadata(&file.path).expect("the file has metadata").len(),
            "the byte count is what landed on disk"
        );

        std::fs::remove_dir_all(&paths.root).expect("the temp directory is removed");
    }

    #[test]
    fn write_probe_file_accumulates_rather_than_overwriting_an_earlier_probe() {
        let paths = vault_paths::resolve(&temp_dir("accumulate"));

        let first = write_probe_file(&paths, "first", "20260913-164512", 1).expect("the first probe file is written");
        let second = write_probe_file(&paths, "second", "20260913-164513", 2).expect("the second probe file is written");

        assert_ne!(first.path, second.path, "a different stamp writes a different file");

        let mut names: Vec<String> = std::fs::read_dir(&paths.files)
            .expect("the files directory is listed")
            .map(|entry| entry.expect("the entry is readable").file_name().to_string_lossy().into_owned())
            .collect();
        names.sort();

        assert_eq!(names, vec!["probe-20260913-164512-1.txt", "probe-20260913-164513-2.txt"]);
        assert!(
            std::fs::read_to_string(&first.path).expect("the first file is readable").contains("first"),
            "the earlier probe still holds its own contents"
        );

        std::fs::remove_dir_all(&paths.root).expect("the temp directory is removed");
    }

    #[test]
    fn two_probes_in_the_same_second_still_leave_two_files() {
        let paths = vault_paths::resolve(&temp_dir("same-second"));

        // The id, not the stamp, is what keeps a same-second repeat from overwriting:
        // the clock only has second resolution in the name.
        let first = write_probe_file(&paths, "first", "20260913-164512", 1).expect("written");
        let second = write_probe_file(&paths, "second", "20260913-164512", 2).expect("written");

        assert_ne!(first.path, second.path);
        assert_eq!(std::fs::read_dir(&paths.files).expect("listed").count(), 2);

        std::fs::remove_dir_all(&paths.root).expect("the temp directory is removed");
    }

    #[test]
    fn compact_stamp_reads_the_date_and_time_out_of_a_sqlite_timestamp() {
        assert_eq!(compact_stamp("2026-09-13T16:45:12.345Z"), "20260913-164512");
        // Any date and any sub-second precision still yield the 14 leading digits.
        assert_eq!(compact_stamp("2026-01-02T03:04:05.000Z"), "20260102-030405");

        // Unexpected input must still produce something a file name can carry: no
        // separators, no colon.
        assert_eq!(compact_stamp("not a timestamp"), "");
    }

    #[test]
    fn the_written_name_uses_the_stamp_and_the_record_id() {
        let paths = vault_paths::resolve(&temp_dir("name"));
        let stamp = compact_stamp("2026-09-13T16:45:12.345Z");

        let file = write_probe_file(&paths, "Smoke test", &stamp, 7).expect("the probe file is written");

        assert_eq!(file.name, "probe-20260913-164512-7.txt");

        std::fs::remove_dir_all(&paths.root).expect("the temp directory is removed");
    }

    #[test]
    fn list_probe_files_is_empty_for_a_files_directory_that_does_not_exist_yet() {
        let paths = vault_paths::resolve(&temp_dir("missing"));
        assert!(!paths.files.exists(), "the directory is missing on purpose");

        let files = list_probe_files(&open(), &paths.files).expect("a missing files directory is not an error");

        assert!(files.is_empty());
    }

    /// Sets a file's modification time outright, so an ordering test does not depend on how
    /// fast two writes follow each other.
    fn set_modified(path: &Path, elapsed: std::time::Duration) {
        let file = std::fs::OpenOptions::new().write(true).open(path).expect("the file is openable");
        file.set_times(std::fs::FileTimes::new().set_modified(UNIX_EPOCH + elapsed))
            .expect("the modification time is set");
    }

    #[test]
    fn list_probe_files_lists_files_newest_first_and_skips_directories() {
        let conn = open();
        let paths = vault_paths::resolve(&temp_dir("listing"));

        let older = write_probe_file(&paths, "first", "20260913-164512", 1).expect("written");
        let newer = write_probe_file(&paths, "second", "20260913-164513", 2).expect("written");
        set_modified(&older.path, std::time::Duration::from_secs(1_757_784_000));
        set_modified(&newer.path, std::time::Duration::from_secs(1_757_784_001));
        // Only `files/` is listed, and only its regular files: a directory inside `files/`
        // is not a probe file. The database is not a case this can even meet — it lives in
        // `db/`, a sibling of the directory being read.
        std::fs::create_dir_all(paths.files.join("nested")).expect("nested directory");

        let files = list_probe_files(&conn, &paths.files).expect("the listing is read");

        assert_eq!(files.len(), 2, "the nested directory is not a file");
        // The order is the property this test is named for, so it is asserted positionally
        // rather than by membership: an inverted comparator has to fail here.
        assert_eq!(files[0].name, newer.name, "the newest file is listed first");
        assert_eq!(files[1].name, older.name);
        for file in &files {
            assert!(file.bytes > 0, "{} has its byte count", file.name);
            // The same ISO-8601 shape the records carry, so both tables format alike.
            assert_eq!(file.modified_at.len(), 24, "{} carries a full timestamp", file.name);
            assert!(file.modified_at.ends_with('Z'), "{} is UTC", file.name);
        }

        std::fs::remove_dir_all(&paths.root).expect("the temp directory is removed");
    }

    #[test]
    fn list_probe_files_orders_two_files_from_the_same_millisecond_by_their_record_id() {
        let conn = open();
        let paths = vault_paths::resolve(&temp_dir("tie-break"));

        // Ten files share one modification time, which is the only case the timestamp
        // cannot order. The ids have to be compared as numbers here: "probe-…-10.txt"
        // precedes "probe-…-9.txt" as text, so a string tie-break would list 9 first.
        let mut written = Vec::new();
        for id in 1..=10 {
            let file = write_probe_file(&paths, "tied", "20260913-164512", id).expect("written");
            set_modified(&file.path, std::time::Duration::from_secs(1_757_784_000));
            written.push(file);
        }

        let files = list_probe_files(&conn, &paths.files).expect("the listing is read");

        assert_eq!(files.len(), 10);
        // Highest id first the whole way down. A text tie-break would list 9 before 10 and
        // fail on the first element, which is the ordering this test exists to pin.
        let newest_first: Vec<&str> = files.iter().map(|file| file.name.as_str()).collect();
        let expected: Vec<&str> = written.iter().rev().map(|file| file.name.as_str()).collect();

        assert_eq!(newest_first, expected);
        assert_eq!(files[0].name, "probe-20260913-164512-10.txt");

        std::fs::remove_dir_all(&paths.root).expect("the temp directory is removed");
    }

    #[test]
    fn a_file_the_probe_did_not_write_is_listed_last_among_the_files_it_ties_with() {
        let conn = open();
        let paths = vault_paths::resolve(&temp_dir("foreign"));

        let probe = write_probe_file(&paths, "probe", "20260913-164512", 1).expect("written");
        let foreign = paths.files.join("notes.txt");
        std::fs::write(&foreign, "a file a human put here\n").expect("the foreign file is written");
        let tied = std::time::Duration::from_secs(1_757_784_000);
        set_modified(&probe.path, tied);
        set_modified(&foreign, tied);

        let files = list_probe_files(&conn, &paths.files).expect("the listing is read");

        assert_eq!(files.len(), 2, "a file the probe did not write is still listed");
        assert_eq!(files[0].name, probe.name, "the probe file leads the tie it has no id for");
        assert_eq!(files[1].record_id, None);

        std::fs::remove_dir_all(&paths.root).expect("the temp directory is removed");
    }

    #[test]
    fn a_second_probe_adds_a_record_and_a_file_rather_than_replacing_either() {
        let conn = open();
        let paths = vault_paths::resolve(&temp_dir("repeat"));

        let first = write_probe(&conn, &paths, "first").expect("the first probe is written");
        let second = write_probe(&conn, &paths, "second").expect("the second probe is written");

        assert_eq!((first.db_record_id, second.db_record_id), (1, 2), "each probe is its own record");
        // The name carries the record's own id, so two writes in the same second still
        // land in two files rather than one overwriting the other.
        assert!(second.file_name.ends_with("-2.txt"), "got {}", second.file_name);
        assert_ne!(first.file_path, second.file_path);

        assert_eq!(vault_repo::list_probe_records(&conn, 10).expect("the records are listed").len(), 2);
        assert_eq!(list_probe_files(&conn, &paths.files).expect("the files are listed").len(), 2);
        assert!(
            std::fs::read_to_string(&first.file_path).expect("the first file is readable").contains("first"),
            "the earlier probe file is still there, with its own contents"
        );
        assert!(std::fs::read_to_string(&second.file_path).expect("the second file is readable").contains("second"));

        std::fs::remove_dir_all(&paths.root).expect("the temp directory is removed");
    }

    #[test]
    fn iso8601_utc_formats_a_file_time_the_way_the_records_are_stored() {
        let conn = open();

        // The exact shape `insert_probe_record` writes through `strftime`, milliseconds
        // included, so the card renders a file's time and a record's time alike.
        assert_eq!(iso8601_utc(&conn, UNIX_EPOCH).expect("the epoch formats"), "1970-01-01T00:00:00.000Z");
        assert_eq!(
            iso8601_utc(&conn, UNIX_EPOCH + std::time::Duration::from_millis(1_234)).expect("a later time formats"),
            "1970-01-01T00:00:01.234Z"
        );
    }

    #[test]
    fn the_probe_result_serializes_camel_case_with_every_field_the_frontend_reads() {
        let result = StorageProbeResult {
            db_record_id: 3,
            db_record_label: "Smoke test".to_string(),
            db_record_created_at: "2026-09-13T16:45:12.345Z".to_string(),
            db_path: "/vault/db/stashly.db".to_string(),
            vault_root: "/vault".to_string(),
            file_path: "/vault/files/probe-20260913-164512-3.txt".to_string(),
            file_name: "probe-20260913-164512-3.txt".to_string(),
            file_bytes: 88,
        };

        let serialized = serde_json::to_value(&result).expect("the result serializes");

        // `StorageProbeResult` verbatim from `src/lib/vault/types.ts`. A rename here is a
        // silent `undefined` in the card: Rust is never checked against TypeScript.
        assert_eq!(
            serialized,
            serde_json::json!({
                "dbRecordId": 3,
                "dbRecordLabel": "Smoke test",
                "dbRecordCreatedAt": "2026-09-13T16:45:12.345Z",
                "dbPath": "/vault/db/stashly.db",
                "vaultRoot": "/vault",
                "filePath": "/vault/files/probe-20260913-164512-3.txt",
                "fileName": "probe-20260913-164512-3.txt",
                "fileBytes": 88,
            })
        );
    }

    #[test]
    fn the_listing_element_shapes_are_the_pinned_ones() {
        let listing = StorageProbeListing {
            records: vec![ProbeRecord {
                id: 2,
                label: "Smoke test".to_string(),
                created_at: "2026-09-13T16:45:12.345Z".to_string(),
            }],
            files: vec![StorageProbeFile {
                record_id: Some(2),
                name: "probe-20260913-164512-2.txt".to_string(),
                bytes: 88,
                modified_at: "2026-09-13T16:45:12.345Z".to_string(),
            }],
        };

        let serialized = serde_json::to_value(&listing).expect("the listing serializes");

        // `StorageProbeRecord` and `StorageProbeFile` verbatim from §4.2. The file's field
        // is `modifiedAt` and not `modified`: the frontend reads `modifiedAt`, so an
        // earlier draft's `modified` reached the UI as `undefined` with nothing failing.
        // The record id the ordering uses is `#[serde(skip)]`, so it is absent here.
        assert_eq!(
            serialized,
            serde_json::json!({
                "records": [{
                    "id": 2,
                    "label": "Smoke test",
                    "createdAt": "2026-09-13T16:45:12.345Z",
                }],
                "files": [{
                    "name": "probe-20260913-164512-2.txt",
                    "bytes": 88,
                    "modifiedAt": "2026-09-13T16:45:12.345Z",
                }],
            })
        );
    }

    #[test]
    fn the_paths_serialize_as_the_three_resolved_locations() {
        let paths = StorageProbePaths {
            vault_root: "/vault".to_string(),
            db_path: "/vault/db/stashly.db".to_string(),
            files_dir: "/vault/files".to_string(),
        };

        let serialized = serde_json::to_value(&paths).expect("the paths serialize");

        // `StorageProbePaths` verbatim from §4.2.
        assert_eq!(
            serialized,
            serde_json::json!({
                "vaultRoot": "/vault",
                "dbPath": "/vault/db/stashly.db",
                "filesDir": "/vault/files",
            })
        );
    }

    #[test]
    fn an_empty_listing_serializes_as_two_empty_arrays_rather_than_missing_keys() {
        let serialized =
            serde_json::to_value(StorageProbeListing { records: Vec::new(), files: Vec::new() }).expect("serializes");

        // The card reads `listing.records` and `listing.files` unconditionally, so both
        // keys have to be present even when the vault has never been probed.
        assert_eq!(serialized, serde_json::json!({ "records": [], "files": [] }));
    }
}
