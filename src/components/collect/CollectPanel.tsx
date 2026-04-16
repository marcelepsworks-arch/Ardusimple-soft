import { useEffect, useRef, useState } from "react";
import {
  MapPin, Loader2, Trash2, Download, X, ChevronDown, ChevronUp,
  AlertTriangle, Plus, FolderOpen, Pencil, Check, FolderX,
  Crosshair, BarChart2, FileDown, Navigation2,
} from "lucide-react";
import { useDeviceStore } from "../../store/useDeviceStore";
import {
  useSurveyStore, SurveyPoint, SurveySession,
  getActiveSession, nextPointName as calcNextName,
} from "../../store/useSurveyStore";
import { fixTypeLabel, fixTypeColor, formatCoord } from "../../lib/formats";
import {
  haversineDistance, distance3D, azimuth, formatAzimuth,
  polygonArea, polygonPerimeter, formatArea, formatDistance,
  exportGeoJSON, exportKML, exportCSV, downloadFile,
} from "../../lib/survey-calc";

const SAMPLE_OPTIONS = [1, 5, 10, 20, 30, 60];
const MIN_QUALITY = [
  { value: 1, label: "Single+" },
  { value: 2, label: "DGPS+" },
  { value: 5, label: "RTK Float+" },
  { value: 4, label: "RTK Fix only" },
];
const AUTO_DISTANCES = [1, 2, 5, 10, 25, 50];
type Tab = "collect" | "analysis" | "export";

