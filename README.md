# Irion — Merchant Console & Neobank

> Merchant console + neobank, built on Irion.

Part of **[Irion](https://github.com/nickthelegend)** — private consumer credit and B2B
neobank infrastructure on the **[Canton Network](https://www.canton.network/)** (Daml smart
contracts). *Buy Now, Pay Never.* Privacy by construction: a Daml contract is visible only to
its signatory and observer parties, so the synchronizer that orders transactions never sees the
underlying balances.

This repo is a [Next.js 16](https://nextjs.org/) app (port **`:3004`**) that plays two roles in
that stack.

---

## What it is

**1. A passkey neobank console (`/dashboard`).** A WebAuthn-authenticated business-banking
console — treasury, FX, private payroll, working-capital lending — that is a thin client over
the [`irion-b2b-api`](https://github.com/nickthelegend/irion-b2b-api) `/v1/account/*` endpoints.
You sign in with a platform passkey (Touch ID / Windows Hello / FIDO2), the API returns a
session token, and that token authorises every subsequent call. No spoofable
`x-wallet-address` header.

**2. The merchant checkout API the storefront uses (`/api/*`, MongoDB).** The bills-and-apps
plumbing that the [`irion-shopping-app-canton`](https://github.com/nickthelegend/irion-shopping-app-canton)
storefront calls (via [`@irion/sdk`](https://github.com/nickthelegend/irion-sdk-canton)) to
create a bill and receive a hosted-checkout URL. This is intentionally hosted here — the
storefront depends on it.

---

## Console features

The `/dashboard` is a thin client over the b2b-api. Sections:

- **Overview** — balances, recent activity, and account state at a glance.
- **Apps & Keys** — create an app to get a `client_id` + `client_secret`, then generate a
  billing link. (This is what powers the checkout API below.)
- **Treasury** — deposit funds, run an FX swap (e.g. USDC ↔ EURC, a real on-ledger atomic
  swap priced from a live rate oracle), and earn yield by supplying to the lending pool.
- **Payroll** — pay a team privately; each salary is its own per-employee Daml contract.
- **Lending** — draw and repay working capital, underwritten on-ledger from treasury depth and
  repayment history.
- **Payments** — send and receive across currencies.
- **Settings** — account and passkey management.

Every action maps to a `/v1/account/*` call on the b2b-api; this app holds no money path of its
own.

---

## Checkout API

A store never touches Canton directly. Instead:

1. In **Apps & Keys**, create an app. You receive a **`client_id`** and a **`client_secret`**
   (shown once; only a SHA-256 hash is stored — see [`lib/secret.ts`](lib/secret.ts)).
2. The store calls **`POST /api/bills/create`** with those credentials in the
   `x-client-id` / `x-client-secret` headers.
3. The endpoint authenticates by looking up the app and doing a **constant-time** hash compare,
   then returns a **`/pay/<hash>` checkout URL** on the consumer core
   ([`irion-core-canton`](https://github.com/nickthelegend/irion-core-canton)).
4. The shopper completes checkout on that hosted `/pay` page — credit, BNPL, or a direct,
   shopper-signed token transfer on Canton.

### API routes (MongoDB-backed)

| Route | Purpose |
|---|---|
| `POST /api/bills/create` | Create a bill from `x-client-id` / `x-client-secret`; returns a `/pay/<hash>` checkout URL. |
| `GET /api/bills/[hash]` | Fetch a bill by hash (used by the hosted checkout). |
| `POST /api/bills/pay` | Settlement / status callback for a bill. |
| `GET` / `POST /api/apps` | List or create merchant apps (`client_id` + `client_secret`). |
| `/api/apps/[id]` | Read an app, plus its `roll-secret`, `bills`, and `webhooks` sub-routes. |
| `POST /api/auth/sync` | Sync the merchant's passkey account into the merchant store. |

---

## How a store integrates

```
1. Sign in to the console (passkey) → Apps & Keys → create an app
2. Copy the client_id + client_secret
3. Drop them into @irion/sdk in your storefront
4. The SDK calls POST /api/bills/create → gets a /pay URL → renders Irion checkout
```

The shopping demo ([`irion-shopping-app-canton`](https://github.com/nickthelegend/irion-shopping-app-canton))
is a working reference of exactly this flow.

---

## Getting started

**Prerequisites:**

- A running [`irion-b2b-api`](https://github.com/nickthelegend/irion-b2b-api) on **`:8088`**
  (the console's backend).
- A **MongoDB** connection (Atlas or local) for the checkout API.
- The consumer core ([`irion-core-canton`](https://github.com/nickthelegend/irion-core-canton))
  on **`:3000`** if you want the generated `/pay` checkout links to resolve.

```bash
npm install
npm run dev -- -p 3004
```

Then open **http://localhost:3004/dashboard**.

> Run this app on **port 3004** — it is one of the passkey origins the b2b-api allows
> (alongside `:3000` and `:3006`). Using another port will break WebAuthn registration/login.

### Environment

Create a `.env.local` (it is git-ignored):

```bash
# The B2B / neobank API the console consumes (treasury, FX, payroll, lending)
NEXT_PUBLIC_B2B_API_URL=http://localhost:8088

# MongoDB connection for the merchant checkout API (/api/bills, /api/apps)
MONGODB_URI=mongodb+srv://...
```

---

## Testing

```bash
npm test
```

Runs the [`node:test`](https://nodejs.org/api/test.html) suite via `tsx` (no extra runtime
deps). Coverage:

- **`lib/secret.ts`** — client-secret hashing and constant-time verification.
- **`lib/neobank.ts`** — the b2b-api client (request shaping, auth headers).
- **`components/neobank/ui.tsx`** — UI render tests via `react-dom/server`
  (`renderToStaticMarkup`), so no jsdom or browser is required.

---

## Project layout

```
app/
  dashboard/            Passkey neobank console (Overview, Apps & Keys,
    apps/               Treasury, Payroll, Lending, Payments, Settings)
    treasury/
    payroll/
    lending/
    payments/
    settings/
  api/
    apps/               Create/list apps, roll-secret, per-app bills + webhooks
      [id]/
    bills/              create (x-client-id/secret → /pay URL), [hash], pay
    auth/sync/          Sync passkey account into the merchant store
    payments/
    webhooks/
components/
  console/              Dashboard shell + sidebar
  neobank/              Login, auth, and shared console UI (+ render tests)
lib/
  secret.ts             SHA-256 hash + constant-time compare for client secrets
  neobank.ts            Client for the irion-b2b-api /v1/account/* endpoints
  mongodb.ts            MongoDB Atlas connection for the checkout API
  webhookSender.ts      HMAC-signed merchant webhooks
```

---

## Tech stack

- **Next.js 16** (App Router) · **React 19** · **Tailwind CSS v4**
- **`@simplewebauthn/browser`** — passkey / WebAuthn auth
- **`mongodb`** driver — the merchant checkout API store
- **`@canton-network/*`** SDK packages
- **`@tanstack/react-query`** — data fetching

---

## Related repos

| Repo | Role |
|---|---|
| [`irion-b2b-api`](https://github.com/nickthelegend/irion-b2b-api) | The console's backend — REST over the Canton ledger (`:8088`). |
| [`irion-core-canton`](https://github.com/nickthelegend/irion-core-canton) | Consumer app that renders the `/pay` checkout the bills point to (`:3000`). |
| [`irion-shopping-app-canton`](https://github.com/nickthelegend/irion-shopping-app-canton) | Demo storefront that uses this checkout API via the SDK. |
| [`irion-sdk-canton`](https://github.com/nickthelegend/irion-sdk-canton) | `@irion/sdk` — the Stripe-style drop-in checkout. |
