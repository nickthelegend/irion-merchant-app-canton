"use client"

export const dynamic = "force-dynamic"

import { useCallback, useEffect, useState } from "react"
import {
  Settings as SettingsIcon, Loader2, Copy, Check, Wallet, KeyRound,
  CreditCard, CalendarClock, ShieldCheck, RefreshCw, AlertTriangle,
} from "lucide-react"
import { useParty } from "@/lib/canton-connect-kit"
import { merchantApi, type MerchantApp } from "@/lib/canton-merchant"

// Checkout config lives on the app doc as { direct, bnpl, credit } (booleans).
// The list route strips secrets, so client_secret only ever arrives via roll-secret.
type CheckoutMethods = { direct: boolean; bnpl: boolean; credit: boolean }
type SettingsApp = MerchantApp & { checkout_methods?: Partial<CheckoutMethods> }

// Missing/undefined methods default to ON (matches the API's `!== false` normalize).
const normMethods = (cm?: Partial<CheckoutMethods>): CheckoutMethods => ({
  direct: cm?.direct !== false,
  bnpl: cm?.bnpl !== false,
  credit: cm?.credit !== false,
})

const short = (s: string, head = 10, tail = 8) =>
  s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`

export default function SettingsPage() {
  const { party } = useParty()
  const partyId = party?.partyId

  const [apps, setApps] = useState<SettingsApp[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const refresh = useCallback(async (p: string) => {
    setLoading(true)
    try { setApps(await merchantApi.listApps(p) as SettingsApp[]) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!partyId) return
    void merchantApi.sync(partyId).then(() => refresh(partyId))
  }, [partyId, refresh])

  if (!partyId) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-6 font-display">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
          <Wallet className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-black tracking-tight mb-2">Connect your Canton wallet</h1>
        <p className="text-white/50 max-w-sm text-sm leading-relaxed">
          Connect Carpincho from the sidebar to open your merchant console — tune checkout options, roll API
          secrets, and configure your workspace on Canton.
        </p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto font-display">
      <header className="mb-8 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <SettingsIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Settings</h1>
          <p className="text-sm text-white/40 mt-1">Checkout options, API keys, and workspace config.</p>
        </div>
      </header>

      {error !== undefined && (
        <p className="text-[11px] text-red-400 font-bold mb-6 uppercase tracking-wide">{error}</p>
      )}

      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2].map((i) => <div key={i} className="h-72 bg-white/5 rounded-2xl animate-pulse" />)}
        </div>
      ) : apps.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl bg-white/[0.02] text-white/40 text-sm">
          No apps yet — create an app on Overview first.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {apps.map((app) => (
            <AppSettingsCard key={app._id} app={app} partyId={partyId} />
          ))}
        </div>
      )}
    </div>
  )
}

function AppSettingsCard({ app, partyId }: { app: SettingsApp; partyId: string }) {
  const [methods, setMethods] = useState<CheckoutMethods>(() => normMethods(app.checkout_methods))
  const [savingKey, setSavingKey] = useState<keyof CheckoutMethods | null>(null)
  const [savedAt, setSavedAt] = useState(0)
  const [saveError, setSaveError] = useState<string | undefined>(undefined)

  const [rolling, setRolling] = useState(false)
  const [rolledSecret, setRolledSecret] = useState<string | undefined>(undefined)
  const [rollError, setRollError] = useState<string | undefined>(undefined)

  // At least one method must stay on — the last enabled one is locked.
  const enabledCount = Number(methods.direct) + Number(methods.bnpl) + Number(methods.credit)

  const toggle = async (key: keyof CheckoutMethods) => {
    // Guard: never let the only-remaining method be turned off.
    if (methods[key] && enabledCount <= 1) return
    const next = { ...methods, [key]: !methods[key] }
    setMethods(next)
    setSavingKey(key)
    setSaveError(undefined)
    try {
      const r = await fetch(`/api/apps/${app._id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-wallet-address": partyId },
        body: JSON.stringify({ checkout_methods: next }),
      })
      if (!r.ok) {
        const b = await r.json().catch(() => ({}))
        throw new Error((b as { error?: string })?.error || `save failed (${r.status})`)
      }
      setSavedAt(Date.now())
    } catch (e) {
      setMethods((m) => ({ ...m, [key]: !m[key] })) // revert the optimistic flip
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingKey(null)
    }
  }

  const rollSecret = async () => {
    setRolling(true)
    setRollError(undefined)
    try {
      const r = await fetch(`/api/apps/${app._id}/roll-secret`, {
        method: "POST",
        headers: { "x-wallet-address": partyId },
      })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error((b as { error?: string })?.error || `roll failed (${r.status})`)
      const secret = (b as { client_secret?: string; app?: { client_secret?: string } })?.client_secret
        ?? (b as { app?: { client_secret?: string } })?.app?.client_secret
      if (!secret) throw new Error("no secret returned")
      setRolledSecret(secret)
    } catch (e) {
      setRollError(e instanceof Error ? e.message : String(e))
    } finally {
      setRolling(false)
    }
  }

  const justSaved = savedAt > 0 && Date.now() - savedAt < 2200

  return (
    <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
      {/* App header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-lg font-bold shrink-0">
          {app.name.charAt(0)}
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-black uppercase italic truncate">{app.name}</h2>
          <p className="text-[10px] text-white/40 uppercase tracking-widest">{app.category || "General"}</p>
        </div>
        <span className="ml-auto text-[8px] font-mono text-white/30">{short(partyId)}</span>
      </div>

      {/* Checkout methods */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-white/70">Checkout methods</h3>
          {justSaved && (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-primary">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Toggle
            label="Direct"
            desc="Pay in full"
            icon={<CreditCard className="w-3.5 h-3.5" />}
            on={methods.direct}
            saving={savingKey === "direct"}
            locked={methods.direct && enabledCount <= 1}
            onToggle={() => toggle("direct")}
          />
          <Toggle
            label="BNPL"
            desc="Buy now, pay later"
            icon={<CalendarClock className="w-3.5 h-3.5" />}
            on={methods.bnpl}
            saving={savingKey === "bnpl"}
            locked={methods.bnpl && enabledCount <= 1}
            onToggle={() => toggle("bnpl")}
          />
          <Toggle
            label="Credit"
            desc="Private credit line"
            icon={<ShieldCheck className="w-3.5 h-3.5" />}
            on={methods.credit}
            saving={savingKey === "credit"}
            locked={methods.credit && enabledCount <= 1}
            onToggle={() => toggle("credit")}
          />
        </div>
        {saveError !== undefined && (
          <p className="text-[10px] text-red-400 font-bold mt-2 uppercase tracking-wide">{saveError}</p>
        )}
        <p className="text-[10px] text-white/30 mt-2">At least one method must stay enabled.</p>
      </div>

      {/* API keys */}
      <div>
        <h3 className="text-[11px] font-black uppercase tracking-widest text-white/70 mb-3">API keys</h3>
        <div className="flex flex-col gap-3">
          <CopyRow label="client_id" value={app.client_id} />

          {rolledSecret ? (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.04] p-3">
              <p className="flex items-center gap-1.5 text-[10px] text-amber-400/90 font-bold uppercase tracking-wide mb-2">
                <AlertTriangle className="w-3 h-3" /> New secret — shown once, copy it now
              </p>
              <CopyRow label="client_secret" value={rolledSecret} />
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-black/30 border border-white/10 px-3 py-2.5">
              <div className="min-w-0">
                <div className="text-[8px] text-white/40 uppercase tracking-widest">client_secret</div>
                <code className="text-[10px] text-white/40 block truncate">sk_••••••••••••••••••••••••</code>
              </div>
              <button
                onClick={rollSecret}
                disabled={rolling}
                className="shrink-0 flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/40 text-white/80 text-[10px] font-black uppercase tracking-tighter px-3 py-2 rounded-lg disabled:opacity-50 transition-all"
                title="Generate a new client secret"
              >
                {rolling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Roll secret
              </button>
            </div>
          )}
          {rollError !== undefined && (
            <p className="text-[10px] text-red-400 font-bold uppercase tracking-wide">{rollError}</p>
          )}
        </div>
        <p className="text-[10px] text-white/30 mt-3 leading-relaxed">
          Set these as <code className="text-white/50">IRION_CLIENT_ID</code> /{" "}
          <code className="text-white/50">IRION_CLIENT_SECRET</code> in your store. Rolling the secret invalidates the
          previous one immediately.
        </p>
      </div>
    </section>
  )
}

function Toggle({
  label, desc, icon, on, saving, locked, onToggle,
}: {
  label: string
  desc: string
  icon: React.ReactNode
  on: boolean
  saving: boolean
  locked: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      disabled={locked || saving}
      title={locked ? "At least one method must stay on" : on ? `Disable ${label}` : `Enable ${label}`}
      className={[
        "group text-left rounded-xl border p-3 transition-all",
        on ? "bg-primary/[0.06] border-primary/30" : "bg-white/[0.02] border-white/10",
        locked ? "cursor-not-allowed" : "hover:border-white/20 cursor-pointer",
      ].join(" ")}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className={["transition-colors", on ? "text-primary" : "text-white/40"].join(" ")}>{icon}</span>
        {/* Pill switch */}
        <span
          className={[
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
            on ? "bg-primary" : "bg-white/15",
          ].join(" ")}
        >
          {saving ? (
            <Loader2 className="w-3 h-3 animate-spin text-black absolute left-1/2 -translate-x-1/2" />
          ) : (
            <span
              className={[
                "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
                on ? "translate-x-[18px]" : "translate-x-[3px]",
              ].join(" ")}
            />
          )}
        </span>
      </div>
      <div className={["text-xs font-black uppercase tracking-tight", on ? "text-white" : "text-white/60"].join(" ")}>
        {label}
      </div>
      <div className="text-[10px] text-white/40">{desc}</div>
    </button>
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
