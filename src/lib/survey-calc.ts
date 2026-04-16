import { SurveyPoint } from "../store/useSurveyStore";
import { fixTypeColor } from "./formats";

const R = 6378137; // WGS84 equatorial radius in metres

/** Haversine distance in metres between two lat/lon points */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 3D distance including altitude difference */
export function distance3D(a: SurveyPoint, b: SurveyPoint): number {
  const d2d = haversineDistance(a.latitude, a.longitude, b.latitude, b.longitude);
  const dAlt = b.altitude - a.altitude;
  return Math.sqrt(d2d ** 2 + dAlt ** 2);
}

/** Forward azimuth in degrees (0–360, 0 = North) */
export function azimuth(a: SurveyPoint, b: SurveyPoint): number {
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const az = (Math.atan2(y, x) * 180) / Math.PI;
  return (az + 360) % 360;
}

/** Format azimuth as DDD°MM'SS" */
export function formatAzimuth(deg: number): string {
  const d = Math.floor(deg);
  const m = Math.floor((deg - d) * 60);
  const s = ((deg - d) * 60 - m) * 60;
  return `${String(d).padStart(3, "0")}°${String(m).padStart(2, "0")}'${s.toFixed(1).padStart(4, "0")}"`;
}

/** Shoelace formula for polygon area in m² (WGS84 approximation) */
export function polygonArea(points: SurveyPoint[]): number {
  if (points.length < 3) return 0;
  // Convert to local metric coords using first point as origin
  const origin = points[0];
  const latRad = (origin.latitude * Math.PI) / 180;
  const metersPerDegLat = (Math.PI * R) / 180;
  const metersPerDegLon = metersPerDegLat * Math.cos(latRad);

  const coords = points.map((p) => ({
    x: (p.longitude - origin.longitude) * metersPerDegLon,
    y: (p.latitude - origin.latitude) * metersPerDegLat,
  }));

  let area = 0;
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += coords[i].x * coords[j].y;
    area -= coords[j].x * coords[i].y;
  }
  return Math.abs(area) / 2;
}

/** Perimeter of a polygon (closes last to first) in metres */
export function polygonPerimeter(points: SurveyPoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    total += haversineDistance(points[i].latitude, points[i].longitude, next.latitude, next.longitude);
  }
  return total;
}

/** Format area as m² / ha / km² depending on size */
export function formatArea(m2: number): string {
  if (m2 >= 1_000_000) return `${(m2 / 1_000_000).toFixed(4)} km²`;
  if (m2 >= 10_000) return `${(m2 / 10_000).toFixed(4)} ha  (${m2.toFixed(1)} m²)`;
  return `${m2.toFixed(2)} m²`;
}

/** Format distance with appropriate units */
export function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(4)} km`;
  return `${m.toFixed(3)} m`;
}

// ─── Export helpers ───────────────────────────────────────────────────────────

import { fixTypeLabel } from "./formats";
import { SurveySession } from "../store/useSurveyStore";

export function exportGeoJSON(session: SurveySession): string {
  const features = session.points.map((p) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [p.longitude, p.latitude, p.altitude] },
    properties: {
      name: p.name,
      code: p.code,
      note: p.note,
      fix: fixTypeLabel(p.fix_quality),
      hdop: p.hdop,
      sats: p.sats_used,
      samples: p.samples,
      timestamp: p.timestamp,
    },
  }));
  return JSON.stringify({ type: "FeatureCollection", features }, null, 2);
}

export function exportKML(session: SurveySession): string {
  const placemarks = session.points.map((p) => `
  <Placemark>
    <name>${p.name}${p.code ? ` (${p.code})` : ""}</name>
    <description>${p.note || ""} | Fix: ${fixTypeLabel(p.fix_quality)} | HDOP: ${p.hdop.toFixed(2)}</description>
    <Point><coordinates>${p.longitude},${p.latitude},${p.altitude}</coordinates></Point>
    <TimeStamp><when>${p.timestamp}</when></TimeStamp>
  </Placemark>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${session.name}</name>
  <description>Exported from GNSS RTK Desktop</description>${placemarks}
