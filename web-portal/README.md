# ArduSimple RTK — Web Auth Portal

Next.js 14 web portal for account management, trial tracking, and Stripe subscription checkout.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   # Fill in your Supabase + Stripe keys
   ```

3. **Add `stripe_customer_id` column to Supabase `profiles` table**
   ```sql
   ALTER TABLE profiles ADD COLUMN stripe_customer_id TEXT;
   ```

4. **Run locally**
   ```bash
   npm run dev
   ```

## Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Set all environment variables from `.env.example` in the Vercel dashboard under **Settings → Environment Variables**.

## Stripe webhook setup

After deploying, register your webhook endpoint in the [Stripe Dashboard](https://dashboard.stripe.com/webhooks):

- **Endpoint URL**: `https://your-domain.vercel.app/api/stripe/webhook`
- **Events to listen for**:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

Copy the **Signing secret** into `STRIPE_WEBHOOK_SECRET` in Vercel environment variables.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with feature grid |
| `/login` | Email + password sign in |
| `/register` | New account + start trial |
| `/dashboard` | Account info, license status, upgrade CTA |
| `/pricing` | Monthly/Yearly plan cards + Stripe checkout |
| `/auth/callback` | Supabase auth redirect handler |
| `/api/stripe/checkout` | POST — create Stripe Checkout session |
| `/api/stripe/webhook` | POST — Stripe event handler (updates Supabase profiles) |
