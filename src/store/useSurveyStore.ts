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

interface CollectingState {
  active: boolean;
  target: number;
  accumulated: {
    lat: number; lon: number; alt: number;
    hdop: number; sats: number; fix_quality: number; count: number;
  } | null;
}

interface SurveyState {
  sessions: SurveySession[];
  activeSessionId: string | null;
  collecting: CollectingState;

  // Session actions
  newSession: (name: string) => string;           // returns new session id
  renameSession: (id: string, name: string) => void;
  setActiveSession: (id: string) => void;
  deleteSession: (id: string) => void;

  // Point actions (operate on active session)
  addPoint: (p: SurveyPoint) => void;
  deletePoint: (id: string) => void;
  clearSession: (id?: string) => void;

  // Collect actions
  startCollecting: (target: number) => void;
  cancelCollecting: () => void;
  addSample: (fix: {
    latitude: number; longitude: number; altitude: number;
    fix_quality: number; hdop: number; sats_used: number;
  }) => {
    done: boolean;
    progress: number;
    accumulated?: { lat: number; lon: number; alt: number; hdop: number; sats: number; fix_quality: number; count: number };
  };

  // Helpers
  nextPointName: () => string;
  activeSession: () => SurveySession | null;
}

function makeSession(name: string): SurveySession {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    points: [],
  };
}

export const useSurveyStore = create<SurveyState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      collecting: { active: false, target: 1, accumulated: null },

      activeSession: () => {
        const { sessions, activeSessionId } = get();
        return sessions.find((s) => s.id === activeSessionId) ?? null;
      },

      newSession: (name) => {
        const session = makeSession(name.trim() || `Session ${new Date().toLocaleDateString()}`);
        set((s) => ({
          sessions: [...s.sessions, session],
          activeSessionId: session.id,
        }));
        return session.id;
      },

      renameSession: (id, name) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === id ? { ...sess, name: name.trim() || sess.name } : sess
          ),
        })),

      setActiveSession: (id) => set({ activeSessionId: id }),

      deleteSession: (id) =>
        set((s) => {
          const remaining = s.sessions.filter((sess) => sess.id !== id);
          const newActive =
            s.activeSessionId === id
              ? (remaining[remaining.length - 1]?.id ?? null)
              : s.activeSessionId;
          return { sessions: remaining, activeSessionId: newActive };
        }),

      addPoint: (p) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === s.activeSessionId
              ? { ...sess, points: [...sess.points, p] }
              : sess
          ),
        })),

      deletePoint: (id) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === s.activeSessionId
              ? { ...sess, points: sess.points.filter((p) => p.id !== id) }
              : sess
          ),
        })),

      clearSession: (id) =>
        set((s) => {
          const target = id ?? s.activeSessionId;
          return {
            sessions: s.sessions.map((sess) =>
              sess.id === target ? { ...sess, points: [] } : sess
            ),
          };
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
          sats: fix.sats_used,
          fix_quality: fix.fix_quality,
          count,
        };

        const done = count >= collecting.target;

        set((s) => ({
          collecting: {
            ...s.collecting,
            accumulated: done ? null : accumulated,
            active: !done,
          },
        }));

        return { done, progress: count / collecting.target, accumulated: done ? accumulated : undefined };
      },

      nextPointName: () => {
        const session = get().activeSession();
        const points = session?.points ?? [];
        const nums = points
          .map((p) => parseInt(p.name.replace(/\D/g, ""), 10))
          .filter((n) => !isNaN(n));
        const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
        return `P${String(next).padStart(3, "0")}`;
      },
    }),
    { name: "survey-sessions-v2" }  // new key avoids old format conflict
  )
);
