"use client";

import { useState } from "react";
import { Loader2, Fingerprint, ShieldCheck, ArrowRight } from "lucide-react";
import { useNeobank } from "./auth";

export default function Login() {
  const { login, register } = useNeobank();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setErr(""); setBusy(true);
    try {
      if (mode === "register") {
        if (!name.trim() || !email.trim()) throw new Error("name and email are required");
        await register(name.trim(), email.trim());
      } else {
        if (!email.trim()) throw new Error("email is required");
        await login(email.trim());
      }
    } catch (e: any) {
      setErr(e?.name === "NotAllowedError" ? "passkey prompt was dismissed — try again" : (e?.message || "failed"));
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4 font-display">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center"><ShieldCheck className="w-6 h-6 text-primary" /></div>
          <h1 className="text-xl font-black tracking-tight">Irion Neobank</h1>
          <p className="text-[11px] text-white/40 uppercase tracking-widest">Programmable banking on Canton</p>
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex gap-1 bg-white/5 rounded-xl p-1 text-xs font-bold">
            {(["login", "register"] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setErr(""); }}
                className={`flex-1 py-2 rounded-lg transition-colors ${mode === m ? "bg-primary text-black" : "text-white/50 hover:text-white"}`}>
                {m === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          {mode === "register" && (
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-white/40 uppercase tracking-widest">Business name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc."
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors" />
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-white/40 uppercase tracking-widest">Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@acme.com"
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors" />
          </label>

          {err && <p className="text-[11px] text-red-400">{err}</p>}

          <button onClick={submit} disabled={busy}
            className="w-full bg-primary text-black px-4 py-3 rounded-xl font-black uppercase text-[11px] tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
            {busy ? "Waiting for passkey…" : mode === "register" ? "Create with passkey" : "Sign in with passkey"}
            {!busy && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
          <p className="text-[10px] text-white/30 text-center leading-relaxed">
            No password. Uses your device passkey — Touch ID, Windows Hello, or a security key. Synced across your devices.
          </p>
        </div>
      </div>
    </div>
  );
}
