"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Loader2, User, Fingerprint, CheckCircle2,
  AlertCircle, LogOut, ShieldCheck
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Profile, Employee } from "@/lib/types"
import {
  isBiometricSupported, isPlatformAuthenticatorAvailable,
  enableBiometricLogin, disableBiometric, hasBiometricSession,
} from "@/lib/webauthn"

export default function MobileProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [biometricLoading, setBiometricLoading] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    const { data: profileData } = await supabase
      .from("profiles").select("*").eq("id", user.id).single()
    setProfile(profileData as Profile | null)

    if (profileData?.employee_id) {
      const { data: empData } = await supabase
        .from("employees").select("*").eq("id", profileData.employee_id).single()
      setEmployee(empData as Employee | null)
    }

    // Check biometric
    if (isBiometricSupported()) {
      const platformAvail = await isPlatformAuthenticatorAvailable()
      setBiometricAvailable(platformAvail)
      setBiometricEnabled(hasBiometricSession())
    }

    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  async function handleEnableBiometric() {
    setMessage(null)
    setBiometricLoading(true)
    const result = await enableBiometricLogin()
    setBiometricLoading(false)
    if (result.ok) {
      setBiometricEnabled(true)
      setMessage({ ok: true, text: "Biometric login enabled! Use it on next sign-in." })
    } else {
      setMessage({ ok: false, text: result.error })
    }
  }

  async function handleDisableBiometric() {
    if (!confirm("Disable biometric login on this device?")) return
    setBiometricLoading(true)
    await disableBiometric()
    setBiometricEnabled(false)
    setBiometricLoading(false)
    setMessage({ ok: true, text: "Biometric login disabled." })
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" /> Loading...
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <User className="size-10 text-muted-foreground mb-3" />
        <p className="text-sm text-foreground">No employee record linked.</p>
        <button onClick={() => router.push("/m")} className="mt-4 text-xs text-primary">Back home</button>
      </div>
    )
  }

  return (
    <>
      <header className="shrink-0 bg-card border-b border-border px-3 py-2.5 flex items-center gap-2">
        <button onClick={() => router.push("/m")} className="p-1.5 text-muted-foreground active:text-foreground">
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-sm font-semibold text-foreground">My Profile</h1>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 py-3 space-y-3">

          {/* Profile card */}
          <div className="bg-card border border-border rounded-2xl p-5 text-center">
            <div className="size-20 mx-auto rounded-full bg-primary/15 flex items-center justify-center text-2xl font-bold text-primary mb-3">
              {employee.full_name.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-base font-semibold text-foreground">{employee.full_name}</h2>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{employee.employee_no}</p>
            <p className="text-[11px] text-muted-foreground mt-1 capitalize">{employee.category.replace("_", " ")}</p>
          </div>

          {/* Biometric setup */}
          {biometricAvailable && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
                  biometricEnabled ? "bg-chart-3/15" : "bg-primary/15"
                }`}>
                  {biometricEnabled ? (
                    <ShieldCheck className="size-5 text-chart-3" />
                  ) : (
                    <Fingerprint className="size-5 text-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Biometric Login</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {biometricEnabled
                      ? "Sign in with your fingerprint or Face ID"
                      : "Use fingerprint or Face ID for faster sign-in"}
                  </p>
                </div>
              </div>

              {message && (
                <div className={`rounded-lg px-3 py-2 text-xs flex items-center gap-2 mb-3 ${
                  message.ok
                    ? "bg-chart-3/10 text-chart-3 border border-chart-3/30"
                    : "bg-destructive/10 text-destructive border border-destructive/30"
                }`}>
                  {message.ok ? <CheckCircle2 className="size-3.5 shrink-0" /> : <AlertCircle className="size-3.5 shrink-0" />}
                  <span>{message.text}</span>
                </div>
              )}

              {biometricEnabled ? (
                <button
                  onClick={handleDisableBiometric}
                  disabled={biometricLoading}
                  className="w-full py-2.5 bg-destructive/10 text-destructive rounded-xl text-xs font-medium active:bg-destructive/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {biometricLoading ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Disable Biometric Login
                </button>
              ) : (
                <button
                  onClick={handleEnableBiometric}
                  disabled={biometricLoading}
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold active:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {biometricLoading ? (
                    <><Loader2 className="size-3.5 animate-spin" /> Setting up...</>
                  ) : (
                    <><Fingerprint className="size-4" /> Enable Biometric Login</>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Personal info */}
          <div className="bg-card border border-border rounded-2xl divide-y divide-border/50">
            <InfoRow label="Phone"        value={employee.phone ?? "—"} />
            <InfoRow label="Email"        value={employee.email ?? "—"} />
            <InfoRow label="National ID"  value={employee.national_id ?? "—"} />
            <InfoRow label="Hire Date"    value={employee.hire_date ? new Date(employee.hire_date).toLocaleDateString("en-GB") : "—"} />
            <InfoRow label="Contract"     value={employee.contract_type ?? "—"} className="capitalize" />
            <InfoRow label="Status"       value={employee.status ?? "—"} className="capitalize" />
          </div>

          <p className="text-[10px] text-center text-muted-foreground">
            To update your info, please contact HR
          </p>

          {/* Logout */}
          <button onClick={logout}
            className="w-full py-3 bg-destructive/10 text-destructive rounded-xl text-sm font-medium active:bg-destructive/20 transition-colors flex items-center justify-center gap-2">
            <LogOut className="size-4" />
            Log out
          </button>

          <div className="h-3" />
        </div>
      </main>
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
