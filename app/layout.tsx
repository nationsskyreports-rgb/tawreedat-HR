"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { LogOut, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { ToastContainer } from "@/components/toast"

// ── How long away before showing logout prompt ──────────────────
const AWAY_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [showLogoutPrompt, setShowLogoutPrompt] = useState(false)

  // ── 1. Back button ──────────────────────────────────────────────────────
  // On Android/PWA: intercept hardware back button so it never closes the app.
  // • /m (home)    → back does nothing (stay in PWA)
  // • sub-pages    → back goes to /m
  useEffect(() => {
    // Push a history entry so there's always something to pop
    window.history.pushState(null, "", window.location.pathname)

    function handlePopState() {
      if (window.location.pathname === "/m") {
        // We're already home — push state again to block app exit
        window.history.pushState(null, "", "/m")
      } else {
        // Navigate to home
        router.push("/m")
      }
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [pathname, router])

  // ── 2. Tab switch / background detection ───────────────────────────────
  // If user switches to another app and comes back after AWAY_TIMEOUT_MS,
  // show a "still there?" logout prompt.
  useEffect(() => {
    let hiddenAt: number | null = null

    function handleVisibility() {
      if (document.hidden) {
        hiddenAt = Date.now()
      } else if (hiddenAt !== null) {
        const awayMs = Date.now() - hiddenAt
        hiddenAt = null
        if (awayMs >= AWAY_TIMEOUT_MS) {
          setShowLogoutPrompt(true)
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [])

  // ── 3. Push notification subscription ──────────────────────────────────
  // Runs once. Asks permission if not yet granted, then saves subscription
  // to Supabase push_subscriptions table.
  useEffect(() => {
    async function initPush() {
      if (typeof window === "undefined") return
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
      if (Notification.permission === "denied") return
      // Skip if no VAPID key configured yet
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return

      try {
        const reg = await navigator.serviceWorker.ready

        // Already subscribed? Nothing to do.
        const existing = await reg.pushManager.getSubscription()
        if (existing) return

        // Ask permission
        const permission = await Notification.requestPermission()
        if (permission !== "granted") return

        // Subscribe
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
          ),
        })

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const keyBuf  = sub.getKey("p256dh")
        const authBuf = sub.getKey("auth")
        if (!keyBuf || !authBuf) return

        const p256dh = btoa(String.fromCharCode(...new Uint8Array(keyBuf)))
        const auth   = btoa(String.fromCharCode(...new Uint8Array(authBuf)))

        await supabase.from("push_subscriptions").upsert(
          {
            user_id:    user.id,
            endpoint:   sub.endpoint,
            p256dh,
            auth,
            user_agent: navigator.userAgent.slice(0, 255),
          },
          { onConflict: "user_id,endpoint" }
        )
      } catch (err) {
        console.warn("[Push] init failed:", err)
      }
    }

    initPush()
  }, [])

  // ── Logout helper ───────────────────────────────────────────────────────
  async function handleLogout() {
    setShowLogoutPrompt(false)
    await supabase.auth.signOut({ scope: "local" } as any)
    router.push("/login")
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">

      {/* Global toast overlay */}
      <ToastContainer />

      {/* Tab-switch logout prompt */}
      {showLogoutPrompt && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-6">
          <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-xs shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-foreground">Still there?</p>
              <button onClick={() => setShowLogoutPrompt(false)} className="text-muted-foreground">
                <X className="size-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              You&apos;ve been away for a while. Log out to keep your account secure?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogoutPrompt(false)}
                className="flex-1 py-2.5 bg-secondary text-foreground rounded-xl text-xs font-medium"
              >
                Stay Logged In
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2.5 bg-destructive/15 text-destructive rounded-xl text-xs font-medium flex items-center justify-center gap-1.5"
              >
                <LogOut className="size-3.5" /> Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {children}
    </div>
  )
}

// ── VAPID key conversion helper ─────────────────────────────────────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
