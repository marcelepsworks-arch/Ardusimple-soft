/**
 * Authentication & license service using Supabase.
 *
 * Flow:
 * 1. User registers → profile created with trial_start = now()
 * 2. On app launch → check session → fetch profile → compute license status
 * 3. Trial: 10 days from trial_start
 * 4. Paid: subscription_status = 'active' and subscription_expires_at > now()
 * 5. Offline grace: cache last known status, allow 3 days offline
 */

import {supabase} from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {LicenseStatus} from '../store/useLicenseStore';

const OFFLINE_CACHE_KEY = '@gnss_rtk_license_cache';
const OFFLINE_GRACE_DAYS = 3;

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'cancelled';
  subscriptionPlan: string | null;
  subscriptionExpiresAt: string | null;
  trialStart: string;
  trialDays: number;
}

interface CachedLicense {
  status: LicenseStatus;
  profile: UserProfile;
  cachedAt: number; // timestamp ms
}

// --- Auth operations ---

export async function signUp(
  email: string,
  password: string,
  fullName: string,
): Promise<void> {
  const {error} = await supabase.auth.signUp({
    email,
    password,
    options: {data: {full_name: fullName}},
  });
  if (error) throw new Error(error.message);
}

export async function signIn(
  email: string,
  password: string,
): Promise<void> {
  const {error} = await supabase.auth.signInWithPassword({email, password});
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  await AsyncStorage.removeItem(OFFLINE_CACHE_KEY);
}

export async function resetPassword(email: string): Promise<void> {
  const {error} = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw new Error(error.message);
}

// --- Profile & license ---

export async function fetchProfile(): Promise<UserProfile | null> {
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) return null;

  const {data, error} = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name || '',
    subscriptionStatus: data.subscription_status,
    subscriptionPlan: data.subscription_plan,
    subscriptionExpiresAt: data.subscription_expires_at,
    trialStart: data.trial_start,
    trialDays: data.trial_days,
  };
}

export function computeLicenseStatus(profile: UserProfile): LicenseStatus {
  // Active subscription
  if (profile.subscriptionStatus === 'active') {
    if (profile.subscriptionExpiresAt) {
      const expiresAt = new Date(profile.subscriptionExpiresAt).getTime();
      if (expiresAt > Date.now()) {
        return {
          isLicensed: true,
          isTrial: false,
          trialDaysRemaining: 0,
          trialExpired: false,
        };
      }
      // Subscription expired
    }
  }

  // Trial
  if (profile.subscriptionStatus === 'trial') {
    const trialStart = new Date(profile.trialStart).getTime();
    const elapsedMs = Date.now() - trialStart;
    const elapsedDays = Math.floor(elapsedMs / 86400000);
    const remaining = Math.max(0, profile.trialDays - elapsedDays);

    return {
      isLicensed: false,
      isTrial: true,
      trialDaysRemaining: remaining,
      trialExpired: remaining <= 0,
    };
  }

  // Expired or cancelled
  return {
    isLicensed: false,
    isTrial: false,
    trialDaysRemaining: 0,
    trialExpired: true,
  };
}

/**
 * Main entry point: check auth session and return license status.
 * Falls back to cached status if offline (3-day grace period).
 */
export async function checkAuthAndLicense(): Promise<{
  status: LicenseStatus;
  profile: UserProfile | null;
  isLoggedIn: boolean;
}> {
  // Check if there's a session
  const {data: {session}} = await supabase.auth.getSession();

  if (!session) {
    return {
      status: {isLicensed: false, isTrial: false, trialDaysRemaining: 0, trialExpired: false},
      profile: null,
      isLoggedIn: false,
    };
  }

  // Try to fetch profile online
  try {
    const profile = await fetchProfile();
    if (profile) {
      const status = computeLicenseStatus(profile);
      // Cache for offline use
      const cache: CachedLicense = {status, profile, cachedAt: Date.now()};
      await AsyncStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(cache));
      return {status, profile, isLoggedIn: true};
    }
  } catch {
    // Offline — try cache
    const cached = await getCachedLicense();
    if (cached) {
      return {status: cached.status, profile: cached.profile, isLoggedIn: true};
    }
  }

  // No profile, no cache
  return {
    status: {isLicensed: false, isTrial: false, trialDaysRemaining: 0, trialExpired: false},
    profile: null,
    isLoggedIn: true, // session exists but profile fetch failed
  };
}

async function getCachedLicense(): Promise<CachedLicense | null> {
  const raw = await AsyncStorage.getItem(OFFLINE_CACHE_KEY);
  if (!raw) return null;

  const cached: CachedLicense = JSON.parse(raw);
  const daysSinceCached = (Date.now() - cached.cachedAt) / 86400000;

  // Offline grace period
  if (daysSinceCached > OFFLINE_GRACE_DAYS) {
    return null; // Too long offline, force re-auth
  }

  return cached;
}
