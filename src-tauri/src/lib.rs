#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Public so the vault core is reachable from the crate root. The app's only other
// entry point is `run()`, so a private module would report every item here as dead
// code until the Tauri commands are wired up.
pub mod db;
pub mod error;
pub mod vault;
pub mod vault_paths;
pub mod vault_repo;

use std::sync::Mutex;

use tauri::Manager;

use crate::db::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // D2: the vault root is Tauri's own `app_data_dir`, resolved rather than assumed.
            let root = app.path().app_data_dir()?;
            let paths = vault_paths::resolve(&root);
            paths.ensure()?;

            // A failed open or migrate aborts startup loudly: running on against a
            // half-built schema would surface as missing tables from unrelated commands.
            let conn = db::open(&paths.db)?;
            db::migrate(&conn)?;

            app.manage(AppState { conn: Mutex::new(conn) });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            vault::vault_get_state,
            vault::vault_complete_onboarding,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
