'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
      Sign out
    </button>
  )
}
