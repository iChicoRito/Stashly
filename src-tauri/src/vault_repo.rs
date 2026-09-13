//! Reads and writes for everything the vault stores in SQLite.
//!
//! Settings are a key/value table, so this module owns the key names; collections are
//! the first real records. Every write that has to be all-or-nothing goes through one
//! transaction, and the master password is only ever handled as an argon2id PHC string.

use std::collections::HashSet;

use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use rand::rngs::OsRng;
use rusqlite::{Connection, OptionalExtension};

use crate::error::{VaultError, VaultResult};

/// `app_settings` keys. Phase 1 writes exactly these and nothing else.
const KEY_ONBOARDING_COMPLETED: &str = "onboarding_completed";
const KEY_USER_NAME: &str = "user_name";
const KEY_VAULT_NAME: &str = "vault_name";
const KEY_STORAGE_MODE: &str = "storage_mode";
const KEY_PROTECTION_ENABLED: &str = "protection_enabled";
const KEY_PASSWORD_SALT: &str = "password_salt";
const KEY_PASSWORD_HASH: &str = "password_hash";

const VALUE_TRUE: &str = "1";
const VALUE_FALSE: &str = "0";

/// Phase 1 stores everything on this device, so this is the only mode written.
const STORAGE_MODE_LOCAL: &str = "local";

/// The longest user name the vault accepts, shared rather than re-invented: Task 4's
/// `validate_submission` and Task 7's wizard state both need the same number, and a name
/// that passes the wizard must not then fail at submit. `save_onboarding` re-checks it
/// before its transaction opens, because a rejected submission must not write anything.
pub const MAX_USER_NAME_LEN: usize = 120;

/// Task 6's probe reuses `app_settings`, so it needs no schema of its own.
const PROBE_LABEL_SUFFIX: &str = ".label";
const PROBE_CREATED_AT_SUFFIX: &str = ".created_at";
const PROBE_DEFAULT_LIMIT: u32 = 10;
const PROBE_MAX_LIMIT: u32 = 50;

/// One row of `collections`. Serialized camelCase for `VaultCollection` in the frontend.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    pub id: i64,
    pub slug: String,
    pub name: String,
    pub created_at: String,
    pub is_starter: bool,
}

/// An initialized vault, without the IPC response envelope Task 4 adds around it.
///
/// Deliberately not `Serialize`: the `ready` payload crosses the boundary with
/// snake_case field names, which is Task 4's response type to write.
#[derive(Debug, Clone)]
pub struct VaultState {
    pub user_name: String,
    pub vault_name: String,
    pub storage_mode: String,
    pub protection_enabled: bool,
    pub onboarding_completed_at: String,
    pub collections: Vec<Collection>,
}

/// The onboarding wizard's payload, camelCase on the wire.
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingSubmission {
    pub user_name: String,
    pub vault_name: Option<String>,
    pub starter_collections: Vec<String>,
    pub master_password: Option<String>,
}

/// One R-01 storage probe record. Serialized camelCase for `StorageProbeRecord`.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProbeRecord {
    pub id: i64,
    pub label: String,
    pub created_at: String,
}

/// Reads one settings row, or `None` when the key was never written.
pub fn get_setting(conn: &Connection, key: &str) -> VaultResult<Option<String>> {
    let value = conn
        .query_row("SELECT value FROM app_settings WHERE key = ?1", [key], |row| row.get::<_, String>(0))
        .optional()?;

    Ok(value)
}

/// Writes one settings row, replacing the value and the timestamp when the key exists.
pub fn set_setting(conn: &Connection, key: &str, value: &str) -> VaultResult<()> {
    conn.execute(
        "INSERT INTO app_settings (key, value, updated_at) VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        rusqlite::params![key, value],
    )?;

    Ok(())
}

