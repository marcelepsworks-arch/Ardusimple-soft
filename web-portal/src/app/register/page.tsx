'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
    } else {
      setDone(true)
    }
  }

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-6">📧</div>
          <h1 className="text-2xl font-bold text-white mb-3">Check your email</h1>
          <p className="text-gray-400 mb-8">
            We sent a confirmation link to <span className="text-white font-medium">{email}</span>.
            Click it to activate your account and start your 10-day free trial.
          </p>
          <Link href="/login" className="text-blue-400 hover:text-blue-300 text-sm">
            Back to sign in
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-sm">A</div>
          <span className="text-sm text-gray-400">ArduSimple RTK</span>
        </Link>

        <h1 className="text-2xl font-bold text-white mb-1">Create account</h1>
        <p className="text-sm text-gray-500 mb-2">Start your 10-day free trial</p>

        {/* Trial badge */}
        <div className="bg-blue-950 border border-blue-800 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
          <span className="text-2xl">🎁</span>
          <div>
            <p className="text-sm font-semibold text-blue-300">10 days free</p>
            <p className="text-xs text-blue-500">No credit card required</p>
          </div>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Full name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Maria Garcia"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Min. 8 characters"
            />
          </div>

          {error && (
            <div className="bg-red-950 border border-red-800 text-red-400 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors">
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-3 text-xs text-gray-600 text-center">
          By registering you agree to our Terms of Service and Privacy Policy.
        </p>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
