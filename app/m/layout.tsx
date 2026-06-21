"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {children}
      <MobileBottomNav />
    </div>
  )
}
