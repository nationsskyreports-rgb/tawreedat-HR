"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Loader2, Fingerprint, CheckCircle2,
  AlertCircle, LogOut, ShieldCheck, Lock, Eye, EyeOff,
  KeyRound, Pencil, Phone, MapPin, User, X, Save,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Profile, Employee } from "@/lib/types"
import {
  isBiometricSupported, isPlatformAuthenticatorAvailable,
  enableBiometricLogin, disableBiometric, hasBiometricSession,
  signOutKeepingBiometric,
  getStoredEmail,
} from "@/lib/webauthn"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"

export default function MobileProfilePage() {
  const router = useRouter()
  const [loading,   setLoading]   = useState(true)
  const [employee,  setEmployee]  = useState<Employee | null>(null)
  const [profile,   setProfile]   = useState<Profile | null>(null)
  const [userEmail, setUserEmail] = useState<string>("")

  // ── Biometric ──────────────────────────────────────────────────────────────
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricEnabled,   setBiometricEnabled]   = useState(false)
  const [biometricLoading,   setBiometricLoading]   = useState(false)
  const [bioMessage,         setBioMessage]         = useState<{ ok: boolean; text: string } | null>(null)
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false)
  const [passwordInput,      setPasswordInput]      = useState("")
  const [showPwd,            setShowPwd]            = useState(false)
  const [pwdError,           setPwdError]           = useState<string | null>(null)

  // ── Change Password ────────────────────────────────────────────────────────
  const [showPwdChangeForm, setShowPwdChangeForm] = useState(false)
  const [pwdChange,         setPwdChange]         = useState({ newPassword: "", confirmPassword: "" })
  const [showNewPwd,        setShowNewPwd]        = useState(false)
  const [showConfirmPwd,    setShowConfirmPwd]    = useState(false)
  const [pwdChanging,       setPwdChanging]       = useState(false)
  const [pwdChangeMsg,      setPwdChangeMsg]      = useState<{ ok: boolean; text: string } | null>(null)

  // ── Edit Profile ───────────────────────────────────────────────────────────
  const [showEditForm, setShowEditForm] = useState(false)
  const [editForm, setEditForm] = useState({
    phone:                     "",
    city:                      "",
    address:                   "",
    emergency_contact_name:    "",
    emergency_contact_phone:   "",
    emergency_contact_relation:"",
  })
  const [editSaving, setEditSaving] = useState(false)
  const [editMsg,    setEditMsg]    = useState<{ ok: boolean; text: string } | null>(null)

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
      if (empData) {
        setEmployee(empData as Employee)
        setEditForm({
          phone:                     empData.phone                     ?? "",
          city:                      empData.city                      ?? "",
          address:                   empData.address                   ?? "",
          emergency_contact_name:    empData.emergency_contact_name    ?? "",
          emergency_contact_phone:   empData.emergency_contact_phone   ?? "",
          emergency_contact_relation:empData.emergency_contact_relation ?? "",
        })
      }
    }

    if (isBiometricSupported()) {
      const ok = await isPlatformAuthenticatorAvailable()
      setBiometricAvailable(ok)
      setBiometricEnabled(hasBiometricSession())
    }

    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  // ── Biometric handlers ─────────────────────────────────────────────────────
  async function handleEnableBiometric() {
    if (!passwordInput.trim()) { setPwdError("Enter your password to enable biometric"); return }
    setPwdError(null)
    setBiometricLoading(true)
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: userEmail, password: passwordInput })
    if (signInErr) { setBiometricLoading(false); setPwdError("Incorrect password"); return }
    const result = await enableBiometricLogin(userEmail, passwordInput)
    setBiometricLoading(false)
    if (result.ok) {
      setBiometricEnabled(true)
      setShowPasswordPrompt(false)
      setPasswordInput("")
      setBioMessage({ ok: true, text: "Biometric login enabled! Use it on next sign-in." })
    } else {
      setPwdError(result.error)
    }
  }

  async function handleDisableBiometric() {
    if (!confirm("Disable biometric login on this device?")) return
    disableBiometric()
    setBiometricEnabled(false)
    setBioMessage({ ok: true, text: "Biometric login disabled." })
  }

  // ── Change password ────────────────────────────────────────────────────────
  async function handleChangePassword() {
    setPwdChangeMsg(null)
    if (pwdChange.newPassword.length < 6) {
      setPwdChangeMsg({ ok: false, text: "Password must be at least 6 characters" }); return
    }
    if (pwdChange.newPassword !== pwdChange.confirmPassword) {
      setPwdChangeMsg({ ok: false, text: "Passwords don't match" }); return
    }
    setPwdChanging(true)
    const { error } = await supabase.auth.updateUser({ password: pwdChange.newPassword })
    setPwdChanging(false)
    if (error) {
      setPwdChangeMsg({ ok: false, text: error.message })
    } else {
      setPwdChangeMsg({ ok: true, text: "Password changed successfully" })
      setShowPwdChangeForm(false)
      setPwdChange({ newPassword: "", confirmPassword: "" })
    }
  }

  // ── Edit profile ───────────────────────────────────────────────────────────
  async function handleSaveProfile() {
    if (!employee) return
    setEditSaving(true)
    setEditMsg(null)
    const { error } = await supabase.from("employees").update({
      phone:                     editForm.phone.trim()                     || null,
      city:                      editForm.city.trim()                      || null,
      address:                   editForm.address.trim()                   || null,
      emergency_contact_name:    editForm.emergency_contact_name.trim()    || null,
      emergency_contact_phone:   editForm.emergency_contact_phone.trim()   || null,
      emergency_contact_relation:editForm.emergency_contact_relation.trim() || null,
    }).eq("id", employee.id)
    setEditSaving(false)
    if (error) {
      setEditMsg({ ok: false, text: error.message })
    } else {
      setEditMsg({ ok: true, text: "Profile updated successfully" })
      setShowEditForm(false)
      await loadData()
    }
  }

  async function logout() {
    await signOutKeepingBiometric()
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
  const initials    = displayName.charAt(0).toUpperCase()

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

          {/* ── Edit Profile ──────────────────────────────────────────────── */}
          {employee && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="size-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <Pencil className="size-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Edit Profile</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Update your contact and emergency info
                  </p>
                </div>
              </div>

              {editMsg && (
                <div className={`rounded-lg px-3 py-2 text-xs flex items-center gap-2 mb-3 ${
                  editMsg.ok
                    ? "bg-chart-3/10 text-chart-3 border border-chart-3/30"
                    : "bg-destructive/10 text-destructive border border-destructive/30"
                }`}>
                  {editMsg.ok ? <CheckCircle2 className="size-3.5 shrink-0" /> : <AlertCircle className="size-3.5 shrink-0" />}
                  {editMsg.text}
                </div>
              )}

              {showEditForm ? (
                <div className="space-y-2.5">
                  {/* Phone */}
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Phone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <input
                        type="tel"
                        value={editForm.phone}
                        onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="+20 1xx xxx xxxx"
                        className="w-full bg-secondary/60 text-foreground text-sm rounded-xl pl-9 pr-4 py-2.5 outline-none border border-transparent focus:border-primary"
                      />
                    </div>
                  </div>

                  {/* City */}
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">City</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        value={editForm.city}
                        onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))}
                        placeholder="e.g. Cairo"
                        className="w-full bg-secondary/60 text-foreground text-sm rounded-xl pl-9 pr-4 py-2.5 outline-none border border-transparent focus:border-primary"
                      />
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Address</label>
                    <textarea
                      value={editForm.address}
                      onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="Street address..."
                      rows={2}
                      className="w-full bg-secondary/60 text-foreground text-sm rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-primary resize-none"
                    />
                  </div>

                  <div className="h-px bg-border/50 my-1" />
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Emergency Contact
                  </p>

                  {/* Emergency name */}
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Contact Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        value={editForm.emergency_contact_name}
                        onChange={e => setEditForm(f => ({ ...f, emergency_contact_name: e.target.value }))}
                        placeholder="Full name"
                        className="w-full bg-secondary/60 text-foreground text-sm rounded-xl pl-9 pr-4 py-2.5 outline-none border border-transparent focus:border-primary"
                      />
                    </div>
                  </div>

                  {/* Emergency phone */}
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Contact Phone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <input
                        type="tel"
                        value={editForm.emergency_contact_phone}
                        onChange={e => setEditForm(f => ({ ...f, emergency_contact_phone: e.target.value }))}
                        placeholder="+20 1xx xxx xxxx"
                        className="w-full bg-secondary/60 text-foreground text-sm rounded-xl pl-9 pr-4 py-2.5 outline-none border border-transparent focus:border-primary"
                      />
                    </div>
                  </div>

                  {/* Emergency relation */}
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Relation</label>
                    <select
                      value={editForm.emergency_contact_relation}
                      onChange={e => setEditForm(f => ({ ...f, emergency_contact_relation: e.target.value }))}
                      className="w-full bg-secondary/60 text-foreground text-sm rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-primary"
                    >
                      <option value="">Select relation...</option>
                      {["Spouse", "Parent", "Sibling", "Child", "Friend", "Other"].map(r => (
                        <option key={r} value={r.toLowerCase()}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => { setShowEditForm(false); setEditMsg(null) }}
                      className="flex-1 py-2 text-xs bg-secondary text-foreground rounded-xl">
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      disabled={editSaving}
                      className="flex-1 py-2 text-xs bg-primary text-primary-foreground rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
                      {editSaving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setShowEditForm(true); setEditMsg(null) }}
                  className="w-full py-2.5 bg-primary/10 text-primary rounded-xl text-xs font-semibold flex items-center justify-center gap-2">
                  <Pencil className="size-4" /> Edit My Info
                </button>
              )}
            </div>
          )}

          {/* ── Biometric ─────────────────────────────────────────────────── */}
          {biometricAvailable && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${biometricEnabled ? "bg-chart-3/15" : "bg-primary/15"}`}>
                  {biometricEnabled
                    ? <ShieldCheck className="size-5 text-chart-3" />
                    : <Fingerprint className="size-5 text-primary" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Biometric Login</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {biometricEnabled ? "Active — sign in with fingerprint or Face ID" : "Sign in faster with fingerprint or Face ID"}
                  </p>
                </div>
              </div>

              {bioMessage && (
                <div className={`rounded-lg px-3 py-2 text-xs flex items-center gap-2 mb-3 ${
                  bioMessage.ok ? "bg-chart-3/10 text-chart-3 border border-chart-3/30" : "bg-destructive/10 text-destructive border border-destructive/30"
                }`}>
                  {bioMessage.ok ? <CheckCircle2 className="size-3.5 shrink-0" /> : <AlertCircle className="size-3.5 shrink-0" />}
                  {bioMessage.text}
                </div>
              )}

              {biometricEnabled ? (
                <button onClick={handleDisableBiometric}
                  className="w-full py-2.5 bg-destructive/10 text-destructive rounded-xl text-xs font-medium">
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
                      className="flex-1 py-2 text-xs bg-secondary text-foreground rounded-xl">Cancel</button>
                    <button onClick={handleEnableBiometric} disabled={biometricLoading || !passwordInput}
                      className="flex-1 py-2 text-xs bg-primary text-primary-foreground rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
                      {biometricLoading ? <Loader2 className="size-3 animate-spin" /> : <Fingerprint className="size-3" />}
                      Enable
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setShowPasswordPrompt(true); setBioMessage(null) }}
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold flex items-center justify-center gap-2">
                  <Fingerprint className="size-4" /> Enable Biometric Login
                </button>
              )}
            </div>
          )}

          {/* ── Change Password ───────────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="size-10 rounded-xl bg-chart-4/15 flex items-center justify-center shrink-0">
                <KeyRound className="size-5 text-chart-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Change Password</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Update your account password</p>
              </div>
            </div>

            {pwdChangeMsg && (
              <div className={`rounded-lg px-3 py-2 text-xs flex items-center gap-2 mb-3 ${
                pwdChangeMsg.ok ? "bg-chart-3/10 text-chart-3 border border-chart-3/30" : "bg-destructive/10 text-destructive border border-destructive/30"
              }`}>
                {pwdChangeMsg.ok ? <CheckCircle2 className="size-3.5 shrink-0" /> : <AlertCircle className="size-3.5 shrink-0" />}
                {pwdChangeMsg.text}
              </div>
            )}

            {showPwdChangeForm ? (
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <input type={showNewPwd ? "text" : "password"} value={pwdChange.newPassword}
                    onChange={e => setPwdChange(f => ({ ...f, newPassword: e.target.value }))}
                    placeholder="New password (min 6 chars)"
                    className="w-full bg-secondary/60 text-foreground text-sm rounded-xl pl-9 pr-10 py-2.5 outline-none border border-transparent focus:border-primary"
                  />
                  <button type="button" onClick={() => setShowNewPwd(!showNewPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" tabIndex={-1}>
                    {showNewPwd ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <input type={showConfirmPwd ? "text" : "password"} value={pwdChange.confirmPassword}
                    onChange={e => setPwdChange(f => ({ ...f, confirmPassword: e.target.value }))}
                    placeholder="Confirm new password"
                    onKeyDown={e => e.key === "Enter" && handleChangePassword()}
                    className="w-full bg-secondary/60 text-foreground text-sm rounded-xl pl-9 pr-10 py-2.5 outline-none border border-transparent focus:border-primary"
                  />
                  <button type="button" onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" tabIndex={-1}>
                    {showConfirmPwd ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setShowPwdChangeForm(false); setPwdChange({ newPassword: "", confirmPassword: "" }); setPwdChangeMsg(null) }}
                    className="flex-1 py-2 text-xs bg-secondary text-foreground rounded-xl">Cancel</button>
                  <button onClick={handleChangePassword} disabled={pwdChanging || !pwdChange.newPassword || !pwdChange.confirmPassword}
                    className="flex-1 py-2 text-xs bg-primary text-primary-foreground rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
                    {pwdChanging ? <Loader2 className="size-3 animate-spin" /> : <KeyRound className="size-3" />}
                    Update
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setShowPwdChangeForm(true); setPwdChangeMsg(null) }}
                className="w-full py-2.5 bg-chart-4/10 text-chart-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2">
                <KeyRound className="size-4" /> Change Password
              </button>
            )}
          </div>

          {/* Personal info (read-only extras) */}
          {employee && (
            <div className="bg-card border border-border rounded-2xl divide-y divide-border/50">
              <InfoRow label="Phone"      value={employee.phone      ?? "—"} />
              <InfoRow label="City"       value={employee.city       ?? "—"} />
              <InfoRow label="Hire Date"  value={employee.hire_date ? new Date(employee.hire_date).toLocaleDateString("en-GB") : "—"} />
              <InfoRow label="Contract"   value={employee.contract_type ?? "—"} className="capitalize" />
              <InfoRow label="Status"     value={employee.status         ?? "—"} className="capitalize" />
              {employee.emergency_contact_name && (
                <InfoRow label="Emergency" value={`${employee.emergency_contact_name} (${employee.emergency_contact_relation ?? "—"})`} />
              )}
            </div>
          )}

          <p className="text-[10px] text-center text-muted-foreground">
            For other changes, please contact HR
          </p>

          <button onClick={logout}
            className="w-full py-3 bg-destructive/10 text-destructive rounded-xl text-sm font-medium flex items-center justify-center gap-2">
            <LogOut className="size-4" /> Log out
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
      <span className={`text-xs text-foreground font-medium truncate max-w-[60%] text-right ${className ?? ""}`}>
        {value}
      </span>
    </div>
  )
}
