'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useStellarWallet } from '@/lib/stellar-wallet';
import { explorerTx } from '@/lib/stellar';

type Analytics = {
  settledCount: number;
  settledVolume: number;
  pendingCount: number;
  totalBills: number;
  apps: number;
  recent: { hash: string; amount: number; asset: string; app: string; txHash: string | null; description: string; paidAt: string }[];
  perApp: { app: string; count: number; volume: number }[];
};

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function AnalyticsPage() {
  const { address } = useStellarWallet();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) { setLoading(false); return; }
    setLoading(true);
    fetch('/api/analytics', { headers: { 'x-wallet-address': address } })
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  const cards = [
    { label: 'Settled with Irion', value: data ? String(data.settledCount) : '—', sub: 'transactions' },
    { label: 'Settled volume', value: data ? `$${fmt(data.settledVolume)}` : '—', sub: 'USDC on Stellar' },
    { label: 'Pending', value: data ? String(data.pendingCount) : '—', sub: 'awaiting payment' },
    { label: 'Conversion', value: data && data.totalBills > 0 ? `${Math.round((data.settledCount / data.totalBills) * 100)}%` : '—', sub: 'bills settled' },
  ];
  const maxVol = data && data.perApp.length ? Math.max(...data.perApp.map((a) => a.volume), 1) : 1;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 font-mono text-foreground">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <span className="text-[10px] tracking-[0.4em] text-primary/70 uppercase">Irion // Merchant Analytics</span>
          <h1 className="text-3xl font-black uppercase tracking-tighter mt-1">Settlement Analytics</h1>
        </div>
        <Link href="/dashboard" className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">← Dashboard</Link>
      </div>

      {!address ? (
        <div className="border border-white/10 rounded-2xl p-12 text-center text-sm text-foreground/50">Connect your wallet to view analytics.</div>
      ) : loading ? (
        <div className="border border-white/10 rounded-2xl p-12 text-center text-sm text-foreground/50">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {cards.map((c) => (
              <div key={c.label} className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                <div className="text-[10px] uppercase tracking-widest text-foreground/40 mb-2">{c.label}</div>
                <div className="text-3xl font-black tracking-tighter text-primary">{c.value}</div>
                <div className="text-[10px] text-foreground/30 uppercase mt-1">{c.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent settlements */}
            <div className="lg:col-span-2 bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 text-[10px] font-black uppercase tracking-widest text-foreground/40">Recent settlements</div>
              {(!data || data.recent.length === 0) ? (
                <div className="px-6 py-12 text-center text-sm text-foreground/40">No settled payments yet.</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {data.recent.map((r) => (
                    <div key={r.hash} className="px-6 py-4 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate">{r.description || r.app}</div>
                        <div className="text-[10px] text-foreground/40 uppercase tracking-wide">{r.app} · {new Date(r.paidAt).toLocaleDateString()}</div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <span className="text-sm font-black text-primary">${fmt(r.amount)} {r.asset}</span>
                        {r.txHash ? (
                          <a href={explorerTx(r.txHash)} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary/60 hover:text-primary underline">tx ↗</a>
                        ) : <span className="text-[10px] text-foreground/20">—</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Per-app volume */}
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 text-[10px] font-black uppercase tracking-widest text-foreground/40">By store</div>
              {(!data || data.perApp.length === 0) ? (
                <div className="px-6 py-12 text-center text-sm text-foreground/40">No data.</div>
              ) : (
                <div className="p-6 space-y-4">
                  {data.perApp.map((a) => (
                    <div key={a.app}>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="font-bold truncate">{a.app}</span>
                        <span className="text-primary font-black">${fmt(a.volume)}</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${(a.volume / maxVol) * 100}%` }} />
                      </div>
                      <div className="text-[9px] text-foreground/30 uppercase mt-1">{a.count} settled</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