/// The vault as the app should start, or `None` when onboarding has never completed.
///
/// An empty database is not an error: `None` is what tells the frontend to show the
/// onboarding wizard.
pub fn vault_state(conn: &Connection) -> VaultResult<Option<VaultState>> {
    if get_setting(conn, KEY_ONBOARDING_COMPLETED)?.as_deref() != Some(VALUE_TRUE) {
        return Ok(None);
    }

    // The completion row carries the moment onboarding finished, so
    // `onboarding_completed_at` needs no settings key of its own.
    let onboarding_completed_at: String = conn.query_row(
        "SELECT updated_at FROM app_settings WHERE key = ?1",
        [KEY_ONBOARDING_COMPLETED],
        |row| row.get(0),
    )?;

    let user_name = get_setting(conn, KEY_USER_NAME)?.unwrap_or_default();
    let vault_name = match get_setting(conn, KEY_VAULT_NAME)? {
        Some(name) if !name.trim().is_empty() => name,
        _ => derive_vault_name(&user_name),
    };
    let storage_mode = get_setting(conn, KEY_STORAGE_MODE)?
        .filter(|mode| !mode.trim().is_empty())
        .unwrap_or_else(|| STORAGE_MODE_LOCAL.to_string());

    Ok(Some(VaultState {
        user_name,
        vault_name,
        storage_mode,
        protection_enabled: get_setting(conn, KEY_PROTECTION_ENABLED)?.as_deref() == Some(VALUE_TRUE),
        onboarding_completed_at,
        collections: list_collections(conn)?,
    }))
}

/// Writes the whole onboarding result — settings, collections, and the completion flag —
/// in one transaction, and returns the vault it created.
///
/// The submission is already validated by Task 4's `validate_submission`; only the
/// over-long user name is re-checked here, before the transaction opens, so that a
/// rejected submission cannot leave a half-written vault behind.
pub fn save_onboarding(conn: &mut Connection, submission: &OnboardingSubmission) -> VaultResult<VaultState> {
    let user_name = submission.user_name.trim();
    if user_name.is_empty() {
        return Err(VaultError::Validation("A user name is required.".to_string()));
    }
    if user_name.chars().count() > MAX_USER_NAME_LEN {
        return Err(VaultError::Validation(format!("The user name must be {MAX_USER_NAME_LEN} characters or fewer.")));
    }

    let vault_name = match submission.vault_name.as_deref().map(str::trim).filter(|name| !name.is_empty()) {
        Some(name) => name.to_string(),
        None => derive_vault_name(user_name),
    };

    // argon2id is slow on purpose, so it runs before the transaction holds the write
    // lock. `password_salt` repeats the salt the PHC string already embeds, so Phase 5
    // can find it without parsing; neither value is ever returned or logged.
    let password = match submission.master_password.as_deref() {
        Some(password) if !password.is_empty() => {
            let salt = SaltString::generate(&mut OsRng);
            Some((salt.as_str().to_string(), hash_password_with_salt(password, &salt)?))
        }
        _ => None,
    };

    let tx = conn.transaction()?;

    set_setting(&tx, KEY_USER_NAME, user_name)?;
    set_setting(&tx, KEY_VAULT_NAME, &vault_name)?;
    set_setting(&tx, KEY_STORAGE_MODE, STORAGE_MODE_LOCAL)?;

    match &password {
        Some((salt, hash)) => {
            set_setting(&tx, KEY_PROTECTION_ENABLED, VALUE_TRUE)?;
            set_setting(&tx, KEY_PASSWORD_SALT, salt)?;
            set_setting(&tx, KEY_PASSWORD_HASH, hash)?;
        }
        None => set_setting(&tx, KEY_PROTECTION_ENABLED, VALUE_FALSE)?,
    }

    create_collections(&tx, &submission.starter_collections, true)?;

    // Written last so that its `updated_at` is the completion time `vault_state` reports.
    set_setting(&tx, KEY_ONBOARDING_COMPLETED, VALUE_TRUE)?;

    tx.commit()?;

    vault_state(conn)?.ok_or_else(|| {
        VaultError::Internal("The vault could not be read back after onboarding was saved.".to_string())
    })
}

/// Every collection, by name.
pub fn list_collections(conn: &Connection) -> VaultResult<Vec<Collection>> {
    let mut statement = conn.prepare(
        "SELECT id, slug, name, created_at, is_starter FROM collections ORDER BY name COLLATE NOCASE, id",
    )?;

    let rows = statement.query_map([], |row| {
        Ok(Collection {
            id: row.get(0)?,
            slug: row.get(1)?,
            name: row.get(2)?,
            created_at: row.get(3)?,
            is_starter: row.get(4)?,
        })
    })?;

    Ok(rows.collect::<rusqlite::Result<Vec<Collection>>>()?)
}

