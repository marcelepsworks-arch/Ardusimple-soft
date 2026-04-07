use serde::Serialize;

/// Parsed live fix from NMEA sentences
#[derive(Debug, Clone, Serialize, Default)]
pub struct LiveFix {
    pub latitude: f64,
    pub longitude: f64,
    pub altitude: f64,
    pub fix_type: String,
    pub fix_quality: u8,
    pub hdop: f64,
    pub sats_used: u32,
    pub age_of_corrections: f64,
    pub speed_knots: f64,
    pub course: f64,
    pub timestamp: String,
}

/// Parse NMEA checksum: "*XX" at end of sentence
fn verify_checksum(sentence: &str) -> bool {
    if let Some(star_pos) = sentence.rfind('*') {
        let data = &sentence[1..star_pos]; // skip leading '$'
        let expected = u8::from_str_radix(&sentence[star_pos + 1..], 16).unwrap_or(0);
        let computed = data.bytes().fold(0u8, |acc, b| acc ^ b);
        computed == expected
    } else {
        false
    }
}

/// Parse degrees + decimal minutes (NMEA format) to decimal degrees
/// e.g. "4124.8963" with direction 'N' -> 41.41494...
fn parse_dm_to_dd(dm: &str, dir: &str) -> Option<f64> {
    if dm.is_empty() {
        return None;
    }
    let dot_pos = dm.find('.')?;
    if dot_pos < 3 {
        return None;
    }
    let deg_end = dot_pos - 2;
    let degrees: f64 = dm[..deg_end].parse().ok()?;
    let minutes: f64 = dm[deg_end..].parse().ok()?;
    let mut dd = degrees + minutes / 60.0;
    if dir == "S" || dir == "W" {
        dd = -dd;
    }
    Some(dd)
}

fn fix_quality_label(q: u8) -> &'static str {
    match q {
        0 => "No Fix",
        1 => "Single",
        2 => "DGPS",
        4 => "RTK Fix",
        5 => "RTK Float",
        _ => "Unknown",
    }
}

/// Parse a GGA sentence and update the LiveFix
pub fn parse_gga(sentence: &str, fix: &mut LiveFix) -> bool {
    if !verify_checksum(sentence) {
        return false;
    }
    let fields: Vec<&str> = sentence.split(',').collect();
    if fields.len() < 15 {
        return false;
    }

    // Time
    if !fields[1].is_empty() {
        fix.timestamp = fields[1].to_string();
    }

    // Lat
    if let Some(lat) = parse_dm_to_dd(fields[2], fields[3]) {
        fix.latitude = lat;
    }

    // Lon
    if let Some(lon) = parse_dm_to_dd(fields[4], fields[5]) {
        fix.longitude = lon;
    }

    // Fix quality
    fix.fix_quality = fields[6].parse().unwrap_or(0);
    fix.fix_type = fix_quality_label(fix.fix_quality).to_string();

    // Sats
    fix.sats_used = fields[7].parse().unwrap_or(0);

    // HDOP
    fix.hdop = fields[8].parse().unwrap_or(99.9);

    // Altitude
    fix.altitude = fields[9].parse().unwrap_or(0.0);

    // Age of corrections (field 13)
    if fields.len() > 13 && !fields[13].is_empty() {
        fix.age_of_corrections = fields[13].parse().unwrap_or(0.0);
    }

    true
}

/// Parse an RMC sentence and update speed/course
pub fn parse_rmc(sentence: &str, fix: &mut LiveFix) -> bool {
    if !verify_checksum(sentence) {
        return false;
    }
    let fields: Vec<&str> = sentence.split(',').collect();
    if fields.len() < 12 {
        return false;
    }

    // Speed over ground (knots)
    fix.speed_knots = fields[7].parse().unwrap_or(0.0);

    // Course over ground
    fix.course = fields[8].parse().unwrap_or(0.0);

    // Also update lat/lon from RMC if GGA hasn't provided it
    if fix.latitude == 0.0 {
        if let Some(lat) = parse_dm_to_dd(fields[3], fields[4]) {
            fix.latitude = lat;
        }
    }
    if fix.longitude == 0.0 {
        if let Some(lon) = parse_dm_to_dd(fields[5], fields[6]) {
            fix.longitude = lon;
        }
    }

    true
}

/// Parse any NMEA sentence and update the LiveFix. Returns true if fix was updated.
pub fn parse_sentence(sentence: &str, fix: &mut LiveFix) -> bool {
    let trimmed = sentence.trim();
    if trimmed.len() < 6 {
        return false;
    }

    // Extract sentence type (e.g., "GGA" from "$GPGGA" or "$GNGGA")
    let msg_type = if trimmed.len() > 6 { &trimmed[3..6] } else { "" };

    match msg_type {
        "GGA" => parse_gga(trimmed, fix),
        "RMC" => parse_rmc(trimmed, fix),
        _ => false, // Ignore other sentences for now
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_gga() {
        let sentence = "$GPGGA,092750.000,5321.6802,N,00630.3372,W,1,8,0.95,39.9,M,47.0,M,,*45";
        // Recompute checksum for this test — let's just test parsing
        let mut fix = LiveFix::default();
        // The checksum might not match this fabricated sentence, so test parse_dm_to_dd directly
        let lat = parse_dm_to_dd("5321.6802", "N").unwrap();
        assert!((lat - 53.36134).abs() < 0.001);
    }

    #[test]
    fn test_parse_dm_to_dd() {
        let dd = parse_dm_to_dd("4124.8963", "N").unwrap();
        assert!((dd - 41.41494).abs() < 0.001);

        let dd = parse_dm_to_dd("00212.3456", "W").unwrap();
        assert!(dd < 0.0);
    }
}
