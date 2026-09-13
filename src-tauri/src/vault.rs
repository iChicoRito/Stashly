//! The `#[tauri::command]` functions the frontend reaches over IPC.
//!
//! `vault_repo` owns every read and every write; this module owns only the wire shapes
//! (`VaultStartupResponse`), the submission rules the command enforces, and the mapping
//! from a locked connection to a response. The wizard shares the name limit rather than
//! these rules — it is TypeScript, so it re-reads `vault_repo::MAX_USER_NAME_LEN` — and
//! `validate_submission` is the only place the rest of the rules live.

use rusqlite::Connection;
use std::sync::MutexGuard;
use tauri::State;

use crate::db::AppState;
use crate::error::{VaultError, VaultResult};
use crate::vault_repo;
use crate::vault_repo::{Collection, OnboardingSubmission, VaultState};

/// The shortest master password this command accepts. A minimum lives here and not in
/// [`vault_repo::save_onboarding`] on purpose: refusing a weak password is the wizard's
/// decision, not a rule about what may be stored.
const MIN_MASTER_PASSWORD_LEN: usize = 8;

/// The longest master password this command accepts. Argon2id's cost is the user's, so
/// the ceiling is only here to refuse a payload that is not a password at all.
const MAX_MASTER_PASSWORD_LEN: usize = 1024;

/// What a command hands back when the lock guarding the connection is poisoned, which
/// only happens after another command panicked while holding it.
const LOCK_POISONED: &str = "vault state lock poisoned";

/// The vault as the frontend's `VaultStartup` union reads it.
///
/// **No `rename_all`, deliberately.** The `ready` fields cross the boundary in
/// snake_case because that is what `src/lib/vault/types.ts` declares, and a
/// `rename_all = "camelCase"` added here would turn all five into camelCase that the UI
/// reads as `undefined` — with no compile error on either side to catch it. The nested
/// collections get their camelCase from [`vault_repo::Collection`]'s own attribute.
/// Each variant keeps only the `rename` that spells its tag, so no field name is ever
/// derived from a container-level rule.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "status")]
pub enum VaultStartupResponse {
    /// No vault yet: `{ "status": "not_initialized" }` and nothing else, which is the
    /// only value that tells the frontend to show onboarding.
    #[serde(rename = "not_initialized")]
    NotInitialized,
    /// An initialized vault, carrying everything the dashboard and settings need.
    #[serde(rename = "ready")]
    Ready {
        user_name: String,
        vault_name: String,
        storage_mode: String,
        protection_enabled: bool,
        onboarding_completed_at: String,
        collections: Vec<Collection>,
    },
}

impl VaultStartupResponse {
    /// The response for a stored vault, or the uninitialized tag when there is none.
    fn from_state(state: Option<VaultState>) -> Self {
        match state {
            None => VaultStartupResponse::NotInitialized,
            Some(state) => VaultStartupResponse::Ready {
                user_name: state.user_name,
                vault_name: state.vault_name,
                storage_mode: state.storage_mode,
                protection_enabled: state.protection_enabled,
                onboarding_completed_at: state.onboarding_completed_at,
                collections: state.collections,
            },
        }
    }
}

/// Checks a submission before anything is written.
///
/// Pure: it reads the submission and nothing else — no database, no clock, no disk — so
/// it runs before the connection is locked and the same rules can be unit-tested without
/// a Tauri runtime.
///
/// Both user-name rules read the trimmed name, which is the same view
/// [`vault_repo::save_onboarding`] measures: `trim` takes `&self` and only reads, and it
/// can only ever shrink the name, so measuring it here cannot accept a name the
/// repository would reject. Nothing is rewritten — the submission is borrowed — and
/// `save_onboarding` still stores the trimmed value it validated.
pub fn validate_submission(submission: &OnboardingSubmission) -> VaultResult<()> {
    let user_name = submission.user_name.trim();

    if user_name.is_empty() {
        return Err(VaultError::Validation("A user name is required.".to_string()));
    }

    // Characters, not bytes: a 120-character name is 240 bytes of `é`, and a byte
    // measurement would reject it at half the length the user is allowed.
    if user_name.chars().count() > vault_repo::MAX_USER_NAME_LEN {
        return Err(VaultError::Validation(format!(
            "The user name must be {} characters or fewer.",
            vault_repo::MAX_USER_NAME_LEN
        )));
    }

    // `None` and `Some("")` both mean "no password", which is a skippable step, so only
    // a password the user actually typed is measured.
    if let Some(password) = submission.master_password.as_deref() {
        if !password.is_empty() {
            let length = password.chars().count();

            if length < MIN_MASTER_PASSWORD_LEN {
                return Err(VaultError::Validation(format!(
                    "The master password must be at least {MIN_MASTER_PASSWORD_LEN} characters."
                )));
            }
            if length > MAX_MASTER_PASSWORD_LEN {
                return Err(VaultError::Validation(format!(
                    "The master password must be {MAX_MASTER_PASSWORD_LEN} characters or fewer."
                )));
            }
        }
    }

    Ok(())
}

