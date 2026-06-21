"use client"

export const dynamic = "force-dynamic"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  Truck, Mail, Lock, Loader2, AlertCircle,
  Fingerprint, Eye, EyeOff, CheckCircle2, Hash, User, ShieldCheck
} from "lucide-react"
import {
  isBiometricSupported, isPlatformAuthenticatorAvailable,
  authenticateWithBiometric, hasBiometricSession, getStoredEmail,
} from "@/lib/webauthn"

type Tab = "signin" | "signup"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlError = searchParams.get("error")

  const [tab, setTab] = useState<Tab>("signin")

  // Sign in state
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(urlError)

  // Sign up state
  const [signupEmail, setSignupEmail] = useState("")
  const [signupFullName, setSignupFullName] = useState("")
  const [signupEmployeeNo, setSignupEmployeeNo] = useState("")
  const [signupPassword, setSignupPassword] = useState("")
  const [signupConfirm, setSignupConfirm] = useState("")
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupError, setSignupError] = useState<string | null>(null)
  const [signupDone, setSignupDone] = useState(false)

  // Biometric
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [hasStoredBiometric, setHasStoredBiometric] = useState(false)
  const [biometricLoading, setBiometricLoading] = useState(false)

  useEffect(() => {
    async function checkBiometric() {
      if (!isBiometricSupported()) return
      const ok = await isPlatformAuthenticatorAvailable()
      if (!ok) return
      const stored = hasBiometricSession()
      setHasStoredBiometric(stored)
      setBiometricAvailable(true)
      if (stored) {
        const e = getStoredEmail()
        if (e) setEmail(e)
      }
    }
    checkBiometric()
  }, [])

  function routeAfterLogin() {
    window.location.href = "/"
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    routeAfterLogin()
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setSignupError(null)

    if (!signupFullName.trim()) return setSignupError("Full name is required")
    if (!signupEmployeeNo.trim()) return setSignupError("Employee number is required")
    if (signupPassword.length < 8) return setSignupError("Password must be at least 8 characters")
    if (signupPassword !== signupConfirm) return setSignupError("Passwords do not match")

    setSignupLoading(true)

    const { error: err } = await supabase.auth.signUp({
      email: signupEmail.trim(),
      password: signupPassword,
      options: {
        data: {
          full_name: signupFullName.trim(),
          employee_no: signupEmployeeNo.trim().toUpperCase(),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setSignupLoading(false)

    if (err) {
      setSignupError(err.message)
      return
    }

    setSignupDone(true)
  }

  async function handleBiometricLogin() {
    setError(null)
    setBiometricLoading(true)
    const result = await authenticateWithBiometric()
    setBiometricLoading(false)
    if (!result.ok) { setError(result.error); return }
    routeAfterLogin()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="size-16 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg shadow-primary/20">
            <Truck className="size-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Tawreedat</h1>
          <p className="text-xs text-muted-foreground mt-1">HRIS · Logistics HR Platform</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-secondary/60 rounded-xl p-1 mb-6">
          <button
            onClick={() => { setTab("signin"); setError(null) }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === "signin"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setTab("signup"); setSignupError(null); setSignupDone(false) }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === "signup"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* ── SIGN IN ── */}
        {tab === "signin" && (
          <div className="space-y-4">
            {biometricAvailable && hasStoredBiometric && (
              <>
                <button
                  onClick={handleBiometricLogin}
                  disabled={biometricLoading || loading}
                  className="w-full py-3.5 bg-primary text-primary-foreground rounded-2xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-md shadow-primary/20"
                >
                  {biometricLoading
                    ? <><Loader2 className="size-5 animate-spin" /> Verifying...</>
                    : <><Fingerprint className="size-5" /> Sign in with Biometric</>
                  }
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] text-muted-foreground">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              </>
            )}

            <form onSubmit={handleSignIn} autoComplete="on" className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <input
                    id="email" type="email" name="email" required
                    autoComplete="username email"
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-secondary/60 text-foreground text-sm rounded-xl pl-10 pr-4 py-3 outline-none border border-transparent focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <input
                    id="password" type={showPassword ? "text" : "password"} name="password" required
                    autoComplete="current-password"
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-secondary/60 text-foreground text-sm rounded-xl pl-10 pr-12 py-3 outline-none border border-transparent focus:border-primary transition-colors"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" tabIndex={-1}>
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

              <button type="submit" disabled={loading || biometricLoading}
                className="w-full py-3 bg-foreground text-background rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {loading && <Loader2 className="size-4 animate-spin" />}
                Sign In
              </button>
            </form>

            {biometricAvailable && !hasStoredBiometric && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-start gap-2">
                <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground">
                  Enable <strong className="text-foreground">Fingerprint / Face ID</strong> from your profile for faster sign-in.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── SIGN UP ── */}
        {tab === "signup" && (
          <>
            {signupDone ? (
              <div className="text-center space-y-4">
                <div className="size-16 mx-auto rounded-full bg-chart-3/15 flex items-center justify-center">
                  <CheckCircle2 className="size-8 text-chart-3" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Check your email!</h2>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    We sent a confirmation link to<br />
                    <strong className="text-foreground">{signupEmail}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                    Click the link in the email to activate your account, then sign in.
                  </p>
                </div>
                <button
                  onClick={() => { setTab("signin"); setSignupDone(false) }}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold"
                >
                  Go to Sign In
                </button>
                <p className="text-[10px] text-muted-foreground">
                  Didn't receive it? Check spam or{" "}
                  <button onClick={handleSignUp} className="text-primary underline">resend</button>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSignUp} autoComplete="on" className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                      type="text" required autoComplete="name"
                      value={signupFullName} onChange={e => setSignupFullName(e.target.value)}
                      placeholder="Ahmed Hassan"
                      className="w-full bg-secondary/60 text-foreground text-sm rounded-xl pl-10 pr-4 py-3 outline-none border border-transparent focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Employee Number</label>
                  <div className="relative">
                    <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                      type="text" required
                      value={signupEmployeeNo} onChange={e => setSignupEmployeeNo(e.target.value.toUpperCase())}
                      placeholder="DRV-001"
                      className="w-full bg-secondary/60 text-foreground text-sm rounded-xl pl-10 pr-4 py-3 outline-none border border-transparent focus:border-primary transition-colors font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground pl-1">
                    Ask HR for your employee number
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                      type="email" required autoComplete="email"
                      value={signupEmail} onChange={e => setSignupEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full bg-secondary/60 text-foreground text-sm rounded-xl pl-10 pr-4 py-3 outline-none border border-transparent focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                      type={showSignupPassword ? "text" : "password"} required
                      autoComplete="new-password"
                      value={signupPassword} onChange={e => setSignupPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full bg-secondary/60 text-foreground text-sm rounded-xl pl-10 pr-12 py-3 outline-none border border-transparent focus:border-primary transition-colors"
                    />
                    <button type="button" onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" tabIndex={-1}>
                      {showSignupPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                      type={showSignupPassword ? "text" : "password"} required
                      autoComplete="new-password"
                      value={signupConfirm} onChange={e => setSignupConfirm(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full bg-secondary/60 text-foreground text-sm rounded-xl pl-10 pr-4 py-3 outline-none border transition-colors ${
                        signupConfirm && signupPassword !== signupConfirm
                          ? "border-destructive"
                          : signupConfirm && signupPassword === signupConfirm
                            ? "border-chart-3"
                            : "border-transparent focus:border-primary"
                      }`}
                    />
                  </div>
                  {signupConfirm && signupPassword !== signupConfirm && (
                    <p className="text-[10px] text-destructive pl-1">Passwords don't match</p>
                  )}
                  {signupConfirm && signupPassword === signupConfirm && (
                    <p className="text-[10px] text-chart-3 pl-1 flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> Passwords match
                    </p>
                  )}
                </div>

                {signupError && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                    <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
                    <span>{signupError}</span>
                  </div>
                )}

                <button type="submit" disabled={signupLoading || signupPassword !== signupConfirm}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {signupLoading && <Loader2 className="size-4 animate-spin" />}
                  Create Account
                </button>

                <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                  By creating an account you agree to the company's HR policies.
                  A confirmation email will be sent to verify your address.
                </p>
              </form>
            )}
          </>
        )}

        <p className="text-[10px] text-muted-foreground text-center mt-8">
          © {new Date().getFullYear()} Tawreedat HRIS
        </p>
      </div>
    </div>
  )
}
