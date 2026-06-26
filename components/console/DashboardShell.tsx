"use client"

import Sidebar from "./Sidebar"

// The Canton wallet provider lives at the app root (components/Providers.tsx),
// so the sidebar + the global header share one connection.
export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    // pull up under the root header gap (header is hidden on /dashboard)
    <div className="-mt-20 min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  )
}