/// Creates the named collections, skipping names that are already stored, and returns
/// the full list.
pub fn create_collections(conn: &Connection, names: &[String], is_starter: bool) -> VaultResult<Vec<Collection>> {
    // The names already stored, so that repeating a call changes nothing, and every slug
    // in use, so that two different names which slugify the same both keep a row — the
    // second one under a `-2`, `-3`, … suffix rather than being dropped. Keying the
    // repeat check on the name (not the slug) is what keeps a suffixed row idempotent:
    // its slug is `-2`, not the base the second call computes again.
    let mut stored_names: HashSet<String> = HashSet::new();
    let mut taken_slugs: HashSet<String> = HashSet::new();

    {
        let mut statement = conn.prepare("SELECT slug, name FROM collections")?;
        let rows = statement.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))?;

        for row in rows {
            let (slug, name) = row?;
            taken_slugs.insert(slug);
            stored_names.insert(name);
        }
    }

    for name in names {
        let name = name.trim();
        if name.is_empty() || stored_names.contains(name) {
            continue;
        }

        // A name with no alphanumerics still gets a row: the user chose it, so it is
        // stored under a readable slug instead of being thrown away.
        let base = match slugify(name) {
            slug if slug.is_empty() => "collection".to_string(),
            slug => slug,
        };
        let slug = free_slug(&base, &taken_slugs);

        conn.execute(
            "INSERT INTO collections (slug, name, created_at, is_starter)
             VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ','now'), ?3)",
            rusqlite::params![slug, name, i64::from(is_starter)],
        )?;

        taken_slugs.insert(slug);
        stored_names.insert(name.to_string());
    }

    list_collections(conn)
}

/// `base`, or the first `base-2`, `base-3`, … that no row holds.
fn free_slug(base: &str, taken: &HashSet<String>) -> String {
    if !taken.contains(base) {
        return base.to_string();
    }

    let mut suffix = 2;
    loop {
        let candidate = format!("{base}-{suffix}");
        if !taken.contains(&candidate) {
            return candidate;
        }
        suffix += 1;
    }
}

/// The slug form of a collection name: lowercase alphanumerics, every other run
/// collapsed to one `-`, and no leading or trailing dash.
///
/// Deliberately not ASCII-folded: `slugify("Café")` is `café`, not `cafe`. Folding would
/// turn a name into another name's slug, and the `UNIQUE` constraint would then force the
/// user's collection to a `-2` suffix. Phase 1's starter collections are ASCII, so
/// nothing reachable today produces a non-ASCII slug.
pub fn slugify(name: &str) -> String {
    let mut slug = String::new();
    let mut pending_dash = false;

    for character in name.chars().flat_map(char::to_lowercase) {
        if character.is_alphanumeric() {
            // The first run of separators becomes one dash; leading ones never do, and a
            // trailing run is left off because nothing follows it.
            if pending_dash && !slug.is_empty() {
                slug.push('-');
            }
            pending_dash = false;
            slug.push(character);
        } else {
            pending_dash = true;
        }
    }

    slug
}

/// `<name>'s Stash`, or `My Stash` when the name is blank.
pub fn derive_vault_name(user_name: &str) -> String {
    match user_name.trim() {
        "" => "My Stash".to_string(),
        name => format!("{name}'s Stash"),
    }
}

/// Hashes a master password to an argon2id PHC string with a fresh random salt.
pub fn hash_master_password(password: &str) -> VaultResult<String> {
    hash_password_with_salt(password, &SaltString::generate(&mut OsRng))
}

/// The one place a password is hashed, so the salt that goes into `password_salt` is
/// always the salt inside the PHC string that goes into `password_hash`.
fn hash_password_with_salt(password: &str, salt: &SaltString) -> VaultResult<String> {
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), salt)
        .map_err(|error| VaultError::Internal(format!("The master password could not be hashed: {error}")))?;

    Ok(hash.to_string())
}

/// Checks a master password against a stored PHC string.
pub fn verify_master_password(password: &str, phc: &str) -> VaultResult<bool> {
    let parsed = PasswordHash::new(phc)
        .map_err(|error| VaultError::Internal(format!("The stored master password is unreadable: {error}")))?;

    Ok(Argon2::default().verify_password(password.as_bytes(), &parsed).is_ok())
}

/// Stores one probe record under `probe.<n>.label` / `probe.<n>.created_at`.
pub fn insert_probe_record(conn: &Connection, label: &str) -> VaultResult<ProbeRecord> {
    let id = next_probe_id(conn)?;
    let created_at: String =
        conn.query_row("SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now')", [], |row| row.get(0))?;

    set_setting(conn, &probe_key(id, PROBE_LABEL_SUFFIX), label)?;
    set_setting(conn, &probe_key(id, PROBE_CREATED_AT_SUFFIX), &created_at)?;

    Ok(ProbeRecord { id, label: label.to_string(), created_at })
}

