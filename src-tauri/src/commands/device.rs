use crate::parser::nmea::{self, LiveFix};
use serde::Serialize;
use std::io::{BufRead, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

/// Known USB VID/PID for ArduSimple / GNSS devices
const KNOWN_DEVICES: &[(&str, &str, &str)] = &[
    ("1546", "01A8", "u-blox ZED-F9P"),
    ("1546", "01A9", "u-blox ZED-F9R"),
    ("1546", "01B0", "u-blox ZED-X20P"),
    ("10C4", "EA60", "CP210x"),
    ("0403", "6001", "FTDI FT232R"),
    ("0403", "6010", "FTDI FT2232H"),
    ("1A86", "7523", "CH340"),
    ("152A", "8A20", "Septentrio Mosaic"),
];

#[derive(Debug, Clone, Serialize)]
pub struct PortInfo {
    pub name: String,
    pub description: String,
    pub chipset: String,
}

/// State managed by Tauri for the serial connection.
/// The `serial_writer` is shared so the NTRIP module can write RTCM data to the port.
pub struct SerialState {
    pub stop_flag: Arc<AtomicBool>,
    pub is_connected: Arc<AtomicBool>,
    pub serial_writer: Arc<Mutex<Option<Box<dyn Write + Send>>>>,
    pub live_fix: Arc<Mutex<LiveFix>>,
}

impl Default for SerialState {
    fn default() -> Self {
        Self {
            stop_flag: Arc::new(AtomicBool::new(false)),
            is_connected: Arc::new(AtomicBool::new(false)),
            serial_writer: Arc::new(Mutex::new(None)),
            live_fix: Arc::new(Mutex::new(LiveFix::default())),
        }
    }
}

fn identify_chipset(vid: u16, pid: u16) -> String {
    let vid_str = format!("{:04X}", vid);
    let pid_str = format!("{:04X}", pid);
    for &(v, p, name) in KNOWN_DEVICES {
        if v.eq_ignore_ascii_case(&vid_str) && p.eq_ignore_ascii_case(&pid_str) {
            return name.to_string();
        }
    }
    String::new()
}

#[tauri::command]
pub fn list_serial_ports() -> Vec<PortInfo> {
    let ports = serialport::available_ports().unwrap_or_default();
    ports
        .into_iter()
        .map(|p| {
            let (description, chipset) = match &p.port_type {
                serialport::SerialPortType::UsbPort(usb) => {
                    let desc = usb
                        .product
                        .clone()
                        .unwrap_or_else(|| "USB Serial".to_string());
                    let chip = identify_chipset(usb.vid, usb.pid);
                    (desc, chip)
                }
                serialport::SerialPortType::PciPort => {
                    ("PCI Serial".to_string(), String::new())
                }
                serialport::SerialPortType::BluetoothPort => {
                    ("Bluetooth Serial".to_string(), String::new())
                }
                serialport::SerialPortType::Unknown => {
                    ("Unknown".to_string(), String::new())
                }
            };
            PortInfo {
                name: p.port_name,
                description,
                chipset,
            }
        })
        .collect()
}

#[tauri::command]
pub async fn connect_serial(
    port: String,
    baud: u32,
    app: AppHandle,
    state: tauri::State<'_, SerialState>,
) -> Result<(), String> {
    // Stop any existing connection
    state.stop_flag.store(true, Ordering::SeqCst);
    std::thread::sleep(std::time::Duration::from_millis(100));
    state.stop_flag.store(false, Ordering::SeqCst);

    let serial = serialport::new(&port, baud)
        .timeout(std::time::Duration::from_millis(500))
        .open()
        .map_err(|e| format!("Failed to open {}: {}", port, e))?;

    // Clone the port for writing (RTCM relay)
    let writer = serial
        .try_clone()
        .map_err(|e| format!("Failed to clone serial port: {}", e))?;

    {
        let mut w = state.serial_writer.lock().unwrap();
        *w = Some(Box::new(writer));
    }

    state.is_connected.store(true, Ordering::SeqCst);
    let _ = app.emit(
        "connection_state",
        serde_json::json!({"state": "connected"}),
    );

    let stop = state.stop_flag.clone();
    let connected = state.is_connected.clone();
    let serial_writer = state.serial_writer.clone();
    let live_fix_shared = state.live_fix.clone();

    // Spawn reader thread
    std::thread::spawn(move || {
        let mut reader = std::io::BufReader::new(serial);
        let mut fix = LiveFix::default();
        let mut line = String::new();

        loop {
            if stop.load(Ordering::SeqCst) {
                break;
            }

            line.clear();
            match reader.read_line(&mut line) {
                Ok(0) => break,
                Ok(_) => {
                    let trimmed = line.trim();
                    if trimmed.starts_with('$') {
                        if nmea::parse_sentence(trimmed, &mut fix) {
                            // Update shared live fix (for NTRIP GGA generation)
                            if let Ok(mut shared) = live_fix_shared.lock() {
                                *shared = fix.clone();
                            }
                            let _ = app.emit("fix_update", &fix);
                        }
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                    continue;
                }
                Err(_) => break,
            }
        }

        connected.store(false, Ordering::SeqCst);
        // Clear writer
        if let Ok(mut w) = serial_writer.lock() {
            *w = None;
        }
        let _ = app.emit(
            "connection_state",
            serde_json::json!({"state": "disconnected"}),
        );
    });

    Ok(())
}

#[tauri::command]
pub async fn disconnect(state: tauri::State<'_, SerialState>) -> Result<(), String> {
    state.stop_flag.store(true, Ordering::SeqCst);
    // Clear writer
    if let Ok(mut w) = state.serial_writer.lock() {
        *w = None;
    }
    Ok(())
}
