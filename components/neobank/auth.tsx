"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import * as nb from "@/lib/neobank";

interface Ctx {
  account: nb.Account | null;
  loading: boolean;
  register: (name: string, email: string) => Promise<void>;
  login: (email: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}
const AuthCtx = createContext<Ctx | null>(null);
export const useNeobank = () => {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useNeobank must be used inside <NeobankAuthProvider>");
  return c;
};

export function NeobankAuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<nb.Account | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!nb.getSession()) { setAccount(null); return; }
    try { const { account } = await nb.me(); setAccount(account); }
    catch { nb.logout(); setAccount(null); }
  }, []);

  useEffect(() => { void refresh().finally(() => setLoading(false)); }, [refresh]);

  const register = useCallback(async (name: string, email: string) => { setAccount(await nb.register(name, email)); }, []);
  const login = useCallback(async (email: string) => { setAccount(await nb.login(email)); }, []);
  const logout = useCallback(() => { nb.logout(); setAccount(null); }, []);

  return <AuthCtx.Provider value={{ account, loading, register, login, logout, refresh }}>{children}</AuthCtx.Provider>;
}
