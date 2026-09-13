//! The vault's SQLite connection and its versioned schema.
//!
//! `PRAGMA user_version` is the schema's version. `migrate` walks it forward one
//! version at a time, so the next schema change is one new arm plus a
//! `SCHEMA_VERSION` bump rather than a rewrite.

use std::path::Path;
use std::sync::Mutex;

use rusqlite::{Connection, Transaction};

use crate::error::{VaultError, VaultResult};

/// The schema version this build writes. Bumped only by adding a migration arm.
pub const SCHEMA_VERSION: i64 = 1;

/// The vault's single connection, handed to the `#[tauri::command]` functions.
///
/// This is a `std::sync::Mutex` and not `tokio`'s: the commands are synchronous,
/// and Tauri runs a synchronous command on a worker thread, so nothing here
/// needs an async runtime to block on.
pub struct AppState {
    pub conn: Mutex<Connection>,
}

/// Opens the vault database, creating its directory when it is missing.
pub fn open(path: &Path) -> VaultResult<Connection> {
    if let Some(parent) = path.parent() {
        // `Path::new("stashly.db").parent()` is `Some("")`, which must not be created.
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)?;
        }
    }

    let conn = Connection::open(path)?;
    configure(&conn)?;

    Ok(conn)
}

/// Brings the database up to [`SCHEMA_VERSION`], one version per transaction.
///
/// A database already at `SCHEMA_VERSION` is left untouched, so calling this on
/// every start neither re-runs the DDL nor moves any data.
pub fn migrate(conn: &Connection) -> VaultResult<()> {
    let mut version = schema_version(conn)?;

    while version < SCHEMA_VERSION {
        let tx = conn.unchecked_transaction()?;

        // One arm per version, matching the version it upgrades *from*.
        match version {
            0 => apply_v1(&tx)?,
            other => return Err(VaultError::Internal(format!("There is no migration from schema version {other}."))),
        }

        tx.pragma_update(None, "user_version", version + 1)?;
        tx.commit()?;
        version += 1;
    }

    Ok(())
}

/// A migrated in-memory database for tests. The plan's schema, without a file.
#[cfg(test)]
pub fn in_memory() -> VaultResult<Connection> {
    let conn = Connection::open_in_memory()?;
    configure(&conn)?;
    migrate(&conn)?;

    Ok(conn)
}

/// The connection-level pragmas from plan §4.1.
///
/// `journal_mode = WAL` is a no-op on an in-memory database — SQLite cannot use
/// write-ahead logging without a file and keeps `memory` mode — so only the
/// file-backed test asserts it.
fn configure(conn: &Connection) -> VaultResult<()> {
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;

    Ok(())
}

fn schema_version(conn: &Connection) -> VaultResult<i64> {
    Ok(conn.query_row("PRAGMA user_version", [], |row| row.get(0))?)
}

/// Migration to version 1: the initial schema from plan §4.1.
fn apply_v1(tx: &Transaction<'_>) -> VaultResult<()> {
    tx.execute_batch(
        "CREATE TABLE IF NOT EXISTS app_settings (
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
) STRICT;",
    )?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicUsize, Ordering};

    use rusqlite::Connection;

    use super::*;

    /// A distinct temp directory per test: the process id separates concurrent
    /// `cargo test` runs and the counter separates the tests inside this one. The
    /// directory is deliberately left uncreated so `open` has to create it.
    fn temp_dir(label: &str) -> PathBuf {
        static COUNTER: AtomicUsize = AtomicUsize::new(0);

        let unique = COUNTER.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("stashly-db-{label}-{}-{unique}", std::process::id()))
    }

    fn table_sql(conn: &Connection, table: &str) -> String {
        conn.query_row("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?1", [table], |row| row.get(0))
            .unwrap_or_else(|error| panic!("table `{table}` is missing: {error}"))
    }

    #[test]
    fn in_memory_opens_at_the_current_schema_version() {
        let conn = in_memory().expect("an in-memory database opens");

        assert_eq!(schema_version(&conn).expect("the schema version is readable"), SCHEMA_VERSION);
    }

    #[test]
    fn migrate_creates_both_tables_as_strict() {
        let conn = in_memory().expect("an in-memory database opens");

        for table in ["app_settings", "collections"] {
            let sql = table_sql(&conn, table);
            assert!(sql.contains("STRICT"), "`{table}` must be declared STRICT, got: {sql}");
        }
    }

    #[test]
    fn migrate_twice_keeps_the_version_and_the_data() {
        let conn = in_memory().expect("an in-memory database opens");

        conn.execute(
            "INSERT INTO app_settings (key, value, updated_at) VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
            rusqlite::params!["user_name", "Ada"],
        )
        .expect("the seeded row is written");

        migrate(&conn).expect("a second migration is a no-op");

        assert_eq!(schema_version(&conn).expect("the schema version is readable"), SCHEMA_VERSION);

        let value: String = conn
            .query_row("SELECT value FROM app_settings WHERE key = ?1", ["user_name"], |row| row.get(0))
            .expect("the seeded row survives the second migration");
        assert_eq!(value, "Ada");

        let rows: i64 = conn
            .query_row("SELECT COUNT(*) FROM app_settings", [], |row| row.get(0))
            .expect("the table is still queryable");
        assert_eq!(rows, 1);
    }

    #[test]
    fn open_sets_wal_and_foreign_keys_on_a_file_backed_database() {
        let dir = temp_dir("wal");
        let db_path = dir.join("stashly.sqlite");

        let conn = open(&db_path).expect("the database opens");

        let journal_mode: String =
            conn.query_row("PRAGMA journal_mode", [], |row| row.get(0)).expect("journal_mode is readable");
        assert_eq!(journal_mode.to_lowercase(), "wal");

        let foreign_keys: i64 =
            conn.query_row("PRAGMA foreign_keys", [], |row| row.get(0)).expect("foreign_keys is readable");
        assert_eq!(foreign_keys, 1);

        drop(conn);
        std::fs::remove_dir_all(&dir).expect("the temp directory is removed");
    }

    #[test]
    fn open_and_migrate_survive_a_reopen_without_rerunning_the_schema() {
        let dir = temp_dir("file");
        let db_path = dir.join("vault").join("stashly.sqlite");

        let conn = open(&db_path).expect("the database opens");
        migrate(&conn).expect("the fresh database migrates");
        conn.execute(
            "INSERT INTO app_settings (key, value, updated_at) VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
            rusqlite::params!["vault_name", "Stash"],
        )
        .expect("the seeded row is written");
        drop(conn);

        // The restart path: an existing vault must come back up untouched.
        let conn = open(&db_path).expect("the database reopens");
        migrate(&conn).expect("the reopened database is already current");

        assert_eq!(schema_version(&conn).expect("the schema version is readable"), SCHEMA_VERSION);

        let value: String = conn
            .query_row("SELECT value FROM app_settings WHERE key = ?1", ["vault_name"], |row| row.get(0))
            .expect("the seeded row survives the reopen");
        assert_eq!(value, "Stash");

        drop(conn);
        std::fs::remove_dir_all(&dir).expect("the temp directory is removed");
    }

    #[test]
    fn open_creates_a_missing_parent_directory() {
        let dir = temp_dir("mkdir");
        let db_path = dir.join("db").join("stashly.sqlite");
        let parent = db_path.parent().expect("the database path has a parent");
        assert!(!parent.exists(), "the test starts without {parent:?}");

        let conn = open(&db_path).expect("the database opens");
        assert!(db_path.exists(), "open created the database file");

        drop(conn);
        std::fs::remove_dir_all(&dir).expect("the temp directory is removed");
    }
}
