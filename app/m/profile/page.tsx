"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Loader2, User, Fingerprint, CheckCircle2,
  AlertCircle, LogOut, ShieldCheck, Lock, Eye, EyeOff
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Profile, Employee } from "@/lib/types"
import {
  isBiometricSupported, isPlatformAuthenticatorAvailable,
  enableBiometricLogin, disableBiometric, hasBiometricSession,
} from "@/lib/webauthn"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"

export default function MobileProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userEmail, setUserEmail] = useState<string>("")

  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [biometricLoading, setBiometricLoading] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  // Password confirmation for biometric setup
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false)
  const [passwordInput, setPasswordInput] = useState("")
  const [showPwd, setShowPwd] = useState(false)
  const [pwdError, setPwdError] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    setUserEmail(user.email ?? "")

    const { data: profileData } = await supabase
      .from("profiles").select("*").eq("id", user.id).single()
    setProfile(profileData as Profile | null)

    if (profileData?.employee_id) {
      const { data: empData } = await supabase
        .from("employees").select("*").eq("id", profileData.employee_id).single()
      setEmployee(empData as Employee | null)
    }

    if (isBiometricSupported()) {
      const ok = await isPlatformAuthenticatorAvailable()
      setBiometricAvailable(ok)
      setBiometricEnabled(hasBiometricSession())
    }

    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  async function handleEnableBiometric() {
    if (!passwordInput.trim()) {
      setPwdError("Enter your password to enable biometric")
      return
    }

    setPwdError(null)
    setBiometricLoading(true)

    // Verify password first
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: passwordInput,
    })

    if (signInErr) {
      setBiometricLoading(false)
      setPwdError("Incorrect password")
      return
    }

    // Password correct → enable biometric
    const result = await enableBiometricLogin(userEmail, passwordInput)
    setBiometricLoading(false)

    if (result.ok) {
      setBiometricEnabled(true)
      setShowPasswordPrompt(false)
      setPasswordInput("")
      setMessage({ ok: true, text: "Biometric login enabled! Use it on next sign-in." })
    } else {
      setPwdError(result.error)
    }
  }

  async function handleDisableBiometric() {
    if (!confirm("Disable biometric login on this device?")) return
    disableBiometric()
    setBiometricEnabled(false)
    setMessage({ ok: true, text: "Biometric login disabled." })
  }

  async function logout() {
    const hasBio = hasBiometricSession()
    await supabase.auth.signOut({ scope: hasBio ? "local" : "global" } as any)
    router.push("/login")
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
      </div>
    )
  }

  const displayName = employee?.full_name ?? profile?.full_name ?? userEmail
  const initials = displayName.charAt(0).toUpperCase()

  return (
    <>
      <header className="shrink-0 bg-card border-b border-border px-3 py-2.5 flex items-center gap-2">
        <button onClick={() => router.push("/m")} className="p-1.5 text-muted-foreground">
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-sm font-semibold text-foreground">My Profile</h1>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 py-3 space-y-3">

          {/* Profile card */}
          <div className="bg-card border border-border rounded-2xl p-5 text-center">
            <div className="size-20 mx-auto rounded-full bg-primary/15 flex items-center justify-center text-2xl font-bold text-primary mb-3">
              {initials}
            </div>
            <h2 className="text-base font-semibold text-foreground">{displayName}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{userEmail}</p>
            {employee && (
              <p className="text-[11px] text-muted-foreground mt-1 font-mono">{employee.employee_no}</p>
            )}
          </div>

          {/* Biometric */}
          {biometricAvailable && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
                  biometricEnabled ? "bg-chart-3/15" : "bg-primary/15"
                }`}>
                  {biometricEnabled
                    ? <ShieldCheck className="size-5 text-chart-3" />
                    : <Fingerprint className="size-5 text-primary" />
                  }
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Biometric Login</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {biometricEnabled
                      ? "Active — sign in with fingerprint or Face ID"
                      : "Sign in faster with fingerprint or Face ID"}
                  </p>
                </div>
              </div>

              {message && (
                <div className={`rounded-lg px-3 py-2 text-xs flex items-center gap-2 mb-3 ${
                  message.ok ? "bg-chart-3/10 text-chart-3 border border-chart-3/30" : "bg-destructive/10 text-destructive border border-destructive/30"
                }`}>
                  {message.ok ? <CheckCircle2 className="size-3.5 shrink-0" /> : <AlertCircle className="size-3.5 shrink-0" />}
                  <span>{message.text}</span>
                </div>
              )}

              {biometricEnabled ? (
                <button onClick={handleDisableBiometric}
                  className="w-full py-2.5 bg-destructive/10 text-destructive rounded-xl text-xs font-medium active:bg-destructive/20 transition-colors">
                  Disable Biometric Login
                </button>
              ) : showPasswordPrompt ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">Enter your password to confirm:</p>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <input
                      type={showPwd ? "text" : "password"}
                      value={passwordInput}
                      onChange={e => setPasswordInput(e.target.value)}
                      placeholder="Your password"
                      onKeyDown={e => e.key === "Enter" && handleEnableBiometric()}
                      className="w-full bg-secondary/60 text-foreground text-sm rounded-xl pl-9 pr-10 py-2.5 outline-none border border-transparent focus:border-primary"
                    />
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" tabIndex={-1}>
                      {showPwd ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                  {pwdError && (
                    <p className="text-[11px] text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" /> {pwdError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => { setShowPasswordPrompt(false); setPasswordInput(""); setPwdError(null) }}
                      className="flex-1 py-2 text-xs bg-secondary text-foreground rounded-xl">
                      Cancel
                    </button>
                    <button onClick={handleEnableBiometric} disabled={biometricLoading || !passwordInput}
                      className="flex-1 py-2 text-xs bg-primary text-primary-foreground rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
                      {biometricLoading ? <Loader2 className="size-3 animate-spin" /> : <Fingerprint className="size-3" />}
                      Enable
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setShowPasswordPrompt(true); setMessage(null) }}
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold active:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                  <Fingerprint className="size-4" /> Enable Biometric Login
                </button>
              )}
            </div>
          )}

          {/* Personal info */}
          {employee && (
            <div className="bg-card border border-border rounded-2xl divide-y divide-border/50">
              <InfoRow label="Phone"     value={employee.phone ?? "—"} />
              <InfoRow label="Email"     value={employee.email ?? "—"} />
              <InfoRow label="Hire Date" value={employee.hire_date ? new Date(employee.hire_date).toLocaleDateString("en-GB") : "—"} />
              <InfoRow label="Contract"  value={employee.contract_type ?? "—"} className="capitalize" />
              <InfoRow label="Status"    value={employee.status ?? "—"} className="capitalize" />
            </div>
          )}

          <p className="text-[10px] text-center text-muted-foreground">
            To update your info, please contact HR
          </p>

          <button onClick={logout}
            className="w-full py-3 bg-destructive/10 text-destructive rounded-xl text-sm font-medium active:bg-destructive/20 transition-colors flex items-center justify-center gap-2">
            <LogOut className="size-4" />
            Log out
          </button>

          <div className="h-3" />
        </div>
      </main>

      <MobileBottomNav />
    </>
  )
}

function InfoRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs text-foreground font-medium truncate max-w-[60%] text-right ${className ?? ""}`}>{value}</span>
    </div>
  )
}
