use crate::commands::device::SerialState;
use base64::Engine as _;
use serde::{Deserialize, Serialize};
use std::io::{BufRead, Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

/// NTRIP connection state shared with Tauri
pub struct NtripState {
    pub stop_flag: Arc<AtomicBool>,
    pub is_connected: Arc<AtomicBool>,
    pub bytes_received: Arc<std::sync::atomic::AtomicU64>,
}

impl Default for NtripState {
    fn default() -> Self {
        Self {
            stop_flag: Arc::new(AtomicBool::new(false)),
            is_connected: Arc::new(AtomicBool::new(false)),
            bytes_received: Arc::new(std::sync::atomic::AtomicU64::new(0)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MountpointInfo {
    pub name: String,
    pub identifier: String,
    pub format: String,
    pub details: String,
    pub latitude: f64,
    pub longitude: f64,
    pub country: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct NtripStatus {
    pub connected: bool,
    pub bytes_received: u64,
    pub bytes_per_second: f64,
}

/// Generate a GGA string from the current live fix for sending to NTRIP caster
fn generate_gga(fix: &crate::parser::nmea::LiveFix) -> String {
    let lat_abs = fix.latitude.abs();
    let lat_deg = lat_abs.floor() as u32;
    let lat_min = (lat_abs - lat_deg as f64) * 60.0;
    let lat_dir = if fix.latitude >= 0.0 { 'N' } else { 'S' };

    let lon_abs = fix.longitude.abs();
    let lon_deg = lon_abs.floor() as u32;
    let lon_min = (lon_abs - lon_deg as f64) * 60.0;
    let lon_dir = if fix.longitude >= 0.0 { 'E' } else { 'W' };

    let body = format!(
        "GPGGA,{},{:02}{:09.6},{},{:03}{:09.6},{},{},{:02},{:.1},{:.1},M,0.0,M,,",
        fix.timestamp,
        lat_deg,
        lat_min,
        lat_dir,
        lon_deg,
        lon_min,
        lon_dir,
        fix.fix_quality,
        fix.sats_used,
        fix.hdop,
        fix.altitude
    );

    let checksum = body.bytes().fold(0u8, |acc, b| acc ^ b);
    format!("${}*{:02X}\r\n", body, checksum)
}

/// Fetch the NTRIP sourcetable and parse mountpoints
#[tauri::command]
pub async fn ntrip_fetch_sourcetable(
    host: String,
    port: u16,
) -> Result<Vec<MountpointInfo>, String> {
    let addr = format!("{}:{}", host, port);
    let mut stream = std::net::TcpStream::connect_timeout(
        &addr.parse().map_err(|e| format!("Invalid address: {}", e))?,
        std::time::Duration::from_secs(10),
    )
    .map_err(|e| format!("Connection failed: {}", e))?;

    stream
        .set_read_timeout(Some(std::time::Duration::from_secs(10)))
        .ok();

    // Request sourcetable
    let request = format!(
        "GET / HTTP/1.1\r\nHost: {}\r\nUser-Agent: NTRIP GNSSRTKDesktop/1.0\r\nNtrip-Version: Ntrip/2.0\r\n\r\n",
        host
    );
    stream
        .write_all(request.as_bytes())
        .map_err(|e| format!("Write failed: {}", e))?;

    let mut response = String::new();
    let mut reader = std::io::BufReader::new(stream);
    loop {
        let mut line = String::new();
        match reader.read_line(&mut line) {
            Ok(0) => break,
            Ok(_) => {
                response.push_str(&line);
                if line.starts_with("ENDSOURCETABLE") {
                    break;
                }
            }
            Err(_) => break,
        }
    }

    // Parse STR lines
    let mountpoints: Vec<MountpointInfo> = response
        .lines()
        .filter(|l| l.starts_with("STR;"))
        .filter_map(|l| {
            let fields: Vec<&str> = l.split(';').collect();
            if fields.len() < 12 {
                return None;
            }
            Some(MountpointInfo {
                name: fields[1].to_string(),
                identifier: fields[2].to_string(),
                format: fields[3].to_string(),
                details: fields[4].to_string(),
                latitude: fields[9].parse().unwrap_or(0.0),
                longitude: fields[10].parse().unwrap_or(0.0),
                country: fields[8].to_string(),
            })
        })
        .collect();

    Ok(mountpoints)
}

/// Connect to NTRIP caster and relay RTCM to serial port
#[tauri::command]
pub async fn ntrip_connect(
    host: String,
    port: u16,
    mountpoint: String,
    username: String,
    password: String,
    app: AppHandle,
    ntrip_state: tauri::State<'_, NtripState>,
    serial_state: tauri::State<'_, SerialState>,
) -> Result<(), String> {
    // Stop existing NTRIP connection
    ntrip_state.stop_flag.store(true, Ordering::SeqCst);
    std::thread::sleep(std::time::Duration::from_millis(100));
    ntrip_state.stop_flag.store(false, Ordering::SeqCst);
    ntrip_state
        .bytes_received
        .store(0, Ordering::SeqCst);

    let addr = format!("{}:{}", host, port);
    let mut stream = std::net::TcpStream::connect_timeout(
        &addr.parse().map_err(|e| format!("Invalid address: {}", e))?,
        std::time::Duration::from_secs(10),
    )
    .map_err(|e| format!("NTRIP connection failed: {}", e))?;

    stream
        .set_read_timeout(Some(std::time::Duration::from_secs(5)))
        .ok();

    // Build auth header
    let credentials = format!("{}:{}", username, password);
    let encoded = base64::engine::general_purpose::STANDARD.encode(&credentials);

    // Send NTRIP request
    let request = format!(
        "GET /{} HTTP/1.1\r\nHost: {}\r\nUser-Agent: NTRIP GNSSRTKDesktop/1.0\r\nAuthorization: Basic {}\r\nNtrip-Version: Ntrip/2.0\r\n\r\n",
        mountpoint, host, encoded
    );
    stream
        .write_all(request.as_bytes())
        .map_err(|e| format!("Request failed: {}", e))?;

    // Read HTTP response header
    let mut header_buf = [0u8; 1024];
    let n = stream
        .read(&mut header_buf)
        .map_err(|e| format!("No response: {}", e))?;
    let header = String::from_utf8_lossy(&header_buf[..n]);

    if !header.contains("200") && !header.contains("ICY 200") {
        return Err(format!("NTRIP rejected: {}", header.lines().next().unwrap_or("")));
    }

    ntrip_state.is_connected.store(true, Ordering::SeqCst);
    let _ = app.emit(
        "ntrip_state",
        serde_json::json!({"connected": true}),
    );

    let stop = ntrip_state.stop_flag.clone();
    let connected = ntrip_state.is_connected.clone();
    let bytes_counter = ntrip_state.bytes_received.clone();
    let serial_writer = serial_state.serial_writer.clone();
    let live_fix = serial_state.live_fix.clone();

    // Spawn RTCM relay + GGA sender thread
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        let mut last_gga_send = std::time::Instant::now();
        let mut last_stats = std::time::Instant::now();
        let mut interval_bytes: u64 = 0;

        loop {
            if stop.load(Ordering::SeqCst) {
                break;
            }

            // Read RTCM data from caster
            match stream.read(&mut buf) {
                Ok(0) => break, // Connection closed
                Ok(n) => {
                    bytes_counter.fetch_add(n as u64, Ordering::Relaxed);
                    interval_bytes += n as u64;

                    // Relay RTCM to serial port
                    if let Ok(mut writer_guard) = serial_writer.lock() {
                        if let Some(ref mut writer) = *writer_guard {
                            let _ = writer.write_all(&buf[..n]);
                        }
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut
                    || e.kind() == std::io::ErrorKind::WouldBlock =>
                {
                    // Timeout is fine, continue
                }
                Err(_) => break,
            }

            // Send GGA to caster every 10 seconds
            if last_gga_send.elapsed() >= std::time::Duration::from_secs(10) {
                if let Ok(fix) = live_fix.lock() {
                    if fix.latitude != 0.0 && fix.longitude != 0.0 {
                        let gga = generate_gga(&fix);
                        let _ = stream.write_all(gga.as_bytes());
                    }
                }
                last_gga_send = std::time::Instant::now();
            }

            // Emit stats every second
            if last_stats.elapsed() >= std::time::Duration::from_secs(1) {
                let elapsed = last_stats.elapsed().as_secs_f64();
                let bps = interval_bytes as f64 / elapsed;
                let _ = app.emit(
                    "ntrip_status",
                    NtripStatus {
                        connected: true,
                        bytes_received: bytes_counter.load(Ordering::Relaxed),
                        bytes_per_second: bps,
                    },
                );
                interval_bytes = 0;
                last_stats = std::time::Instant::now();
            }
        }

        connected.store(false, Ordering::SeqCst);
        let _ = app.emit(
            "ntrip_state",
            serde_json::json!({"connected": false}),
        );
    });

    Ok(())
}

#[tauri::command]
pub async fn ntrip_disconnect(ntrip_state: tauri::State<'_, NtripState>) -> Result<(), String> {
    ntrip_state.stop_flag.store(true, Ordering::SeqCst);
    Ok(())
}
