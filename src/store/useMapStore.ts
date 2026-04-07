import { create } from "zustand";

interface MapState {
  followRover: boolean;
  setFollowRover: (v: boolean) => void;
}

export const useMapStore = create<MapState>((set) => ({
  followRover: true,
  setFollowRover: (v) => set({ followRover: v }),
}));