/// The newest `limit` probe records, newest first.
///
/// `0` means the default of 10 and anything above 50 is clamped to 50, matching what
/// Task 6's card can display.
pub fn list_probe_records(conn: &Connection, limit: u32) -> VaultResult<Vec<ProbeRecord>> {
    let limit = if limit == 0 { PROBE_DEFAULT_LIMIT } else { limit.min(PROBE_MAX_LIMIT) };

    // One probe record is two settings rows, so this joins them: `label.key` is
    // `probe.<n>.label` and the joined key is the same `<n>` as `probe.<n>.created_at`.
    // A label without its timestamp is not a record and is left out. Starting `substr`
    // at 7 skips `probe.` and its length drops the trailing 12 characters (`.label`).
    let sql = format!(
        "SELECT CAST(substr(label.key, 7, length(label.key) - 12) AS INTEGER) AS id, label.value, created.value
           FROM app_settings AS label
           JOIN app_settings AS created
             ON created.key = 'probe.' || substr(label.key, 7, length(label.key) - 12) || '{PROBE_CREATED_AT_SUFFIX}'
          WHERE label.key LIKE 'probe.%{PROBE_LABEL_SUFFIX}'
          ORDER BY id DESC
          LIMIT ?1"
    );
    let mut statement = conn.prepare(&sql)?;

    let rows = statement.query_map([limit], |row| {
        Ok(ProbeRecord { id: row.get(0)?, label: row.get(1)?, created_at: row.get(2)? })
    })?;

    Ok(rows.collect::<rusqlite::Result<Vec<ProbeRecord>>>()?)
}

/// The keys one probe record is stored under.
fn probe_key(id: i64, suffix: &str) -> String {
    format!("probe.{id}{suffix}")
}

/// The number for the next probe record: one past the highest `probe.<n>.` already stored.
///
/// Counting probe rows instead would collide with an existing record as soon as one is
/// deleted or a database is edited by hand; the highest index cannot.
fn next_probe_id(conn: &Connection) -> VaultResult<i64> {
    let sql = format!("SELECT key FROM app_settings WHERE key LIKE 'probe.%{PROBE_LABEL_SUFFIX}'");
    let mut statement = conn.prepare(&sql)?;

    let keys = statement.query_map([], |row| row.get::<_, String>(0))?;

    let mut highest = 0;
    for key in keys {
        if let Some(id) = probe_id(&key?) {
            highest = highest.max(id);
        }
    }

    Ok(highest + 1)
}

