"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Truck, Mail, Lock, Loader2, AlertCircle, Fingerprint, Eye, EyeOff } from "lucide-react"
import {
  isBiometricSupported, isPlatformAuthenticatorAvailable,
  authenticateWithBiometric, hasBiometricSession, getStoredEmail,
} from "@/lib/webauthn"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [biometricLoading, setBiometricLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [hasStoredBiometric, setHasStoredBiometric] = useState(false)

  useEffect(() => {
    async function checkBiometric() {
      if (!isBiometricSupported()) return
      const platformAvail = await isPlatformAuthenticatorAvailable()
      if (!platformAvail) return
      const stored = hasBiometricSession()
      setHasStoredBiometric(stored)
      setBiometricAvailable(true)
      if (stored) {
        const storedEmail = getStoredEmail()
        if (storedEmail) setEmail(storedEmail)
      }
    }
    checkBiometric()
  }, [])

  async function routeAfterLogin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role === "employee") router.push("/m")
    else router.push("/")
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: email.trim(), password,
    })
    setLoading(false)
    if (signInErr) { setError(signInErr.message); return }
    await routeAfterLogin()
  }

  async function handleBiometricLogin() {
    setError(null)
    setBiometricLoading(true)
    const result = await authenticateWithBiometric()
    setBiometricLoading(false)
    if (!result.ok) { setError(result.error); return }
    await routeAfterLogin()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="size-14 rounded-2xl bg-primary flex items-center justify-center mb-3">
            <Truck className="size-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Tawreedat HRIS</h1>
          <p className="text-xs text-muted-foreground mt-1">Sign in to continue</p>
        </div>

        {biometricAvailable && hasStoredBiometric && (
          <>
            <button
              onClick={handleBiometricLogin}
              disabled={biometricLoading || loading}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 active:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mb-3"
            >
              {biometricLoading ? (
                <><Loader2 className="size-5 animate-spin" /> Verifying...</>
              ) : (
                <><Fingerprint className="size-5" /> Sign in with Biometric</>
              )}
            </button>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground uppercase">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          </>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-secondary/60 text-foreground text-sm rounded-xl pl-10 pr-3 py-3 outline-none border border-transparent focus:border-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input type={showPassword ? "text" : "password"} required value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                className="w-full bg-secondary/60 text-foreground text-sm rounded-xl pl-10 pr-10 py-3 outline-none border border-transparent focus:border-primary"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs">
              <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading || biometricLoading}
            className="w-full py-3 bg-foreground text-background rounded-xl text-sm font-semibold hover:opacity-90 active:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Sign in
          </button>
        </form>

        {biometricAvailable && !hasStoredBiometric && (
          <p className="text-[11px] text-muted-foreground text-center mt-6">
            💡 Sign in once, then enable <strong>Fingerprint / Face ID</strong> from your profile for faster access.
          </p>
        )}

        <p className="text-[10px] text-muted-foreground text-center mt-8">
          Tawreedat HRIS · Logistics HR Platform
        </p>
      </div>
    </div>
  )
}
