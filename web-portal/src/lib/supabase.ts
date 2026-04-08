import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled'

export interface UserProfile {
  id: string
  full_name: string | null
  email: string | null
  trial_start: string | null
  subscription_status: SubscriptionStatus
  subscription_plan: string | null
  subscription_expires_at: string | null
  stripe_customer_id: string | null
}

/** Days remaining in trial (negative = expired) */
export function trialDaysRemaining(trialStart: string | null): number {
  if (!trialStart) return 10
  const start = new Date(trialStart).getTime()
  const now = Date.now()
  const elapsed = (now - start) / (1000 * 60 * 60 * 24)
  return Math.ceil(10 - elapsed)
}