</Document>
</kml>`;
}

export function exportCSV(session: SurveySession): string {
  const header = "Name,Code,Latitude,Longitude,Altitude(m),Fix,HDOP,Sats,Samples,Timestamp,Note\n";
  const rows = session.points.map((p) =>
    [p.name, p.code, p.latitude.toFixed(8), p.longitude.toFixed(8),
     p.altitude.toFixed(4), fixTypeLabel(p.fix_quality),
     p.hdop.toFixed(2), p.sats_used, p.samples, p.timestamp, `"${p.note}"`].join(",")
  ).join("\n");
  return header + rows;
}

/** Save a file — uses native OS save dialog in Tauri, browser blob fallback in web */
export async function downloadFile(content: string, filename: string, _mime: string) {
  // Tauri environment: use plugin-dialog save + plugin-fs write
  if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__) {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const ext = filename.split(".").pop() ?? "";
      const filters: { name: string; extensions: string[] }[] = ext ? [{ name: ext.toUpperCase(), extensions: [ext] }] : [];
      const path = await save({ defaultPath: filename, filters });
      if (path) {
        await writeTextFile(path, content);
      }
      return;
    } catch (e) {
      console.warn("Tauri save dialog failed, falling back to browser download:", e);
    }
  }
  // Browser / web fallback
  const blob = new Blob([content], { type: _mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Local metric coordinates (ENU) ──────────────────────────────────────────

function toLocalMetric(points: SurveyPoint[]): Array<{ e: number; n: number; u: number; pt: SurveyPoint }> {
  if (points.length === 0) return [];
  const origin = points[0];
  const mPerDegLat = (Math.PI * R) / 180;
  const mPerDegLon = mPerDegLat * Math.cos((origin.latitude * Math.PI) / 180);
  return points.map((p) => ({
    e: (p.longitude - origin.longitude) * mPerDegLon,
    n: (p.latitude  - origin.latitude)  * mPerDegLat,
    u: p.altitude,
    pt: p,
  }));
}

// ─── DXF ─────────────────────────────────────────────────────────────────────
// AutoCAD / Civil 3D / BricsCAD / QGIS
// Coordinates: local ENU metres (origin = first point). Absolute altitude on Z.
// Layers: one per point code (or "SURVEY" if no code).

export function exportDXF(session: SurveySession): string {
  const coords = toLocalMetric(session.points);
  const origin = session.points[0];
  const codes = [...new Set(session.points.map((p) => p.code || "SURVEY"))];

  const layerDefs = codes.map((c) => `  0\nLAYER\n  2\n${c}\n 70\n0\n 62\n7\n  6\nCONTINUOUS`).join("\n");

  const entities = coords.map(({ e, n, u, pt }) => {
    const layer = pt.code || "SURVEY";
    return [
      `  0\nPOINT`,
      `  8\n${layer}`,
      ` 10\n${e.toFixed(4)}`,
      ` 20\n${n.toFixed(4)}`,
      ` 30\n${u.toFixed(4)}`,
      // TEXT label
      `  0\nTEXT`,
      `  8\n${layer}_LABELS`,
      ` 10\n${e.toFixed(4)}`,
      ` 20\n${n.toFixed(4)}`,
      ` 30\n${u.toFixed(4)}`,
      ` 40\n0.5`,
      `  1\n${pt.name}${pt.code ? ` (${pt.code})` : ""}`,
    ].join("\n");
  }).join("\n");

  return [
    `  0\nSECTION\n  2\nHEADER`,
    `  9\n$ACADVER\n  1\nAC1015`,
    `  9\n$INSUNITS\n 70\n6`, // 6 = metres
    `  0\nENDSEC`,
    `  0\nSECTION\n  2\nTABLES`,
    `  0\nTABLE\n  2\nLAYER\n 70\n${codes.length * 2}`,
    layerDefs,
    `  0\nENDTAB\n  0\nENDSEC`,
    `  0\nSECTION\n  2\nENTITIES`,
    entities,
    `  0\nENDSEC\n  0\nEOF`,
    // Metadata comment block at top not valid in DXF, use filename convention
  ].join("\n") +
  // Append origin info as a comment-like entity (non-breaking)
  `\n; Origin: ${origin?.latitude.toFixed(8)}, ${origin?.longitude.toFixed(8)}\n`;
}

// ─── GPX ─────────────────────────────────────────────────────────────────────
// GPS Exchange Format — Garmin, Google Maps, Strava, OsmAnd, Locus

export function exportGPX(session: SurveySession): string {
  const wpts = session.points.map((p) => `  <wpt lat="${p.latitude.toFixed(8)}" lon="${p.longitude.toFixed(8)}">
    <ele>${p.altitude.toFixed(4)}</ele>
    <time>${p.timestamp}</time>
    <name>${p.name}</name>
    <cmt>${p.note || ""} | Fix: ${fixTypeLabel(p.fix_quality)} | HDOP: ${p.hdop.toFixed(2)}</cmt>
    <desc>${p.code || ""}</desc>
    <sym>Flag</sym>
  </wpt>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GNSS RTK Desktop"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${session.name}</name>
    <time>${session.createdAt}</time>
  </metadata>
