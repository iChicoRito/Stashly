//! Where the vault's bytes live on disk.
//!
//! SQLite holds the records and `files/` holds documents and attachments (D-07), and
//! both hang off one root so that backing up or wiping a vault is a single directory.

use std::path::{Path, PathBuf};

use crate::error::VaultResult;

/// The three paths the rest of the app resolves against.
///
/// `root` and `files` are directories while `db` is a file, so only
/// [`VaultPaths::ensure`] knows which of them may be created.
#[derive(Debug, Clone)]
pub struct VaultPaths {
    pub root: PathBuf,
    pub db: PathBuf,
    pub files: PathBuf,
}

/// Builds the vault's layout under Tauri's `app_data_dir`.
///
/// Pure: it reads nothing and creates nothing, so it is safe to call before the app
/// has decided to keep any data.
pub fn resolve(app_data_dir: &Path) -> VaultPaths {
    let root = app_data_dir.to_path_buf();

    VaultPaths {
        db: root.join("db").join("stashly.db"),
        files: root.join("files"),
        root,
    }
}

impl VaultPaths {
    /// Creates the directories the vault needs, so a first launch on a clean machine works.
    ///
    /// Idempotent: `create_dir_all` succeeds on directories that already exist. The
    /// database file itself is created by `db::open`, not here.
    pub fn ensure(&self) -> VaultResult<()> {
        std::fs::create_dir_all(&self.root)?;

        // `db` is `<root>/db/stashly.db`, so the directory to create is its parent —
        // creating `db` itself would leave a directory where the database file belongs.
        let db_dir = self.db.parent().unwrap_or(&self.root);
        std::fs::create_dir_all(db_dir)?;

        std::fs::create_dir_all(&self.files)?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicUsize, Ordering};

    use super::*;

    /// A distinct temp directory per test: the process id separates concurrent `cargo
    /// test` runs and the counter separates the tests inside this one. The directory is
    /// deliberately left uncreated so `ensure` has to create it.
    fn temp_dir(label: &str) -> PathBuf {
        static COUNTER: AtomicUsize = AtomicUsize::new(0);

        let unique = COUNTER.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("stashly-paths-{label}-{}-{unique}", std::process::id()))
    }

    #[test]
    fn resolve_lays_out_the_database_file_and_the_files_directory() {
        let app_data_dir = temp_dir("resolve");
        assert!(!app_data_dir.exists(), "the test starts without {app_data_dir:?}");

        let paths = resolve(&app_data_dir);

        assert_eq!(paths.root, app_data_dir);
        assert_eq!(paths.db, app_data_dir.join("db").join("stashly.db"));
        assert_eq!(paths.files, app_data_dir.join("files"));
        // `resolve` is pure, so nothing exists until `ensure` runs.
        assert!(!paths.root.exists(), "resolve must not touch the disk");
    }

    #[test]
    fn ensure_creates_the_root_the_database_directory_and_the_files_directory() {
        let app_data_dir = temp_dir("ensure");
        let paths = resolve(&app_data_dir);

        paths.ensure().expect("the vault directories are created");

        assert!(paths.root.is_dir(), "the vault root is created");
        assert!(paths.db.parent().expect("the database path has a parent").is_dir(), "the db directory is created");
        assert!(paths.files.is_dir(), "the files directory is created");
        assert!(!paths.db.is_dir(), "the database path itself must stay a file path");

        // A second launch must not fail on directories that already exist.
        paths.ensure().expect("a second ensure is a no-op");

        std::fs::remove_dir_all(&paths.root).expect("the temp directory is removed");
    }
}
