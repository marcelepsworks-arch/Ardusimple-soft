import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase-server'
import { trialDaysRemaining, UserProfile } from '@/lib/supabase'
import { SignOutButton } from '@/components/SignOutButton'

export default async function DashboardPage() {
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<UserProfile>()

  const trialDays = trialDaysRemaining(profile?.trial_start ?? null)
  const status = profile?.subscription_status ?? 'trial'
  const isActive = status === 'active'
  const isExpired = status === 'expired' || (status === 'trial' && trialDays <= 0)

  return (
    <main className="min-h-screen px-4 py-10 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-sm">A</div>
          <span className="font-semibold text-white">ArduSimple RTK</span>
        </div>
        <SignOutButton />
      </div>

      {/* Greeting */}
      <h1 className="text-2xl font-bold text-white mb-1">
        Hello, {profile?.full_name ?? user.email?.split('@')[0] ?? 'Surveyor'} 👋
      </h1>
      <p className="text-gray-500 text-sm mb-8">{user.email}</p>

      {/* License status card */}
      <div className={`rounded-2xl border p-6 mb-6 ${
        isActive
          ? 'bg-emerald-950 border-emerald-800'
          : isExpired
          ? 'bg-red-950 border-red-800'
          : trialDays <= 3
          ? 'bg-amber-950 border-amber-800'
          : 'bg-blue-950 border-blue-800'
      }`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">License Status</p>
            <p className={`text-2xl font-extrabold ${
              isActive ? 'text-emerald-300' : isExpired ? 'text-red-300' : 'text-blue-200'
            }`}>
              {isActive
                ? 'Active'
                : isExpired
                ? 'Expired'
                : `Trial — ${Math.max(0, trialDays)} day${trialDays !== 1 ? 's' : ''} left`}
            </p>
            {isActive && profile?.subscription_plan && (
              <p className="text-sm text-emerald-400 mt-1 capitalize">{profile.subscription_plan} plan</p>
            )}
            {isActive && profile?.subscription_expires_at && (
              <p className="text-xs text-gray-500 mt-1">
                Renews {new Date(profile.subscription_expires_at).toLocaleDateString()}
              </p>
            )}
          </div>
          <span className="text-3xl">
            {isActive ? '✅' : isExpired ? '🔒' : '⏳'}
          </span>
        </div>

        {!isActive && (
          <Link
            href="/pricing"
            className="mt-4 inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">
            Upgrade now →
          </Link>
        )}
      </div>

      {/* Account info */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Account</h2>
        <InfoRow label="Full name" value={profile?.full_name ?? '—'} />
        <InfoRow label="Email" value={user.email ?? '—'} />
        <InfoRow label="Member since" value={new Date(user.created_at).toLocaleDateString()} />
        {profile?.trial_start && (
          <InfoRow label="Trial started" value={new Date(profile.trial_start).toLocaleDateString()} />
        )}
      </div>

      {/* App download links */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Get the app</h2>
        <div className="flex gap-3">
          <a
            href="#"
            className="flex-1 border border-gray-700 hover:border-gray-500 rounded-xl px-4 py-3 text-center transition-colors">
            <p className="text-lg mb-1">🤖</p>
            <p className="text-xs font-semibold text-white">Android</p>
            <p className="text-xs text-gray-500">Google Play</p>
          </a>
          <a
            href="#"
            className="flex-1 border border-gray-700 hover:border-gray-500 rounded-xl px-4 py-3 text-center transition-colors">
            <p className="text-lg mb-1">🍎</p>
            <p className="text-xs font-semibold text-white">iOS</p>
            <p className="text-xs text-gray-500">App Store</p>
          </a>
        </div>
      </div>
    </main>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-gray-800 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-white font-medium">{value}</span>
    </div>
  )
}
