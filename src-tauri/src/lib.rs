#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Public so the vault core is reachable from the crate root. The app's only other
// entry point is `run()`, so a private module would report every item here as dead
// code until the Tauri commands are wired up.
pub mod db;
// The probe is compiled only in debug builds: a release binary then has no probe command
// to register, so the handler list below cannot expose one even by mistake.
#[cfg(debug_assertions)]
pub mod dev_storage;
pub mod error;
pub mod vault;
pub mod vault_paths;
pub mod vault_repo;

use std::sync::Mutex;

use tauri::Manager;

use crate::db::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().setup(|app| {
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
    });

    // The handler list is the only registration point for a command, so both branches are
    // written out in full rather than unified behind a runtime flag. Unifying them would
    // put the probe's file writer in a release binary, and dropping the two production
    // commands from the debug list would stop the dashboard from booting — a failure with
    // no compile error on either side.
    #[cfg(debug_assertions)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        vault::vault_get_state,
        vault::vault_complete_onboarding,
        dev_storage::vault_probe_write,
        dev_storage::vault_probe_read,
        dev_storage::vault_probe_paths,
    ]);

    #[cfg(not(debug_assertions))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        vault::vault_get_state,
        vault::vault_complete_onboarding,
    ]);

    builder.run(tauri::generate_context!()).expect("error while running tauri application");
}
