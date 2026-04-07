use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const TRIAL_DAYS: u64 = 10;
const LICENSE_FILE: &str = "license.dat";
const TRIAL_FILE: &str = ".trial";

#[derive(Debug, Clone, Serialize)]
pub struct LicenseStatus {
    pub is_licensed: bool,
    pub is_trial: bool,
    pub trial_days_remaining: i64,
    pub trial_expired: bool,
}

fn app_data_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

/// Simple obfuscation for the trial timestamp to prevent trivial file editing.
/// Not cryptographically secure — just deters casual tampering.
fn encode_timestamp(ts: u64) -> String {
    let bytes = ts.to_le_bytes();
    let key: [u8; 8] = [0x47, 0x4E, 0x53, 0x53, 0x52, 0x54, 0x4B, 0x21]; // "GNSSRTK!"
    let encoded: Vec<u8> = bytes.iter().zip(key.iter()).map(|(b, k)| b ^ k).collect();
    hex::encode(encoded)
}

fn decode_timestamp(hex_str: &str) -> Option<u64> {
    let encoded = hex::decode(hex_str).ok()?;
    if encoded.len() != 8 {
        return None;
    }
    let key: [u8; 8] = [0x47, 0x4E, 0x53, 0x53, 0x52, 0x54, 0x4B, 0x21];
    let bytes: Vec<u8> = encoded.iter().zip(key.iter()).map(|(b, k)| b ^ k).collect();
    Some(u64::from_le_bytes(bytes.try_into().ok()?))
}

/// Validate a license key. For now, a simple format check.
/// In production, this would verify against a server or use asymmetric crypto.
fn validate_license_key(key: &str) -> bool {
    // Format: GNSS-XXXX-XXXX-XXXX-XXXX (20 hex chars after dashes)
    let parts: Vec<&str> = key.split('-').collect();
    if parts.len() != 5 || parts[0] != "GNSS" {
        return false;
    }
    parts[1..].iter().all(|p| p.len() == 4 && p.chars().all(|c| c.is_ascii_hexdigit()))
}

#[tauri::command]
pub fn check_license(app: AppHandle) -> LicenseStatus {
    let data_dir = app_data_dir(&app);
    let _ = fs::create_dir_all(&data_dir);

    // Check for valid license file first
    let license_path = data_dir.join(LICENSE_FILE);
    if license_path.exists() {
        if let Ok(key) = fs::read_to_string(&license_path) {
            if validate_license_key(key.trim()) {
                return LicenseStatus {
                    is_licensed: true,
                    is_trial: false,
                    trial_days_remaining: 0,
                    trial_expired: false,
                };
            }
        }
    }

    // Check/create trial
    let trial_path = data_dir.join(TRIAL_FILE);
    let trial_start = if trial_path.exists() {
        fs::read_to_string(&trial_path)
            .ok()
            .and_then(|s| decode_timestamp(s.trim()))
            .unwrap_or_else(|| {
                // Corrupted file — treat as expired
                0
            })
    } else {
        // First launch — start trial
        let ts = now_secs();
        let encoded = encode_timestamp(ts);
        let _ = fs::write(&trial_path, &encoded);
        ts
    };

    let elapsed_secs = now_secs().saturating_sub(trial_start);
    let elapsed_days = elapsed_secs / 86400;
    let remaining = TRIAL_DAYS as i64 - elapsed_days as i64;

    LicenseStatus {
        is_licensed: false,
        is_trial: true,
        trial_days_remaining: remaining.max(0),
        trial_expired: remaining <= 0,
    }
}

#[tauri::command]
pub fn activate_license(app: AppHandle, key: String) -> Result<LicenseStatus, String> {
    if !validate_license_key(&key) {
        return Err("Invalid license key format. Expected: GNSS-XXXX-XXXX-XXXX-XXXX".to_string());
    }

    let data_dir = app_data_dir(&app);
    let _ = fs::create_dir_all(&data_dir);
    let license_path = data_dir.join(LICENSE_FILE);

    fs::write(&license_path, &key).map_err(|e| format!("Failed to save license: {}", e))?;

    Ok(LicenseStatus {
        is_licensed: true,
        is_trial: false,
        trial_days_remaining: 0,
        trial_expired: false,
    })
}
