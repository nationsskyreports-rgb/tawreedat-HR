"use client"

import { useEffect } from "react"

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Register service worker for PWA
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.error("SW registration failed:", err))
    }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}