/// The `<n>` of a `probe.<n>.label` key, or `None` when the key is not a probe label.
fn probe_id(key: &str) -> Option<i64> {
    key.strip_prefix("probe.")?.strip_suffix(PROBE_LABEL_SUFFIX)?.parse().ok()
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use rusqlite::Connection;

    use super::*;
    use crate::db;

    fn open() -> Connection {
        db::in_memory().expect("an in-memory vault opens")
    }

    /// An already-valid submission, which is what Task 4 hands to `save_onboarding`.
    fn submission(user_name: &str) -> OnboardingSubmission {
        OnboardingSubmission {
            user_name: user_name.to_string(),
            vault_name: None,
            starter_collections: vec!["Personal Documents".to_string(), "Work".to_string()],
            master_password: None,
        }
    }

    fn count(conn: &Connection, table: &str) -> i64 {
        conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| row.get(0)).expect("the table is countable")
    }

    fn updated_at(conn: &Connection, key: &str) -> String {
        conn.query_row("SELECT updated_at FROM app_settings WHERE key = ?1", [key], |row| row.get(0))
            .expect("the setting has a timestamp")
    }

    /// What a collection is, ignoring the order the list happens to be in.
    fn signature(collections: &[Collection]) -> Vec<(i64, String, String, bool)> {
        let mut signature = collections
            .iter()
            .map(|collection| (collection.id, collection.slug.clone(), collection.created_at.clone(), collection.is_starter))
            .collect::<Vec<_>>();
        signature.sort();

        signature
    }

    fn names(collections: &[Collection]) -> Vec<String> {
        collections.iter().map(|collection| collection.name.clone()).collect()
    }

    #[test]
    fn set_setting_round_trips_and_overwrites_in_place() {
        let conn = open();

        assert_eq!(get_setting(&conn, "vault_name").expect("the lookup succeeds"), None);

        set_setting(&conn, "vault_name", "Stash").expect("the first write succeeds");
        assert_eq!(get_setting(&conn, "vault_name").expect("the lookup succeeds").as_deref(), Some("Stash"));

        let first_write = updated_at(&conn, "vault_name");
        assert_eq!(first_write.len(), 24, "timestamps are ISO-8601 UTC with milliseconds");

        // Long enough that a kept timestamp would be visibly different. This is the row
        // `vault_state` reads `onboarding_completed_at` from, so a stale `updated_at`
        // would put a wrong completion time in the UI without any other test failing.
        std::thread::sleep(Duration::from_millis(20));
        set_setting(&conn, "vault_name", "Vault").expect("the upsert succeeds");

        assert_eq!(get_setting(&conn, "vault_name").expect("the lookup succeeds").as_deref(), Some("Vault"));
        assert_eq!(count(&conn, "app_settings"), 1, "an upsert replaces the row instead of adding one");
        assert_ne!(updated_at(&conn, "vault_name"), first_write, "an upsert refreshes the timestamp as well as the value");
    }

    #[test]
    fn create_collections_inserts_the_names_and_returns_them_sorted_by_name() {
        let conn = open();
        let requested =
            vec!["Work".to_string(), "Learning & References".to_string(), "Personal Documents".to_string()];

        let collections = create_collections(&conn, &requested, true).expect("the collections are created");

        assert_eq!(
            names(&collections),
            vec!["Learning & References", "Personal Documents", "Work"],
            "the returned list is sorted by name"
        );
        assert_eq!(collections[0].slug, "learning-references");
        assert_eq!(collections[1].slug, "personal-documents");
        assert_eq!(collections[2].slug, "work");
        assert!(collections.iter().all(|collection| collection.is_starter));
        assert!(collections.iter().all(|collection| collection.id > 0));
        assert!(collections.iter().all(|collection| collection.created_at.len() == 24));
        assert_eq!(count(&conn, "collections"), 3);
    }

    #[test]
    fn create_collections_is_idempotent_by_name_and_keeps_the_first_created_at() {
        let conn = open();
        let requested = vec!["Personal Documents".to_string(), "Work".to_string()];

        let first = create_collections(&conn, &requested, true).expect("the collections are created");

        // Long enough that a rewritten row would carry a different timestamp.
        std::thread::sleep(Duration::from_millis(20));
        let second = create_collections(&conn, &requested, true).expect("the second call succeeds");

        assert_eq!(count(&conn, "collections"), 2, "a repeated call adds no rows");
        assert_eq!(signature(&first), signature(&second), "the existing rows, ids and timestamps are untouched");
    }

    #[test]
    fn create_collections_keeps_both_rows_when_two_names_slugify_the_same() {
        let conn = open();
        let requested = vec!["Personal Documents".to_string(), "personal  documents!".to_string()];

        let collections = create_collections(&conn, &requested, true).expect("both collections are created");

        let mut slugs: Vec<&str> = collections.iter().map(|collection| collection.slug.as_str()).collect();
        slugs.sort_unstable();

        let mut returned = names(&collections);
        returned.sort();

        assert_eq!(count(&conn, "collections"), 2, "neither collection is dropped");
        assert_eq!(slugs, vec!["personal-documents", "personal-documents-2"]);
        assert_eq!(returned, vec!["Personal Documents", "personal  documents!"]);

        // And the collision is still idempotent on the way back in.
        create_collections(&conn, &requested, true).expect("the repeated call succeeds");
        assert_eq!(count(&conn, "collections"), 2, "the suffixed row is matched by name on the repeat");
    }

    #[test]
    fn create_collections_skips_a_blank_name() {
        let conn = open();
        let requested = vec!["Work".to_string(), String::new(), "   ".to_string()];

        let collections = create_collections(&conn, &requested, true).expect("the named collection is created");

        assert_eq!(count(&conn, "collections"), 1, "a blank name is not a collection");
        assert_eq!(names(&collections), vec!["Work"]);
    }

    #[test]
    fn create_collections_gives_a_name_with_no_slug_a_readable_one() {
        let conn = open();
        let requested = vec!["***".to_string(), "!!".to_string()];

        let collections = create_collections(&conn, &requested, true).expect("both collections are created");

        let mut slugs: Vec<&str> = collections.iter().map(|collection| collection.slug.as_str()).collect();
        slugs.sort_unstable();

        assert_eq!(count(&conn, "collections"), 2, "a name the user chose is never dropped");
        assert_eq!(slugs, vec!["collection", "collection-2"]);
        assert_eq!(names(&collections), vec!["!!", "***"], "the list is by name, not insertion order");
    }

    #[test]
    fn save_onboarding_writes_the_settings_the_collections_and_the_flag_in_one_transaction() {
        let mut conn = open();
        let submission = submission("Ada Lovelace");

        let state = save_onboarding(&mut conn, &submission).expect("the vault is created");

        assert_eq!(get_setting(&conn, KEY_ONBOARDING_COMPLETED).expect("read").as_deref(), Some(VALUE_TRUE));
        assert_eq!(get_setting(&conn, KEY_USER_NAME).expect("read").as_deref(), Some("Ada Lovelace"));
        assert_eq!(get_setting(&conn, KEY_VAULT_NAME).expect("read").as_deref(), Some("Ada Lovelace's Stash"));
        assert_eq!(get_setting(&conn, KEY_STORAGE_MODE).expect("read").as_deref(), Some(STORAGE_MODE_LOCAL));
        assert_eq!(get_setting(&conn, KEY_PROTECTION_ENABLED).expect("read").as_deref(), Some(VALUE_FALSE));
        assert_eq!(get_setting(&conn, KEY_PASSWORD_HASH).expect("read"), None, "no password row without a password");
        assert_eq!(get_setting(&conn, KEY_PASSWORD_SALT).expect("read"), None);
        assert_eq!(count(&conn, "app_settings"), 5);
        assert_eq!(count(&conn, "collections"), 2);

        // The completion timestamp is the one the same transaction wrote.
        assert_eq!(state.onboarding_completed_at, updated_at(&conn, KEY_ONBOARDING_COMPLETED));
        assert_eq!(state.onboarding_completed_at.len(), 24);
        assert_eq!(names(&state.collections), vec!["Personal Documents", "Work"]);
    }

    #[test]
    fn save_onboarding_stores_only_the_phc_string_and_its_salt_for_a_password() {
        let mut conn = open();
        let mut submission = submission("Ada");
        submission.vault_name = Some("Ada's Vault".to_string());
        submission.master_password = Some("correct horse battery".to_string());

        let state = save_onboarding(&mut conn, &submission).expect("the vault is created");

        let hash = get_setting(&conn, KEY_PASSWORD_HASH).expect("read").expect("the hash is stored");
        let salt = get_setting(&conn, KEY_PASSWORD_SALT).expect("read").expect("the salt is stored");

        assert!(state.protection_enabled);
        assert_eq!(get_setting(&conn, KEY_PROTECTION_ENABLED).expect("read").as_deref(), Some(VALUE_TRUE));
        assert_eq!(state.vault_name, "Ada's Vault", "a given vault name wins over the derived one");
        assert!(hash.starts_with("$argon2id$"), "the stored value is an argon2id PHC string, not the password");
        assert!(hash.contains(&salt), "the stored salt is the one inside the PHC string");
        assert!(
            !hash.contains("correct horse battery") && !salt.contains("correct horse battery"),
            "the plaintext password is in neither stored value"
        );
        assert!(verify_master_password("correct horse battery", &hash).expect("the check runs"));
        assert!(!verify_master_password("correct horse batteru", &hash).expect("the check runs"));
    }

    #[test]
    fn save_onboarding_rejects_an_over_long_user_name_before_writing_anything() {
        let mut conn = open();
        let submission = submission(&"A".repeat(5000));

        let error = save_onboarding(&mut conn, &submission).expect_err("the name is too long");

        assert_eq!(error.code(), "validation");
        assert_eq!(count(&conn, "app_settings"), 0, "not one settings row may be written");
        assert_eq!(count(&conn, "collections"), 0, "and not one collection either");
        assert!(vault_state(&conn).expect("the state is readable").is_none(), "the vault is still uninitialized");
    }

    #[test]
    fn a_rejected_submission_leaves_an_initialized_vault_untouched() {
        let mut conn = open();
        save_onboarding(&mut conn, &submission("Ada")).expect("the vault is created");
        let before = vault_state(&conn).expect("the state is readable").expect("the vault is initialized");

        let error = save_onboarding(&mut conn, &submission(&"A".repeat(5000))).expect_err("the name is too long");

        assert_eq!(error.code(), "validation");
        let after = vault_state(&conn).expect("the state is readable").expect("the vault is initialized");
        assert_eq!(after.user_name, before.user_name);
        assert_eq!(signature(&after.collections), signature(&before.collections));
        assert_eq!(count(&conn, "app_settings"), 5, "the failed call wrote nothing at all");
    }

    #[test]
    fn save_onboarding_accepts_a_user_name_at_the_limit() {
        let mut conn = open();
        let submission = submission(&"A".repeat(MAX_USER_NAME_LEN));

        let state = save_onboarding(&mut conn, &submission).expect("a 120 character name is accepted");

        assert_eq!(state.user_name.chars().count(), MAX_USER_NAME_LEN);
    }

    #[test]
    fn save_onboarding_rejects_a_blank_user_name_before_writing_anything() {
        for blank in ["", "   "] {
            let mut conn = open();

            let error = save_onboarding(&mut conn, &submission(blank)).expect_err("a blank name is rejected");

            assert_eq!(error.code(), "validation");
            assert_eq!(count(&conn, "app_settings"), 0, "a blank name writes no settings");
            assert_eq!(count(&conn, "collections"), 0, "and no collections");
            assert!(vault_state(&conn).expect("the state is readable").is_none());
        }
    }

    #[test]
    fn save_onboarding_treats_an_empty_password_as_no_protection() {
        let mut conn = open();
        let mut submission = submission("Ada");
        submission.master_password = Some(String::new());

        let state = save_onboarding(&mut conn, &submission).expect("the vault is created");

        assert!(!state.protection_enabled);
        assert_eq!(get_setting(&conn, KEY_PROTECTION_ENABLED).expect("read").as_deref(), Some(VALUE_FALSE));
        assert_eq!(get_setting(&conn, KEY_PASSWORD_HASH).expect("read"), None, "no hash row is written");
        assert_eq!(get_setting(&conn, KEY_PASSWORD_SALT).expect("read"), None, "and no salt row either");
        assert_eq!(count(&conn, "app_settings"), 5, "an empty password adds no rows");
    }

    #[test]
    fn vault_state_on_an_empty_database_is_none_rather_than_an_error() {
        let conn = open();

        assert!(vault_state(&conn).expect("an empty vault is not an error").is_none());
    }

    #[test]
    fn vault_state_reports_the_identity_the_protection_and_the_collections() {
        let mut conn = open();
        let mut submission = submission("Mark Adrianne");
        submission.master_password = Some("a long enough password".to_string());

        save_onboarding(&mut conn, &submission).expect("the vault is created");
        let state = vault_state(&conn).expect("the state is readable").expect("the vault is initialized");

        assert_eq!(state.user_name, "Mark Adrianne");
        assert_eq!(state.vault_name, "Mark Adrianne's Stash");
        assert_eq!(state.storage_mode, "local");
        assert!(state.protection_enabled);
        assert_eq!(state.onboarding_completed_at.len(), 24);
        assert_eq!(names(&state.collections), vec!["Personal Documents", "Work"]);
    }

    #[test]
    fn vault_state_keeps_a_stored_vault_name_that_differs_from_the_derived_one() {
        let mut conn = open();
        let mut submission = submission("Ada");
        submission.vault_name = Some("  The Study  ".to_string());

        save_onboarding(&mut conn, &submission).expect("the vault is created");

        let state = vault_state(&conn).expect("the state is readable").expect("the vault is initialized");
        assert_eq!(state.vault_name, "The Study");
    }

    #[test]
    fn hash_master_password_produces_a_salted_argon2id_phc_string() {
        let first = hash_master_password("hunter2hunter2").expect("the password hashes");
        let second = hash_master_password("hunter2hunter2").expect("the password hashes again");

        assert!(first.starts_with("$argon2id$"));
        assert_ne!(first, second, "the same password hashes differently because each call salts itself");
        assert_eq!(first.split('$').count(), 6, "PHC: $argon2id$v=..$m=..,t=..,p=..$salt$hash");
        assert_eq!(first.split('$').nth(1), Some("argon2id"));
        assert!(first.split('$').nth(4).expect("the salt is present").len() >= 16);
    }

    #[test]
    fn verify_master_password_accepts_the_right_password_and_rejects_a_wrong_one() {
        let phc = hash_master_password("hunter2hunter2").expect("the password hashes");

        assert!(verify_master_password("hunter2hunter2", &phc).expect("the check runs"));
        assert!(!verify_master_password("hunter2hunter3", &phc).expect("the check runs"));
        assert!(!verify_master_password("", &phc).expect("the check runs"));

        let error = verify_master_password("hunter2hunter2", "not-a-phc-string").expect_err("the hash is unreadable");
        assert_eq!(error.code(), "internal");
    }

    #[test]
    fn derive_vault_name_uses_the_whole_trimmed_user_name() {
        assert_eq!(derive_vault_name("Mark Adrianne"), "Mark Adrianne's Stash");
        assert_eq!(derive_vault_name("  Mark  "), "Mark's Stash");
    }

    #[test]
    fn derive_vault_name_falls_back_when_the_name_is_blank() {
        assert_eq!(derive_vault_name(""), "My Stash");
        assert_eq!(derive_vault_name("   "), "My Stash");
    }

    #[test]
    fn slugify_lowercases_and_collapses_everything_else_to_single_dashes() {
        assert_eq!(slugify("Learning & References"), "learning-references");
        assert_eq!(slugify("Personal Documents"), "personal-documents");
        assert_eq!(slugify("  Work  "), "work");
        assert_eq!(slugify("Finance / Taxes (2026)"), "finance-taxes-2026");
        assert_eq!(slugify("a--b__c"), "a-b-c");
        assert_eq!(slugify("***"), "", "a name with no alphanumerics has no slug");
        assert_eq!(slugify("Café"), "café", "non-ASCII letters are kept rather than folded away");
    }

    #[test]
    fn insert_probe_record_numbers_the_rows_and_timestamps_them() {
        let conn = open();

        let first = insert_probe_record(&conn, "first").expect("the probe is stored");
        let second = insert_probe_record(&conn, "second").expect("the probe is stored");

        assert_eq!(first.id, 1);
        assert_eq!(second.id, 2);
        assert_eq!(first.label, "first");
        assert_eq!(first.created_at.len(), 24);
        assert_eq!(get_setting(&conn, "probe.2.label").expect("read").as_deref(), Some("second"));
        assert_eq!(
            get_setting(&conn, "probe.2.created_at").expect("read").as_deref(),
            Some(second.created_at.as_str())
        );
    }

    #[test]
    fn list_probe_records_returns_the_newest_first_and_honours_the_limit() {
        let conn = open();
        for label in ["one", "two", "three"] {
            insert_probe_record(&conn, label).expect("the probe is stored");
        }

        let records = list_probe_records(&conn, 10).expect("the probes are listed");

        assert_eq!(records.iter().map(|record| record.label.as_str()).collect::<Vec<_>>(), vec!["three", "two", "one"]);
        assert_eq!(records[0].id, 3);

        let newest = list_probe_records(&conn, 2).expect("the probes are listed");
        assert_eq!(newest.iter().map(|record| record.label.as_str()).collect::<Vec<_>>(), vec!["three", "two"]);
    }

    #[test]
    fn list_probe_records_defaults_zero_to_ten_and_clamps_above_fifty() {
        let conn = open();
        for index in 1..=55 {
            insert_probe_record(&conn, &format!("probe {index}")).expect("the probe is stored");
        }

        assert_eq!(list_probe_records(&conn, 0).expect("the default applies").len(), PROBE_DEFAULT_LIMIT as usize);
        assert_eq!(list_probe_records(&conn, 5).expect("the limit applies").len(), 5);

        let clamped = list_probe_records(&conn, 900).expect("the limit is clamped");
        assert_eq!(clamped.len(), PROBE_MAX_LIMIT as usize);
        assert_eq!(clamped[0].id, 55, "the clamped list still starts at the newest record");
    }

    #[test]
    fn a_collection_serializes_as_camel_case_for_the_frontend() {
        let collection = Collection {
            id: 7,
            slug: "work".to_string(),
            name: "Work".to_string(),
            created_at: "2026-09-13T00:00:00.000Z".to_string(),
            is_starter: true,
        };

        assert_eq!(
            serde_json::to_value(&collection).expect("the collection serializes"),
            serde_json::json!({
                "id": 7,
                "slug": "work",
                "name": "Work",
                "createdAt": "2026-09-13T00:00:00.000Z",
                "isStarter": true,
            })
        );
    }

    #[test]
    fn a_probe_record_serializes_as_camel_case_for_the_frontend() {
        let record = ProbeRecord {
            id: 2,
            label: "probe".to_string(),
            created_at: "2026-09-13T00:00:00.000Z".to_string(),
        };

        assert_eq!(
            serde_json::to_value(&record).expect("the record serializes"),
            serde_json::json!({
                "id": 2,
                "label": "probe",
                "createdAt": "2026-09-13T00:00:00.000Z",
            })
        );
    }

    #[test]
    fn an_onboarding_submission_deserializes_from_camel_case() {
        let submission: OnboardingSubmission = serde_json::from_value(serde_json::json!({
            "userName": "Ada",
            "vaultName": null,
            "starterCollections": [],
            "masterPassword": "hunter2hunter2",
        }))
        .expect("the submission deserializes");

        assert_eq!(submission.user_name, "Ada");
        assert_eq!(submission.vault_name, None);
        assert!(submission.starter_collections.is_empty());
        assert_eq!(submission.master_password.as_deref(), Some("hunter2hunter2"));
    }
}
