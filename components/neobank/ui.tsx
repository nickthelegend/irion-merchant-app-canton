"use client";

import { ReactNode } from "react";

/** money/number formatter */
export const fmt = (n: number | undefined | null, dp = 2) =>
  (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

export const short = (s: string | undefined, h = 8, t = 6) =>
  !s ? "" : s.length <= h + t + 1 ? s : `${s.slice(0, h)}…${s.slice(-t)}`;

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-white/40 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white/[0.03] border border-white/10 rounded-2xl p-5 ${className}`}>{children}</div>;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card>
      <div className="text-[10px] text-white/40 uppercase tracking-widest mb-2">{label}</div>
      <div className="text-2xl font-black tracking-tight">{value}</div>
      {sub && <div className="text-[11px] text-white/40 mt-1">{sub}</div>}
    </Card>
  );
}

export const page = "p-6 md:p-10 max-w-5xl mx-auto font-display";
export const btn = "bg-primary text-black px-4 py-2.5 rounded-xl font-black uppercase text-[11px] tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100";
export const btnGhost = "bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-widest text-white/70 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50";
export const input = "bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors w-full";
export const label = "text-[10px] text-white/40 uppercase tracking-widest";
