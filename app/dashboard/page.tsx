"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, Landmark, Users, ArrowRight, Loader2 } from "lucide-react";
import { useNeobank } from "@/components/neobank/auth";
import * as nb from "@/lib/neobank";
import { PageHeader, Card, Stat, fmt, page } from "@/components/neobank/ui";

export default function Overview() {
  const { account } = useNeobank();
  const [t, setT] = useState<any>(null);
  const [credit, setCredit] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [tt, c, e] = await Promise.all([
          nb.getTreasury(),
          nb.getCredit().catch(() => ({ credit: null })),
          nb.getEvents().catch(() => ({ events: [] })),
        ]);
        setT(tt); setCredit(c.credit); setEvents(e.events || []);
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className={page}><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;
  const balances: Record<string, number> = t?.balances || {};

  return (
    <div className={page}>
      <PageHeader title={`Welcome, ${account?.name || "there"}`} subtitle="Your programmable treasury on Canton — private by construction." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Stat label="Treasury (USDC)" value={`$${fmt(t?.cash)}`} sub={`total incl. yield $${fmt(t?.total)}`} />
        <Stat label="Yield position" value={`$${fmt(t?.yieldValue)}`} sub={`${fmt(t?.yieldShares, 0)} shares`} />
        <Stat label="Credit available" value={credit ? `$${fmt(credit.available)}` : "—"} sub={credit ? `of $${fmt(credit.creditLimit)} · score ${credit.score}` : "not underwritten yet"} />
        <Stat label="Currencies" value={Object.keys(balances).length || 1} sub={Object.keys(balances).join(" · ") || "USDC"} />
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {[
          { href: "/dashboard/treasury", label: "Move & rebalance", desc: "Deposit, FX swap USDC↔EURC, earn yield", icon: Wallet },
          { href: "/dashboard/payroll", label: "Run payroll", desc: "Private salaries — each invisible to others", icon: Users },
          { href: "/dashboard/lending", label: "Borrow", desc: "Working capital against your credit line", icon: Landmark },
        ].map((q) => (
          <Link key={q.href} href={q.href}>
            <Card className="hover:border-primary/40 transition-colors group h-full">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary"><q.icon className="w-4 h-4" /></div>
                <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-primary transition-colors" />
              </div>
              <div className="font-bold text-sm">{q.label}</div>
              <div className="text-[11px] text-white/40 mt-1">{q.desc}</div>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <div className="text-[10px] text-white/40 uppercase tracking-widest mb-4">Recent activity</div>
        {events.length === 0 ? (
          <p className="text-xs text-white/30 py-4 text-center">No activity yet — deposit to your treasury to begin.</p>
        ) : (
          <div className="flex flex-col divide-y divide-white/5">
            {events.slice(0, 8).map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2.5 text-xs">
                <span className="font-mono text-primary/80">{e.type}</span>
                <span className="text-white/30">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
