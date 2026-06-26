"use client";

import { Power, Fingerprint } from "lucide-react";
import { useNeobank } from "@/components/neobank/auth";
import { PageHeader, Card, page, btnGhost, short } from "@/components/neobank/ui";

function Row({ k, v, mono }: { k: string; v: any; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <span className="text-[11px] text-white/40">{k}</span>
      <span className={`text-sm text-white/80 ${mono ? "font-mono text-xs" : ""}`}>{v || "—"}</span>
    </div>
  );
}

export default function Settings() {
  const { account, logout } = useNeobank();
  return (
    <div className={page}>
      <PageHeader title="Settings" subtitle="Your account, identity, and security." />
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <div className="text-[10px] text-white/40 uppercase tracking-widest mb-3">Account</div>
          <Row k="Business" v={account?.name} />
          <Row k="Email" v={account?.email} />
          <Row k="Canton party" v={short(account?.party, 14, 10)} mono />
          <Row k="Member since" v={account?.createdAt ? new Date(account.createdAt).toLocaleDateString() : "—"} />
        </Card>
        <Card>
          <div className="text-[10px] text-white/40 uppercase tracking-widest mb-3 flex items-center gap-2"><Fingerprint className="w-3.5 h-3.5" /> Security</div>
          <p className="text-xs text-white/50 leading-relaxed mb-4">
            This account is secured by a <b className="text-white/80">passkey</b> — Touch ID, Windows Hello, or a FIDO2 key, synced across your devices. High-value actions require a fresh passkey step-up. Your operational Canton key is custodied (encrypted at rest) so scheduled treasury rebalancing and payroll can run unattended.
          </p>
          <button onClick={logout} className={`${btnGhost} w-full hover:text-red-400 hover:border-red-500/40`}>
            <Power className="w-3.5 h-3.5" /> Sign out
          </button>
        </Card>
      </div>
    </div>
  );
}
