"use client";

import { useEffect, useState } from "react";
import { KeyRound, Plus, Copy, Check, Loader2, Link2, ExternalLink, RefreshCw } from "lucide-react";
import { useNeobank } from "@/components/neobank/auth";
import { PageHeader, Card, page } from "@/components/neobank/ui";

type App = { _id: string; name: string; client_id: string; status: string; created_at: string };
type Reveal = { name: string; client_id: string; client_secret: string };

export default function AppsPage() {
  const { account } = useNeobank();
  const party = account?.party || "";

  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [copied, setCopied] = useState("");
  const [amt, setAmt] = useState("49.99");
  const [link, setLink] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);

  const load = async () => {
    if (!party) return;
    const r = await fetch("/api/apps", { headers: { "x-wallet-address": party } });
    const j = await r.json().catch(() => ({ apps: [] }));
    setApps(j.apps || []);
  };

  useEffect(() => {
    (async () => {
      if (!party) { setLoading(false); return; }
      // Register the merchant user (idempotent upsert) so app creation succeeds.
      await fetch("/api/auth/sync", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet_address: party, email: account?.email }),
      }).catch(() => {});
      await load();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [party]);

  const copy = (k: string, v: string) => { navigator.clipboard?.writeText(v); setCopied(k); setTimeout(() => setCopied(""), 1200); };

  const createApp = async () => {
    if (!name.trim() || !party) return;
    setBusy(true); setErr(""); setReveal(null); setLink("");
    try {
      const r = await fetch("/api/apps", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet_address: party, name: name.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "create failed");
      setReveal({ name: j.app.name, client_id: j.app.client_id, client_secret: j.app.client_secret });
      setName("");
      await load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const rollSecret = async (app: App) => {
    setErr(""); setLink("");
    try {
      const r = await fetch(`/api/apps/${app._id}/roll-secret`, { method: "POST", headers: { "x-wallet-address": party } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "roll failed");
      const secret = j.client_secret || j.app?.client_secret;
      setReveal({ name: app.name, client_id: app.client_id, client_secret: secret });
    } catch (e: any) { setErr(e.message); }
  };

  // Generate a real billing link with the revealed app credentials.
  const makeLink = async () => {
    if (!reveal || !(Number(amt) > 0)) return;
    setLinkBusy(true); setLink("");
    try {
      const r = await fetch("/api/bills/create", {
        method: "POST",
        headers: { "content-type": "application/json", "x-client-id": reveal.client_id, "x-client-secret": reveal.client_secret },
        body: JSON.stringify({ amount: Number(amt), description: `Demo charge from ${reveal.name}` }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "bill failed");
      setLink(j.checkoutUrl);
    } catch (e: any) { setErr(e.message); } finally { setLinkBusy(false); }
  };

  if (loading) return <div className={page}><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;

  const field = "bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors w-full";
  const CopyBtn = ({ k, v }: { k: string; v: string }) => (
    <button onClick={() => copy(k, v)} className="shrink-0 p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors" title="Copy">
      {copied === k ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );

  return (
    <div className={page}>
      <PageHeader title="Apps & API keys" subtitle="Create an app to get checkout credentials — drop them into the Irion SDK on any store." />

      {/* Create app */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary mb-3"><KeyRound className="w-4 h-4" /> Create an app</div>
        <div className="flex items-center gap-2">
          <input className={field} placeholder="App name (e.g. Quantum Store)" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createApp()} disabled={busy} />
          <button onClick={createApp} disabled={busy || !name.trim()} className="shrink-0 bg-primary text-black px-4 py-2.5 rounded-xl font-black uppercase text-[11px] tracking-widest hover:scale-[1.02] transition-all flex items-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create
          </button>
        </div>
        {err && <p className="text-[11px] text-red-400 mt-2">{err}</p>}
      </Card>

      {/* Reveal new credentials + billing-link generator */}
      {reveal && (
        <Card className="mb-6 border-primary/40">
          <div className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">{reveal.name} — credentials</div>
          <p className="text-[11px] text-amber-400/80 mb-4">⚠ Copy the secret now — it is shown once.</p>
          <div className="flex flex-col gap-2">
            <div className="text-[10px] text-white/40 uppercase tracking-widest">Client ID</div>
            <div className="flex items-center gap-2"><code className="flex-1 bg-black/30 rounded-lg px-3 py-2 text-xs text-white/90 truncate">{reveal.client_id}</code><CopyBtn k="cid" v={reveal.client_id} /></div>
            <div className="text-[10px] text-white/40 uppercase tracking-widest mt-2">Client Secret</div>
            <div className="flex items-center gap-2"><code className="flex-1 bg-black/30 rounded-lg px-3 py-2 text-xs text-primary/90 truncate">{reveal.client_secret}</code><CopyBtn k="csk" v={reveal.client_secret} /></div>
          </div>

          <div className="border-t border-white/10 mt-5 pt-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/60 mb-3"><Link2 className="w-4 h-4 text-primary" /> Create a payment link</div>
            <div className="flex items-center gap-2">
              <input className={field} type="number" min={1} value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="Amount (USDC)" />
              <button onClick={makeLink} disabled={linkBusy} className="shrink-0 bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-widest text-white/80 hover:bg-white/10 transition-all flex items-center gap-2 disabled:opacity-50">
                {linkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Generate
              </button>
            </div>
            {link && (
              <div className="flex items-center gap-2 mt-3 bg-black/30 rounded-lg px-3 py-2">
                <code className="flex-1 text-[11px] text-white/80 truncate">{link}</code>
                <CopyBtn k="link" v={link} />
                <a href={link} target="_blank" rel="noreferrer" className="shrink-0 p-1.5 rounded-md bg-primary/15 text-primary hover:bg-primary/25 transition-colors" title="Open checkout"><ExternalLink className="w-3.5 h-3.5" /></a>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Existing apps */}
      <Card>
        <div className="text-[10px] text-white/40 uppercase tracking-widest mb-4">Your apps</div>
        {apps.length === 0 ? (
          <p className="text-xs text-white/30 py-6 text-center">No apps yet — create one above to get checkout credentials.</p>
        ) : (
          <div className="flex flex-col divide-y divide-white/5">
            {apps.map((a) => (
              <div key={a._id} className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold">{a.name}</div>
                  <code className="text-[10px] text-white/40">{a.client_id}</code>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[8px] font-black uppercase tracking-widest rounded px-1.5 py-0.5 border border-primary/20 bg-primary/10 text-primary">{a.status}</span>
                  <button onClick={() => rollSecret(a)} className="text-[9px] font-bold uppercase tracking-widest text-white/40 hover:text-primary transition-colors flex items-center gap-1" title="Reveal a fresh secret">
                    <RefreshCw className="w-3 h-3" /> Roll secret
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="text-[10px] text-white/30 mt-4 leading-relaxed">
        Use these in any store via <code className="text-white/50">@xorr-finance/irion-sdk</code> — <code className="text-white/50">createCheckout()</code> sends <code className="text-white/50">x-client-id</code> / <code className="text-white/50">x-client-secret</code> to your bills API, and the shopper pays on the Irion <code className="text-white/50">/pay</code> page. Settlement targets your Canton party.
      </p>
    </div>
  );
}
