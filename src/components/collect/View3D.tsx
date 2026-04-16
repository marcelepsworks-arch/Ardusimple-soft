/**
 * View3D — Professional 3D/Elevation visualization for survey points.
 *
 * Two views (no external dependencies — pure Canvas + SVG):
 *   1. Elevation Profile  — altitude vs. cumulative distance (SVG)
 *   2. 3D Perspective     — interactive Canvas, drag to rotate, color by elevation
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { SurveyPoint } from "../../store/useSurveyStore";
import { fixTypeColor, fixTypeLabel } from "../../lib/formats";
import { haversineDistance } from "../../lib/survey-calc";
import { Mountain, Activity, RotateCw } from "lucide-react";

// ─── Coordinate helpers ───────────────────────────────────────────────────────

const DEG2RAD = Math.PI / 180;
const R_EARTH = 6378137;

/** Convert a point to local ENU (East, North, Up) metres relative to origin */
function toENU(p: SurveyPoint, origin: SurveyPoint): [number, number, number] {
  const mPerDegLat = Math.PI * R_EARTH / 180;
  const mPerDegLon = mPerDegLat * Math.cos(origin.latitude * DEG2RAD);
  return [
    (p.longitude - origin.longitude) * mPerDegLon,
    (p.latitude  - origin.latitude)  * mPerDegLat,
    p.altitude   - origin.altitude,
  ];
}

/** Elevation gradient: deep-blue (low) → cyan → green → yellow → red (high) */
function elevationColor(t: number): string {
  // t in [0, 1]
  const stops: [number, [number,number,number]][] = [
    [0.00, [30,  80, 200]],
    [0.25, [0,  200, 200]],
    [0.50, [50, 200,  50]],
    [0.75, [240,200,   0]],
    [1.00, [220,  40,  40]],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / (t1 - t0);
      return `rgb(${Math.round(c0[0] + (c1[0]-c0[0])*f)},${Math.round(c0[1] + (c1[1]-c0[1])*f)},${Math.round(c0[2] + (c1[2]-c0[2])*f)})`;
    }
  }
  return "#fff";
}

// ─── 1. Elevation Profile (SVG) ───────────────────────────────────────────────

