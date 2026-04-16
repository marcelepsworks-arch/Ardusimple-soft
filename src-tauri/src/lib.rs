mod commands;
mod engine;
mod parser;

use commands::device::SerialState;
use commands::ntrip::NtripState;
use commands::tcp::TcpState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SerialState::default())
        .manage(NtripState::default())
        .manage(TcpState::default())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::device::list_serial_ports,
            commands::device::connect_serial,
            commands::device::disconnect,
            commands::ntrip::ntrip_connect,
            commands::ntrip::ntrip_disconnect,
            commands::ntrip::ntrip_fetch_sourcetable,
            commands::license::check_license,
            commands::license::activate_license,
            commands::tcp::connect_tcp,
            commands::tcp::disconnect_tcp,
            commands::tcp::write_tcp,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
