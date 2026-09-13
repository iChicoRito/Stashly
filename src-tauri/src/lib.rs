#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Public so the vault core is reachable from the crate root. The app's only other
// entry point is `run()`, so a private module would report every item here as dead
// code until the Tauri commands are wired up.
pub mod db;
pub mod error;
pub mod vault_paths;
pub mod vault_repo;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
