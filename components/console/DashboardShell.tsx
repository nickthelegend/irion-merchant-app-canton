"use client";

import { Loader2 } from "lucide-react";
import { NeobankAuthProvider, useNeobank } from "@/components/neobank/auth";
import Login from "@/components/neobank/Login";
import Sidebar from "./Sidebar";

// Passkey-gated neobank console. Unauthenticated → the passkey login screen;
// authenticated → the sidebar + the requested page (which talks to irion-b2b-api).
function Gate({ children }: { children: React.ReactNode }) {
  const { account, loading } = useNeobank();
  if (loading) {
    return (
      <div className="-mt-20 min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }
  if (!account) return <div className="-mt-20"><Login /></div>;
  return (
    <div className="-mt-20 min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <NeobankAuthProvider>
      <Gate>{children}</Gate>
    </NeobankAuthProvider>
  );
}
