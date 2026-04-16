import { useEffect, useRef, useState } from "react";
import {
  MapPin, Loader2, Trash2, Download, X,
  ChevronDown, ChevronUp, AlertTriangle, Plus,
  FolderOpen, Pencil, Check, FolderX,
} from "lucide-react";
import { useDeviceStore } from "../../store/useDeviceStore";
import { useSurveyStore, SurveyPoint, SurveySession } from "../../store/useSurveyStore";
import { fixTypeLabel, fixTypeColor, formatCoord } from "../../lib/formats";

const SAMPLE_OPTIONS = [1, 5, 10, 20, 30, 60];
const MIN_QUALITY: { value: number; label: string }[] = [
  { value: 1, label: "Single+" },
  { value: 2, label: "DGPS+" },
  { value: 5, label: "RTK Float+" },
  { value: 4, label: "RTK Fix only" },
];

// ─── Session header bar ───────────────────────────────────────────────────────
function SessionBar() {
  const { sessions, activeSessionId, newSession, renameSession,
          setActiveSession, deleteSession } = useSurveyStore();
  const active = sessions.find((s) => s.id === activeSessionId);

  const [showPicker, setShowPicker] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleNew() {
    const defaultName = `Session ${new Date().toLocaleDateString("ca", {
      day: "2-digit", month: "2-digit", year: "numeric",
    })}`;
    setNewName(defaultName);
    setShowNew(true);
    setShowPicker(false);
    setTimeout(() => inputRef.current?.select(), 50);
  }

  function confirmNew() {
    if (!newName.trim()) return;
    newSession(newName);
    setShowNew(false);
    setNewName("");
  }

  function startEdit(s: SurveySession) {
    setEditingId(s.id);
    setEditName(s.name);
  }

  function confirmEdit() {
    if (editingId) renameSession(editingId, editName);
    setEditingId(null);
  }

  return (
    <div className="border-b border-gray-800 bg-gray-950">
      {/* Active session row */}
      <div className="flex items-center gap-2 px-4 py-2">
        <FolderOpen size={13} className="text-blue-400 flex-shrink-0" />
        <button
          onClick={() => { setShowPicker((v) => !v); setShowNew(false); }}
          className="flex-1 text-left text-xs font-semibold text-gray-100 truncate hover:text-white"
        >
          {active ? active.name : <span className="text-gray-500 italic">No session</span>}
        </button>
        <button
          onClick={handleNew}
          title="New session"
          className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 flex-shrink-0"
        >
          <Plus size={13} /> New
        </button>
        <button
          onClick={() => { setShowPicker((v) => !v); setShowNew(false); }}
          className="text-gray-500 hover:text-gray-300 flex-shrink-0"
        >
          {showPicker ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* New session input */}
      {showNew && (
        <div className="flex items-center gap-2 px-4 pb-2">
          <input
            ref={inputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirmNew(); if (e.key === "Escape") setShowNew(false); }}
            className="flex-1 bg-gray-800 border border-blue-600 rounded px-2 py-1 text-xs"
            placeholder="Session name..."
            autoFocus
          />
          <button onClick={confirmNew} className="text-green-400 hover:text-green-300"><Check size={14} /></button>
          <button onClick={() => setShowNew(false)} className="text-gray-500 hover:text-gray-300"><X size={14} /></button>
        </div>
      )}

      {/* Session picker */}
      {showPicker && (
        <div className="border-t border-gray-800 max-h-48 overflow-y-auto">
          {sessions.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-3">No sessions yet</p>
          ) : (
            [...sessions].reverse().map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-2 px-4 py-1.5 text-xs transition-colors ${
                  s.id === activeSessionId
                    ? "bg-blue-900/30 text-blue-300"
                    : "hover:bg-gray-800 text-gray-300"
                }`}
              >
                {editingId === s.id ? (
                  <>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") setEditingId(null); }}
                      className="flex-1 bg-gray-900 border border-blue-600 rounded px-1.5 py-0.5 text-xs"
                      autoFocus
                    />
                    <button onClick={confirmEdit} className="text-green-400"><Check size={12} /></button>
                    <button onClick={() => setEditingId(null)} className="text-gray-500"><X size={12} /></button>
                  </>
                ) : (
                  <>
                    <button
                      className="flex-1 text-left truncate"
                      onClick={() => { setActiveSession(s.id); setShowPicker(false); }}
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="text-gray-500 ml-1.5">
                        ({s.points.length} pts · {new Date(s.createdAt).toLocaleDateString()})
                      </span>
                    </button>
                    <button onClick={() => startEdit(s)} className="text-gray-600 hover:text-gray-300"><Pencil size={11} /></button>
                    {confirmDelete === s.id ? (
                      <span className="flex items-center gap-1">
                        <button onClick={() => { deleteSession(s.id); setConfirmDelete(null); }} className="text-red-400 hover:text-red-300 text-[10px]">Del</button>
                        <button onClick={() => setConfirmDelete(null)} className="text-gray-500 text-[10px]">Cancel</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDelete(s.id)} className="text-gray-600 hover:text-red-400"><FolderX size={11} /></button>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export function CollectPanel() {
  const fix = useDeviceStore((s) => s.liveFix);
  const connectionState = useDeviceStore((s) => s.connectionState);
  const {
    sessions, activeSessionId, collecting,
    addPoint, deletePoint, clearSession,
    startCollecting, addSample, cancelCollecting,
    nextPointName, newSession, activeSession,
  } = useSurveyStore();

  const session = activeSession();
  const points = session?.points ?? [];

  const [pointName, setPointName] = useState(() => useSurveyStore.getState().nextPointName());
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [samples, setSamples] = useState(1);
  const [minQuality, setMinQuality] = useState(4);
  const [progress, setProgress] = useState(0);
  const [showList, setShowList] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const unsub = useRef<(() => void) | null>(null);

  // Refresh auto-name when session or points change
  useEffect(() => {
    if (!collecting.active) setPointName(useSurveyStore.getState().nextPointName());
  }, [activeSessionId, points.length, collecting.active]);

  // Auto-create first session if none exist
  useEffect(() => {
    if (useSurveyStore.getState().sessions.length === 0) {
      useSurveyStore.getState().newSession(
        `Session ${new Date().toLocaleDateString("ca", { day: "2-digit", month: "2-digit", year: "numeric" })}`
      );
    }
  }, []);

  function startCollect() {
    if (!fix || connectionState !== "connected") return;
    if (!session) {
      // No active session — create one automatically
      newSession(`Session ${new Date().toLocaleDateString()}`);
    }
    if (fix.fix_quality < minQuality && minQuality !== 1) return;
    if (samples === 1) {
      savePoint(fix.latitude, fix.longitude, fix.altitude,
                fix.fix_quality, fix.hdop, fix.sats_used, 1);
      return;
    }
    setProgress(0);
    startCollecting(samples);
  }

  useEffect(() => {
    if (!collecting.active) {
      unsub.current?.();
      unsub.current = null;
      return;
    }
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

  function savePoint(
    lat: number, lon: number, alt: number,
    fix_quality: number, hdop: number, sats_used: number, n: number
  ) {
    const point: SurveyPoint = {
      id: crypto.randomUUID(),
      name: pointName.trim() || useSurveyStore.getState().nextPointName(),
      code: code.trim(),
      note: note.trim(),
      latitude: lat, longitude: lon, altitude: alt,
      fix_quality, hdop, sats_used, samples: n,
      timestamp: new Date().toISOString(),
    };
    addPoint(point);
    setCode("");
    setNote("");
    setProgress(0);
  }

  function exportCSV(sess?: SurveySession) {
    const target = sess ?? session;
    if (!target) return;
    const header = "Name,Code,Latitude,Longitude,Altitude(m),Fix,HDOP,Sats,Samples,Timestamp,Note\n";
    const rows = target.points.map((p) =>
      [p.name, p.code, p.latitude.toFixed(8), p.longitude.toFixed(8),
       p.altitude.toFixed(4), fixTypeLabel(p.fix_quality),
       p.hdop.toFixed(2), p.sats_used, p.samples, p.timestamp, p.note].join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${target.name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isConnected = connectionState === "connected";
  const qualityOk = fix ? (fix.fix_quality >= minQuality || minQuality === 1) : false;
  const canCollect = isConnected && !!fix && qualityOk && !collecting.active;

  return (
    <div className="flex flex-col h-full text-sm">
      {/* Page title */}
      <div className="px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
          Survey — Point Collection
        </h2>
      </div>

      {/* Session bar */}
      <div className="flex-shrink-0">
        <SessionBar />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Live fix quality */}
        <div className="px-4 py-2 border-b border-gray-800 bg-gray-950">
          {fix && isConnected ? (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: fixTypeColor(fix.fix_quality) }} />
                <span style={{ color: fixTypeColor(fix.fix_quality) }} className="font-mono font-bold text-xs">
                  {fixTypeLabel(fix.fix_quality)}
                </span>
              </span>
              <span className="text-gray-400 text-xs">HDOP {fix.hdop.toFixed(1)} · {fix.sats_used} sats</span>
            </div>
          ) : (
            <span className="text-gray-500 text-xs flex items-center gap-1">
              <AlertTriangle size={11} />
              {isConnected ? "Waiting for fix..." : "No device connected"}
            </span>
          )}
        </div>

        {/* No active session warning */}
        {!session && (
          <div className="mx-4 mt-3 text-xs text-amber-400 bg-amber-900/20 border border-amber-800/50 rounded px-3 py-2 flex items-center gap-2">
            <AlertTriangle size={12} />
            Create or select a session to start collecting points
          </div>
        )}

        {/* Collect form */}
        <div className="px-4 py-3 space-y-3 border-b border-gray-800">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-gray-400">Point Name</label>
              <input
                value={pointName}
                onChange={(e) => setPointName(e.target.value)}
                disabled={collecting.active}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs font-mono"
                placeholder="P001"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-gray-400">Code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                disabled={collecting.active}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs font-mono"
                placeholder="TN, BM, EP..."
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-400">Note (optional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={collecting.active}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs"
              placeholder="Description..."
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-gray-400">Averaging</label>
              <select
                value={samples}
                onChange={(e) => setSamples(Number(e.target.value))}
                disabled={collecting.active}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs"
              >
                {SAMPLE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n === 1 ? "Single shot" : `${n} fixes avg`}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-gray-400">Min. Quality</label>
              <select
                value={minQuality}
                onChange={(e) => setMinQuality(Number(e.target.value))}
                disabled={collecting.active}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs"
              >
                {MIN_QUALITY.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {fix && isConnected && !qualityOk && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-900/20 border border-amber-800/50 rounded px-2 py-1.5">
              <AlertTriangle size={12} /> Fix quality too low for selected minimum
            </div>
          )}

          {collecting.active && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Loader2 size={11} className="animate-spin" />
                  Averaging... {Math.round(progress * samples)}/{samples} fixes
                </span>
                <button onClick={cancelCollecting} className="text-red-400 hover:text-red-300 flex items-center gap-1">
                  <X size={11} /> Cancel
                </button>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-200" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
          )}

          <button
            onClick={startCollect}
            disabled={!canCollect || !session}
            className={`w-full py-2.5 rounded font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
              canCollect && session
                ? "bg-green-600 hover:bg-green-500 text-white"
                : "bg-gray-800 text-gray-500 cursor-not-allowed"
            }`}
          >
            <MapPin size={16} />
            {collecting.active ? "Collecting..." : "Collect Point"}
          </button>
        </div>

        {/* Points list */}
        {session && (
          <div className="flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-950 sticky top-0 z-10">
              <button
                className="flex items-center gap-1.5 text-xs text-gray-300 font-semibold"
                onClick={() => setShowList((v) => !v)}
              >
                {showList ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                Points ({points.length})
              </button>
              <div className="flex items-center gap-2">
                {points.length > 0 && (
                  <>
                    <button
                      onClick={() => exportCSV()}
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      title="Export session CSV"
                    >
                      <Download size={12} /> CSV
                    </button>
                    {confirmClear ? (
                      <span className="flex items-center gap-1 text-xs">
                        <button onClick={() => { clearSession(); setConfirmClear(false); }} className="text-red-400 hover:text-red-300">Confirm</button>
                        <button onClick={() => setConfirmClear(false)} className="text-gray-400">Cancel</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmClear(true)} className="text-gray-500 hover:text-red-400" title="Clear session points">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {showList && (
              <div className="divide-y divide-gray-800/60">
                {points.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-6">No points in this session</p>
                ) : (
                  [...points].reverse().map((p) => (
                    <PointRow key={p.id} point={p} onDelete={() => deletePoint(p.id)} />
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Point row ────────────────────────────────────────────────────────────────
function PointRow({ point, onDelete }: { point: SurveyPoint; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="px-4 py-2 hover:bg-gray-800/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <button className="flex-1 text-left" onClick={() => setExpanded((v) => !v)}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: fixTypeColor(point.fix_quality) }} />
            <span className="font-mono font-semibold text-xs text-gray-100">{point.name}</span>
            {point.code && (
              <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 rounded font-mono">{point.code}</span>
            )}
            <span className="text-[10px] ml-auto" style={{ color: fixTypeColor(point.fix_quality) }}>
              {fixTypeLabel(point.fix_quality)}
            </span>
          </div>
          <div className="text-[10px] text-gray-400 font-mono mt-0.5 pl-4">
            {point.latitude.toFixed(7)}°  {point.longitude.toFixed(7)}°  {point.altitude.toFixed(3)}m
          </div>
        </button>
        <button onClick={onDelete} className="text-gray-600 hover:text-red-400 flex-shrink-0 mt-0.5">
          <Trash2 size={12} />
        </button>
      </div>
      {expanded && (
        <div className="mt-2 ml-4 text-[10px] text-gray-400 space-y-0.5 font-mono">
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
