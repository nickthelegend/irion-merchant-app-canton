"use client"

import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

// The shell drives the Canton wallet SDK (Carpincho) — strictly client-side.
const DashboardShell = dynamic(() => import("@/components/console/DashboardShell"), {
  ssr: false,
  loading: () => (
    <div className="-mt-20 min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  ),
})

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
