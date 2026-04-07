/**
 * Import/Export service for survey data.
 * Supports CSV, GeoJSON, KML, and DXF formats.
 */

import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import {CollectedPoint} from '../store/useProjectStore';
import {Project} from '../store/useProjectStore';

// ─── CSV ────────────────────────────────────────────────────────────────

export function pointsToCSV(points: CollectedPoint[], project: Project): string {
  const header =
    'Name,Code,Description,Easting,Northing,Elevation,Latitude,Longitude,Height,FixType,HDOP,Sats,CollectedAt';
  const rows = points.map(p =>
    [
      p.name,
      p.code,
      `"${p.description.replace(/"/g, '""')}"`,
      p.easting.toFixed(4),
      p.northing.toFixed(4),
      p.elevation.toFixed(4),
      p.latitude.toFixed(8),
      p.longitude.toFixed(8),
      p.height.toFixed(4),
      p.fixType,
      p.hdop.toFixed(2),
      p.satsUsed,
      p.collectedAt,
    ].join(','),
  );
  return [header, ...rows].join('\n');
}

export function csvToPoints(
  csv: string,
  projectId: string,
): CollectedPoint[] {
  const lines = csv.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // Auto-detect header
  const header = lines[0].toLowerCase();
  const cols = header.split(',').map(c => c.trim());

  const nameIdx = cols.findIndex(c => c === 'name' || c === 'point');
  const codeIdx = cols.findIndex(c => c === 'code');
  const descIdx = cols.findIndex(c => c === 'description' || c === 'desc');
  const eIdx = cols.findIndex(c => c === 'easting' || c === 'e' || c === 'x');
  const nIdx = cols.findIndex(c => c === 'northing' || c === 'n' || c === 'y');
  const zIdx = cols.findIndex(c => c === 'elevation' || c === 'z' || c === 'height' || c === 'alt');
  const latIdx = cols.findIndex(c => c === 'latitude' || c === 'lat');
  const lonIdx = cols.findIndex(c => c === 'longitude' || c === 'lon' || c === 'lng');

  const points: CollectedPoint[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (vals.length < 3) continue;

    const point: CollectedPoint = {
      id: `imp_${Date.now()}_${i}`,
      projectId,
      name: nameIdx >= 0 ? vals[nameIdx] || `IMP-${i}` : `IMP-${i}`,
      code: codeIdx >= 0 ? vals[codeIdx] || 'TP' : 'TP',
      description: descIdx >= 0 ? vals[descIdx] || '' : '',
      easting: eIdx >= 0 ? parseFloat(vals[eIdx]) || 0 : 0,
      northing: nIdx >= 0 ? parseFloat(vals[nIdx]) || 0 : 0,
      elevation: zIdx >= 0 ? parseFloat(vals[zIdx]) || 0 : 0,
      latitude: latIdx >= 0 ? parseFloat(vals[latIdx]) || 0 : 0,
      longitude: lonIdx >= 0 ? parseFloat(vals[lonIdx]) || 0 : 0,
      height: zIdx >= 0 ? parseFloat(vals[zIdx]) || 0 : 0,
      fixType: 'Imported',
      fixQuality: 0,
      hdop: 0,
      satsUsed: 0,
      collectedAt: new Date().toISOString(),
      note: 'Imported from CSV',
    };

    points.push(point);
  }

  return points;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ─── GeoJSON ────────────────────────────────────────────────────────────

export function pointsToGeoJSON(points: CollectedPoint[]): string {
  const features = points.map(p => ({
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: [p.longitude, p.latitude, p.height],
    },
    properties: {
      name: p.name,
      code: p.code,
      description: p.description,
      easting: p.easting,
      northing: p.northing,
      elevation: p.elevation,
      fixType: p.fixType,
      hdop: p.hdop,
      satsUsed: p.satsUsed,
      collectedAt: p.collectedAt,
    },
  }));

  return JSON.stringify(
    {type: 'FeatureCollection', features},
    null,
    2,
  );
}

