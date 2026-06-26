"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import {
  Wallet, ArrowLeftRight, TrendingUp, Loader2, AlertTriangle, ArrowDownToLine, Coins,
} from "lucide-react";
import * as nb from "@/lib/neobank";
import { PageHeader, Card, Stat, fmt, page, btn, btnGhost, input, label } from "@/components/neobank/ui";

const CURRENCIES = ["USDC", "EURC", "GBPC"] as const;
type Currency = (typeof CURRENCIES)[number];

type Treasury = {
  balances: { USDC: number; EURC: number; GBPC: number };
  cash: number;
  yieldShares: number;
  yieldValue: number;
  total: number;
};
type Rates = { source: string; rates: Record<string, number> };

export default function TreasuryPage() {
  const [treasury, setTreasury] = useState<Treasury | null>(null);
  const [rates, setRates] = useState<Rates | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // deposit form
  const [depAmount, setDepAmount] = useState("");
  const [depCurrency, setDepCurrency] = useState<Currency>("USDC");

  // fx rebalance form
  const [fxFrom, setFxFrom] = useState<Currency>("USDC");
  const [fxTo, setFxTo] = useState<Currency>("EURC");
  const [fxAmount, setFxAmount] = useState("");
  const [fxResult, setFxResult] = useState<{ bought: number; to: string; updateId: string } | null>(null);

  // yield form
  const [sweepAmount, setSweepAmount] = useState("");

  const refresh = useCallback(async () => {
    const t = await nb.getTreasury();
    setTreasury(t as Treasury);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, r] = await Promise.all([nb.getTreasury(), nb.getRates()]);
      setTreasury(t as Treasury);
      setRates(r as Rates);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // wrap a mutation: guard busy, clear error, run, refresh balances
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDeposit() {
    const amount = Number(depAmount);
    if (!amount || amount <= 0) { setError("Enter a deposit amount greater than 0."); return; }
    await run(async () => { await nb.deposit(amount, depCurrency); });
    setDepAmount("");
  }

  async function onRebalance() {
    const amount = Number(fxAmount);
    if (!amount || amount <= 0) { setError("Enter a rebalance amount greater than 0."); return; }
    if (fxFrom === fxTo) { setError("Pick two different currencies to rebalance."); return; }
    setFxResult(null);
    await run(async () => {
      const res = await nb.rebalance(fxFrom, fxTo, amount);
      setFxResult({ bought: res.bought, to: res.to, updateId: res.updateId });
    });
    setFxAmount("");
  }

  async function onSweep() {
    const amount = Number(sweepAmount);
    if (!amount || amount <= 0) { setError("Enter an amount to sweep greater than 0."); return; }
    await run(async () => { await nb.sweep(amount); });
    setSweepAmount("");
  }

  async function onRedeem() {
    await run(async () => { await nb.redeem(); });
  }

  // live rate for the selected fx pair
  const fxPair = `${fxFrom}:${fxTo}`;
  const fxRate = fxFrom === fxTo ? 1 : rates?.rates[fxPair];
  const fxReceive = fxRate != null && Number(fxAmount) > 0 ? Number(fxAmount) * fxRate : null;

  if (loading && !treasury) {
    return (
      <div className={page}>
        <PageHeader
          title="Treasury"
          subtitle="Multi-currency balances, FX rebalancing, and yield — all settled on Canton."
        />
        <div className="flex items-center justify-center gap-2.5 text-white/40 py-24">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-xs font-bold uppercase tracking-widest">Loading treasury…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={page}>
      <PageHeader
        title="Treasury"
        subtitle="Multi-currency balances, FX rebalancing, and yield — all settled on Canton."
      />

      {error && (
        <div className="flex items-center gap-2.5 bg-red-500/[0.07] border border-red-500/20 rounded-xl px-4 py-3 mb-6 text-red-300/90">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="text-xs font-bold">{error}</span>
        </div>
      )}

      {/* Balance stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {CURRENCIES.map((c) => (
          <Stat key={c} label={c} value={fmt(treasury?.balances[c])} sub="balance" />
        ))}
        <Stat label="Yield" value={fmt(treasury?.yieldValue)} sub="in pool" />
        <Stat label="Total (USDC + yield)" value={fmt(treasury?.total)} sub="USDC equiv." />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Deposit */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <ArrowDownToLine className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-black uppercase tracking-widest">Deposit</h2>
          </div>
          <p className="text-xs text-white/40 mb-4 leading-relaxed">
            Add funds to your treasury in any supported currency — settled on the Canton ledger.
          </p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="col-span-2">
              <label className={label}>Amount</label>
              <input
                type="number"
                min="0"
                step="any"
                value={depAmount}
                onChange={(e) => setDepAmount(e.target.value)}
                placeholder="0.00"
                className={`${input} mt-1`}
              />
            </div>
            <div>
              <label className={label}>Currency</label>
              <select
                value={depCurrency}
                onChange={(e) => setDepCurrency(e.target.value as Currency)}
                className={`${input} mt-1`}
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <button onClick={onDeposit} disabled={busy} className={`${btn} w-full`}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowDownToLine className="w-3.5 h-3.5" />}
            Deposit
          </button>
        </Card>

        {/* FX rebalance */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <ArrowLeftRight className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-black uppercase tracking-widest">FX Rebalance</h2>
          </div>
          <p className="text-xs text-white/40 mb-4 leading-relaxed">
            Convert between currencies at the live rate. Settled atomically on Canton.
          </p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className={label}>From</label>
              <select
                value={fxFrom}
                onChange={(e) => { setFxFrom(e.target.value as Currency); setFxResult(null); }}
                className={`${input} mt-1`}
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>To</label>
              <select
                value={fxTo}
                onChange={(e) => { setFxTo(e.target.value as Currency); setFxResult(null); }}
                className={`${input} mt-1`}
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Amount</label>
              <input
                type="number"
                min="0"
                step="any"
                value={fxAmount}
                onChange={(e) => setFxAmount(e.target.value)}
                placeholder="0.00"
                className={`${input} mt-1`}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 mb-4">
            <span className="text-white/40">
              Rate{" "}
              {fxFrom === fxTo ? (
                <span className="text-white/30">same currency</span>
              ) : fxRate != null ? (
                <span className="text-white/70 font-mono tabular-nums">1 {fxFrom} = {fmt(fxRate, 4)} {fxTo}</span>
              ) : (
                <span className="text-white/30">unavailable</span>
              )}
            </span>
            <span className="text-white/40">
              You receive{" "}
              <span className="text-primary font-mono tabular-nums">
                ≈ {fxReceive != null ? fmt(fxReceive) : "—"} {fxTo}
              </span>
            </span>
          </div>

          <button onClick={onRebalance} disabled={busy} className={`${btn} w-full`}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowLeftRight className="w-3.5 h-3.5" />}
            Rebalance
          </button>

          {fxResult && (
            <div className="mt-3 text-[11px] text-primary/90 bg-primary/[0.06] border border-primary/20 rounded-xl px-3 py-2.5">
              Bought <span className="font-mono tabular-nums font-bold">{fmt(fxResult.bought)} {fxResult.to}</span>
              <span className="text-white/40 font-mono ml-2">update {fxResult.updateId}</span>
            </div>
          )}
        </Card>

        {/* Yield */}
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-black uppercase tracking-widest">Yield</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
              <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Yield value</div>
              <div className="text-xl font-black tabular-nums">{fmt(treasury?.yieldValue)}</div>
              <div className="text-[11px] text-white/40 mt-1">USDC supplied + earned</div>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
              <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Pool shares</div>
              <div className="text-xl font-black tabular-nums">{fmt(treasury?.yieldShares)}</div>
              <div className="text-[11px] text-white/40 mt-1">your PoolShare</div>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
              <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Idle cash</div>
              <div className="text-xl font-black tabular-nums">{fmt(treasury?.cash)}</div>
              <div className="text-[11px] text-white/40 mt-1">available to sweep</div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1">
              <label className={label}>Amount to sweep (USDC)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={sweepAmount}
                onChange={(e) => setSweepAmount(e.target.value)}
                placeholder="0.00"
                className={`${input} mt-1`}
              />
            </div>
            <button onClick={onSweep} disabled={busy} className={`${btn} md:w-44`}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />}
              Sweep to yield
            </button>
            <button onClick={onRedeem} disabled={busy} className={`${btnGhost} md:w-44`}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
              Redeem all
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
