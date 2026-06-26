"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Landmark, Gauge, Wallet, TrendingUp, Loader2, AlertTriangle,
  ShieldCheck, Sparkles, Banknote, CheckCircle2,
} from "lucide-react";
import * as nb from "@/lib/neobank";
import { PageHeader, Card, Stat, fmt, short, page, btn, btnGhost, input, label } from "@/components/neobank/ui";

type Credit = {
  creditLimit: number;
  outstanding: number;
  available: number;
  score: number;
  repayments: number;
} | null;

type Signals = {
  treasuryTotal: number;
  repayments: number;
  depthPts: number;
  historyPts: number;
};

type Loan = {
  id: string;
  principal: number;
  principalRepaid: number;
  outstanding: number;
  collateral: number;
  kind: "unsecured" | "bnpl";
  status: string;
  dueTime?: string;
};

export default function LendingPage() {
  const [credit, setCredit] = useState<Credit>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [signals, setSignals] = useState<Signals | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // which action is running
  const [error, setError] = useState<string | null>(null);

  // draw form
  const [drawAmount, setDrawAmount] = useState("");
  const [termDays, setTermDays] = useState("30");

  // per-loan repay inputs
  const [repayInputs, setRepayInputs] = useState<Record<string, string>>({});

  const available = credit?.available ?? 0;

  const loadCredit = useCallback(async () => {
    const { credit } = await nb.getCredit();
    setCredit(credit);
  }, []);

  const loadLoans = useCallback(async () => {
    const { loans } = await nb.getLoans();
    setLoans(loans || []);
  }, []);

  useEffect(() => {
    (async () => {
      setError(null);
      try {
        await Promise.all([loadCredit(), loadLoans()]);
      } catch (e: any) {
        setError(e?.message || "Failed to load lending data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadCredit, loadLoans]);

  const handleUnderwrite = async () => {
    setBusy("underwrite");
    setError(null);
    try {
      const res = await nb.underwrite();
      setSignals(res.signals);
      // underwrite returns the fresh credit too; refresh from source to stay canonical
      setCredit(res.credit ?? null);
      await loadCredit();
    } catch (e: any) {
      setError(e?.message || "Underwriting failed.");
    } finally {
      setBusy(null);
    }
  };

  const handleDraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(drawAmount);
    if (!amount || amount <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }
    setBusy("draw");
    setError(null);
    try {
      await nb.drawLoan(amount, Number(termDays) || 30);
      setDrawAmount("");
      await Promise.all([loadLoans(), loadCredit()]);
    } catch (e: any) {
      // ledger rejects if score < 600 or amount > available — surface it verbatim
      setError(e?.message || "Draw rejected by the ledger.");
    } finally {
      setBusy(null);
    }
  };

  const handleRepay = async (id: string) => {
    const amount = Number(repayInputs[id]);
    if (!amount || amount <= 0) {
      setError("Enter a repayment amount greater than 0.");
      return;
    }
    setBusy(`repay:${id}`);
    setError(null);
    try {
      await nb.repayLoan(id, amount);
      setRepayInputs((p) => ({ ...p, [id]: "" }));
      await Promise.all([loadLoans(), loadCredit()]);
    } catch (e: any) {
      setError(e?.message || "Repayment rejected by the ledger.");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className={page}>
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  const activeLoans = loans.filter((l) => l.outstanding > 0 || l.status?.toLowerCase() === "active");

  return (
    <div className={page}>
      <PageHeader
        title="Lending"
        subtitle="Working capital against your credit line — underwritten from real on-ledger signals, private by construction."
      />

      {error && (
        <div className="flex items-start gap-2.5 bg-red-500/[0.07] border border-red-500/20 rounded-xl px-4 py-3 mb-6 text-red-300/90">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="text-xs font-medium leading-relaxed">{error}</span>
        </div>
      )}

      {/* ---- Credit line ---- */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white/60">
            <Gauge className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Credit line</span>
          </div>
          <button onClick={handleUnderwrite} disabled={busy !== null} className={btnGhost}>
            {busy === "underwrite" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {credit ? "Re-assess" : "Underwrite"}
          </button>
        </div>

        {credit ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Score" value={credit.score} sub={credit.score < 600 ? "below draw threshold" : "eligible to draw"} />
            <Stat label="Credit limit" value={`$${fmt(credit.creditLimit)}`} />
            <Stat label="Available" value={`$${fmt(credit.available)}`} sub={available <= 0 ? "underwrite to unlock" : "ready to draw"} />
            <Stat label="Outstanding" value={`$${fmt(credit.outstanding)}`} sub={`${fmt(credit.repayments, 0)} repayments`} />
          </div>
        ) : (
          <div className="flex items-start gap-3 py-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              No credit line yet. Hit <span className="text-white/80 font-bold">Underwrite</span> to score your account
              from real on-ledger signals — treasury depth and repayment history. Nothing is hardcoded.
            </p>
          </div>
        )}

        {signals && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary/70 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> Computed from on-ledger data
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-white/40 font-mono tabular-nums">
              <span>treasury depth <span className="text-white/70">+{fmt(signals.depthPts, 0)} pts</span></span>
              <span>history <span className="text-white/70">+{fmt(signals.historyPts, 0)} pts</span></span>
              <span>treasury total <span className="text-white/70">${fmt(signals.treasuryTotal)}</span></span>
              <span>repayments <span className="text-white/70">{fmt(signals.repayments, 0)}</span></span>
            </div>
          </div>
        )}
      </Card>

      {/* ---- Draw working capital ---- */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 text-white/60 mb-4">
          <Banknote className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Draw working capital</span>
        </div>

        {available <= 0 && (
          <div className="flex items-center gap-2.5 bg-amber-500/[0.07] border border-amber-500/20 rounded-xl px-4 py-3 mb-4 text-amber-300/90">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="text-xs font-medium">
              No credit available — run <span className="font-bold">Underwrite</span> above to unlock a line first.
            </span>
          </div>
        )}

        <form onSubmit={handleDraw} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-3 items-end">
          <div>
            <div className={label + " mb-1.5"}>Amount (USDC)</div>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={drawAmount}
              onChange={(e) => setDrawAmount(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <div className={label + " mb-1.5"}>Term (days)</div>
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              placeholder="30"
              value={termDays}
              onChange={(e) => setTermDays(e.target.value)}
              className={input}
            />
          </div>
          <button type="submit" disabled={busy !== null || available <= 0} className={btn}>
            {busy === "draw" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
            Draw
          </button>
        </form>
        <p className="text-[11px] text-white/30 mt-3">
          {available > 0 ? `Up to $${fmt(available)} available · ` : ""}
          The ledger rejects draws if your score is below 600 or the amount exceeds your available line.
        </p>
      </Card>

      {/* ---- Active loans ---- */}
      <Card>
        <div className="flex items-center gap-2 text-white/60 mb-4">
          <Landmark className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Active loans</span>
        </div>

        {activeLoans.length === 0 ? (
          <p className="text-xs text-white/30 py-6 text-center">
            No active loans. Draw working capital above to get started.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-white/5">
            {activeLoans.map((l) => (
              <div key={l.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <code className="text-[11px] font-mono text-primary/80">{short(l.id)}</code>
                    <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/5 text-white/50">
                      {l.kind}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-primary/70">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" /> {l.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-5 text-xs tabular-nums">
                    <span className="text-white/40">
                      principal <span className="text-white/80 font-bold">${fmt(l.principal)}</span>
                    </span>
                    <span className="text-white/40">
                      outstanding <span className="text-white/80 font-bold">${fmt(l.outstanding)}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder={`Repay up to $${fmt(l.outstanding)}`}
                    value={repayInputs[l.id] ?? ""}
                    onChange={(e) => setRepayInputs((p) => ({ ...p, [l.id]: e.target.value }))}
                    className={input}
                  />
                  <button
                    onClick={() => handleRepay(l.id)}
                    disabled={busy !== null}
                    className={btnGhost + " shrink-0"}
                  >
                    {busy === `repay:${l.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
                    Repay
                  </button>
                </div>

                {l.collateral > 0 && (
                  <p className="text-[10px] text-white/30 mt-2 font-mono tabular-nums">
                    collateral ${fmt(l.collateral)}
                    {l.dueTime ? ` · due ${new Date(l.dueTime).toLocaleDateString()}` : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
