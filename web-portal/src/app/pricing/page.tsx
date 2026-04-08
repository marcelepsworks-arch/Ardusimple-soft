import Link from 'next/link'
import { CheckoutButton } from '@/components/CheckoutButton'

const PLANS = [
  {
    key: 'monthly',
    label: 'Monthly',
    price: '€9.99',
    period: '/month',
    priceEnvKey: 'STRIPE_PRICE_MONTHLY',
    highlight: false,
    features: [
      'All professional tools',
      'Unlimited projects & points',
      'BLE receiver connection',
      'NTRIP RTK corrections',
      'COGO + DTM + Stakeout',
      'CSV / GeoJSON / KML / DXF export',
      'Cancel anytime',
    ],
  },
  {
    key: 'yearly',
    label: 'Yearly',
    price: '€79',
    period: '/year',
    priceEnvKey: 'STRIPE_PRICE_YEARLY',
    badge: 'Save 34%',
    highlight: true,
    features: [
      'Everything in Monthly',
      '2 months free vs monthly',
      'Priority support',
      'Early access to new features',
    ],
  },
]

export default function PricingPage() {
  const monthlyPriceId = process.env.STRIPE_PRICE_MONTHLY ?? ''
  const yearlyPriceId  = process.env.STRIPE_PRICE_YEARLY  ?? ''

  return (
    <main className="min-h-screen px-4 py-16 max-w-3xl mx-auto">
      <Link href="/" className="flex items-center gap-2 mb-12">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-sm">A</div>
        <span className="text-sm text-gray-400">ArduSimple RTK</span>
      </Link>

      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-white mb-3">Simple pricing</h1>
        <p className="text-gray-400">10-day free trial · No credit card required · Cancel anytime</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 mb-12">
        {/* Monthly */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-7 flex flex-col">
          <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Monthly</p>
          <div className="mb-6">
            <span className="text-4xl font-extrabold text-white">€9.99</span>
            <span className="text-gray-500 text-sm">/month</span>
          </div>
          <ul className="space-y-2 mb-8 flex-1">
            {PLANS[0].features.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-blue-400 mt-0.5">✓</span>{f}
              </li>
            ))}
          </ul>
          <CheckoutButton priceId={monthlyPriceId} label="Get Monthly" variant="outline" />
        </div>

        {/* Yearly */}
        <div className="bg-blue-950 border-2 border-blue-600 rounded-2xl p-7 flex flex-col relative overflow-hidden">
          <div className="absolute top-4 right-4 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
            Save 34%
          </div>
          <p className="text-sm font-semibold text-blue-300 uppercase tracking-wider mb-3">Yearly</p>
          <div className="mb-1">
            <span className="text-4xl font-extrabold text-white">€79</span>
            <span className="text-blue-300 text-sm">/year</span>
          </div>
          <p className="text-xs text-blue-400 mb-6">≈ €6.58/month</p>
          <ul className="space-y-2 mb-8 flex-1">
            {[...PLANS[0].features, ...PLANS[1].features].map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-blue-100">
                <span className="text-blue-400 mt-0.5">✓</span>{f}
              </li>
            ))}
          </ul>
          <CheckoutButton priceId={yearlyPriceId} label="Get Yearly — Best value" variant="primary" />
        </div>
      </div>

      {/* Free trial note */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">
        <p className="text-lg font-bold text-white mb-1">Not ready to commit?</p>
        <p className="text-sm text-gray-400 mb-4">
          Download the app and use all features free for 10 days — no credit card needed.
        </p>
        <Link
          href="/register"
          className="inline-block border border-gray-700 hover:border-gray-500 text-gray-300 font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors">
          Start free trial
        </Link>
      </div>

      <p className="mt-10 text-center text-xs text-gray-600">
        Prices in EUR. VAT may apply. Subscription auto-renews. Cancel any time from your dashboard.
      </p>
    </main>
  )
}
