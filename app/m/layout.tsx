"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { LogOut, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { ToastContainer } from "@/components/toast"
import { syncBiometricSession } from "@/lib/webauthn"

const AWAY_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [showLogoutPrompt, setShowLogoutPrompt] = useState(false)

  // ── 1. Back button ──────────────────────────────────────────────────────
  useEffect(() => {
    window.history.pushState(null, "", window.location.pathname)

    function handlePopState() {
      if (window.location.pathname === "/m") {
        window.history.pushState(null, "", "/m")
      } else {
        router.push("/m")
      }
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [pathname, router])

  // ── 2. Tab switch detection ─────────────────────────────────────────────
  useEffect(() => {
    let hiddenAt: number | null = null

    function handleVisibility() {
      if (document.hidden) {
        hiddenAt = Date.now()
      } else if (hiddenAt !== null) {
        const awayMs = Date.now() - hiddenAt
        hiddenAt = null
        if (awayMs >= AWAY_TIMEOUT_MS) setShowLogoutPrompt(true)
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [])

  // ── 2b. Keep biometric token snapshot fresh (tokens rotate) ─────────────
  useEffect(() => {
    syncBiometricSession()
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        syncBiometricSession()
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // ── 3. Push subscription ────────────────────────────────────────────────
  useEffect(() => {
    async function initPush() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
      if (Notification.permission === "denied") return
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return

      try {
        const reg = await navigator.serviceWorker.ready
        const existing = await reg.pushManager.getSubscription()
        if (existing) return

        const permission = await Notification.requestPermission()
        if (permission !== "granted") return

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        })

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const keyBuf  = sub.getKey("p256dh")
        const authBuf = sub.getKey("auth")
        if (!keyBuf || !authBuf) return

        await supabase.from("push_subscriptions").upsert({
          user_id:    user.id,
          endpoint:   sub.endpoint,
          p256dh:     btoa(String.fromCharCode(...new Uint8Array(keyBuf))),
          auth:       btoa(String.fromCharCode(...new Uint8Array(authBuf))),
          user_agent: navigator.userAgent.slice(0, 255),
        }, { onConflict: "user_id,endpoint" })
      } catch (err) {
        console.warn("[Push] init failed:", err)
      }
    }

    initPush()
  }, [])

  async function handleLogout() {
    setShowLogoutPrompt(false)
    await supabase.auth.signOut({ scope: "local" } as any)
    router.push("/login")
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      <ToastContainer />

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
              <button onClick={() => setShowLogoutPrompt(false)}
                className="flex-1 py-2.5 bg-secondary text-foreground rounded-xl text-xs font-medium">
                Stay Logged In
              </button>
              <button onClick={handleLogout}
                className="flex-1 py-2.5 bg-destructive/15 text-destructive rounded-xl text-xs font-medium flex items-center justify-center gap-1.5">
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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
