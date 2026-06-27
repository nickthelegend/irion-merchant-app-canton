import { test, before, afterEach } from "node:test"
import assert from "node:assert/strict"

// Browser globals the client relies on, stubbed before importing the module.
const ls = {
  store: {} as Record<string, string>,
  getItem(k: string) { return this.store[k] ?? null },
  setItem(k: string, v: string) { this.store[k] = v },
  removeItem(k: string) { delete this.store[k] },
}
;(globalThis as any).window = { localStorage: ls }
;(globalThis as any).localStorage = ls

const realFetch = globalThis.fetch
let calls: any[] = []
function stubFetch(resp: { ok?: boolean; status?: number; body?: any }) {
  calls = []
  globalThis.fetch = (async (url: any, init: any) => {
    calls.push({ url, init })
    const b = resp.body ?? {}
    return { ok: resp.ok ?? true, status: resp.status ?? 200, text: async () => (typeof b === "string" ? b : JSON.stringify(b)) } as any
  }) as any
}
afterEach(() => { globalThis.fetch = realFetch; ls.store = {} })

// Loaded in a hook (not top-level await — this package isn't "type":"module")
// AND after the window/localStorage stubs above are in place.
let nb: typeof import("./neobank.ts")
before(async () => { nb = await import("./neobank.ts") })

test("apiGet: GET to the API base, no Bearer when there is no session", async () => {
  stubFetch({ body: { ok: true } })
  await nb.apiGet("/v1/account/treasury")
  assert.equal(calls[0].url, "http://localhost:8088/v1/account/treasury")
  assert.equal(calls[0].init.method, "GET")
  assert.equal(calls[0].init.headers.authorization, undefined)
})

test("apiGet: attaches Bearer when a session is stored", async () => {
  ls.setItem("irion_session", "tok123")
  stubFetch({ body: {} })
  await nb.apiGet("/v1/account/treasury")
  assert.equal(calls[0].init.headers.authorization, "Bearer tok123")
})

test("deposit: POST with a JSON body + explicit currency", async () => {
  stubFetch({ body: { id: "x" } })
  await nb.deposit(250, "EURC")
  assert.equal(calls[0].url, "http://localhost:8088/v1/account/treasury/deposit")
  assert.equal(calls[0].init.method, "POST")
  assert.deepEqual(JSON.parse(calls[0].init.body), { amount: 250, currency: "EURC" })
})

test("transfer: defaults currency to USDC", async () => {
  stubFetch({ body: {} })
  await nb.transfer("acct_x", 10)
  assert.equal(calls[0].url, "http://localhost:8088/v1/account/transfers")
  assert.deepEqual(JSON.parse(calls[0].init.body), { to: "acct_x", amount: 10, currency: "USDC" })
})

test("repayLoan: URL-encodes the loan id", async () => {
  stubFetch({ body: {} })
  await nb.repayLoan("loan id/77", 20)
  assert.equal(calls[0].url, "http://localhost:8088/v1/account/loans/loan%20id%2F77/repay")
})

test("surfaces the API error message on a non-ok response", async () => {
  stubFetch({ ok: false, status: 402, body: { error: "insufficient treasury" } })
  await assert.rejects(() => nb.underwrite(), /insufficient treasury/)
})

test("getSession is SSR-safe (no window → null)", () => {
  const w = (globalThis as any).window
  delete (globalThis as any).window
  assert.equal(nb.getSession(), null)
  ;(globalThis as any).window = w
})
