import {create} from 'zustand';

export interface NtripProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  mountpoint: string;
  username: string;
  password: string;
}

interface NtripState {
  connected: boolean;
  bytesReceived: number;
  bytesPerSecond: number;
  profile: NtripProfile | null;
  setConnected: (v: boolean) => void;
  setBytesReceived: (v: number) => void;
  setBytesPerSecond: (v: number) => void;
  setProfile: (p: NtripProfile | null) => void;
}

export const useNtripStore = create<NtripState>(set => ({
  connected: false,
  bytesReceived: 0,
  bytesPerSecond: 0,
  profile: null,
  setConnected: connected => set({connected}),
  setBytesReceived: bytesReceived => set({bytesReceived}),
  setBytesPerSecond: bytesPerSecond => set({bytesPerSecond}),
  setProfile: profile => set({profile}),
}));
