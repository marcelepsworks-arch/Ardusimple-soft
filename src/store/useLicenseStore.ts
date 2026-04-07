import { create } from "zustand";

export interface LicenseStatus {
  is_licensed: boolean;
  is_trial: boolean;
  trial_days_remaining: number;
  trial_expired: boolean;
}

interface LicenseState {
  status: LicenseStatus | null;
  loading: boolean;
  setStatus: (status: LicenseStatus) => void;
  setLoading: (v: boolean) => void;
}

export const useLicenseStore = create<LicenseState>((set) => ({
  status: null,
  loading: true,
  setStatus: (status) => set({ status, loading: false }),
  setLoading: (loading) => set({ loading }),
}));
