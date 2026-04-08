import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerSupabase } from '@/lib/supabase-server'
import { createAdminSupabase } from '@/lib/supabase-server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

export async function POST(req: NextRequest) {
  try {
    const { priceId } = await req.json()
    if (!priceId) {
      return NextResponse.json({ error: 'priceId required' }, { status: 400 })
    }

    // Get authenticated user
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get or create Stripe customer
    const admin = createAdminSupabase()
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id, full_name')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id as string | undefined

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        name: profile?.full_name ?? undefined,
        metadata: { supabase_uid: user.id },
      })
      customerId = customer.id

      // Save customer ID to profile
      await admin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
      metadata: { supabase_uid: user.id },
      subscription_data: {
        metadata: { supabase_uid: user.id },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
