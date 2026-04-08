# ArduSimple RTK Survey — Complete Installation Guide

This document covers every step required to go from a fresh machine to a fully running system:

1. [Prerequisites](#1-prerequisites)
2. [Clone the repository](#2-clone-the-repository)
3. [Supabase — backend database & auth](#3-supabase--backend-database--auth)
4. [Stripe — payment processing](#4-stripe--payment-processing)
5. [Web portal (Next.js)](#5-web-portal-nextjs)
6. [Deploy web portal to Vercel](#6-deploy-web-portal-to-vercel)
7. [Mobile app — Android](#7-mobile-app--android)
8. [Mobile app — iOS](#8-mobile-app--ios)
9. [Connect everything together](#9-connect-everything-together)
10. [Android permissions checklist](#10-android-permissions-checklist)
11. [Running tests](#11-running-tests)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prerequisites

### Required for everything
| Tool | Minimum version | How to install |
|------|----------------|----------------|
| Node.js | **22.11.0** | https://nodejs.org (use LTS) |
| npm | 10+ | Bundled with Node.js |
| Git | any | https://git-scm.com |

> **Tip:** Use [nvm](https://github.com/nvm-sh/nvm) (macOS/Linux) or [nvm-windows](https://github.com/coreybutler/nvm-windows) to manage Node versions.
> ```bash
> nvm install 22
> nvm use 22
> ```

### Required for Android
| Tool | Version | Notes |
|------|---------|-------|
| Java JDK | **17** | https://adoptium.net — choose Temurin 17 |
| Android Studio | Hedgehog or newer | https://developer.android.com/studio |
| Android SDK | API **36** (Android 16) | Installed via Android Studio SDK Manager |
| Android Build Tools | **36.0.0** | Installed via SDK Manager |
| Android NDK | latest stable | Installed via SDK Manager |

### Required for iOS (macOS only)
| Tool | Version | Notes |
|------|---------|-------|
| macOS | Ventura 13+ | Required |
| Xcode | **16+** | App Store |
| CocoaPods | **1.15+** | `sudo gem install cocoapods` |
| Watchman | any | `brew install watchman` |

### Required for web portal
| Tool | Notes |
|------|-------|
| Vercel account | https://vercel.com (free tier works) |
| Supabase account | https://supabase.com (free tier works) |
| Stripe account | https://stripe.com |

---

## 2. Clone the repository

```bash
git clone https://github.com/marcelepsworks-arch/Ardusimple-soft.git
cd Ardusimple-soft
```

Repository structure:
```
Ardusimple-soft/
├── gnss-rtk-app/        ← React Native mobile app (Android + iOS)
└── web-portal/          ← Next.js web portal (auth + subscriptions)
```

---

## 3. Supabase — backend database & auth

Supabase is the backend for both the mobile app and the web portal. One project serves both.

### 3.1 Create a Supabase project

1. Go to https://supabase.com and sign in
2. Click **New project**
3. Choose a name (e.g. `ardusimple-rtk`), set a strong database password, select the region closest to your users
4. Wait ~2 minutes for the project to provision

### 3.2 Run the database schema

Go to **SQL Editor** in your Supabase dashboard and run the following SQL:

```sql
-- Profiles table (one row per user)
CREATE TABLE public.profiles (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name             TEXT,
  email                 TEXT,
  trial_start           TIMESTAMPTZ DEFAULT NOW(),
  subscription_status   TEXT NOT NULL DEFAULT 'trial'
                          CHECK (subscription_status IN ('trial','active','expired','cancelled')),
  subscription_plan     TEXT,
  subscription_expires_at TIMESTAMPTZ,
  stripe_customer_id    TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile row when a user registers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, trial_start)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Row-level security: users can only read/update their own profile
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
```

### 3.3 Get your API keys

In your Supabase project dashboard go to **Settings → API**:

| Key | Where to use |
|-----|-------------|
| **Project URL** | Both mobile app and web portal |
| **anon / public key** | Both mobile app and web portal |
| **service_role / secret key** | Web portal only (server-side) — keep secret |

### 3.4 Configure email auth

Go to **Authentication → Providers → Email** and ensure it is **enabled**.

Go to **Authentication → URL Configuration** and set:
- **Site URL**: your Vercel domain (e.g. `https://auth.your-domain.com`)
- **Redirect URLs**: add `https://auth.your-domain.com/auth/callback`

---

## 4. Stripe — payment processing

### 4.1 Create a Stripe account

Go to https://stripe.com and create an account. You can test with **Test mode** enabled (toggle in top-right) before going live.

### 4.2 Create products and prices

1. Go to **Products** → **Add product**
2. Create **ArduSimple RTK Survey — Monthly**
   - Price: `€9.99`, recurring, monthly
   - Copy the **Price ID** (starts with `price_`) — this is `STRIPE_PRICE_MONTHLY`
3. Create **ArduSimple RTK Survey — Yearly**
   - Price: `€79.00`, recurring, yearly
   - Copy the **Price ID** — this is `STRIPE_PRICE_YEARLY`

### 4.3 Get your API keys

Go to **Developers → API keys**:

| Key | Variable name |
|-----|--------------|
| Publishable key (`pk_test_...`) | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| Secret key (`sk_test_...`) | `STRIPE_SECRET_KEY` |

> Switch to live keys (`pk_live_...` / `sk_live_...`) when ready to accept real payments.

### 4.4 Webhook (configure after deploying to Vercel)

See [Section 6.3](#63-configure-stripe-webhook).

---

## 5. Web portal (Next.js)

### 5.1 Install dependencies

```bash
cd web-portal
npm install
```

### 5.2 Create environment file

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in all values:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...    # fill after step 6.3

# Stripe price IDs
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_YEARLY=price_...

# Your deployed URL (use http://localhost:3000 for local dev)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5.3 Run locally

```bash
npm run dev
```

Visit http://localhost:3000 — you should see the landing page.

To test webhooks locally, install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and run:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The CLI will print a webhook signing secret starting with `whsec_` — paste it into `STRIPE_WEBHOOK_SECRET` in `.env.local`.

---

## 6. Deploy web portal to Vercel

### 6.1 Install Vercel CLI and deploy

```bash
npm install -g vercel
cd web-portal
vercel --prod
```

Follow the prompts:
- Link to existing project or create a new one
- Framework: **Next.js** (auto-detected)
- Root directory: leave as default (`.`)

### 6.2 Set environment variables in Vercel

Go to your project in https://vercel.com → **Settings → Environment Variables** and add every key from `.env.example` with your real values. Set `NEXT_PUBLIC_APP_URL` to your Vercel production URL (e.g. `https://auth.your-domain.com`).

After adding variables, trigger a redeploy:

```bash
vercel --prod
```

### 6.3 Configure Stripe webhook

1. Go to https://dashboard.stripe.com/webhooks → **Add endpoint**
2. **Endpoint URL**: `https://your-vercel-domain.vercel.app/api/stripe/webhook`
3. **Events to listen for** — select these four:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Click **Add endpoint**
5. Click **Reveal** on the **Signing secret** field
6. Copy the `whsec_...` value and add it as `STRIPE_WEBHOOK_SECRET` in Vercel environment variables
7. Redeploy: `vercel --prod`

### 6.4 Update Supabase redirect URL

Go back to Supabase → **Authentication → URL Configuration** and update:
- **Site URL** → `https://your-vercel-domain.vercel.app`
- **Redirect URLs** → `https://your-vercel-domain.vercel.app/auth/callback`

---

## 7. Mobile app — Android

### 7.1 Install Android Studio and SDK

1. Download and install Android Studio from https://developer.android.com/studio
2. On first launch, run through the **Setup Wizard** — it installs the default SDK
3. Open **SDK Manager** (Tools → SDK Manager) and ensure the following are installed:
   - **SDK Platforms**: Android 16 (API 36) with "Android SDK Platform 36"
   - **SDK Tools**: Android SDK Build-Tools 36.0.0, Android NDK (latest), Android Emulator

### 7.2 Set environment variables

Add these to your shell profile (`~/.bashrc`, `~/.zshrc`, or Windows Environment Variables):

**macOS / Linux:**
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk          # macOS
# or
export ANDROID_HOME=$HOME/Android/Sdk                  # Linux

export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
```

**Windows (PowerShell / System Environment Variables):**
```
ANDROID_HOME = C:\Users\<YourUser>\AppData\Local\Android\Sdk
Add to PATH: %ANDROID_HOME%\platform-tools
Add to PATH: %ANDROID_HOME%\emulator
```

Restart your terminal after setting these.

### 7.3 Install Java 17

Download Temurin JDK 17 from https://adoptium.net (choose **JDK 17 LTS**) and install.

Verify:
```bash
java -version
# openjdk version "17.x.x" ...
```

### 7.4 Install app dependencies

```bash
cd gnss-rtk-app
npm install
```

### 7.5 Add required Android permissions

The app needs Bluetooth and location permissions. Open `android/app/src/main/AndroidManifest.xml` and replace the `<manifest>` block with:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Internet (NTRIP + Supabase) -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <!-- Bluetooth BLE (Android 12+) -->
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN"
        android:usesPermissionFlags="neverForLocation" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />

    <!-- Bluetooth BLE (Android < 12) -->
    <uses-permission android:name="android.permission.BLUETOOTH"
        android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN"
        android:maxSdkVersion="30" />

    <!-- Location (required for BLE scan on Android < 12) -->
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

    <!-- File storage for export (Android < 10) -->
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
        android:maxSdkVersion="28" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
        android:maxSdkVersion="32" />

    <!-- BLE hardware feature declaration -->
    <uses-feature android:name="android.hardware.bluetooth_le" android:required="true" />

    <application
      android:name=".MainApplication"
      android:label="@string/app_name"
      android:icon="@mipmap/ic_launcher"
      android:roundIcon="@mipmap/ic_launcher_round"
      android:allowBackup="false"
      android:theme="@style/AppTheme"
      android:usesCleartextTraffic="${usesCleartextTraffic}"
      android:supportsRtl="true">
      <activity
        android:name=".MainActivity"
        android:label="@string/app_name"
        android:configChanges="keyboard|keyboardHidden|orientation|screenLayout|screenSize|smallestScreenSize|uiMode"
        android:launchMode="singleTask"
        android:windowSoftInputMode="adjustResize"
        android:exported="true">
        <intent-filter>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent-filter>
      </activity>
    </application>
</manifest>
```

### 7.6 Configure Supabase keys in the app

Open `gnss-rtk-app/src/services/supabase.ts` and replace the placeholder values:

```typescript
const SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co'  // your project URL
const SUPABASE_ANON_KEY = 'eyJhbGci...'                  // your anon key
```

### 7.7 Connect a device or start an emulator

**Physical device (recommended for BLE testing):**
1. On your Android phone go to **Settings → About phone** and tap **Build number** 7 times to enable Developer Options
2. Go to **Settings → Developer Options** → enable **USB Debugging**
3. Connect phone via USB
4. Run `adb devices` — you should see your device listed

**Emulator (no BLE support):**
1. Open Android Studio → **Device Manager** → **Create Device**
2. Choose a Pixel device, API 36 system image

### 7.8 Build and run

```bash
cd gnss-rtk-app
npm run android
```

Metro bundler will start automatically. The app will be installed and launched on your device/emulator.

To run Metro separately (useful for debugging):
```bash
# Terminal 1
npm start

# Terminal 2
npm run android
```

### 7.9 Build a release APK

```bash
cd gnss-rtk-app/android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

For Play Store upload, build an AAB instead:
```bash
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

> **Signing:** You must create a keystore and configure signing before releasing. See https://reactnative.dev/docs/signed-apk-android

---

## 8. Mobile app — iOS

> **macOS only.** iOS builds are not possible on Windows or Linux.

### 8.1 Install Xcode

Install Xcode 16+ from the Mac App Store. After installation, also install the **Command Line Tools**:

```bash
xcode-select --install
```

Accept the Xcode license:
```bash
sudo xcodebuild -license accept
```

### 8.2 Install CocoaPods

```bash
sudo gem install cocoapods
```

Or with Homebrew (preferred):
```bash
brew install cocoapods
```

### 8.3 Install dependencies

```bash
cd gnss-rtk-app
npm install
cd ios
pod install
cd ..
```

> If `pod install` fails with Ruby errors, try: `sudo arch -x86_64 gem install ffi && pod install`

### 8.4 Add iOS permissions

Open `ios/GNSSRTKApp/Info.plist` and add these keys inside the `<dict>`:

```xml
<!-- Bluetooth -->
<key>NSBluetoothAlwaysUsageDescription</key>
<string>ArduSimple RTK needs Bluetooth to connect to GNSS receivers.</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>ArduSimple RTK needs Bluetooth to connect to GNSS receivers.</string>

<!-- Location (for map display) -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>ArduSimple RTK uses location for map display and point collection.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>ArduSimple RTK uses location in the background during survey sessions.</string>

<!-- Photo library (for map screenshots, optional) -->
<key>NSPhotoLibraryUsageDescription</key>
<string>ArduSimple RTK may save map screenshots to your photo library.</string>
```

### 8.5 Run on simulator or device

```bash
cd gnss-rtk-app
npm run ios
```

To specify a simulator:
```bash
npm run ios -- --simulator="iPhone 16 Pro"
```

To run on a physical device, open `ios/GNSSRTKApp.xcworkspace` in Xcode, select your device as the build target, and press the **Run** button. You will need an Apple Developer account (free account works for personal testing).

### 8.6 Build for App Store

1. Open `ios/GNSSRTKApp.xcworkspace` in Xcode
2. Set your **Team** under Signing & Capabilities (requires paid Apple Developer account — $99/year)
3. Select **Any iOS Device** as the build target
4. Go to **Product → Archive**
5. In the Organizer window, click **Distribute App** → App Store Connect

---

## 9. Connect everything together

After completing steps 3–8, update these two files with your real Supabase URL/keys and web portal URL:

### 9.1 Mobile app — Supabase

**File:** `gnss-rtk-app/src/services/supabase.ts`

```typescript
const SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

### 9.2 Mobile app — Web portal URL

**File:** `gnss-rtk-app/src/screens/LicenseExpiredScreen.tsx`

```typescript
const PORTAL_URL = 'https://your-vercel-domain.vercel.app/pricing'
```

**File:** `gnss-rtk-app/App.tsx`

Find the trial banner and update the URL in `Linking.openURL(...)`:
```typescript
Linking.openURL('https://your-vercel-domain.vercel.app/pricing')
```

### 9.3 End-to-end flow

Once everything is running, the complete flow is:

```
User installs app
       │
       ▼
OnboardingScreen (first launch)
       │
       ▼
RegisterScreen (in-app) ──────► Supabase creates user
       │                         + profiles row (trial_start = NOW())
       ▼
App checks license every launch ◄── Supabase profiles table
       │
  ┌────┴────┐
trial     expired
  │           │
  ▼           ▼
AppNavigator  LicenseExpiredScreen
              │
              ▼
     "Subscribe Now" opens browser
              │
              ▼
     web-portal /pricing
              │
              ▼
     Stripe Checkout
              │
              ▼
     Stripe webhook → /api/stripe/webhook
              │
              ▼
     Supabase profiles updated
     (subscription_status = 'active')
              │
              ▼
     App re-checks → license valid → AppNavigator
```

---

## 10. Android permissions checklist

When the app first runs on Android, it will request these permissions at runtime. Ensure your test device allows them:

| Permission | When asked | Required for |
|-----------|-----------|-------------|
| `BLUETOOTH_SCAN` | DeviceScreen — first BLE scan | Scanning for GNSS receivers |
| `BLUETOOTH_CONNECT` | DeviceScreen — on connect | Connecting to receiver |
| `ACCESS_FINE_LOCATION` | DeviceScreen — first BLE scan (Android < 12) | BLE scan |

If a permission is denied, the user must re-enable it in **Settings → Apps → ArduSimple RTK → Permissions**.

---

## 11. Running tests

```bash
cd gnss-rtk-app

# Run all tests
npm test

# Watch mode
npm test -- --watch

# With coverage
npm test -- --coverage
```

Tests cover:
- `__tests__/nmea-parser.test.ts` — NMEA sentence parsing (9 tests)
- `__tests__/coordinate-systems.test.ts` — coordinate transforms (10 tests)
- `__tests__/App.test.tsx` — app smoke test

---

## 12. Troubleshooting

### Metro bundler port in use

```bash
# Kill the process on port 8081
npx kill-port 8081
npm start
```

### Android build fails — SDK not found

```bash
# Verify ANDROID_HOME is set
echo $ANDROID_HOME    # macOS/Linux
echo %ANDROID_HOME%   # Windows

# Should output something like:
# /Users/username/Library/Android/sdk
```

If empty, set it as described in [Section 7.2](#72-set-environment-variables).

### Android — "Unable to load script from assets"

Metro is not running. Open a separate terminal and run `npm start` before `npm run android`.

### iOS — pod install fails

```bash
cd ios
pod repo update
pod install --repo-update
```

### iOS — "Signing for 'GNSSRTKApp' requires a development team"

Open `ios/GNSSRTKApp.xcworkspace` in Xcode → click the project in the navigator → **Signing & Capabilities** → select your Apple ID under **Team**.

### Supabase auth not working

- Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct in `gnss-rtk-app/src/services/supabase.ts`
- Make sure email auth is enabled in Supabase → Authentication → Providers
- Check the Supabase logs in your dashboard: **Database → Logs**

### Stripe webhook not receiving events

- Verify the webhook URL is correct in the Stripe dashboard
- Check that `STRIPE_WEBHOOK_SECRET` matches the signing secret shown in Stripe
- Check Vercel function logs: Vercel dashboard → your project → **Functions** tab

### BLE scan returns no devices

- Ensure Bluetooth is turned on and the receiver is powered
- On Android, ensure **Location** is also turned on (required for BLE scan on Android < 12)
- On iOS, check that Bluetooth permission was granted in Settings

### App shows "Trial Expired" immediately after registration

The `profiles` row may not have been created. Check that the Supabase trigger `on_auth_user_created` exists by running in the SQL editor:

```sql
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'users';
```

If the trigger is missing, re-run the SQL in [Section 3.2](#32-run-the-database-schema).

---

## Summary of environment variables

| Variable | File | Notes |
|----------|------|-------|
| `SUPABASE_URL` | `gnss-rtk-app/src/services/supabase.ts` | Mobile app |
| `SUPABASE_ANON_KEY` | `gnss-rtk-app/src/services/supabase.ts` | Mobile app |
| `NEXT_PUBLIC_SUPABASE_URL` | `web-portal/.env.local` | Web portal |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `web-portal/.env.local` | Web portal |
| `SUPABASE_SERVICE_ROLE_KEY` | `web-portal/.env.local` | Web portal (server only) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `web-portal/.env.local` | Web portal |
| `STRIPE_SECRET_KEY` | `web-portal/.env.local` | Web portal (server only) |
| `STRIPE_WEBHOOK_SECRET` | `web-portal/.env.local` + Vercel | Web portal |
| `STRIPE_PRICE_MONTHLY` | `web-portal/.env.local` + Vercel | Web portal |
| `STRIPE_PRICE_YEARLY` | `web-portal/.env.local` + Vercel | Web portal |
| `NEXT_PUBLIC_APP_URL` | `web-portal/.env.local` + Vercel | Web portal |