/// The startup state: an initialized vault, or `not_initialized` for the wizard.
#[tauri::command]
pub fn vault_get_state(state: State<'_, AppState>) -> VaultResult<VaultStartupResponse> {
    let conn = lock(&state)?;

    Ok(VaultStartupResponse::from_state(vault_repo::vault_state(&conn)?))
}

/// Stores the onboarding result and answers with the vault it created.
///
/// The frontend sends `invoke("vault_complete_onboarding", { submission })`, so the
/// argument is named `submission` to deserialize from that key. Validation runs before
/// the lock is taken and before the repository is reached, so a rejected submission
/// cannot write anything.
#[tauri::command]
pub fn vault_complete_onboarding(
    state: State<'_, AppState>,
    submission: OnboardingSubmission,
) -> VaultResult<VaultStartupResponse> {
    validate_submission(&submission)?;

    let mut conn = lock(&state)?;
    let vault = vault_repo::save_onboarding(&mut conn, &submission)?;

    Ok(VaultStartupResponse::from_state(Some(vault)))
}

/// The vault connection, or `Internal` when a previous command panicked holding the lock.
fn lock(state: &AppState) -> VaultResult<MutexGuard<'_, Connection>> {
    state.conn.lock().map_err(|_| VaultError::Internal(LOCK_POISONED.to_string()))
}

#[cfg(test)]
mod tests {
    use crate::vault_repo::{Collection, OnboardingSubmission, VaultState};

    use super::*;

    /// A valid submission: the shape Task 7's wizard sends when every optional field
    /// is skipped. Each test overrides only the field it is about.
    fn submission(user_name: &str) -> OnboardingSubmission {
        OnboardingSubmission {
            user_name: user_name.to_string(),
            vault_name: None,
            starter_collections: Vec::new(),
            master_password: None,
        }
    }

    /// Asserts the submission is rejected, and rejected as `validation` specifically:
    /// every other code would reach the UI as a retry screen instead of a field error.
    fn assert_rejected(submission: &OnboardingSubmission) {
        let error = validate_submission(submission).expect_err("the submission is rejected");

        assert_eq!(error.code(), "validation", "got: {error}");
    }

    fn submission_passworded(password: &str) -> OnboardingSubmission {
        let mut submission = submission("Ada");
        submission.master_password = Some(password.to_string());

        submission
    }

    fn ready_state() -> VaultState {
        VaultState {
            user_name: "Ada Lovelace".to_string(),
            vault_name: "Ada Lovelace's Stash".to_string(),
            storage_mode: "local".to_string(),
            protection_enabled: true,
            onboarding_completed_at: "2026-09-13T00:00:00.000Z".to_string(),
            collections: vec![Collection {
                id: 7,
                slug: "work".to_string(),
                name: "Work".to_string(),
                created_at: "2026-09-13T00:00:00.000Z".to_string(),
                is_starter: true,
            }],
        }
    }

    #[test]
    fn validate_submission_rejects_an_empty_or_whitespace_only_user_name() {
        for blank in ["", " ", "   ", "\t", "\n  \t "] {
            assert_rejected(&submission(blank));
        }
    }

    #[test]
    fn validate_submission_accepts_a_name_at_the_limit_and_rejects_one_character_more() {
        let at_the_limit = "A".repeat(vault_repo::MAX_USER_NAME_LEN);
        validate_submission(&submission(&at_the_limit)).expect("exactly the limit is accepted");

        let over_the_limit = "A".repeat(vault_repo::MAX_USER_NAME_LEN + 1);
        assert_rejected(&submission(&over_the_limit));
    }

    #[test]
    fn validate_submission_measures_the_trimmed_user_name() {
        // Padding must not push a name the repository would accept over the limit:
        // `save_onboarding` trims before it measures, so the command has to measure the
        // same view or the two disagree about a name that is exactly at the limit.
        let padded_at_the_limit = format!("  {}  ", "A".repeat(vault_repo::MAX_USER_NAME_LEN));
        validate_submission(&submission(&padded_at_the_limit))
            .expect("120 characters padded with whitespace is still a 120 character name");

        // And trimming must not become a way to smuggle an over-long name through.
        let padded_over_the_limit = format!("  {}  ", "A".repeat(vault_repo::MAX_USER_NAME_LEN + 1));
        assert_rejected(&submission(&padded_over_the_limit));
    }

