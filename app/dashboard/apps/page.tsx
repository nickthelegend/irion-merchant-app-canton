"use client"

export const dynamic = "force-dynamic"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Boxes, Plus, Loader2, Copy, Check, Trash2, Wallet, X, Settings2, Calendar, Tag,
} from "lucide-react"
import { useParty } from "@/lib/canton-connect-kit"
import { merchantApi, type MerchantApp } from "@/lib/canton-merchant"

export default function AppsPage() {
  const { party } = useParty()
  const partyId = party?.partyId

  const [apps, setApps] = useState<MerchantApp[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)
  const [newKeys, setNewKeys] = useState<MerchantApp | null>(null)
  const [error, setError] = useState<string | undefined>(undefined)

  const refresh = useCallback(async (p: string) => {
    setLoading(true)
    try { setApps(await merchantApi.listApps(p)) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!partyId) return
    void merchantApi.sync(partyId).then(() => refresh(partyId))
  }, [partyId, refresh])

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!partyId || !name.trim()) return
    setCreating(true); setError(undefined)
    try {
      const app = await merchantApi.createApp(partyId, name.trim())
      setNewKeys(app)
      setName("")
      await refresh(partyId)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setCreating(false) }
  }

  const onDelete = async (id: string, n: string) => {
    if (!partyId || !confirm(`Delete "${n}"? Removes its API keys + bills.`)) return
    try { await merchantApi.deleteApp(partyId, id); await refresh(partyId) }
    catch { setError("delete failed") }
  }

  if (!partyId) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-6 font-display">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
          <Wallet className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-black tracking-tight mb-2">Connect your Canton wallet</h1>
        <p className="text-white/50 max-w-sm text-sm leading-relaxed">
          Connect Carpincho from the sidebar to open your merchant console — create apps, mint API keys,
          and accept BNPL &amp; private credit on Canton.
        </p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto font-display">
      <header className="mb-8">
        <h1 className="text-2xl font-black tracking-tight">Apps</h1>
        <p className="text-sm text-white/50 mt-1 leading-relaxed max-w-xl">
          Your stores and their API keys. Drop the keys into a storefront to accept Irion checkout.
        </p>
      </header>

      {/* Create app */}
      <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 mb-8">
        <h2 className="text-sm font-black uppercase tracking-widest text-white/70 mb-1">Create an app</h2>
        <p className="text-xs text-white/40 mb-4">A store with its own API keys — drop them into your storefront to accept Irion checkout.</p>
        <form onSubmit={onCreate} className="flex flex-col sm:flex-row gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="App name (e.g. Acme Coffee)"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="bg-primary text-black px-6 py-3 rounded-xl font-black text-sm uppercase tracking-tighter hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create
          </button>
        </form>
        {error !== undefined && <p className="text-[11px] text-red-400 font-bold mt-3 uppercase tracking-wide">{error}</p>}
      </section>

      {/* Apps list */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-white/70">Your apps</h2>
          {!loading && apps.length > 0 && (
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">
              <Boxes className="w-3.5 h-3.5" /> {apps.length} {apps.length === 1 ? "store" : "stores"}
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-56 bg-white/5 rounded-2xl animate-pulse" />)}
          </div>
        ) : apps.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl bg-white/[0.02] text-white/40 text-sm">
            No apps yet — create your first store above to get API keys.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {apps.map((app) => (
              <div key={app._id} className="group bg-white/[0.03] border border-white/10 rounded-2xl p-5 flex flex-col hover:border-primary/40 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-lg font-bold">{app.name.charAt(0).toUpperCase()}</div>
                  <button
                    onClick={() => onDelete(app._id, app.name)}
                    title="Delete app"
                    className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="text-base font-black uppercase italic mb-2 truncate">{app.name}</h3>

                <div className="flex items-center flex-wrap gap-2 mb-4">
                  <StatusPill status={app.status} />
                  <span className="inline-flex items-center gap-1 text-[10px] text-white/40 uppercase tracking-widest">
                    <Tag className="w-3 h-3" /> {app.category || "General"}
                  </span>
                  {app.created_at && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-white/40 uppercase tracking-widest">
                      <Calendar className="w-3 h-3" /> {new Date(app.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <div className="mt-auto">
                  <CopyRow label="client_id" value={app.client_id} />
                  <div className="flex items-center justify-between mt-3">
                    <Link
                      href="/dashboard/settings"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-primary/80 hover:text-primary transition-colors"
                    >
                      <Settings2 className="w-3.5 h-3.5" /> Configure checkout →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {newKeys && <KeyRevealModal app={newKeys} onClose={() => setNewKeys(null)} />}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const active = status === "active"
  return (
    <span
      className={
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest " +
        (active
          ? "bg-primary/15 text-primary border border-primary/30"
          : "bg-white/5 text-white/40 border border-white/10")
      }
    >
      <span className={"w-1.5 h-1.5 rounded-full " + (active ? "bg-primary" : "bg-white/30")} />
      {status || "unknown"}
    </span>
  )
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200) }}
      className="w-full flex items-center justify-between gap-2 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-left hover:border-white/20 transition-colors"
      title="Copy"
    >
      <div className="min-w-0">
        <div className="text-[8px] text-white/40 uppercase tracking-widest">{label}</div>
        <code className="text-[10px] text-white/80 block truncate">{value}</code>
      </div>
      {copied ? <Check className="w-3.5 h-3.5 text-primary shrink-0" /> : <Copy className="w-3.5 h-3.5 text-white/40 shrink-0" />}
    </button>
  )
}

function KeyRevealModal({ app, onClose }: { app: MerchantApp; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-zinc-950 border border-primary/30 rounded-2xl p-7 max-w-md w-full shadow-[0_0_60px_-12px_rgba(166,242,74,0.3)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-black tracking-tight">{app.name} — keys</h3>
            <p className="text-[11px] text-amber-400/90 font-bold uppercase tracking-wide mt-1">Copy the secret now — shown once.</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex flex-col gap-3">
          <CopyRow label="client_id" value={app.client_id} />
          {app.client_secret && <CopyRow label="client_secret" value={app.client_secret} />}
        </div>
        <p className="text-[10px] text-white/40 mt-4 leading-relaxed">
          Set these as <code className="text-white/60">IRION_CLIENT_ID</code> / <code className="text-white/60">IRION_CLIENT_SECRET</code> in your store
          to create Canton checkouts.
        </p>
      </div>
    </div>
  )
}