${wpts}
</gpx>`;
}

// ─── PNEZD CSV ───────────────────────────────────────────────────────────────
// Point, Northing, Easting, Elevation, Description
// Used by: Carlson Survey, SurvCE/SurvPC, Eagle Point, Softdesk, IntelliCAD

export function exportPNEZD(session: SurveySession): string {
  return session.points.map((p) =>
    [
      p.name,
      p.latitude.toFixed(8),   // Northing = latitude
      p.longitude.toFixed(8),  // Easting  = longitude
      p.altitude.toFixed(4),
      p.code || p.note || "",
    ].join(",")
  ).join("\n");
}

// ─── LandXML ─────────────────────────────────────────────────────────────────
// Civil engineering standard — Autodesk Civil 3D, Trimble Business Center,
// Leica Infinity, Bentley InRoads, MAGNET Office

export function exportLandXML(session: SurveySession): string {
  const now = new Date().toISOString();
  const cgpoints = session.points.map((p, i) =>
    `      <CgPoint name="${p.name}" desc="${p.code || ""}" oID="${i + 1}">` +
    `${p.latitude.toFixed(8)} ${p.longitude.toFixed(8)} ${p.altitude.toFixed(4)}` +
    `</CgPoint>`
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<LandXML version="1.2" date="${now.slice(0, 10)}" time="${now.slice(11, 19)}"
  xmlns="http://www.landxml.org/schema/LandXML-1.2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.landxml.org/schema/LandXML-1.2 http://www.landxml.org/schema/LandXML-1.2/LandXML-1.2.xsd">
  <Units>
    <Metric linearUnit="meter" areaUnit="squareMeter" volumeUnit="cubicMeter" angularUnit="decimal dd.mm.ss" directionUnit="decimal dd.mm.ss"/>
  </Units>
  <Project name="${session.name}"/>
  <Application name="GNSS RTK Desktop" version="1.0"/>
  <CgPoints name="${session.name}">
${cgpoints}
  </CgPoints>
</LandXML>`;
}

// ─── XYZ (ASCII point cloud) ──────────────────────────────────────────────────
// CloudCompare, MeshLab, Leica Cyclone, FARO Scene
// Format: X Y Z (local metric ENU, space-separated)
// Optional colour column (R G B 0–255)

export function exportXYZ(session: SurveySession, includeColor = true): string {
  const coords = toLocalMetric(session.points);
  return coords.map(({ e, n, u, pt }) => {
    const base = `${e.toFixed(4)} ${n.toFixed(4)} ${u.toFixed(4)}`;
    if (!includeColor) return base;
    // RGB from fix quality colour
    const hex = fixTypeColor(pt.fix_quality).replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `${base} ${r} ${g} ${b}`;
  }).join("\n");
}
