import {create} from 'zustand';
import {UserProfile} from '../services/auth-service';

export interface LicenseStatus {
  isLicensed: boolean;
  isTrial: boolean;
  trialDaysRemaining: number;
  trialExpired: boolean;
}

interface LicenseState {
  status: LicenseStatus | null;
  profile: UserProfile | null;
  isLoggedIn: boolean;
  loading: boolean;
  setStatus: (status: LicenseStatus) => void;
  setProfile: (profile: UserProfile | null) => void;
  setIsLoggedIn: (v: boolean) => void;
  setLoading: (v: boolean) => void;
}

export const useLicenseStore = create<LicenseState>(set => ({
  status: null,
  profile: null,
  isLoggedIn: false,
  loading: true,
  setStatus: status => set({status, loading: false}),
  setProfile: profile => set({profile}),
  setIsLoggedIn: isLoggedIn => set({isLoggedIn}),
  setLoading: loading => set({loading}),
}));
