/**
 * COGO — Coordinate Geometry calculations.
 *
 * All functions operate on projected (Easting/Northing) or WGS-84 (lat/lon)
 * coordinates. Units: metres, degrees.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Point2D {
  easting: number;
  northing: number;
  /** Optional label */
  name?: string;
}

export interface InverseResult {
  distance: number;       // metres
  bearing: number;        // degrees from north, 0–360
  azimuth: number;        // same as bearing (alias)
  dE: number;             // easting difference
  dN: number;             // northing difference
}

export interface TraversePoint extends Point2D {
  distance: number;       // leg distance from previous point
  bearing: number;        // leg bearing from previous point
}

export interface AreaResult {
  area: number;           // m²
  perimeter: number;      // m
  areaHa: number;         // hectares
}

export interface IntersectionResult {
  easting: number;
  northing: number;
  valid: boolean;
}

// ─── Inverse (Bearing + Distance between two projected points) ────────────────

export function inverse(from: Point2D, to: Point2D): InverseResult {
  const dE = to.easting - from.easting;
  const dN = to.northing - from.northing;
  const distance = Math.sqrt(dE * dE + dN * dN);

  let bearingRad = Math.atan2(dE, dN); // atan2(E, N) gives bearing from north
  if (bearingRad < 0) bearingRad += 2 * Math.PI;
  const bearing = (bearingRad * 180) / Math.PI;

  return {distance, bearing, azimuth: bearing, dE, dN};
}

// ─── Traverse (compute point from start + bearing + distance) ────────────────

/**
 * Given a start point, bearing (degrees from north), and distance (m),
 * returns the resulting point.
 */
export function traverseLeg(
  start: Point2D,
  bearingDeg: number,
  distance: number,
): Point2D {
  const bearingRad = (bearingDeg * Math.PI) / 180;
  return {
    easting: start.easting + distance * Math.sin(bearingRad),
    northing: start.northing + distance * Math.cos(bearingRad),
  };
}

/**
 * Compute a full open traverse from a starting point.
 * Each leg is defined by {bearing, distance}.
 * Returns all computed points including the start.
 */
export function openTraverse(
  start: Point2D,
  legs: {bearing: number; distance: number}[],
): TraversePoint[] {
  const result: TraversePoint[] = [
    {easting: start.easting, northing: start.northing, distance: 0, bearing: 0, name: start.name},
  ];
  let current = start;
  for (const leg of legs) {
    const next = traverseLeg(current, leg.bearing, leg.distance);
    result.push({
      easting: next.easting,
      northing: next.northing,
      distance: leg.distance,
      bearing: leg.bearing,
    });
    current = next;
  }
  return result;
}

/**
 * Closure error of a closed traverse (last computed point vs start).
 */
export function traverseClosure(points: Point2D[]): {
  errorE: number;
  errorN: number;
  linearError: number;
  precision: string; // "1:XXXX"
  perimeter: number;
} {
  if (points.length < 2) return {errorE: 0, errorN: 0, linearError: 0, precision: '—', perimeter: 0};

  let perimeter = 0;
  for (let i = 0; i < points.length - 1; i++) {
    perimeter += inverse(points[i], points[i + 1]).distance;
  }

  const first = points[0];
  const last = points[points.length - 1];
  const errorE = last.easting - first.easting;
  const errorN = last.northing - first.northing;
  const linearError = Math.sqrt(errorE * errorE + errorN * errorN);
  const precisionRatio = perimeter > 0 ? Math.round(perimeter / linearError) : 0;

  return {
    errorE,
    errorN,
    linearError,
    precision: linearError > 0 ? `1:${precisionRatio.toLocaleString()}` : 'Perfect',
    perimeter,
  };
}

// ─── Area (Gauss/Shoelace, polygon must be closed or auto-closed) ─────────────

/**
 * Area and perimeter of a polygon using the Shoelace formula.
 * Works on projected coordinates (metres). Points need NOT be repeated.
 */
