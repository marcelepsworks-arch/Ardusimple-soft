/**
 * NMEA 0183 parser — GGA, RMC, GSA, GSV
 * All survey math stays here (no native module needed for parsing).
 */

export interface LiveFix {
  latitude: number;
  longitude: number;
  altitude: number;
  fixType: string;
  fixQuality: number;
  hdop: number;
  satsUsed: number;
  ageOfCorrections: number;
  speedKnots: number;
  course: number;
  timestamp: string;
}

export function emptyFix(): LiveFix {
  return {
    latitude: 0,
    longitude: 0,
    altitude: 0,
    fixType: 'No Fix',
    fixQuality: 0,
    hdop: 99.9,
    satsUsed: 0,
    ageOfCorrections: 0,
    speedKnots: 0,
    course: 0,
    timestamp: '',
  };
}

function verifyChecksum(sentence: string): boolean {
  const starPos = sentence.lastIndexOf('*');
  if (starPos < 0 || starPos + 2 >= sentence.length) return false;
  const data = sentence.substring(1, starPos); // skip $
  const expected = parseInt(sentence.substring(starPos + 1), 16);
  let computed = 0;
  for (let i = 0; i < data.length; i++) {
    computed ^= data.charCodeAt(i);
  }
  return computed === expected;
}

/** Parse NMEA degrees+minutes (DDDMM.MMMM) to decimal degrees */
function parseDmToDd(dm: string, dir: string): number | null {
  if (!dm) return null;
  const dotPos = dm.indexOf('.');
  if (dotPos < 3) return null;
  const degEnd = dotPos - 2;
  const degrees = parseFloat(dm.substring(0, degEnd));
  const minutes = parseFloat(dm.substring(degEnd));
  if (isNaN(degrees) || isNaN(minutes)) return null;
  let dd = degrees + minutes / 60.0;
  if (dir === 'S' || dir === 'W') dd = -dd;
  return dd;
}

function fixQualityLabel(q: number): string {
  switch (q) {
    case 0: return 'No Fix';
    case 1: return 'Single';
    case 2: return 'DGPS';
    case 4: return 'RTK Fix';
    case 5: return 'RTK Float';
    default: return `Q${q}`;
  }
}

function parseGGA(fields: string[], fix: LiveFix): boolean {
  if (fields.length < 15) return false;
  if (fields[1]) fix.timestamp = fields[1];
  const lat = parseDmToDd(fields[2], fields[3]);
  if (lat !== null) fix.latitude = lat;
  const lon = parseDmToDd(fields[4], fields[5]);
  if (lon !== null) fix.longitude = lon;
  fix.fixQuality = parseInt(fields[6]) || 0;
  fix.fixType = fixQualityLabel(fix.fixQuality);
  fix.satsUsed = parseInt(fields[7]) || 0;
  fix.hdop = parseFloat(fields[8]) || 99.9;
  fix.altitude = parseFloat(fields[9]) || 0;
  if (fields[13]) fix.ageOfCorrections = parseFloat(fields[13]) || 0;
  return true;
}

function parseRMC(fields: string[], fix: LiveFix): boolean {
  if (fields.length < 12) return false;
  fix.speedKnots = parseFloat(fields[7]) || 0;
  fix.course = parseFloat(fields[8]) || 0;
  if (fix.latitude === 0) {
    const lat = parseDmToDd(fields[3], fields[4]);
    if (lat !== null) fix.latitude = lat;
  }
  if (fix.longitude === 0) {
    const lon = parseDmToDd(fields[5], fields[6]);
    if (lon !== null) fix.longitude = lon;
  }
  return true;
}

/** Parse a single NMEA sentence and update the LiveFix. Returns true if fix was updated. */
export function parseSentence(sentence: string, fix: LiveFix): boolean {
  const trimmed = sentence.trim();
  if (trimmed.length < 6 || !trimmed.startsWith('$')) return false;
  if (!verifyChecksum(trimmed)) return false;

  const starPos = trimmed.lastIndexOf('*');
  const body = trimmed.substring(0, starPos);
  const fields = body.split(',');
  const msgType = trimmed.substring(3, 6);

  switch (msgType) {
    case 'GGA': return parseGGA(fields, fix);
    case 'RMC': return parseRMC(fields, fix);
    default: return false;
  }
}

/** Generate a GGA string from the current fix (for NTRIP caster) */
export function generateGGA(fix: LiveFix): string {
  const latAbs = Math.abs(fix.latitude);
  const latDeg = Math.floor(latAbs);
  const latMin = (latAbs - latDeg) * 60;
  const latDir = fix.latitude >= 0 ? 'N' : 'S';

  const lonAbs = Math.abs(fix.longitude);
  const lonDeg = Math.floor(lonAbs);
  const lonMin = (lonAbs - lonDeg) * 60;
  const lonDir = fix.longitude >= 0 ? 'E' : 'W';

  const body = `GPGGA,${fix.timestamp},${String(latDeg).padStart(2, '0')}${latMin.toFixed(6)},${latDir},${String(lonDeg).padStart(3, '0')}${lonMin.toFixed(6)},${lonDir},${fix.fixQuality},${String(fix.satsUsed).padStart(2, '0')},${fix.hdop.toFixed(1)},${fix.altitude.toFixed(1)},M,0.0,M,,`;

  let checksum = 0;
  for (let i = 0; i < body.length; i++) {
    checksum ^= body.charCodeAt(i);
  }
  return `$${body}*${checksum.toString(16).toUpperCase().padStart(2, '0')}\r\n`;
}
