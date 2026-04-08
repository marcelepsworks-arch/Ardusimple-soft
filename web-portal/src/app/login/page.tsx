'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  async function handleForgotPassword() {
    if (!email) { setError('Enter your email first.'); return }
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/update-password`,
    })
    setError('')
    alert('Password reset email sent — check your inbox.')
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-sm">A</div>
          <span className="text-sm text-gray-400">ArduSimple RTK</span>
        </Link>

        <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
        <p className="text-sm text-gray-500 mb-8">Sign in to your account</p>

        <form onSubmit={handleLogin} className="space-y-4">
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
              placeholder="••••••••"
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
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <button
          onClick={handleForgotPassword}
          className="mt-4 w-full text-sm text-gray-500 hover:text-gray-300 transition-colors text-center">
          Forgot password?
        </button>

        <p className="mt-6 text-center text-sm text-gray-500">
          No account?{' '}
          <Link href="/register" className="text-blue-400 hover:text-blue-300 font-medium">
            Start your free trial
          </Link>
        </p>
      </div>
    </main>
  )
}
