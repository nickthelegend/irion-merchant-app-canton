# Irion Merchant / Neobank Console

A [Next.js 16](https://nextjs.org/) app that serves two roles in the Irion stack:

1. **Neobank / B2B console** (`/dashboard`) — a passkey-authenticated (WebAuthn)
   business-banking console that drives the [`irion-b2b-api`](../irion-b2b-api):
   treasury, FX, payroll, and lending. Onboarding and login use the browser
   authenticator (Touch ID / Windows Hello / FIDO2) — no spoofable
   `x-wallet-address` header — and the returned session token authorises every
   call. Dashboard sections: `treasury/`, `payments/`, `payroll/`, `lending/`,
   `settings/`.

2. **Merchant checkout API** (`/api/bills/*`, `/api/apps/*`, `/api/payments`,
   backed by MongoDB) — the bills/apps plumbing the
   [`irion-shopping-app-canton`](../irion-shopping-app-canton) storefront calls
   via `@irion/sdk` to create a bill and obtain a hosted-checkout URL.

## Architecture

- **Console → b2b-api:** `lib/neobank.ts` is the client for the Irion B2B /
  neobank API. It handles passkey register/login (`@simplewebauthn/browser`) and
  bearer-token-authorised requests against `NEXT_PUBLIC_B2B_API_URL`
  (defaults to `http://localhost:8088`).
- **Checkout API → MongoDB:** `lib/mongodb.ts` connects to MongoDB Atlas; the
  `/api/bills/*` and `/api/apps/*` routes store merchant apps, API keys, and
  bills. These power the external storefront checkout flow, ultimately handing
  off to the Irion `/pay` hosted checkout on Canton.

## How to run

The console expects the b2b-api on `:8088` and the consumer core on `:3000`
(cross-app URLs assume core is there). Run this app on **port 3004**:

```bash
npm install
npm run dev -- -p 3004
```

Then open [http://localhost:3004/dashboard](http://localhost:3004/dashboard).

### Environment

Create `.env.local`:

```bash
# B2B / neobank API the console consumes (treasury, FX, payroll, lending)
NEXT_PUBLIC_B2B_API_URL=http://localhost:8088

# MongoDB connection for the merchant checkout API (/api/bills, /api/apps)
MONGODB_URI=mongodb+srv://...
```

## Tech stack

- Next.js 16 (App Router, Turbopack)
- React 19, Tailwind CSS v4, Framer Motion
- `@simplewebauthn/browser` (passkey / WebAuthn auth)
- MongoDB (`mongodb` driver) for the merchant checkout API
- `@canton-network/*` SDK packages
