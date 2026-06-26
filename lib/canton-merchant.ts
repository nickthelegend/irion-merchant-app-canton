// Merchant API helpers, keyed by the merchant's CANTON PARTY (from Carpincho).
//
// The existing /api/* routes are chain-agnostic: `wallet_address` is just the
// merchant's identifier + ownership key. On Canton we pass the connected party id
// as that identifier, so the same MongoDB app/key/bill plumbing works unchanged —
// and the party doubles as the merchant's on-ledger settlement recipient.

export interface MerchantApp {
  _id: string
  name: string
  category?: string
  client_id: string
  client_secret?: string
  status: string
  network?: string
  created_at?: string
}

async function json<T>(r: Response): Promise<T> {
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((body as any)?.error || `request failed (${r.status})`)
  return body as T
}

export const merchantApi = {
  /** Register/refresh the merchant user (the party is the identity). */
  async sync(party: string): Promise<void> {
    await fetch("/api/auth/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet_address: party, email: null }),
    }).catch(() => {})
  },

  /** List the merchant's apps (stores). */
  async listApps(party: string): Promise<MerchantApp[]> {
    const r = await fetch("/api/apps", { headers: { "x-wallet-address": party } })
    const { apps } = await json<{ apps: MerchantApp[] }>(r)
    return apps ?? []
  },

  /** Create an app/store → returns the app incl. the one-time client_secret. */
  async createApp(party: string, name: string, category = "General"): Promise<MerchantApp> {
    const r = await fetch("/api/apps", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet_address: party, name, category, network: "canton:irion-sandbox" }),
    })
    const { app } = await json<{ app: MerchantApp }>(r)
    return app
  },

  /** Delete an app/store. */
  async deleteApp(party: string, id: string): Promise<void> {
    const r = await fetch(`/api/apps/${id}`, { method: "DELETE", headers: { "x-wallet-address": party } })
    if (!r.ok) throw new Error("delete failed")
  },
}