// ─── Session bar ──────────────────────────────────────────────────────────────
function SessionBar() {
  const sessions = useSurveyStore((s) => s.sessions) ?? [];
  const activeSessionId = useSurveyStore((s) => s.activeSessionId);
  const { newSession, renameSession, setActiveSession, deleteSession } = useSurveyStore();
  const active = sessions.find((s) => s.id === activeSessionId);

  const [showPicker, setShowPicker] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function handleNew() {
    setNewName(`Session ${new Date().toLocaleDateString()}`);
    setShowNew(true);
    setShowPicker(false);
  }

  function confirmNew() {
    if (!newName.trim()) return;
    newSession(newName);
    setShowNew(false);
  }

  return (
    <div className="border-b border-gray-800 bg-gray-950">
      <div className="flex items-center gap-2 px-3 py-2">
        <FolderOpen size={13} className="text-blue-400 flex-shrink-0" />
        <button
          onClick={() => { setShowPicker((v) => !v); setShowNew(false); }}
          className="flex-1 text-left text-xs font-semibold text-gray-100 truncate hover:text-white"
        >
          {active ? active.name : <span className="text-gray-500 italic">No session — create one</span>}
        </button>
        <button onClick={handleNew} className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1 flex-shrink-0">
          <Plus size={13} /> New
        </button>
        <button onClick={() => { setShowPicker((v) => !v); setShowNew(false); }} className="text-gray-500 hover:text-gray-300 flex-shrink-0">
          {showPicker ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {showNew && (
        <div className="flex items-center gap-2 px-3 pb-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirmNew(); if (e.key === "Escape") setShowNew(false); }}
            className="flex-1 bg-gray-800 border border-blue-600 rounded px-2 py-1 text-xs"
            autoFocus
          />
          <button onClick={confirmNew} className="text-green-400"><Check size={14} /></button>
          <button onClick={() => setShowNew(false)} className="text-gray-500"><X size={14} /></button>
        </div>
      )}

      {showPicker && sessions.length > 0 && (
        <div className="border-t border-gray-800 max-h-44 overflow-y-auto">
          {[...sessions].reverse().map((s) => (
            <div key={s.id} className={`flex items-center gap-2 px-3 py-1.5 text-xs ${s.id === activeSessionId ? "bg-blue-900/30 text-blue-300" : "hover:bg-gray-800 text-gray-300"}`}>
              {editingId === s.id ? (
                <>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { renameSession(s.id, editName); setEditingId(null); } if (e.key === "Escape") setEditingId(null); }}
                    className="flex-1 bg-gray-900 border border-blue-600 rounded px-1.5 py-0.5 text-xs" autoFocus />
                  <button onClick={() => { renameSession(s.id, editName); setEditingId(null); }} className="text-green-400"><Check size={12} /></button>
                  <button onClick={() => setEditingId(null)} className="text-gray-500"><X size={12} /></button>
                </>
              ) : (
                <>
                  <button className="flex-1 text-left truncate" onClick={() => { setActiveSession(s.id); setShowPicker(false); }}>
                    <span className="font-medium">{s.name}</span>
                    <span className="text-gray-500 ml-1.5">({s.points.length} pts · {new Date(s.createdAt).toLocaleDateString()})</span>
                  </button>
                  <button onClick={() => { setEditingId(s.id); setEditName(s.name); }} className="text-gray-600 hover:text-gray-300"><Pencil size={11} /></button>
                  {confirmDelete === s.id ? (
                    <span className="flex items-center gap-1">
                      <button onClick={() => { deleteSession(s.id); setConfirmDelete(null); }} className="text-red-400 text-[10px]">Del</button>
                      <button onClick={() => setConfirmDelete(null)} className="text-gray-500 text-[10px]">Cancel</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDelete(s.id)} className="text-gray-600 hover:text-red-400"><FolderX size={11} /></button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Collect tab ──────────────────────────────────────────────────────────────
function CollectTab() {
  const fix = useDeviceStore((s) => s.liveFix);
  const connectionState = useDeviceStore((s) => s.connectionState);
  const storeState = useSurveyStore();
  const sessions = storeState.sessions ?? [];
  const activeSessionId = storeState.activeSessionId;
  const collecting = storeState.collecting;
  const autoCollectDistance = storeState.autoCollectDistance;
  const { addPoint, startCollecting, addSample, cancelCollecting,
          setAutoCollectDistance, newSession } = storeState;

  const session = getActiveSession({ sessions, activeSessionId });
  const points = session?.points ?? [];

  const [pointName, setPointName] = useState(() => calcNextName({ sessions, activeSessionId }));
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [samples, setSamples] = useState(1);
  const [minQuality, setMinQuality] = useState(4);
  const [progress, setProgress] = useState(0);
  const [showList, setShowList] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [autoActive, setAutoActive] = useState(false);
  const lastAutoPos = useRef<{ lat: number; lon: number } | null>(null);
  const unsub = useRef<(() => void) | null>(null);
  const autoUnsub = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!collecting.active) setPointName(calcNextName({ sessions, activeSessionId }));
  }, [activeSessionId, points.length, collecting.active]);

  // Auto-create session if none
  useEffect(() => {
    if ((useSurveyStore.getState().sessions ?? []).length === 0) {
      useSurveyStore.getState().newSession(`Session ${new Date().toLocaleDateString()}`);
    }
  }, []);

  // Averaging subscription
  useEffect(() => {
    if (!collecting.active) { unsub.current?.(); unsub.current = null; return; }
    unsub.current = useDeviceStore.subscribe((state) => {
      const f = state.liveFix;
      if (!f || !useSurveyStore.getState().collecting.active) return;
      const result = addSample(f);
      setProgress(result.progress);
      if (result.done && result.accumulated) {
        const acc = result.accumulated;
        savePoint(acc.lat, acc.lon, acc.alt, acc.fix_quality, acc.hdop, acc.sats, samples);
      }
    });
    return () => { unsub.current?.(); unsub.current = null; };
  }, [collecting.active]);

  // Auto-collect by distance subscription
  useEffect(() => {
    if (!autoActive || autoCollectDistance === null) {
      autoUnsub.current?.(); autoUnsub.current = null;
      lastAutoPos.current = null;
      return;
    }
    autoUnsub.current = useDeviceStore.subscribe((state) => {
      const f = state.liveFix;
      if (!f) return;
      const last = lastAutoPos.current;
      if (!last) { lastAutoPos.current = { lat: f.latitude, lon: f.longitude }; return; }
      const d = haversineDistance(last.lat, last.lon, f.latitude, f.longitude);
      if (d >= autoCollectDistance!) {
        lastAutoPos.current = { lat: f.latitude, lon: f.longitude };
        const st = useSurveyStore.getState();
        const name = calcNextName({ sessions: st.sessions ?? [], activeSessionId: st.activeSessionId });
        const point: SurveyPoint = {
          id: crypto.randomUUID(), name, code: "AUTO", note: `Auto @ ${autoCollectDistance}m`,
          latitude: f.latitude, longitude: f.longitude, altitude: f.altitude,
          fix_quality: f.fix_quality, hdop: f.hdop, sats_used: f.sats_used,
          samples: 1, timestamp: new Date().toISOString(),
        };
        st.addPoint(point);
      }
    });
    return () => { autoUnsub.current?.(); autoUnsub.current = null; };
  }, [autoActive, autoCollectDistance]);

  function savePoint(lat: number, lon: number, alt: number, fix_quality: number, hdop: number, sats_used: number, n: number) {
    const st = useSurveyStore.getState();
    const point: SurveyPoint = {
      id: crypto.randomUUID(),
      name: pointName.trim() || calcNextName({ sessions: st.sessions ?? [], activeSessionId: st.activeSessionId }),
      code: code.trim(), note: note.trim(),
      latitude: lat, longitude: lon, altitude: alt,
      fix_quality, hdop, sats_used, samples: n,
      timestamp: new Date().toISOString(),
    };
    addPoint(point);
    setCode(""); setNote(""); setProgress(0);
  }

  function startCollect() {
    if (!fix || connectionState !== "connected") return;
    if (!session) { newSession(`Session ${new Date().toLocaleDateString()}`); }
    if (fix.fix_quality < minQuality && minQuality !== 1) return;
    if (samples === 1) { savePoint(fix.latitude, fix.longitude, fix.altitude, fix.fix_quality, fix.hdop, fix.sats_used, 1); return; }
    setProgress(0);
    startCollecting(samples);
  }

  const isConnected = connectionState === "connected";
  const qualityOk = fix ? (fix.fix_quality >= minQuality || minQuality === 1) : false;
  const canCollect = isConnected && !!fix && qualityOk && !collecting.active && !autoActive;

  return (
    <div className="flex flex-col gap-0">
      {/* Fix quality bar */}
      <div className="px-3 py-2 border-b border-gray-800 bg-gray-950">
        {fix && isConnected ? (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: fixTypeColor(fix.fix_quality) }} />
              <span style={{ color: fixTypeColor(fix.fix_quality) }} className="font-mono font-bold text-xs">{fixTypeLabel(fix.fix_quality)}</span>
            </span>
            <span className="text-gray-400 text-xs font-mono">HDOP {fix.hdop.toFixed(1)} · {fix.sats_used} sats · {fix.altitude.toFixed(2)}m</span>
          </div>
        ) : (
          <span className="text-gray-500 text-xs flex items-center gap-1"><AlertTriangle size={11} />{isConnected ? "Waiting for fix..." : "No device connected"}</span>
        )}
      </div>

      {/* Collect form */}
      <div className="px-3 py-3 space-y-2.5 border-b border-gray-800">
        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider">Point Name</label>
            <input value={pointName} onChange={(e) => setPointName(e.target.value)} disabled={collecting.active || autoActive}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs font-mono" placeholder="P001" />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider">Code</label>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} disabled={collecting.active || autoActive}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs font-mono" placeholder="TN, BM, EP…" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-gray-400 uppercase tracking-wider">Note</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} disabled={collecting.active || autoActive}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs" placeholder="Optional description…" />
        </div>
        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider">Averaging</label>
            <select value={samples} onChange={(e) => setSamples(Number(e.target.value))} disabled={collecting.active || autoActive}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs">
              {SAMPLE_OPTIONS.map((n) => <option key={n} value={n}>{n === 1 ? "Single shot" : `${n} fixes avg`}</option>)}
            </select>
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider">Min. Quality</label>
            <select value={minQuality} onChange={(e) => setMinQuality(Number(e.target.value))} disabled={collecting.active || autoActive}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs">
              {MIN_QUALITY.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>

        {fix && isConnected && !qualityOk && !autoActive && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-900/20 border border-amber-800/50 rounded px-2 py-1.5">
            <AlertTriangle size={12} /> Fix quality too low for selected minimum
          </div>
        )}

        {collecting.active && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span className="flex items-center gap-1"><Loader2 size={11} className="animate-spin" />Averaging… {Math.round(progress * samples)}/{samples}</span>
              <button onClick={cancelCollecting} className="text-red-400 hover:text-red-300 flex items-center gap-1"><X size={11} /> Cancel</button>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all duration-200" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        )}

        <button onClick={startCollect} disabled={!canCollect || !session}
          className={`w-full py-2.5 rounded font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${canCollect && session ? "bg-green-600 hover:bg-green-500 text-white" : "bg-gray-800 text-gray-500 cursor-not-allowed"}`}>
          <MapPin size={16} />{collecting.active ? "Collecting…" : "Collect Point"}
        </button>

        {/* ── Auto-collect by distance ── */}
        <div className="border border-gray-700 rounded p-2.5 space-y-2 bg-gray-900/50">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-300 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Navigation2 size={11} /> Auto-Collect by Distance
            </span>
            <button
              onClick={() => setAutoActive((v) => { if (!v) lastAutoPos.current = null; return !v; })}
              disabled={!isConnected || !fix || !session}
              className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${autoActive ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-40"}`}>
              {autoActive ? "● ACTIVE" : "Start"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-400 w-16">Every</label>
            <select value={autoCollectDistance ?? 5} onChange={(e) => setAutoCollectDistance(Number(e.target.value))}
              disabled={autoActive} className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs">
              {AUTO_DISTANCES.map((d) => <option key={d} value={d}>{d} m</option>)}
            </select>
          </div>
          {autoActive && (
            <p className="text-[10px] text-amber-400 flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" /> Recording — walk to collect points automatically
            </p>
          )}
        </div>
      </div>

      {/* Points list */}
      {session && (
        <div>
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-gray-950 sticky top-0 z-10">
            <button className="flex items-center gap-1.5 text-xs text-gray-300 font-semibold" onClick={() => setShowList((v) => !v)}>
              {showList ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Points ({points.length})
            </button>
            {points.length > 0 && (
              confirmClear ? (
                <span className="flex items-center gap-1 text-xs">
                  <button onClick={() => { useSurveyStore.getState().clearSession(); setConfirmClear(false); }} className="text-red-400">Confirm</button>
                  <button onClick={() => setConfirmClear(false)} className="text-gray-400">Cancel</button>
                </span>
              ) : (
                <button onClick={() => setConfirmClear(true)} className="text-gray-500 hover:text-red-400"><Trash2 size={12} /></button>
              )
            )}
          </div>
          {showList && (
            <div className="divide-y divide-gray-800/60">
              {points.length === 0
                ? <p className="text-xs text-gray-500 text-center py-5">No points in this session</p>
                : [...points].reverse().map((p) => (
                  <PointRow key={p.id} point={p} onDelete={() => useSurveyStore.getState().deletePoint(p.id)} />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Analysis tab ─────────────────────────────────────────────────────────────
function AnalysisTab() {
  const sessions = useSurveyStore((s) => s.sessions) ?? [];
  const activeSessionId = useSurveyStore((s) => s.activeSessionId);
  const session = getActiveSession({ sessions, activeSessionId });
  const points = session?.points ?? [];

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inverseA, setInverseA] = useState<string>("");
  const [inverseB, setInverseB] = useState<string>("");

  const selected = points.filter((p) => selectedIds.has(p.id));
  const area = selected.length >= 3 ? polygonArea(selected) : null;
  const perimeter = selected.length >= 2 ? polygonPerimeter(selected) : null;

  const ptA = points.find((p) => p.id === inverseA);
  const ptB = points.find((p) => p.id === inverseB);
  const invDist2D = ptA && ptB ? haversineDistance(ptA.latitude, ptA.longitude, ptB.latitude, ptB.longitude) : null;
  const invDist3D = ptA && ptB ? distance3D(ptA, ptB) : null;
  const invAzimuth = ptA && ptB ? azimuth(ptA, ptB) : null;
  const invDeltaH = ptA && ptB ? ptB.altitude - ptA.altitude : null;

  function togglePoint(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (!session) return <p className="text-xs text-gray-500 text-center py-8">No active session</p>;

  return (
    <div className="px-3 py-3 space-y-4">
      {/* Area & perimeter */}
      <div className="space-y-2">
        <h3 className="text-[10px] text-gray-300 font-semibold uppercase tracking-wider flex items-center gap-1.5">
          <BarChart2 size={11} /> Area & Perimeter
        </h3>
        <p className="text-[10px] text-gray-500">Select 3+ points to compute area (polygon in order selected)</p>
        <div className="space-y-1 max-h-36 overflow-y-auto">
          {points.length === 0
            ? <p className="text-xs text-gray-500 text-center py-2">No points</p>
            : points.map((p, i) => (
              <label key={p.id} className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs transition-colors ${selectedIds.has(p.id) ? "bg-blue-900/40 text-blue-200" : "hover:bg-gray-800 text-gray-300"}`}>
                <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => togglePoint(p.id)} className="accent-blue-500" />
                <span className="font-mono font-semibold">{p.name}</span>
                {p.code && <span className="text-gray-500 text-[10px]">{p.code}</span>}
                <span className="text-gray-500 text-[10px] ml-auto">#{i + 1}</span>
              </label>
            ))}
        </div>
        {selected.length >= 2 && (
          <div className="bg-gray-800 rounded p-2.5 space-y-1.5 font-mono text-xs">
            {area !== null && (
              <div className="flex justify-between">
                <span className="text-gray-400">Area:</span>
                <span className="text-green-400 font-bold">{formatArea(area)}</span>
              </div>
            )}
            {selected.length >= 2 && perimeter !== null && (
              <div className="flex justify-between">
                <span className="text-gray-400">Perimeter:</span>
                <span className="text-blue-300">{formatDistance(perimeter)}</span>
              </div>
            )}
            {selected.length < 3 && (
              <p className="text-gray-500 text-[10px]">Select 1 more point for area</p>
            )}
          </div>
        )}
        {selected.length >= 2 && (
          <button onClick={() => setSelectedIds(new Set())} className="text-[10px] text-gray-500 hover:text-gray-300">
            Clear selection
          </button>
        )}
      </div>

      <div className="border-t border-gray-800" />

      {/* COGO Inverse */}
      <div className="space-y-2">
        <h3 className="text-[10px] text-gray-300 font-semibold uppercase tracking-wider flex items-center gap-1.5">
          <Crosshair size={11} /> COGO — Inverse
        </h3>
        <p className="text-[10px] text-gray-500">Distance and azimuth between two collected points</p>
        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] text-gray-400">From (A)</label>
            <select value={inverseA} onChange={(e) => setInverseA(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs font-mono">
              <option value="">— select —</option>
              {points.map((p) => <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ""}</option>)}
            </select>
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-[10px] text-gray-400">To (B)</label>
            <select value={inverseB} onChange={(e) => setInverseB(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs font-mono">
              <option value="">— select —</option>
              {points.map((p) => <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ""}</option>)}
            </select>
          </div>
        </div>
        {ptA && ptB && invDist2D !== null && (
          <div className="bg-gray-800 rounded p-2.5 space-y-1.5 font-mono text-xs">
            <div className="flex justify-between"><span className="text-gray-400">Dist 2D:</span><span className="text-white font-bold">{formatDistance(invDist2D)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Dist 3D:</span><span className="text-white">{formatDistance(invDist3D!)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Azimuth:</span><span className="text-amber-300 font-bold">{formatAzimuth(invAzimuth!)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">ΔH:</span><span className={invDeltaH! >= 0 ? "text-green-400" : "text-red-400"}>{invDeltaH! >= 0 ? "+" : ""}{invDeltaH!.toFixed(3)} m</span></div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Export tab ───────────────────────────────────────────────────────────────
function ExportTab() {
  const sessions = useSurveyStore((s) => s.sessions) ?? [];
  const activeSessionId = useSurveyStore((s) => s.activeSessionId);
  const session = getActiveSession({ sessions, activeSessionId });

  if (!session) return <p className="text-xs text-gray-500 text-center py-8">No active session</p>;

  const slug = session.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
  const date = new Date().toISOString().slice(0, 10);

  function doExport(type: "csv" | "geojson" | "kml") {
    if (!session) return;
    if (type === "csv") downloadFile(exportCSV(session), `${slug}_${date}.csv`, "text/csv");
    if (type === "geojson") downloadFile(exportGeoJSON(session), `${slug}_${date}.geojson`, "application/geo+json");
    if (type === "kml") downloadFile(exportKML(session), `${slug}_${date}.kml`, "application/vnd.google-earth.kml+xml");
  }

  return (
    <div className="px-3 py-3 space-y-3">
      <h3 className="text-[10px] text-gray-300 font-semibold uppercase tracking-wider flex items-center gap-1.5">
        <FileDown size={11} /> Export Session
      </h3>
      <p className="text-[10px] text-gray-500">
        <span className="text-gray-300 font-semibold">{session.name}</span> · {session.points.length} points
      </p>

      {session.points.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-4">No points to export</p>
      ) : (
        <div className="space-y-2">
          {[
            { type: "csv" as const, label: "CSV", desc: "Spreadsheet / Excel / QGIS", color: "text-green-400" },
            { type: "geojson" as const, label: "GeoJSON", desc: "QGIS, Mapbox, web GIS", color: "text-blue-400" },
            { type: "kml" as const, label: "KML", desc: "Google Earth, Google Maps", color: "text-amber-400" },
          ].map(({ type, label, desc, color }) => (
            <button key={type} onClick={() => doExport(type)}
              className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 hover:border-gray-600 transition-colors text-left">
              <Download size={15} className={color} />
              <div>
                <div className={`text-xs font-bold ${color}`}>{label}</div>
                <div className="text-[10px] text-gray-400">{desc}</div>
              </div>
            </button>
          ))}

          <div className="border-t border-gray-800 pt-2">
            <p className="text-[10px] text-gray-500 mb-2">Export all sessions</p>
            <button onClick={() => {
              const all = sessions.map((s) => ({
                type: "FeatureCollection" as const,
                name: s.name,
                features: JSON.parse(exportGeoJSON(s)).features,
              }));
              downloadFile(JSON.stringify(all, null, 2), `all_sessions_${date}.geojson`, "application/geo+json");
            }} className="w-full flex items-center gap-3 px-3 py-2 bg-gray-800/60 hover:bg-gray-700 rounded border border-gray-700 text-left">
              <Download size={14} className="text-blue-300" />
              <div>
                <div className="text-xs font-bold text-blue-300">All Sessions GeoJSON</div>
                <div className="text-[10px] text-gray-400">{sessions.length} sessions · {sessions.reduce((a, s) => a + s.points.length, 0)} total pts</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Point row ────────────────────────────────────────────────────────────────
function PointRow({ point, onDelete }: { point: SurveyPoint; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="px-3 py-2 hover:bg-gray-800/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <button className="flex-1 text-left" onClick={() => setExpanded((v) => !v)}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: fixTypeColor(point.fix_quality) }} />
            <span className="font-mono font-semibold text-xs text-gray-100">{point.name}</span>
            {point.code && <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 rounded font-mono">{point.code}</span>}
            <span className="text-[10px] ml-auto" style={{ color: fixTypeColor(point.fix_quality) }}>{fixTypeLabel(point.fix_quality)}</span>
          </div>
          <div className="text-[10px] text-gray-400 font-mono mt-0.5 pl-4">
            {point.latitude.toFixed(7)}° {point.longitude.toFixed(7)}° {point.altitude.toFixed(3)}m
          </div>
        </button>
        <button onClick={onDelete} className="text-gray-600 hover:text-red-400 flex-shrink-0 mt-0.5"><Trash2 size={12} /></button>
      </div>
      {expanded && (
        <div className="mt-1.5 ml-4 text-[10px] text-gray-400 space-y-0.5 font-mono">
          <div>Lat: {formatCoord(point.latitude, true)}</div>
          <div>Lon: {formatCoord(point.longitude, false)}</div>
          <div>Alt: {point.altitude.toFixed(4)} m</div>
          <div>HDOP: {point.hdop.toFixed(2)} · Sats: {point.sats_used}</div>
          {point.samples > 1 && <div>Averaged: {point.samples} fixes</div>}
          <div>{new Date(point.timestamp).toLocaleString()}</div>
          {point.note && <div className="text-gray-300">"{point.note}"</div>}
        </div>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export function CollectPanel() {
  const [tab, setTab] = useState<Tab>("collect");

  const tabs: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: "collect", icon: <MapPin size={13} />, label: "Collect" },
    { id: "analysis", icon: <BarChart2 size={13} />, label: "Analysis" },
    { id: "export", icon: <FileDown size={13} />, label: "Export" },
  ];

  return (
    <div className="flex flex-col h-full text-sm">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-800 flex-shrink-0">
        <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Survey</h2>
      </div>

      {/* Session bar */}
      <div className="flex-shrink-0"><SessionBar /></div>

      {/* Tab nav */}
      <div className="flex border-b border-gray-800 flex-shrink-0 bg-gray-950">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${tab === t.id ? "text-blue-400 border-b-2 border-blue-400 bg-gray-900" : "text-gray-500 hover:text-gray-300"}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "collect" && <CollectTab />}
        {tab === "analysis" && <AnalysisTab />}
        {tab === "export" && <ExportTab />}
      </div>
    </div>
  );
}
