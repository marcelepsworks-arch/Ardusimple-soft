import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminSupabase } from '@/lib/supabase-server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

// Tell Next.js not to parse body — Stripe needs the raw bytes for signature verification
export const config = { api: { bodyParser: false } }

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  const admin = createAdminSupabase()

  switch (event.type) {
    // ── Subscription created / updated ───────────────────────────────────────
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const uid = sub.metadata?.supabase_uid
      if (!uid) break

      const status = sub.status === 'active' ? 'active' : 'expired'
      const plan = sub.items.data[0]?.price?.recurring?.interval === 'year' ? 'yearly' : 'monthly'
      const expiresAt = new Date(sub.current_period_end * 1000).toISOString()

      await admin.from('profiles').update({
        subscription_status: status,
        subscription_plan: plan,
        subscription_expires_at: expiresAt,
      }).eq('id', uid)

      console.log(`Subscription ${event.type} for user ${uid}: ${status} (${plan})`)
      break
    }

    // ── Subscription deleted / cancelled ─────────────────────────────────────
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const uid = sub.metadata?.supabase_uid
      if (!uid) break

      await admin.from('profiles').update({
        subscription_status: 'cancelled',
        subscription_plan: null,
        subscription_expires_at: null,
      }).eq('id', uid)

      console.log(`Subscription cancelled for user ${uid}`)
      break
    }

    // ── Invoice payment failed ────────────────────────────────────────────────
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const uid = (invoice.subscription_details?.metadata as Record<string, string> | null)?.supabase_uid
      if (!uid) break

      await admin.from('profiles').update({
        subscription_status: 'expired',
      }).eq('id', uid)

      console.log(`Payment failed for user ${uid}`)
      break
    }

    default:
      console.log(`Unhandled Stripe event: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}