    #[test]
    fn validate_submission_counts_characters_rather_than_bytes() {
        // `é` is two bytes in UTF-8, so a byte-measured limit would reject this name at 60
        // characters and the wizard would have nothing to show the user.
        let at_the_limit = "é".repeat(vault_repo::MAX_USER_NAME_LEN);
        assert_eq!(at_the_limit.len(), vault_repo::MAX_USER_NAME_LEN * 2, "the input really is multi-byte");

        validate_submission(&submission(&at_the_limit))
            .expect("120 characters is accepted however many bytes it takes");

        let over_the_limit = "é".repeat(vault_repo::MAX_USER_NAME_LEN + 1);
        assert_rejected(&submission(&over_the_limit));
    }

    #[test]
    fn validate_submission_counts_password_characters_rather_than_bytes() {
        // 7 characters, 14 bytes: long enough by bytes, too short by characters.
        assert_rejected(&submission_passworded(&"é".repeat(7)));
        validate_submission(&submission_passworded(&"é".repeat(8))).expect("8 characters is accepted");
    }

    #[test]
    fn validate_submission_accepts_no_vault_name_and_no_starter_collections() {
        let submission = submission("Ada");

        assert_eq!(submission.vault_name, None);
        assert!(submission.starter_collections.is_empty());

        validate_submission(&submission).expect("an empty vault name and an empty list are both skippable");
    }

    #[test]
    fn validate_submission_accepts_an_absent_or_empty_master_password() {
        validate_submission(&submission("Ada")).expect("no password at all is allowed");

        let mut empty = submission("Ada");
        empty.master_password = Some(String::new());
        validate_submission(&empty).expect("an empty password means 'no password', not a too-short one");
    }

    #[test]
    fn validate_submission_enforces_the_password_length_boundaries() {
        validate_submission(&submission_passworded(&"p".repeat(8))).expect("exactly 8 is accepted");
        assert_rejected(&submission_passworded(&"p".repeat(7)));

        validate_submission(&submission_passworded(&"p".repeat(1024))).expect("exactly 1024 is accepted");
        assert_rejected(&submission_passworded(&"p".repeat(1025)));
    }

    #[test]
    fn validate_submission_accepts_a_padded_submission_without_rewriting_it() {
        let submission = OnboardingSubmission {
            user_name: "  Ada Lovelace  ".to_string(),
            vault_name: Some("  Ada's Vault  ".to_string()),
            starter_collections: vec![" Work ".to_string()],
            master_password: Some("  hunter2hunter2  ".to_string()),
        };

        // The padded name is measured trimmed, so padding neither rejects it nor survives
        // into storage: `save_onboarding` stores the trimmed value it validated. That the
        // submission comes back byte-identical is guaranteed by the `&` receiver rather
        // than asserted here — `OnboardingSubmission` has no interior mutability, so a
        // validator that rewrote it would not compile.
        validate_submission(&submission).expect("a padded but valid submission is accepted");
    }

    #[test]
    fn the_ready_response_is_snake_case_at_the_top_level_and_camel_case_in_collections() {
        let serialized = serde_json::to_value(VaultStartupResponse::from_state(Some(ready_state())))
            .expect("the response serializes");

        // This is `VaultStartup`'s `ready` variant verbatim from `src/lib/vault/types.ts`.
        // A `rename_all = "camelCase"` anywhere on this type would turn the five snake_case
        // keys into camelCase and every one of them would read `undefined` in the UI, with
        // nothing failing to compile on either side.
        assert_eq!(
            serialized,
            serde_json::json!({
                "status": "ready",
                "user_name": "Ada Lovelace",
                "vault_name": "Ada Lovelace's Stash",
                "storage_mode": "local",
                "protection_enabled": true,
                "onboarding_completed_at": "2026-09-13T00:00:00.000Z",
                "collections": [{
                    "id": 7,
                    "slug": "work",
                    "name": "Work",
                    "createdAt": "2026-09-13T00:00:00.000Z",
                    "isStarter": true,
                }],
            })
        );
    }

    #[test]
    fn the_not_initialized_response_is_a_bare_status_tag() {
        let serialized = serde_json::to_value(VaultStartupResponse::from_state(None)).expect("the response serializes");

        assert_eq!(serialized, serde_json::json!({ "status": "not_initialized" }));
    }
}
