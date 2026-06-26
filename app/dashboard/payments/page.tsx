"use client";

import { useEffect, useState } from "react";
import { Send, Loader2, ArrowLeftRight } from "lucide-react";
import * as nb from "@/lib/neobank";
import { PageHeader, Card, fmt, short, page, btn, input, label } from "@/components/neobank/ui";

export default function Payments() {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USDC");
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const load = async () => {
    try { const e = await nb.getEvents(); setEvents((e.events || []).filter((x: any) => x.type === "transfer.sent")); }
    catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  async function send() {
    setErr(""); setOk(""); setBusy(true);
    try {
      const r = await nb.transfer(to.trim(), Number(amount), currency);
      setOk(`Sent ${amount} ${currency} · settled ${short(r.updateId)}`);
      setTo(""); setAmount(""); await load();
    } catch (e: any) { setErr(e?.message || "transfer failed"); } finally { setBusy(false); }
  }

  return (
    <div className={page}>
      <PageHeader title="Payments" subtitle="Send any currency to any Canton party — instant, atomic settlement." />
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <div className="text-[10px] text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2"><Send className="w-3.5 h-3.5" /> Send a payment</div>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1"><span className={label}>Recipient — Canton party id</span>
              <input className={input} value={to} onChange={(e) => setTo(e.target.value)} placeholder="party::1220…" /></label>
            <div className="grid grid-cols-3 gap-2">
              <label className="col-span-2 flex flex-col gap-1"><span className={label}>Amount</span>
                <input className={input} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" /></label>
              <label className="flex flex-col gap-1"><span className={label}>Currency</span>
                <select className={input} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option>USDC</option><option>EURC</option><option>GBPC</option>
                </select></label>
            </div>
            {err && <p className="text-[11px] text-red-400">{err}</p>}
            {ok && <p className="text-[11px] text-primary">{ok}</p>}
            <button className={btn} onClick={send} disabled={busy || !to || !amount}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send payment
            </button>
          </div>
        </Card>
        <Card>
          <div className="text-[10px] text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2"><ArrowLeftRight className="w-3.5 h-3.5" /> Recent transfers</div>
          {loading ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : events.length === 0 ? (
            <p className="text-xs text-white/30 py-4 text-center">No transfers yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-white/5">
              {events.slice(0, 10).map((e: any) => (
                <div key={e.id} className="py-2.5 text-xs flex items-center justify-between">
                  <span className="text-white/70">{fmt(e.data?.amount)} {e.data?.currency} → <code className="text-white/40">{short(e.data?.to)}</code></span>
                  <span className="text-white/30">{new Date(e.createdAt).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
