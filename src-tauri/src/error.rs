//! The error type that crosses the Tauri IPC boundary.
//!
//! The frontend only accepts the flat `{ "code": ..., "message": ... }` shape, so
//! `Serialize` is written by hand rather than derived: a derived enum would nest the
//! payload under a variant name and every failure would reach the UI as `internal`.

use serde::ser::{Serialize, SerializeStruct, Serializer};

/// Every way a vault command can fail.
#[derive(Debug)]
pub enum VaultError {
    /// No vault exists yet; the frontend shows onboarding.
    NotInitialized,
    /// The caller sent something the vault cannot accept.
    Validation(String),
    /// SQLite rejected the statement or the file is not a usable database.
    Db(String),
    /// The vault's files on disk could not be read or written.
    Io(String),
    /// A bug on our side: an impossible state, an unmapped schema version.
    Internal(String),
}

impl VaultError {
    /// The literal the frontend switches on. Only these five values are recognised.
    pub fn code(&self) -> &'static str {
        match self {
            VaultError::NotInitialized => "not_initialized",
            VaultError::Validation(_) => "validation",
            VaultError::Db(_) => "db",
            VaultError::Io(_) => "io",
            VaultError::Internal(_) => "internal",
        }
    }

    /// The human-readable half of the error, shown to the user as-is.
    pub fn message(&self) -> String {
        match self {
            VaultError::NotInitialized => "The vault has not been initialized yet.".to_string(),
            VaultError::Validation(message)
            | VaultError::Db(message)
            | VaultError::Io(message)
            | VaultError::Internal(message) => message.clone(),
        }
    }
}

impl Serialize for VaultError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut state = serializer.serialize_struct("VaultError", 2)?;
        state.serialize_field("code", self.code())?;
        state.serialize_field("message", &self.message())?;
        state.end()
    }
}

impl std::fmt::Display for VaultError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.message())
    }
}

impl std::error::Error for VaultError {}

impl From<rusqlite::Error> for VaultError {
    fn from(error: rusqlite::Error) -> Self {
        VaultError::Db(error.to_string())
    }
}

impl From<std::io::Error> for VaultError {
    fn from(error: std::io::Error) -> Self {
        VaultError::Io(error.to_string())
    }
}

pub type VaultResult<T> = Result<T, VaultError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_variant_reports_its_frozen_code() {
        assert_eq!(VaultError::NotInitialized.code(), "not_initialized");
        assert_eq!(VaultError::Validation(String::new()).code(), "validation");
        assert_eq!(VaultError::Db(String::new()).code(), "db");
        assert_eq!(VaultError::Io(String::new()).code(), "io");
        assert_eq!(VaultError::Internal(String::new()).code(), "internal");
    }

    #[test]
    fn serializes_as_a_flat_code_and_message_object() {
        let error = VaultError::Validation("A user name is required.".to_string());

        let serialized = serde_json::to_value(&error).expect("the error serializes");

        assert_eq!(serialized, serde_json::json!({
            "code": "validation",
            "message": "A user name is required.",
        }));
    }

    #[test]
    fn display_prints_the_message() {
        assert_eq!(VaultError::NotInitialized.to_string(), VaultError::NotInitialized.message());
    }
}
