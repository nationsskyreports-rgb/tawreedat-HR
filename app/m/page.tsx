"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Home, MapPin, Wallet, User, LogOut, Loader2,
  CheckCircle2, Clock, Briefcase, Megaphone, FileText, CalendarCheck,
  Download
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type {
  Profile, Employee, AttendanceLog, ShiftAssignment, Shift
} from "@/lib/types"

type Section = "home" | "checkin" | "leave" | "payslip" | "profile"

// BeforeInstallPromptEvent (PWA install prompt)
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export default function MobileHomePage() {
  const router = useRouter()
  const [section, setSection] = useState<Section>("home")

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [todayCheckin, setTodayCheckin] = useState<AttendanceLog | null>(null)
  const [todayShift, setTodayShift] = useState<{ shift: Shift; assignment: ShiftAssignment } | null>(null)
  const [pendingLeaves, setPendingLeaves] = useState(0)
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0)

  // Install prompt
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if running as installed PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
    }

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setInstallPrompt(e as InstallPromptEvent)
    }

    function handleAppInstalled() {
      setIsInstalled(true)
      setInstallPrompt(null)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push("/login")
      return
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
    setProfile(profileData as Profile | null)

    if (!profileData?.employee_id) {
      setLoading(false)
      return
    }

    const { data: empData } = await supabase
      .from("employees")
      .select("*")
      .eq("id", profileData.employee_id)
      .single()
    setEmployee(empData as Employee | null)

    if (empData) {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayStr = todayStart.toISOString().split("T")[0]
      const nowISO = new Date().toISOString()

      const [checkinRes, leavesRes, shiftRes, annRes] = await Promise.all([
        supabase.from("attendance_logs")
          .select("*")
          .eq("employee_id", empData.id)
          .gte("checkin_at", todayStart.toISOString())
          .order("checkin_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("leave_requests")
          .select("id", { count: "exact", head: true })
          .eq("employee_id", empData.id)
          .eq("status", "pending"),
        supabase.from("shift_assignments")
          .select("*, shifts(*)")
          .eq("employee_id", empData.id)
          .eq("assignment_date", todayStr)
          .maybeSingle(),
        supabase.from("announcements")
          .select("id", { count: "exact", head: true })
          .lte("publish_at", nowISO)
          .or(`expires_at.is.null,expires_at.gt.${nowISO}`),
      ])

      setTodayCheckin(checkinRes.data as AttendanceLog | null)
      setPendingLeaves(leavesRes.count ?? 0)
      setUnreadAnnouncements(annRes.count ?? 0)

      if (shiftRes.data) {
        const sd = shiftRes.data as any
        setTodayShift({ shift: sd.shifts, assignment: sd })
      }
    }

    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  async function logout() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  async function triggerInstall() {
    if (!installPrompt) {
      alert(
        "To install: tap your browser's Share/Menu button, then choose 'Add to Home Screen' or 'Install app'."
      )
      return
    }
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === "accepted") {
      setInstallPrompt(null)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading...
      </div>
    )
  }

  if (profile && ["admin", "hr", "manager"].includes(profile.role)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <Briefcase className="size-12 text-primary mb-4" />
        <h1 className="text-lg font-semibold text-foreground mb-2">Admin Account</h1>
        <p className="text-sm text-muted-foreground mb-6">
          You're logged in as <strong>{profile.role}</strong>. The mobile app is for employees.
        </p>
        <button onClick={() => router.push("/")}
          className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
          Open Desktop View
        </button>
        <button onClick={logout} className="mt-3 text-xs text-muted-foreground hover:text-foreground">
          Log out
        </button>
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <User className="size-12 text-muted-foreground mb-4" />
        <h1 className="text-lg font-semibold text-foreground mb-2">No Profile Linked</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Your account is not linked to an employee record. Please contact HR.
        </p>
        <button onClick={logout} className="px-6 py-2.5 bg-secondary text-foreground rounded-lg text-sm font-medium">
          Log out
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <header className="shrink-0 bg-card border-b border-border px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-9 rounded-full bg-primary/15 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
            {employee.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="leading-tight min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{employee.full_name}</p>
            <p className="text-[10px] text-muted-foreground font-mono">{employee.employee_no}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isInstalled && installPrompt && (
            <button onClick={triggerInstall}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-primary/10 text-primary text-[10px] font-medium rounded-lg">
              <Download className="size-3" />
              Install
            </button>
          )}
          <button onClick={logout} className="p-2 text-muted-foreground active:text-destructive transition-colors">
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      {/* Section content — scrollable middle area */}
      <main className="flex-1 overflow-y-auto overscroll-contain">
        {section === "home" && (
          <HomeSection
            employee={employee}
            todayCheckin={todayCheckin}
            todayShift={todayShift}
            pendingLeaves={pendingLeaves}
            unreadAnnouncements={unreadAnnouncements}
            isInstalled={isInstalled}
            canInstall={!!installPrompt}
            onInstall={triggerInstall}
            onCheckIn={() => setSection("checkin")}
            onLeave={() => setSection("leave")}
            onPayslip={() => setSection("payslip")}
          />
        )}
        {section === "checkin"  && <ComingSoon title="Check-In" />}
        {section === "leave"    && <ComingSoon title="Leave Requests" />}
        {section === "payslip"  && <ComingSoon title="Payslip" />}
        {section === "profile"  && <ProfileSection employee={employee} />}
      </main>

      {/* Bottom navigation — pinned */}
      <nav className="shrink-0 bg-card border-t border-border" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="grid grid-cols-5">
          {[
            { id: "home",    label: "Home",     icon: Home },
            { id: "checkin", label: "Check-In", icon: MapPin },
            { id: "leave",   label: "Leave",    icon: CalendarCheck },
            { id: "payslip", label: "Payslip",  icon: Wallet },
            { id: "profile", label: "Profile",  icon: User },
          ].map(item => {
            const Icon = item.icon
            const isActive = section === item.id
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id as Section)}
                className="flex flex-col items-center justify-center py-2 gap-0.5 transition-colors active:bg-secondary/30"
              >
                <Icon className={`size-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-[10px] ${isActive ? "text-primary font-medium" : "text-muted-foreground"}`}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}

// =============================================================================
// Home Section
// =============================================================================
function HomeSection({
  employee, todayCheckin, todayShift, pendingLeaves, unreadAnnouncements,
  isInstalled, canInstall, onInstall,
  onCheckIn, onLeave, onPayslip,
}: {
  employee: Employee
  todayCheckin: AttendanceLog | null
  todayShift: { shift: Shift; assignment: ShiftAssignment } | null
  pendingLeaves: number
  unreadAnnouncements: number
  isInstalled: boolean
  canInstall: boolean
  onInstall: () => void
  onCheckIn: () => void
  onLeave: () => void
  onPayslip: () => void
}) {
  const now = new Date()
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening"
  const firstName = employee.full_name.split(" ")[0]

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Install banner */}
      {!isInstalled && (
        <button onClick={onInstall}
          className="w-full bg-primary/10 border border-primary/30 rounded-xl p-3 flex items-center gap-3 active:bg-primary/15 transition-colors">
          <div className="size-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
            <Download className="size-4 text-primary" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">Install Tawreedat</p>
            <p className="text-[10px] text-muted-foreground">
              {canInstall ? "Tap to install on your device" : "Use your browser's Share menu → Add to Home Screen"}
            </p>
          </div>
        </button>
      )}

      <div>
        <p className="text-xs text-muted-foreground">{greeting},</p>
        <p className="text-lg font-semibold text-foreground">{firstName} 👋</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Today's Status Card */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Today</p>
          {todayCheckin ? (
            <span className="flex items-center gap-1 text-[10px] text-chart-3">
              <CheckCircle2 className="size-3" /> Checked in
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-primary">
              <Clock className="size-3" /> Not yet
            </span>
          )}
        </div>

        {todayShift ? (
          <div className="bg-secondary/40 rounded-xl px-3 py-2.5 mb-3">
            <p className="text-[9px] text-muted-foreground uppercase">Your shift</p>
            <div className="flex items-baseline justify-between mt-0.5">
              <p className="text-sm font-medium text-foreground">{todayShift.shift.name}</p>
              <p className="text-[11px] text-muted-foreground font-mono">
                {todayShift.shift.start_time.slice(0, 5)} – {todayShift.shift.end_time.slice(0, 5)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic mb-3">No shift scheduled today</p>
        )}

        {todayCheckin ? (
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-muted-foreground">Checked in at</span>
            <span className="font-mono font-semibold text-foreground">
              {new Date(todayCheckin.checkin_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ) : (
          <button onClick={onCheckIn}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold active:bg-primary/90 transition-colors flex items-center justify-center gap-2">
            <MapPin className="size-4" />
            Check In Now
          </button>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2.5">
        <QuickAction icon={CalendarCheck} label="Request Leave" sublabel={`${pendingLeaves} pending`}
          color="text-chart-2" bg="bg-chart-2/10" onClick={onLeave} />
        <QuickAction icon={Wallet} label="My Payslip" sublabel="View latest"
          color="text-chart-3" bg="bg-chart-3/10" onClick={onPayslip} />
        <QuickAction icon={Megaphone} label="Announcements" sublabel={`${unreadAnnouncements} active`}
          color="text-chart-4" bg="bg-chart-4/10" />
        <QuickAction icon={FileText} label="Documents" sublabel="View your files"
          color="text-primary" bg="bg-primary/10" />
      </div>
    </div>
  )
}

function QuickAction({
  icon: Icon, label, sublabel, color, bg, onClick,
}: {
  icon: typeof Home
  label: string
  sublabel: string
  color: string
  bg: string
  onClick?: () => void
}) {
  return (
    <button onClick={onClick}
      className="bg-card border border-border rounded-2xl p-3 text-left active:bg-secondary/30 transition-colors">
      <div className={`size-9 rounded-xl ${bg} flex items-center justify-center mb-2`}>
        <Icon className={`size-4 ${color}`} />
      </div>
      <p className="text-xs font-semibold text-foreground leading-tight">{label}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{sublabel}</p>
    </button>
  )
}

// =============================================================================
// Profile Section
// =============================================================================
function ProfileSection({ employee }: { employee: Employee }) {
  return (
    <div className="px-4 py-3 space-y-3">
      <div className="bg-card border border-border rounded-2xl p-5 text-center">
        <div className="size-20 mx-auto rounded-full bg-primary/15 flex items-center justify-center text-2xl font-bold text-primary mb-3">
          {employee.full_name.charAt(0).toUpperCase()}
        </div>
        <h2 className="text-base font-semibold text-foreground">{employee.full_name}</h2>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">{employee.employee_no}</p>
        <p className="text-[11px] text-muted-foreground mt-1 capitalize">{employee.category.replace("_", " ")}</p>
      </div>

      <div className="bg-card border border-border rounded-2xl divide-y divide-border/50">
        <InfoRow label="Phone"        value={employee.phone ?? "—"} />
        <InfoRow label="Email"        value={employee.email ?? "—"} />
        <InfoRow label="National ID"  value={employee.national_id ?? "—"} />
        <InfoRow label="Hire Date"    value={employee.hire_date ? new Date(employee.hire_date).toLocaleDateString("en-GB") : "—"} />
        <InfoRow label="Contract"     value={employee.contract_type ?? "—"} className="capitalize" />
        <InfoRow label="Status"       value={employee.status ?? "—"} className="capitalize" />
      </div>

      <p className="text-[10px] text-center text-muted-foreground pb-2">
        To update your info, please contact HR
      </p>
    </div>
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

// =============================================================================
// Coming Soon (placeholder)
// =============================================================================
function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
        <Clock className="size-7 text-primary" />
      </div>
      <h2 className="text-base font-semibold text-foreground mb-1">{title}</h2>
      <p className="text-xs text-muted-foreground">Coming in the next update</p>
    </div>
  )
}