export function polygonArea(points: Point2D[]): AreaResult {
  const n = points.length;
  if (n < 3) return {area: 0, perimeter: 0, areaHa: 0};

  let sum = 0;
  let perimeter = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    sum += points[i].easting * points[j].northing;
    sum -= points[j].easting * points[i].northing;
    perimeter += inverse(points[i], points[j]).distance;
  }

  const area = Math.abs(sum) / 2;
  return {area, perimeter, areaHa: area / 10000};
}

// ─── Intersection ─────────────────────────────────────────────────────────────

/**
 * Bearing–bearing intersection: find the point where two bearing lines cross.
 * p1 + bearing1 and p2 + bearing2.
 */
export function bearingBearingIntersection(
  p1: Point2D,
  bearing1: number,
  p2: Point2D,
  bearing2: number,
): IntersectionResult {
  const b1 = (bearing1 * Math.PI) / 180;
  const b2 = (bearing2 * Math.PI) / 180;

  const sin1 = Math.sin(b1);
  const cos1 = Math.cos(b1);
  const sin2 = Math.sin(b2);
  const cos2 = Math.cos(b2);

  // Solve: p1 + t*dir1 = p2 + s*dir2
  const dE = p2.easting - p1.easting;
  const dN = p2.northing - p1.northing;
  const det = sin1 * cos2 - cos1 * sin2; // cross product of directions

  if (Math.abs(det) < 1e-10) {
    return {easting: 0, northing: 0, valid: false}; // parallel
  }

  const t = (dE * cos2 - dN * sin2) / det;

  return {
    easting: p1.easting + t * sin1,
    northing: p1.northing + t * cos1,
    valid: true,
  };
}

/**
 * Distance–distance intersection (two circles). Returns the two possible points.
 */
export function distanceDistanceIntersection(
  p1: Point2D,
  d1: number,
  p2: Point2D,
  d2: number,
): {point1: IntersectionResult; point2: IntersectionResult} {
  const dx = p2.easting - p1.easting;
  const dy = p2.northing - p1.northing;
  const d = Math.sqrt(dx * dx + dy * dy);

  if (d > d1 + d2 || d < Math.abs(d1 - d2) || d === 0) {
    const noSolution = {easting: 0, northing: 0, valid: false};
    return {point1: noSolution, point2: noSolution};
  }

  const a = (d1 * d1 - d2 * d2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, d1 * d1 - a * a));

  const mx = p1.easting + (a * dx) / d;
  const my = p1.northing + (a * dy) / d;

  return {
    point1: {
      easting: mx + (h * dy) / d,
      northing: my - (h * dx) / d,
      valid: true,
    },
    point2: {
      easting: mx - (h * dy) / d,
      northing: my + (h * dx) / d,
      valid: true,
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert decimal degrees to DMS string */
export function ddToDms(dd: number, isLon = false): string {
  const abs = Math.abs(dd);
  const deg = Math.floor(abs);
  const minFull = (abs - deg) * 60;
  const min = Math.floor(minFull);
  const sec = ((minFull - min) * 60).toFixed(4);
  const dir = dd >= 0 ? (isLon ? 'E' : 'N') : isLon ? 'W' : 'S';
  return `${deg}° ${min}' ${sec}" ${dir}`;
}

/** Format bearing to text quadrant (e.g. N 45°30'00" E) */
export function bearingToQuadrant(bearingDeg: number): string {
  const b = ((bearingDeg % 360) + 360) % 360;
  let ref: number;
  let prefix: string;
  let suffix: string;

  if (b <= 90) {
    ref = b; prefix = 'N'; suffix = 'E';
  } else if (b <= 180) {
    ref = 180 - b; prefix = 'S'; suffix = 'E';
  } else if (b <= 270) {
    ref = b - 180; prefix = 'S'; suffix = 'W';
  } else {
    ref = 360 - b; prefix = 'N'; suffix = 'W';
  }

  const deg = Math.floor(ref);
  const minFull = (ref - deg) * 60;
  const min = Math.floor(minFull);
  const sec = ((minFull - min) * 60).toFixed(0).padStart(2, '0');
  return `${prefix} ${deg}°${min}'${sec}" ${suffix}`;
}
