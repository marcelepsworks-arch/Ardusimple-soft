/// TCP socket GNSS connection — used by mobile devices connecting to a
/// WiFi/Bluetooth-bridge GNSS receiver (e.g. ArduSimple in WiFi AP mode,
/// Lefebure NTRIP client forwarding, etc.)
///
/// The TCP reader feeds the same NMEA parser and emits the same Tauri events
/// as the serial port reader, so the frontend works identically.
use crate::parser::nmea::{self, LiveFix};
use serde::Serialize;
use std::io::{BufRead, Write};
use std::net::TcpStream;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize)]
pub struct TcpPortInfo {
    pub host: String,
    pub port: u16,
}

pub struct TcpState {
    pub stop_flag: Arc<AtomicBool>,
    pub is_connected: Arc<AtomicBool>,
    pub tcp_writer: Arc<Mutex<Option<Box<dyn Write + Send>>>>,
    pub live_fix: Arc<Mutex<LiveFix>>,
}

impl Default for TcpState {
    fn default() -> Self {
        Self {
            stop_flag: Arc::new(AtomicBool::new(false)),
            is_connected: Arc::new(AtomicBool::new(false)),
            tcp_writer: Arc::new(Mutex::new(None)),
            live_fix: Arc::new(Mutex::new(LiveFix::default())),
        }
    }
}

#[tauri::command]
pub async fn connect_tcp(
    host: String,
    port: u16,
    app: AppHandle,
    state: tauri::State<'_, TcpState>,
) -> Result<(), String> {
    // Stop any existing connection
    state.stop_flag.store(true, Ordering::SeqCst);
    std::thread::sleep(std::time::Duration::from_millis(100));
    state.stop_flag.store(false, Ordering::SeqCst);

    let addr = format!("{}:{}", host, port);
    let stream = TcpStream::connect(&addr)
        .map_err(|e| format!("Failed to connect to {}: {}", addr, e))?;

    // Clone for writing (RTCM relay)
    match stream.try_clone() {
        Ok(writer) => {
            let mut w = state.tcp_writer.lock().unwrap();
            *w = Some(Box::new(writer));
        }
        Err(e) => {
            log::warn!("TCP stream clone failed (RTCM relay disabled): {}", e);
        }
    }

    state.is_connected.store(true, Ordering::SeqCst);
    let _ = app.emit(
        "connection_state",
        serde_json::json!({"state": "connected", "transport": "tcp", "addr": addr}),
    );

    let stop = state.stop_flag.clone();
    let connected = state.is_connected.clone();
    let tcp_writer = state.tcp_writer.clone();
    let live_fix_shared = state.live_fix.clone();

    std::thread::spawn(move || {
        let mut reader = std::io::BufReader::new(stream);
        let mut fix = LiveFix::default();
        let mut buf: Vec<u8> = Vec::with_capacity(256);
        let mut disconnect_reason: Option<String> = None;

        loop {
            if stop.load(Ordering::SeqCst) {
                break;
            }

            buf.clear();
            match reader.read_until(b'\n', &mut buf) {
                Ok(0) => {
                    disconnect_reason = Some("Connection closed (EOF)".to_string());
                    break;
                }
                Ok(_) => {
                    if let Ok(line) = std::str::from_utf8(&buf) {
                        let trimmed = line.trim();
                        if trimmed.starts_with('$') {
                            if nmea::parse_sentence(trimmed, &mut fix) {
                                if let Ok(mut shared) = live_fix_shared.lock() {
                                    *shared = fix.clone();
                                }
                                let _ = app.emit("fix_update", &fix);
                            }
                        }
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut
                    || e.kind() == std::io::ErrorKind::WouldBlock =>
                {
                    continue;
                }
                Err(e) => {
                    disconnect_reason = Some(format!("Read error: {}", e));
                    break;
                }
            }
        }

        connected.store(false, Ordering::SeqCst);
        if let Ok(mut w) = tcp_writer.lock() {
            *w = None;
        }
        let _ = app.emit(
            "connection_state",
            serde_json::json!({
                "state": "disconnected",
                "reason": disconnect_reason
            }),
        );
    });

    Ok(())
}

#[tauri::command]
pub async fn disconnect_tcp(state: tauri::State<'_, TcpState>) -> Result<(), String> {
    state.stop_flag.store(true, Ordering::SeqCst);
    if let Ok(mut w) = state.tcp_writer.lock() {
        *w = None;
    }
    Ok(())
}

/// Write raw bytes to the TCP stream (for forwarding RTCM corrections)
#[tauri::command]
pub async fn write_tcp(
    data: Vec<u8>,
    state: tauri::State<'_, TcpState>,
) -> Result<(), String> {
    if let Ok(mut w) = state.tcp_writer.lock() {
        if let Some(ref mut writer) = *w {
            writer.write_all(&data).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
