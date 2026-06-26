"use client"

export const dynamic = "force-dynamic"

import { useCallback, useEffect, useState } from "react"
import {
  Wallet, Banknote, TrendingUp, ArrowUpRight, Lock, Loader2, AlertTriangle,
} from "lucide-react"
import { useParty } from "@/lib/canton-connect-kit"

const B2B = process.env.NEXT_PUBLIC_B2B_API_URL ?? "http://localhost:8088"

const short = (s: string, head = 10, tail = 8) =>
  s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`

const usd = (n: number) => `$${n.toFixed(2)}`

type Treasury = {
  party: string
  cash: number
  yieldShares: number
  yieldValue: number
  total: number
}

export default function TreasuryPage() {
  const { party } = useParty()
  const partyId = party?.partyId

  const [data, setData] = useState<Treasury | null>(null)
  const [loading, setLoading] = useState(false)
  const [unreachable, setUnreachable] = useState(false)

  const load = useCallback(async (p: string) => {
    setLoading(true)
    setUnreachable(false)
    try {
      const res = await fetch(`${B2B}/v1/wallet/treasury?party=${encodeURIComponent(p)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as Treasury
      setData(json)
    } catch {
      setUnreachable(true)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!partyId) return
    void load(partyId)
  }, [partyId, load])

  if (!partyId) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-6 font-display">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
          <Wallet className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-black tracking-tight mb-2">Connect your Canton wallet</h1>
        <p className="text-white/50 max-w-sm text-sm leading-relaxed">
          Connect Carpincho from the sidebar to view your treasury — the USDC your storefront has
          settled on Canton, private by construction.
        </p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto font-display">
      <header className="mb-8">
        <h1 className="text-2xl font-black tracking-tight">Treasury</h1>
        <p className="text-sm text-white/40 mt-1">
          Your USDC on Canton — settled from checkouts, private by construction.
        </p>
      </header>

      {unreachable && (
        <div className="flex items-center gap-2.5 bg-amber-500/[0.07] border border-amber-500/20 rounded-xl px-4 py-3 mb-6 text-amber-300/90">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wide">Canton ledger unreachable — showing no balance.</span>
        </div>
      )}

      {/* Hero balance */}
      {loading && !data ? (
        <div className="h-44 bg-white/5 rounded-2xl animate-pulse mb-6" />
      ) : (
        <section className="relative overflow-hidden bg-gradient-to-br from-primary/[0.08] to-white/[0.02] border border-primary/20 rounded-2xl p-7 mb-6">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 text-primary/80 mb-3">
              <Lock className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Total on Canton</span>
            </div>
            <div className="text-5xl font-black tracking-tight tabular-nums">
              {data ? usd(data.total) : "$0.00"}
              <span className="text-lg text-white/30 font-bold ml-2">USDC</span>
            </div>
            <p className="text-xs text-white/40 mt-4 font-mono">
              settling party <code className="text-primary/90">{short(partyId)}</code>
            </p>
          </div>
        </section>
      )}

      {/* Cash + Yield */}
      {loading && !data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {[1, 2].map((i) => <div key={i} className="h-40 bg-white/5 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Cash */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex flex-col">
            <div className="flex items-center gap-2 text-white/40 mb-3">
              <Banknote className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Cash</span>
            </div>
            <div className="text-3xl font-black tabular-nums">{data ? usd(data.cash) : "$0.00"}</div>
            <p className="text-xs text-white/40 mt-2 leading-relaxed">Idle USDC, ready to spend or sweep.</p>
            <div className="mt-auto pt-5">
              <button
                disabled
                title="Coming soon"
                className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-tighter text-white/30 cursor-not-allowed"
              >
                <ArrowUpRight className="w-3.5 h-3.5" /> Sweep to yield — coming soon
              </button>
            </div>
          </div>

          {/* Yield position */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex flex-col">
            <div className="flex items-center gap-2 text-white/40 mb-3">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Yield position</span>
            </div>
            <div className="text-3xl font-black tabular-nums">{data ? usd(data.yieldValue) : "$0.00"}</div>
            <p className="text-xs text-white/40 mt-2 leading-relaxed">Supplied to the pool, earning.</p>
            {data && data.yieldShares > 0 && (
              <p className="text-[10px] text-white/30 mt-1 font-mono tabular-nums">{data.yieldShares} shares</p>
            )}
            <div className="mt-auto pt-5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary/70">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Active
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Explainer */}
      <section className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          {loading ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <Lock className="w-4 h-4 text-primary" />}
        </div>
        <p className="text-xs text-white/50 leading-relaxed">
          Settlements from your storefront&apos;s <span className="text-white/80 font-bold">BNPL</span>,{" "}
          <span className="text-white/80 font-bold">Direct</span> and{" "}
          <span className="text-white/80 font-bold">Credit</span> checkouts land here on the Canton ledger —
          visible only to you and Irion. Sub-transaction privacy means counterparties never see your balance.
        </p>
      </section>
    </div>
  )
}
