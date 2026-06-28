"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Wallet, Users, Landmark, ArrowLeftRight, Settings, Power, ShieldCheck, KeyRound } from "lucide-react";
import { useNeobank } from "@/components/neobank/auth";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/dashboard/apps", label: "Apps & Keys", icon: KeyRound },
  { href: "/dashboard/treasury", label: "Treasury", icon: Wallet },
  { href: "/dashboard/payroll", label: "Payroll", icon: Users },
  { href: "/dashboard/lending", label: "Lending", icon: Landmark },
  { href: "/dashboard/payments", label: "Payments", icon: ArrowLeftRight },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];
const short = (s: string, h = 8, t = 6) => (s.length <= h + t + 1 ? s : `${s.slice(0, h)}…${s.slice(-t)}`);

export default function Sidebar() {
  const pathname = usePathname();
  const { account, logout } = useNeobank();

  return (
    <aside className="w-60 shrink-0 min-h-screen bg-white/[0.02] border-r border-white/10 flex flex-col font-display">
      <div className="h-20 flex items-center gap-2 px-6 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center"><ShieldCheck className="w-4 h-4 text-primary" /></div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-black tracking-tight">Irion</span>
          <span className="text-[9px] text-white/40 uppercase tracking-widest">Neobank · Canton</span>
        </div>
      </div>

      <nav className="flex-1 p-3 flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/dashboard" ? pathname === "/dashboard" : pathname?.startsWith(href);
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${active ? "bg-primary/10 text-primary" : "text-white/55 hover:text-white hover:bg-white/5"}`}>
              <Icon className="w-4 h-4" /> {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <div className="flex flex-col gap-2 bg-white/[0.03] border border-white/10 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[10px] text-white/60 font-mono uppercase truncate">Passkey · {account?.name}</span>
          </div>
          <code className="text-[10px] text-white/80 break-all" title={account?.party}>{account?.party ? short(account.party) : account?.email}</code>
          <button onClick={logout}
            className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-red-400 transition-colors mt-1">
            <Power className="w-3 h-3" /> Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
