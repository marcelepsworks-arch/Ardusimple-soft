import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SurveyPoint {
  id: string;
  name: string;
  code: string;
  note: string;
  latitude: number;
  longitude: number;
  altitude: number;
  fix_quality: number;
  hdop: number;
  sats_used: number;
  timestamp: string;
  samples: number;
}

export interface SurveySession {
  id: string;
  name: string;
  createdAt: string;
  points: SurveyPoint[];
}

export interface CollectingState {
  active: boolean;
  target: number;
  accumulated: {
    lat: number; lon: number; alt: number;
    hdop: number; sats: number; fix_quality: number; count: number;
  } | null;
}

// Serializable state only — no methods (avoids persist issues)
interface SurveyState {
  sessions: SurveySession[];
  activeSessionId: string | null;
  collecting: CollectingState;
  autoCollectDistance: number | null; // null = off, otherwise meters

  newSession: (name: string) => string;
  renameSession: (id: string, name: string) => void;
  setActiveSession: (id: string) => void;
  deleteSession: (id: string) => void;

  addPoint: (p: SurveyPoint) => void;
  deletePoint: (id: string) => void;
  clearSession: (id?: string) => void;

  startCollecting: (target: number) => void;
  cancelCollecting: () => void;
  addSample: (fix: {
    latitude: number; longitude: number; altitude: number;
    fix_quality: number; hdop: number; sats_used: number;
  }) => {
    done: boolean; progress: number;
    accumulated?: { lat: number; lon: number; alt: number; hdop: number; sats: number; fix_quality: number; count: number };
  };

  setAutoCollectDistance: (d: number | null) => void;
}

function makeSession(name: string): SurveySession {
  return { id: crypto.randomUUID(), name, createdAt: new Date().toISOString(), points: [] };
}

// Helper exported for components
export function getActiveSession(state: Pick<SurveyState, "sessions" | "activeSessionId">): SurveySession | null {
  return state.sessions.find((s) => s.id === state.activeSessionId) ?? null;
}

export function nextPointName(state: Pick<SurveyState, "sessions" | "activeSessionId">): string {
  const session = getActiveSession(state);
  const points = session?.points ?? [];
  const nums = points.map((p) => parseInt(p.name.replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `P${String(next).padStart(3, "0")}`;
}

export const useSurveyStore = create<SurveyState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      collecting: { active: false, target: 1, accumulated: null },
      autoCollectDistance: null,

      newSession: (name) => {
        const session = makeSession(name.trim() || `Session ${new Date().toLocaleDateString()}`);
        set((s) => ({ sessions: [...s.sessions, session], activeSessionId: session.id }));
        return session.id;
      },

      renameSession: (id, name) =>
        set((s) => ({
          sessions: s.sessions.map((sess) => sess.id === id ? { ...sess, name: name.trim() || sess.name } : sess),
        })),

      setActiveSession: (id) => set({ activeSessionId: id }),

      deleteSession: (id) =>
        set((s) => {
          const remaining = s.sessions.filter((sess) => sess.id !== id);
          const newActive = s.activeSessionId === id ? (remaining[remaining.length - 1]?.id ?? null) : s.activeSessionId;
          return { sessions: remaining, activeSessionId: newActive };
        }),

      addPoint: (p) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === s.activeSessionId ? { ...sess, points: [...sess.points, p] } : sess
          ),
        })),

      deletePoint: (id) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === s.activeSessionId ? { ...sess, points: sess.points.filter((p) => p.id !== id) } : sess
          ),
        })),

      clearSession: (id) =>
        set((s) => {
          const target = id ?? s.activeSessionId;
          return { sessions: s.sessions.map((sess) => sess.id === target ? { ...sess, points: [] } : sess) };
        }),

      startCollecting: (target) =>
        set({ collecting: { active: true, target, accumulated: null } }),

      cancelCollecting: () =>
        set({ collecting: { active: false, target: 1, accumulated: null } }),

      addSample: (fix) => {
        const { collecting } = get();
        if (!collecting.active) return { done: false, progress: 0 };
        const prev = collecting.accumulated;
        const count = (prev?.count ?? 0) + 1;
        const accumulated = {
          lat: ((prev?.lat ?? 0) * (count - 1) + fix.latitude) / count,
          lon: ((prev?.lon ?? 0) * (count - 1) + fix.longitude) / count,
          alt: ((prev?.alt ?? 0) * (count - 1) + fix.altitude) / count,
          hdop: ((prev?.hdop ?? 0) * (count - 1) + fix.hdop) / count,
          sats: fix.sats_used, fix_quality: fix.fix_quality, count,
        };
        const done = count >= collecting.target;
        set((s) => ({ collecting: { ...s.collecting, accumulated: done ? null : accumulated, active: !done } }));
        return { done, progress: count / collecting.target, accumulated: done ? accumulated : undefined };
      },

      setAutoCollectDistance: (d) => set({ autoCollectDistance: d }),
    }),
    {
      name: "survey-sessions-v3",
      // Only persist data, not transient collecting state
      partialize: (s) => ({ sessions: s.sessions, activeSessionId: s.activeSessionId }),
    }
  )
);
