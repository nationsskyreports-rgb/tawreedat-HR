"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  Truck, Mail, Lock, Loader2, AlertCircle,
  Fingerprint, Eye, EyeOff, ShieldCheck
} from "lucide-react"
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

  // After login, let middleware handle routing
  async function routeAfterLogin() {
    // Force a navigation to "/" — middleware will redirect employee → /m
    // and admin/hr/manager → /
    window.location.href = "/"
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
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

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="size-16 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg shadow-primary/30">
            <Truck className="size-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Tawreedat</h1>
          <p className="text-xs text-muted-foreground mt-1">HRIS · Logistics HR Platform</p>
        </div>

        {/* Biometric button */}
        {biometricAvailable && hasStoredBiometric && (
          <>
            <button
              onClick={handleBiometricLogin}
              disabled={biometricLoading || loading}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-2xl text-sm font-semibold hover:bg-primary/90 active:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mb-3 shadow-md shadow-primary/20"
            >
              {biometricLoading ? (
                <><Loader2 className="size-5 animate-spin" /> Verifying...</>
              ) : (
                <><Fingerprint className="size-5" /> Sign in with Biometric</>
              )}
            </button>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">or sign in with password</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          </>
        )}

        {/* Email/Password form */}
        <form
          onSubmit={handleEmailLogin}
          autoComplete="on"
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                id="email"
                type="email"
                name="email"
                required
                autoComplete="username email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full bg-secondary/60 text-foreground text-sm rounded-xl pl-10 pr-4 py-3 outline-none border border-transparent focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-secondary/60 text-foreground text-sm rounded-xl pl-10 pr-12 py-3 outline-none border border-transparent focus:border-primary transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || biometricLoading}
            className="w-full py-3 bg-foreground text-background rounded-xl text-sm font-semibold hover:opacity-90 active:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Sign In
          </button>
        </form>

        {/* Biometric hint */}
        {biometricAvailable && !hasStoredBiometric && (
          <div className="mt-5 p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-start gap-2">
            <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground">
              Sign in once, then go to <strong className="text-foreground">Profile → Enable Biometric Login</strong> for faster access with your fingerprint or Face ID.
            </p>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground text-center mt-8">
          © {new Date().getFullYear()} Tawreedat HRIS
        </p>
      </div>
    </div>
  )
}
