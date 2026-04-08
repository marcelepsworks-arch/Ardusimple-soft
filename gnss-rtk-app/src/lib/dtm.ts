/**
 * DTM — Digital Terrain Model
 *
 * Pure TypeScript implementation (no native deps):
 *  - Delaunay triangulation (Bowyer-Watson algorithm)
 *  - TIN elevation query by point-in-triangle barycentric interpolation
 *  - Basic surface statistics (min, max, mean elevation, volume estimate)
 *  - Contour line generation (marching-squares style on a regular grid)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SurveyPoint3D {
  easting: number;
  northing: number;
  elevation: number;
  name?: string;
}

export interface Triangle {
  a: SurveyPoint3D;
  b: SurveyPoint3D;
  c: SurveyPoint3D;
}

export interface SurfaceStats {
  minElev: number;
  maxElev: number;
  meanElev: number;
  rangeElev: number;
  pointCount: number;
  triangleCount: number;
  /** Approximate surface area in m² */
  surfaceArea: number;
  /** Approximate volume above a datum plane (datum = minElev) in m³ */
  volumeAboveDatum: number;
}

export interface ContourLine {
  elevation: number;
  /** Array of [easting, northing] pairs */
  segments: [number, number][][];
}

export interface DTMSurface {
  points: SurveyPoint3D[];
  triangles: Triangle[];
  stats: SurfaceStats;
  boundingBox: {minE: number; maxE: number; minN: number; maxN: number};
}

// ─── Delaunay Triangulation (Bowyer-Watson) ───────────────────────────────────

interface CircumCircle {
  cx: number;
  cy: number;
  r2: number; // radius squared
}

function circumcircle(a: SurveyPoint3D, b: SurveyPoint3D, c: SurveyPoint3D): CircumCircle | null {
  const ax = a.easting, ay = a.northing;
  const bx = b.easting, by = b.northing;
  const cx = c.easting, cy = c.northing;

  const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(D) < 1e-10) return null; // collinear

  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / D;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / D;

  const dx = ax - ux, dy = ay - uy;
  return {cx: ux, cy: uy, r2: dx * dx + dy * dy};
}

function edgeKey(a: SurveyPoint3D, b: SurveyPoint3D): string {
  const ids = [
    `${a.easting},${a.northing}`,
    `${b.easting},${b.northing}`,
  ].sort();
  return ids.join('|');
}

/** Bowyer-Watson Delaunay triangulation on 2D easting/northing. */
export function delaunay(inputPoints: SurveyPoint3D[]): Triangle[] {
  if (inputPoints.length < 3) return [];

  // Compute bounding box and super-triangle
  let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
  for (const p of inputPoints) {
    if (p.easting < minE) minE = p.easting;
    if (p.easting > maxE) maxE = p.easting;
    if (p.northing < minN) minN = p.northing;
    if (p.northing > maxN) maxN = p.northing;
  }

  const dE = maxE - minE, dN = maxN - minN;
  const deltaMax = Math.max(dE, dN) * 10;
  const midE = (minE + maxE) / 2;
  const midN = (minN + maxN) / 2;

  const st1: SurveyPoint3D = {easting: midE - 20 * deltaMax, northing: midN - deltaMax, elevation: 0, name: '__super1'};
  const st2: SurveyPoint3D = {easting: midE, northing: midN + 20 * deltaMax, elevation: 0, name: '__super2'};
  const st3: SurveyPoint3D = {easting: midE + 20 * deltaMax, northing: midN - deltaMax, elevation: 0, name: '__super3'};

  interface DTMTriangle {
    a: SurveyPoint3D;
    b: SurveyPoint3D;
    c: SurveyPoint3D;
    cc: CircumCircle | null;
  }

  let triangles: DTMTriangle[] = [{a: st1, b: st2, c: st3, cc: circumcircle(st1, st2, st3)}];

  for (const point of inputPoints) {
    const px = point.easting, py = point.northing;

    // Find bad triangles (point inside circumcircle)
    const badTriangles: DTMTriangle[] = [];
    for (const tri of triangles) {
      if (!tri.cc) continue;
      const dx = px - tri.cc.cx, dy = py - tri.cc.cy;
      if (dx * dx + dy * dy <= tri.cc.r2 + 1e-10) {
        badTriangles.push(tri);
      }
    }

    // Find boundary polygon of bad triangles
    const edgeCount = new Map<string, number>();
    for (const tri of badTriangles) {
      for (const [ea, eb] of [[tri.a, tri.b], [tri.b, tri.c], [tri.c, tri.a]] as [SurveyPoint3D, SurveyPoint3D][]) {
        const key = edgeKey(ea, eb);
        edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
      }
    }

    // Remove bad triangles
    triangles = triangles.filter(t => !badTriangles.includes(t));

    // Re-triangulate with new point using boundary edges
    const badSet = new Set(badTriangles);
    for (const tri of badSet) {
      for (const [ea, eb] of [[tri.a, tri.b], [tri.b, tri.c], [tri.c, tri.a]] as [SurveyPoint3D, SurveyPoint3D][]) {
        const key = edgeKey(ea, eb);
        if ((edgeCount.get(key) ?? 0) === 1) {
          const newTri = {a: ea, b: eb, c: point, cc: circumcircle(ea, eb, point)};
          triangles.push(newTri);
        }
      }
    }
  }

  // Remove triangles that share vertices with super-triangle
  const superNames = new Set(['__super1', '__super2', '__super3']);
  const isSuper = (p: SurveyPoint3D) => superNames.has(p.name ?? '');

  return triangles
    .filter(t => !isSuper(t.a) && !isSuper(t.b) && !isSuper(t.c))
    .map(t => ({a: t.a, b: t.b, c: t.c}));
}

