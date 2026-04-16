import { SurveyPoint } from "../store/useSurveyStore";

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

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