export function ElevationProfile({ points }: { points: SurveyPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 text-xs">
        Need at least 2 points for elevation profile
      </div>
    );
  }

  // Compute cumulative distances
  const dists: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    dists.push(dists[i - 1] + haversineDistance(
      points[i-1].latitude, points[i-1].longitude,
      points[i].latitude,   points[i].longitude,
    ));
  }
  const totalDist = dists[dists.length - 1];
  const alts = points.map((p) => p.altitude);
  const minAlt = Math.min(...alts);
  const maxAlt = Math.max(...alts);
  const altRange = maxAlt - minAlt || 1;

  // SVG viewport
  const W = 300, H = 140;
  const PAD = { l: 42, r: 12, t: 14, b: 28 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  const xOf = (d: number) => PAD.l + (d / totalDist) * chartW;
  const yOf = (a: number) => PAD.t + chartH - ((a - minAlt) / altRange) * chartH;

  const linePts = points.map((p, i) => `${xOf(dists[i])},${yOf(p.altitude)}`).join(" ");
  const fillPts = [
    `${xOf(0)},${PAD.t + chartH}`,
    ...points.map((p, i) => `${xOf(dists[i])},${yOf(p.altitude)}`),
    `${xOf(totalDist)},${PAD.t + chartH}`,
  ].join(" ");

  // Y grid lines (3 intermediate)
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map((f) => ({
    alt: minAlt + f * altRange,
    y: PAD.t + chartH - f * chartH,
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 150 }}>
      <defs>
        <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Grid */}
      {yTicks.map(({ alt, y }, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={y} x2={PAD.l + chartW} y2={y} stroke="#374151" strokeWidth="0.5" strokeDasharray="3,3" />
          <text x={PAD.l - 3} y={y + 3} textAnchor="end" fontSize="7" fill="#6b7280">{alt.toFixed(1)}</text>
        </g>
      ))}

      {/* Axes */}
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + chartH} stroke="#4b5563" strokeWidth="1" />
      <line x1={PAD.l} y1={PAD.t + chartH} x2={PAD.l + chartW} y2={PAD.t + chartH} stroke="#4b5563" strokeWidth="1" />

      {/* Axis labels */}
      <text x={10} y={PAD.t + chartH / 2} textAnchor="middle" fontSize="7" fill="#9ca3af"
        transform={`rotate(-90,10,${PAD.t + chartH / 2})`}>Alt (m)</text>
      <text x={PAD.l + chartW / 2} y={H - 4} textAnchor="middle" fontSize="7" fill="#9ca3af">
        Distance: {totalDist >= 1000 ? `${(totalDist/1000).toFixed(2)} km` : `${totalDist.toFixed(1)} m`}
      </text>

      {/* Fill */}
      <polygon points={fillPts} fill="url(#profGrad)" />

      {/* Profile line */}
      <polyline points={linePts} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round" />

      {/* Points */}
      {points.map((p, i) => (
        <g key={p.id}>
          <circle
            cx={xOf(dists[i])} cy={yOf(p.altitude)} r={3}
            fill={fixTypeColor(p.fix_quality)}
            stroke="#111827" strokeWidth="1"
          />
          {/* Label for first, last, and every ~5th point */}
          {(i === 0 || i === points.length - 1 || i % Math.max(1, Math.floor(points.length / 6)) === 0) && (
            <text x={xOf(dists[i])} y={yOf(p.altitude) - 5}
              textAnchor="middle" fontSize="6.5" fill="#d1d5db" fontFamily="monospace">
              {p.name}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

// ─── 2. 3D Perspective Canvas ─────────────────────────────────────────────────

interface Point3D { enu: [number,number,number]; pt: SurveyPoint; }

function project(
  enu: [number,number,number],
  azRad: number, tiltRad: number,
  scale: number, cx: number, cy: number
): [number, number, number] {
  const [e, n, u] = enu;
  // Azimuth rotation (around Z/up axis)
  const cosA = Math.cos(azRad), sinA = Math.sin(azRad);
  const e2 =  e * cosA + n * sinA;
  const n2 = -e * sinA + n * cosA;
  // Tilt rotation (around E axis)
  const cosT = Math.cos(tiltRad), sinT = Math.sin(tiltRad);
  const n3 =  n2 * cosT - u * sinT;
  const u3 =  n2 * sinT + u * cosT;
  // Perspective
  const depth = n3 + scale * 3;
  const factor = (scale * 2.8) / Math.max(depth, 0.01);
  return [cx + e2 * factor, cy - u3 * factor, depth];
}

export function View3DCanvas({ points }: { points: SurveyPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [az, setAz]     = useState(0.5);       // azimuth radians
  const [tilt, setTilt] = useState(0.6);        // tilt radians (~35°)
  const [colorMode, setColorMode] = useState<"elevation" | "quality">("elevation");
  const [hovered, setHovered] = useState<SurveyPoint | null>(null);
  const dragging = useRef(false);
  const lastMouse = useRef<[number, number]>([0, 0]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, W, H);

    if (points.length === 0) return;

    const origin = points[0];
    const pts3d: Point3D[] = points.map((p) => ({ enu: toENU(p, origin), pt: p }));

    // Compute altitude range for color mapping
    const alts = pts3d.map((p) => p.enu[2]);
    const minAlt = Math.min(...alts);
    const maxAlt = Math.max(...alts);
    const altRange = maxAlt - minAlt || 1;

    // Auto scale: fit all points
    const maxExt = Math.max(
      ...pts3d.map((p) => Math.sqrt(p.enu[0]**2 + p.enu[1]**2 + p.enu[2]**2)),
      1
    );
    const scale = Math.min(cx, cy) * 0.55 / maxExt;

    // Draw ground grid
    const gridN = 5;
    const extent = maxExt * 1.2;
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 0.5;
    for (let i = -gridN; i <= gridN; i++) {
      const t = (i / gridN) * extent;
      const p1 = project([t, -extent, 0], az, tilt, scale, cx, cy);
      const p2 = project([t,  extent, 0], az, tilt, scale, cx, cy);
      const p3 = project([-extent, t, 0], az, tilt, scale, cx, cy);
      const p4 = project([ extent, t, 0], az, tilt, scale, cx, cy);
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p3[0], p3[1]); ctx.lineTo(p4[0], p4[1]); ctx.stroke();
    }

    // Sort by depth (painter's algorithm)
    const projected = pts3d.map((p) => ({
      ...p,
      screen: project(p.enu, az, tilt, scale, cx, cy),
    })).sort((a, b) => b.screen[2] - a.screen[2]);

    // Draw vertical "stems" to ground
    projected.forEach(({ enu, screen }) => {
      const ground = project([enu[0], enu[1], 0], az, tilt, scale, cx, cy);
      ctx.beginPath();
      ctx.moveTo(screen[0], screen[1]);
      ctx.lineTo(ground[0], ground[1]);
      ctx.strokeStyle = "rgba(100,116,139,0.3)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    });

    // Draw traverse line (in collection order)
    if (points.length >= 2) {
      const orderedScreens = pts3d.map((p) => project(p.enu, az, tilt, scale, cx, cy));
      ctx.beginPath();
      ctx.moveTo(orderedScreens[0][0], orderedScreens[0][1]);
      for (let i = 1; i < orderedScreens.length; i++) {
        ctx.lineTo(orderedScreens[i][0], orderedScreens[i][1]);
      }
      ctx.strokeStyle = "rgba(148,163,184,0.25)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw points
    projected.forEach(({ pt, enu, screen }) => {
      const t = (enu[2] - minAlt) / altRange;
      const color = colorMode === "elevation" ? elevationColor(t) : fixTypeColor(pt.fix_quality);
      const depth = screen[2];
      const r = Math.max(3, Math.min(8, (scale * 2) / (depth + 1) * maxExt * 0.12 + 4));

      // Shadow
      ctx.beginPath();
      ctx.arc(screen[0] + 1, screen[1] + 1, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fill();

      // Point
      ctx.beginPath();
      ctx.arc(screen[0], screen[1], r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Label
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = `bold 8px monospace`;
      ctx.fillText(pt.name, screen[0] + r + 2, screen[1] - r);
    });

    // Axis labels
    const axisLen = extent * 0.4;
    const drawAxis = (vec: [number,number,number], label: string, color: string) => {
      const s = project(vec, az, tilt, scale, cx, cy);
      const o = project([0,0,0], az, tilt, scale, cx, cy);
      ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(s[0], s[1]);
      ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = color; ctx.font = "bold 9px monospace";
      ctx.fillText(label, s[0] + 2, s[1] - 2);
    };
    drawAxis([axisLen,0,0], "E", "#f87171");
    drawAxis([0,axisLen,0], "N", "#4ade80");
    drawAxis([0,0,axisLen], "Z", "#60a5fa");

    // Elevation scale legend
    if (colorMode === "elevation" && altRange > 0.01) {
      const lx = W - 16, ly = H * 0.15, lh = H * 0.5;
      const grad = ctx.createLinearGradient(0, ly, 0, ly + lh);
      grad.addColorStop(0,   elevationColor(1));
      grad.addColorStop(0.25,elevationColor(0.75));
      grad.addColorStop(0.5, elevationColor(0.5));
      grad.addColorStop(0.75,elevationColor(0.25));
      grad.addColorStop(1,   elevationColor(0));
      ctx.fillStyle = grad;
      ctx.fillRect(lx, ly, 8, lh);
      ctx.strokeStyle = "#334155"; ctx.lineWidth = 0.5; ctx.strokeRect(lx, ly, 8, lh);
      ctx.fillStyle = "#94a3b8"; ctx.font = "7px monospace";
      ctx.fillText(`${(minAlt + altRange).toFixed(1)}m`, lx - 22, ly + 4);
      ctx.fillText(`${minAlt.toFixed(1)}m`,              lx - 22, ly + lh + 4);
    }
  }, [points, az, tilt, colorMode]);

  useEffect(() => { draw(); }, [draw]);

  // Mouse interaction
  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    lastMouse.current = [e.clientX, e.clientY];
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastMouse.current[0];
    const dy = e.clientY - lastMouse.current[1];
    lastMouse.current = [e.clientX, e.clientY];
    setAz((a)   => a + dx * 0.008);
    setTilt((t) => Math.max(0.05, Math.min(Math.PI * 0.5, t - dy * 0.008)));
  };
  const onMouseUp = () => { dragging.current = false; };

  // Touch interaction
  const lastTouch = useRef<[number, number]>([0, 0]);
  const onTouchStart = (e: React.TouchEvent) => {
    lastTouch.current = [e.touches[0].clientX, e.touches[0].clientY];
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - lastTouch.current[0];
    const dy = e.touches[0].clientY - lastTouch.current[1];
    lastTouch.current = [e.touches[0].clientX, e.touches[0].clientY];
    setAz((a)   => a + dx * 0.008);
    setTilt((t) => Math.max(0.05, Math.min(Math.PI * 0.5, t - dy * 0.008)));
  };

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center h-36 text-gray-500 text-xs">
        No points to display
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] text-gray-500">Drag to rotate · Elevation colour-coded</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setColorMode((m) => m === "elevation" ? "quality" : "elevation")}
            className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
            <RotateCw size={10} />
            {colorMode === "elevation" ? "By Fix" : "By Elev."}
          </button>
          <button onClick={() => { setAz(0.5); setTilt(0.6); }}
            className="text-[10px] text-gray-500 hover:text-gray-300">Reset</button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={296} height={220}
        className="w-full rounded border border-gray-700 cursor-grab active:cursor-grabbing"
        style={{ imageRendering: "crisp-edges" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onMouseUp}
      />
      {/* Point count + altitude info */}
      {points.length >= 2 && (() => {
        const alts = points.map((p) => p.altitude);
        const min = Math.min(...alts), max = Math.max(...alts);
        return (
          <div className="flex justify-between text-[10px] text-gray-500 font-mono px-1">
            <span>{points.length} pts</span>
            <span>Alt range: {(max - min).toFixed(3)} m</span>
            <span>Min {min.toFixed(2)} · Max {max.toFixed(2)}</span>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Combined view exported ───────────────────────────────────────────────────

type View3DMode = "profile" | "3d";

export function View3DPanel({ points }: { points: SurveyPoint[] }) {
  const [mode, setMode] = useState<View3DMode>("profile");

  return (
    <div className="space-y-2">
      {/* Mode toggle */}
      <div className="flex rounded overflow-hidden border border-gray-700 text-xs">
        <button
          onClick={() => setMode("profile")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 transition-colors ${mode === "profile" ? "bg-blue-700 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-200"}`}
        >
          <Activity size={12} /> Elevation Profile
        </button>
        <button
          onClick={() => setMode("3d")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 transition-colors ${mode === "3d" ? "bg-blue-700 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-200"}`}
        >
          <Mountain size={12} /> 3D View
        </button>
      </div>

      {mode === "profile" && <ElevationProfile points={points} />}
      {mode === "3d"      && <View3DCanvas    points={points} />}
    </div>
  );
}
