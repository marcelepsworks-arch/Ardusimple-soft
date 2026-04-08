# ArduSimple RTK Survey

**Professional GNSS / RTK surveying for Android & iOS.**

A full-featured mobile surveying app built for the [ArduSimple](https://www.ardusimple.com) receiver ecosystem — centimetre-level accuracy in your pocket, with no proprietary lock-in.

---

## Screenshots

> _Android + iOS builds coming to Google Play and the App Store._

---

## Features

| Category | Capabilities |
|----------|-------------|
| **Device** | BLE connection to ArduSimple receivers (ZED-F9P, ZED-F9R, UM982, Septentrio Mosaic) via Nordic UART Service |
| **NTRIP** | TCP NTRIP client with HTTP/1.1 Basic Auth, RTCM relay, auto GGA every 10 s |
| **NMEA** | Real-time $GPGGA / $GPRMC parsing, fix type, HDOP, sats, age of corrections |
| **Projects** | Multi-project management, 30+ coordinate systems (EPSG) via proj4, custom CS support |
| **Collect** | Single-shot and averaged point collection, 56 built-in survey codes across 9 categories |
| **Map** | Live rover marker, collected point markers, coordinate display |
| **Stakeout** | Vincenty compass, N/E offset display, configurable arrival tolerance, vibration alert |
| **COGO** | Inverse, single traverse leg, polygon area (Shoelace), bearing–bearing and distance–distance intersection |
| **DTM** | Bowyer-Watson Delaunay TIN, barycentric elevation query, surface statistics, contour generation |
| **Export** | CSV, GeoJSON, KML, DXF (CAD) |
| **Import** | CSV, GeoJSON via document picker |
| **Auth** | Supabase email/password, 10-day free trial, offline 3-day grace period |
| **Subscriptions** | Stripe monthly / yearly via web portal |

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Mobile framework | React Native 0.84 + TypeScript |
| State management | Zustand |
| BLE | react-native-ble-plx (Nordic UART Service) |
| NTRIP | react-native-tcp-socket |
| Maps | react-native-maps |
| Coordinate systems | proj4 |
| Auth + database | Supabase |
| Payments | Stripe |
| Web portal | Next.js 14 + Tailwind CSS, deployed on Vercel |

---

## Repository structure

```
Ardusimple-soft/
│
├── gnss-rtk-app/               ← React Native mobile app (Android + iOS)
│   ├── src/
│   │   ├── lib/                ← Pure-TS libraries (NMEA, COGO, DTM, coordinate systems)
│   │   ├── services/           ← BLE, NTRIP, export, Supabase auth
│   │   ├── store/              ← Zustand stores
│   │   ├── screens/            ← All screens
│   │   ├── components/         ← Shared UI components
│   │   └── navigation/         ← Bottom tab navigator
│   ├── android/                ← Android native project
│   ├── ios/                    ← iOS native project
│   └── __tests__/              ← Jest unit tests
│
├── web-portal/                 ← Next.js web portal
│   └── src/
│       ├── app/                ← Pages: /, /login, /register, /dashboard, /pricing
│       ├── app/api/stripe/     ← Checkout + webhook API routes
│       ├── components/         ← SignOutButton, CheckoutButton
│       └── lib/                ← Supabase client (browser + server)
│
├── INSTALL.md                  ← Complete installation guide
└── README.md                   ← This file
```

---

## Quick start

### Prerequisites

- Node.js ≥ 22.11
- For Android: Android Studio + JDK 17 + Android SDK 36
- For iOS (macOS only): Xcode 16 + CocoaPods

### Mobile app

```bash
cd gnss-rtk-app
npm install

# Android
npm run android

# iOS
cd ios && pod install && cd ..
npm run ios
```

### Web portal

```bash
cd web-portal
npm install
cp .env.example .env.local   # fill in Supabase + Stripe keys
npm run dev
```

**Full step-by-step instructions → [INSTALL.md](INSTALL.md)**

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  React Native App                         │
│                                                          │
│  BLE Service ──► NMEA Parser ──► Zustand stores          │
│       │               │               │                  │
│  NTRIP Service    LiveFix           Screens              │
│  (TCP socket)         │          (Map, Collect,          │
│       │          Coord. transform  Stakeout, COGO, DTM…) │
│  RTCM relay       (proj4)                                │
└──────────────────────────────────────────────────────────┘
              │ auth / license check
              ▼
┌─────────────────────┐      ┌─────────────────────────┐
│     Supabase        │      │     Web Portal          │
│  - auth.users       │◄────►│  - Login / Register     │
│  - profiles         │      │  - Dashboard            │
│    (trial_start,    │      │  - Pricing              │
│     subscription)   │      │  - Stripe Checkout      │
└─────────────────────┘      └─────────────────────────┘
              ▲                           │
              │                           ▼
              │                  ┌────────────────┐
              └──────────────────│    Stripe      │
               webhook updates   │  Subscriptions │
                                 └────────────────┘
```

---

## Licensing model

The app uses a **10-day free trial** followed by a paid subscription:

| Plan | Price |
|------|-------|
| Monthly | €9.99 / month |
| Yearly | €79 / year (~€6.58/month) |

- Trial starts automatically on first login — no credit card required
- All features are unlocked during the trial
- After expiry, the app shows an upgrade screen linking to the web portal
- Subscription status is synced via Supabase and verified on every launch (3-day offline grace period for field use)

---

## Hardware compatibility

Tested and supported ArduSimple receivers:

| Receiver | Chipset | BLE profile |
|----------|---------|-------------|
| simpleRTK2B | u-blox ZED-F9P | Nordic UART Service |
| simpleRTK2B-heading | u-blox ZED-F9P + ZED-F9P | Nordic UART Service |
| simpleRTK3B | u-blox ZED-F9R | Nordic UART Service |
| simpleRTK2Lite | u-blox ZED-F9P | Nordic UART Service |
| simpleRTK2Pro | Unicore UM982 | Nordic UART Service |
| simpleRTK3Pro Heading | Septentrio Mosaic | Nordic UART Service |

Any receiver that exposes a Nordic UART Service (NUS) over BLE should work.

---

## Running tests

```bash
cd gnss-rtk-app
npm test
```

| Test file | Coverage |
|-----------|---------|
| `nmea-parser.test.ts` | Checksum, GGA/RMC parsing, GGA generation (9 tests) |
| `coordinate-systems.test.ts` | Forward/inverse transforms, search, custom CS (10 tests) |
| `App.test.tsx` | App smoke test with native module mocks |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit with conventional commits: `git commit -m "feat: add my feature"`
4. Push and open a Pull Request

Please ensure `npx tsc --noEmit` passes before submitting.

---

## License

Copyright © 2025 ArduSimple RTK Survey contributors.

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for the full text.

> The app connects to third-party services (Supabase, Stripe). Use of those services is subject to their respective terms. This project is not affiliated with or endorsed by ArduSimple SL.