export function geoJSONToPoints(
  json: string,
  projectId: string,
): CollectedPoint[] {
  const data = JSON.parse(json);
  if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new Error('Invalid GeoJSON: expected FeatureCollection');
  }

  return data.features
    .filter((f: any) => f.geometry?.type === 'Point')
    .map((f: any, i: number) => {
      const [lon, lat, alt = 0] = f.geometry.coordinates;
      const props = f.properties || {};
      return {
        id: `imp_${Date.now()}_${i}`,
        projectId,
        name: props.name || `IMP-${i + 1}`,
        code: props.code || 'TP',
        description: props.description || '',
        easting: props.easting || 0,
        northing: props.northing || 0,
        elevation: props.elevation || alt,
        latitude: lat,
        longitude: lon,
        height: alt,
        fixType: 'Imported',
        fixQuality: 0,
        hdop: 0,
        satsUsed: 0,
        collectedAt: props.collectedAt || new Date().toISOString(),
        note: 'Imported from GeoJSON',
      } as CollectedPoint;
    });
}

// ─── KML ────────────────────────────────────────────────────────────────

export function pointsToKML(points: CollectedPoint[], projectName: string): string {
  const placemarks = points
    .map(
      p => `    <Placemark>
      <name>${escapeXml(p.name)}</name>
      <description>${escapeXml(p.code)} - ${escapeXml(p.description)}</description>
      <Point>
        <coordinates>${p.longitude},${p.latitude},${p.height}</coordinates>
      </Point>
      <ExtendedData>
        <Data name="code"><value>${escapeXml(p.code)}</value></Data>
        <Data name="easting"><value>${p.easting.toFixed(4)}</value></Data>
        <Data name="northing"><value>${p.northing.toFixed(4)}</value></Data>
        <Data name="elevation"><value>${p.elevation.toFixed(4)}</value></Data>
        <Data name="fixType"><value>${escapeXml(p.fixType)}</value></Data>
        <Data name="hdop"><value>${p.hdop.toFixed(2)}</value></Data>
      </ExtendedData>
    </Placemark>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(projectName)}</name>
${placemarks}
  </Document>
</kml>`;
}

// ─── DXF ────────────────────────────────────────────────────────────────

export function pointsToDXF(points: CollectedPoint[]): string {
  // Minimal DXF file — points as POINT entities, each code = layer
  const layers = [...new Set(points.map(p => p.code))];

  let dxf = '0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n';
  for (const layer of layers) {
    dxf += `0\nLAYER\n2\n${layer}\n70\n0\n62\n7\n6\nCONTINUOUS\n`;
  }
  dxf += '0\nENDTAB\n0\nENDSEC\n';

  dxf += '0\nSECTION\n2\nENTITIES\n';
  for (const p of points) {
    // POINT entity
    dxf += `0\nPOINT\n8\n${p.code}\n10\n${p.easting.toFixed(4)}\n20\n${p.northing.toFixed(4)}\n30\n${p.elevation.toFixed(4)}\n`;
    // TEXT entity for label
    dxf += `0\nTEXT\n8\n${p.code}\n10\n${(p.easting + 0.5).toFixed(4)}\n20\n${(p.northing + 0.5).toFixed(4)}\n30\n${p.elevation.toFixed(4)}\n40\n0.5\n1\n${p.name}\n`;
  }
  dxf += '0\nENDSEC\n0\nEOF\n';

  return dxf;
}

// ─── File operations ────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function exportToFile(
  content: string,
  filename: string,
  mimeType: string,
): Promise<string> {
  const path = `${RNFS.DocumentDirectoryPath}/${filename}`;
  await RNFS.writeFile(path, content, 'utf8');
  return path;
}

export async function shareFile(
  path: string,
  mimeType: string,
): Promise<void> {
  await Share.open({
    url: `file://${path}`,
    type: mimeType,
    failOnCancel: false,
  });
}

export async function readFileContent(uri: string): Promise<string> {
  return RNFS.readFile(uri, 'utf8');
}