// ─── Elevation query (barycentric interpolation) ──────────────────────────────

function barycentricWeights(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
): {u: number; v: number; w: number} | null {
  const denom = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(denom) < 1e-12) return null;
  const u = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / denom;
  const v = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / denom;
  const w = 1 - u - v;
  return {u, v, w};
}

/**
 * Query elevation at (easting, northing) by barycentric interpolation
 * within the TIN. Returns null if point is outside the triangulated surface.
 */
export function queryElevation(
  easting: number,
  northing: number,
  triangles: Triangle[],
): number | null {
  const EPS = -1e-10;
  for (const {a, b, c} of triangles) {
    const bary = barycentricWeights(
      easting, northing,
      a.easting, a.northing,
      b.easting, b.northing,
      c.easting, c.northing,
    );
    if (!bary) continue;
    const {u, v, w} = bary;
    if (u >= EPS && v >= EPS && w >= EPS) {
      return u * a.elevation + v * b.elevation + w * c.elevation;
    }
  }
  return null;
}

// ─── Surface statistics ───────────────────────────────────────────────────────

export function computeStats(points: SurveyPoint3D[], triangles: Triangle[]): SurfaceStats {
  if (points.length === 0) {
    return {minElev: 0, maxElev: 0, meanElev: 0, rangeElev: 0, pointCount: 0,
            triangleCount: 0, surfaceArea: 0, volumeAboveDatum: 0};
  }

  let minElev = Infinity, maxElev = -Infinity, sumElev = 0;
  for (const p of points) {
    if (p.elevation < minElev) minElev = p.elevation;
    if (p.elevation > maxElev) maxElev = p.elevation;
    sumElev += p.elevation;
  }
  const meanElev = sumElev / points.length;
  const datum = minElev;

  let surfaceArea = 0;
  let volumeAboveDatum = 0;

  for (const {a, b, c} of triangles) {
    // 2D projected area via cross product
    const ex = b.easting - a.easting, ey = b.northing - a.northing;
    const fx = c.easting - a.easting, fy = c.northing - a.northing;
    const planArea = Math.abs(ex * fy - ey * fx) / 2;

    // 3D surface area (approximate with 3D cross product)
    const bx = b.easting - a.easting, by = b.northing - a.northing, bz = b.elevation - a.elevation;
    const ccx = c.easting - a.easting, ccy = c.northing - a.northing, ccz = c.elevation - a.elevation;
    const nx = by * ccz - bz * ccy;
    const ny = bz * ccx - bx * ccz;
    const nz = bx * ccy - by * ccx;
    surfaceArea += Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;

    // Volume above datum: prism with average height
    const avgHeight = ((a.elevation - datum) + (b.elevation - datum) + (c.elevation - datum)) / 3;
    if (avgHeight > 0) volumeAboveDatum += planArea * avgHeight;
  }

  return {
    minElev, maxElev, meanElev, rangeElev: maxElev - minElev,
    pointCount: points.length, triangleCount: triangles.length,
    surfaceArea, volumeAboveDatum,
  };
}

// ─── Build full DTM surface ───────────────────────────────────────────────────

export function buildSurface(points: SurveyPoint3D[]): DTMSurface {
  const triangles = delaunay(points);
  const stats = computeStats(points, triangles);

  let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
  for (const p of points) {
    if (p.easting < minE) minE = p.easting;
    if (p.easting > maxE) maxE = p.easting;
    if (p.northing < minN) minN = p.northing;
    if (p.northing > maxN) maxN = p.northing;
  }

  return {points, triangles, stats, boundingBox: {minE, maxE, minN, maxN}};
}

// ─── Contour generation ───────────────────────────────────────────────────────

/**
 * Interpolate point along an edge where elevation crosses `level`.
 */
function edgeLerp(
  a: SurveyPoint3D,
  b: SurveyPoint3D,
  level: number,
): [number, number] {
  const t = (level - a.elevation) / (b.elevation - a.elevation);
  return [
    a.easting + t * (b.easting - a.easting),
    a.northing + t * (b.northing - a.northing),
  ];
}

/**
 * Generate contour line segments for a given elevation level.
 * Each contour level returns an array of line segments (pairs of 2D points).
 */
export function generateContours(
  triangles: Triangle[],
  levels: number[],
): ContourLine[] {
  const result: ContourLine[] = [];

  for (const level of levels) {
    const segments: [number, number][][] = [];

    for (const {a, b, c} of triangles) {
      const edges: [SurveyPoint3D, SurveyPoint3D][] = [[a, b], [b, c], [c, a]];
      const crossings: [number, number][] = [];

      for (const [p, q] of edges) {
        const lo = Math.min(p.elevation, q.elevation);
        const hi = Math.max(p.elevation, q.elevation);
        if (level > lo && level <= hi) {
          crossings.push(edgeLerp(p, q, level));
        }
      }

      if (crossings.length === 2) {
        segments.push([crossings[0], crossings[1]]);
      }
    }

    if (segments.length > 0) {
      result.push({elevation: level, segments});
    }
  }

  return result;
}

/**
 * Auto-generate contour levels between min and max elevation.
 * @param interval contour interval in metres
 */
export function autoContourLevels(stats: SurfaceStats, interval: number): number[] {
  if (interval <= 0 || stats.rangeElev === 0) return [];
  const first = Math.ceil(stats.minElev / interval) * interval;
  const levels: number[] = [];
  for (let l = first; l <= stats.maxElev; l += interval) {
    levels.push(parseFloat(l.toFixed(4)));
  }
  return levels;
}
