import { create } from "zustand";

export interface PortInfo {
  name: string;
  description: string;
  chipset: string;
}

export interface LiveFix {
  latitude: number;
  longitude: number;
  altitude: number;
  fix_type: string; // "No Fix" | "Single" | "DGPS" | "RTK Float" | "RTK Fix"
  fix_quality: number;
  hdop: number;
  sats_used: number;
  age_of_corrections: number;
  speed_knots: number;
  course: number;
  timestamp: string;
}

interface DeviceState {
  ports: PortInfo[];
  connectedPort: string | null;
  connectionState: "disconnected" | "connected" | "error";
  liveFix: LiveFix | null;
  setPorts: (ports: PortInfo[]) => void;
  setConnectedPort: (port: string | null) => void;
  setConnectionState: (state: "disconnected" | "connected" | "error") => void;
  setLiveFix: (fix: LiveFix) => void;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  ports: [],
  connectedPort: null,
  connectionState: "disconnected",
  liveFix: null,
  setPorts: (ports) => set({ ports }),
  setConnectedPort: (port) => set({ connectedPort: port }),
  setConnectionState: (state) => set({ connectionState: state }),
  setLiveFix: (fix) => set({ liveFix: fix }),
}));
