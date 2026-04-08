import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Logo + wordmark */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-2xl font-black text-white">
          A
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest">ArduSimple</p>
          <p className="text-xl font-bold text-white leading-tight">RTK Survey</p>
        </div>
      </div>

      <h1 className="text-4xl sm:text-5xl font-extrabold text-white text-center mb-4 leading-tight">
        Professional GNSS<br />in your pocket
      </h1>
      <p className="text-lg text-gray-400 text-center max-w-md mb-10">
        RTK centimetre-level accuracy for Android &amp; iOS. BLE receiver connection,
        NTRIP corrections, COGO tools, DTM surfaces and full survey workflows.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <Link
          href="/register"
          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl text-center transition-colors">
          Start free trial
        </Link>
        <Link
          href="/login"
          className="flex-1 border border-gray-700 hover:border-gray-500 text-gray-300 font-semibold py-3 px-6 rounded-xl text-center transition-colors">
          Sign in
        </Link>
      </div>

      <Link href="/pricing" className="mt-6 text-sm text-gray-500 hover:text-gray-300 transition-colors">
        View pricing →
      </Link>

      {/* Feature grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-16 max-w-2xl w-full">
        {FEATURES.map(f => (
          <div key={f.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-2xl mb-2">{f.icon}</p>
            <p className="text-sm font-semibold text-white">{f.label}</p>
            <p className="text-xs text-gray-500 mt-1">{f.desc}</p>
          </div>
        ))}
      </div>

      <p className="mt-16 text-xs text-gray-600">
        © {new Date().getFullYear()} ArduSimple RTK Survey · 10-day free trial
      </p>
    </main>
  )
}

const FEATURES = [
  {icon: '📡', label: 'BLE Connection', desc: 'Connect ArduSimple receivers over Bluetooth'},
  {icon: '🛰️', label: 'NTRIP RTK', desc: 'Centimetre accuracy via NTRIP casters'},
  {icon: '📐', label: 'COGO Tools', desc: 'Inverse, traverse, area, intersections'},
  {icon: '🗺️', label: 'DTM Surface', desc: 'TIN triangulation + contour generation'},
  {icon: '📍', label: 'Stakeout', desc: 'Navigate to target points with compass'},
  {icon: '📦', label: 'Export', desc: 'CSV, GeoJSON, KML, DXF formats'},
]
