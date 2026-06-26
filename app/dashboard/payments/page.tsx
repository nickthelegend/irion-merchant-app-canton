"use client"

export const dynamic = "force-dynamic"

import { useCallback, useEffect, useState } from "react"
import {
  TrendingUp, CheckCircle2, Clock, Receipt, Wallet, ArrowUpRight,
} from "lucide-react"
import { useParty } from "@/lib/canton-connect-kit"

type Payment = {
  id: string
  hash?: string
  app: string
  amount: number
  asset: string
  description: string
  status: string
  payment_mode: string | null
  tx_hash: string | null
  created_at: number | string
  paid_at: number | string | null
}

type Stats = { total: number; settled: number; pending: number; volume: number }

const short = (s: string, head = 6, tail = 6) =>
  s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`

const fmtDate = (x: number | string) => {
  const d = new Date(x)
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString()
}

export default function PaymentsPage() {
  const { party } = useParty()
  const partyId = party?.partyId

  const [payments, setPayments] = useState<Payment[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, settled: 0, pending: 0, volume: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const refresh = useCallback(async (p: string) => {
    setLoading(true)
    setError(undefined)
    try {
      const res = await fetch("/api/payments", { headers: { "x-wallet-address": p } })
      if (!res.ok) throw new Error(`Failed to load payments (${res.status})`)
      const data = await res.json()
      setPayments(Array.isArray(data.payments) ? data.payments : [])
      setStats(data.stats ?? { total: 0, settled: 0, pending: 0, volume: 0 })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!partyId) return
    void refresh(partyId)
  }, [partyId, refresh])

  if (!partyId) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-6 font-display">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
          <Wallet className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-black tracking-tight mb-2">Connect your Canton wallet</h1>
        <p className="text-white/50 max-w-sm text-sm leading-relaxed">
          Connect Carpincho from the sidebar to see every checkout that settled to your Canton party —
          BNPL, direct, and private credit.
        </p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto font-display">
      <header className="mb-8">
        <h1 className="text-2xl font-black tracking-tight">Payments</h1>
        <p className="text-sm text-white/40 mt-1">Every checkout that settled to your Canton party.</p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Kpi
          label="Volume"
          value={`$${stats.volume.toFixed(2)}`}
          sub="USDC"
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <Kpi label="Settled" value={String(stats.settled)} icon={<CheckCircle2 className="w-4 h-4" />} />
        <Kpi label="Pending" value={String(stats.pending)} icon={<Clock className="w-4 h-4" />} />
        <Kpi label="Total" value={String(stats.total)} icon={<Receipt className="w-4 h-4" />} />
      </div>

      {error !== undefined && (
        <p className="text-[11px] text-red-400 font-bold mb-4 uppercase tracking-wide">{error}</p>
      )}

      {/* Payments list */}
      <section>
        <h2 className="text-sm font-black uppercase tracking-widest text-white/70 mb-4">Recent checkouts</h2>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl bg-white/[0.02] text-white/40 text-sm px-6">
            No payments yet — share a payment link or wire your storefront to start accepting Canton checkouts.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {payments.map((p) => (
              <PaymentRow key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Kpi({
  label, value, sub, icon,
}: { label: string; value: string; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 text-white/40 mb-2">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-xl font-black flex items-baseline gap-1.5">
        {value}
        {sub && <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{sub}</span>}
      </div>
    </div>
  )
}

function PaymentRow({ p }: { p: Payment }) {
  const paid = p.status === "paid"
  return (
    <div className="group bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-5 hover:border-primary/40 transition-all flex items-center gap-4">
      {/* App glyph */}
      <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-base font-bold">
        {(p.app || "?").charAt(0).toUpperCase()}
      </div>

      {/* Main */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-black uppercase italic truncate">{p.app}</span>
          {p.payment_mode && (
            <span className="shrink-0 text-[8px] font-black uppercase tracking-widest text-white/50 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
              {p.payment_mode}
            </span>
          )}
        </div>
        <p className="text-xs text-white/40 truncate">{p.description || "Checkout"}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[10px] text-white/30 font-mono">{fmtDate(p.created_at)}</span>
          {p.tx_hash && (
            <code className="text-[10px] text-white/30 font-mono flex items-center gap-0.5 truncate">
              <ArrowUpRight className="w-3 h-3 shrink-0" />
              {short(p.tx_hash)}
            </code>
          )}
        </div>
      </div>

      {/* Amount + status */}
      <div className="shrink-0 text-right flex flex-col items-end gap-1.5">
        <div className="text-sm font-black tabular-nums">
          {(p.amount ?? 0).toFixed(2)}
          <span className="text-[10px] font-bold text-white/30 ml-1 tracking-widest">{p.asset}</span>
        </div>
        {paid ? (
          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
            <CheckCircle2 className="w-3 h-3" /> Paid
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-2 py-0.5">
            <Clock className="w-3 h-3" /> Pending
          </span>
        )}
      </div>
    </div>
  )
}
