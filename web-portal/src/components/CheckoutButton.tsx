'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  priceId: string
  label: string
  variant?: 'primary' | 'outline'
}

export function CheckoutButton({ priceId, label, variant = 'primary' }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleCheckout() {
    if (!priceId) {
      alert('Stripe price ID not configured. Set STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY in .env.local')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const data = await res.json()
      if (data.url) {
        router.push(data.url)
      } else {
        throw new Error(data.error ?? 'Checkout failed')
      }
    } catch (err: any) {
      alert(err.message)
      setLoading(false)
    }
  }

  const base = 'w-full font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50'
  const cls = variant === 'primary'
    ? `${base} bg-blue-600 hover:bg-blue-500 text-white`
    : `${base} border border-gray-700 hover:border-gray-500 text-gray-200`

  return (
    <button onClick={handleCheckout} disabled={loading} className={cls}>
      {loading ? 'Redirecting…' : label}
    </button>
  )
}
