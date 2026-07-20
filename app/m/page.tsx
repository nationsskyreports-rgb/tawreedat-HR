"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Home, MapPin, Wallet, User, LogOut, Loader2,
  CheckCircle2, Clock, Megaphone, FileText,
  CalendarCheck, Download, Shield, Briefcase,
  Users, BarChart3, ClipboardList, Timer,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { signOutKeepingBiometric } from "@/lib/webauthn"
import type {
  Profile, Employee, AttendanceLog, ShiftAssignment, Shift,
} from "@/lib/types"

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export default function MobileHomePage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [todayCheckin, setTodayCheckin] = useState<AttendanceLog | null>(null)
  const [todayShift, setTodayShift] = useState<{ shift: Shift; assignment: ShiftAssignment } | null>(null)
  const [pendingLeaves, setPendingLeaves] = useState(0)
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
    }
    function onBeforeInstall(e: Event) {
      e.preventDefault()
      setInstallPrompt(e as InstallPromptEvent)
    }
    function onInstalled() { setIsInstalled(true); setInstallPrompt(null) }
    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

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

      if (empData) {
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const todayStr = todayStart.toISOString().split("T")[0]
        const nowISO = new Date().toISOString()

        const [checkinRes, leavesRes, shiftRes, annRes] = await Promise.all([
          supabase.from("attendance_logs").select("*")
            .eq("employee_id", empData.id)
            .gte("checkin_at", todayStart.toISOString())
            .order("checkin_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("leave_requests").select("id", { count: "exact", head: true })
            .eq("employee_id", empData.id).eq("status", "pending"),
          supabase.from("shift_assignments").select("*, shifts(*)")
            .eq("employee_id", empData.id).eq("assignment_date", todayStr).maybeSingle(),
          supabase.from("announcements").select("id", { count: "exact", head: true })
            .lte("publish_at", nowISO).or(`expires_at.is.null,expires_at.gt.${nowISO}`),
        ])

        setTodayCheckin(checkinRes.data as AttendanceLog | null)
        setPendingLeaves(leavesRes.count ?? 0)
        setUnreadAnnouncements(annRes.count ?? 0)
        if (shiftRes.data) {
          const sd = shiftRes.data as any
          setTodayShift({ shift: sd.shifts, assignment: sd })
        }
      }
    }

    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  async function logout() {
    await signOutKeepingBiometric()
    router.push("/login")
  }

  async function triggerInstall() {
    if (!installPrompt) {
      alert("To install: tap your browser's Share/Menu button → 'Add to Home Screen'")
      return
    }
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === "accepted") setInstallPrompt(null)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" /> Loading...
      </div>
    )
  }

  const role = profile?.role ?? "employee"
  const isAdminRole = ["admin", "hr", "manager"].includes(role)

  return (
    <>
      {/* Header */}
      <header className="shrink-0 bg-card border-b border-border px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-9 rounded-full bg-primary/15 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
            {(profile?.full_name ?? "?").charAt(0).toUpperCase()}
          </div>
          <div className="leading-tight min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {profile?.full_name ?? "..."}
            </p>
            <p className="text-[10px] text-muted-foreground capitalize">
              {employee?.employee_no ? `${employee.employee_no} · ` : ""}{role}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isInstalled && installPrompt && (
            <button
              onClick={triggerInstall}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-primary/10 text-primary text-[10px] font-medium rounded-lg"
            >
              <Download className="size-3" /> Install
            </button>
          )}
          <button onClick={logout} className="p-2 text-muted-foreground active:text-destructive transition-colors">
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 py-3 space-y-3">

          {/* Install banner */}
          {!isInstalled && (
            <button
              onClick={triggerInstall}
              className="w-full bg-primary/10 border border-primary/30 rounded-xl p-3 flex items-center gap-3 active:bg-primary/15 transition-colors"
            >
              <div className="size-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <Download className="size-4 text-primary" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">Install Tawreedat App</p>
                <p className="text-[10px] text-muted-foreground">
                  {installPrompt ? "Tap to install on your device" : "Share menu → Add to Home Screen"}
                </p>
              </div>
            </button>
          )}

          {/* Greeting */}
          {(() => {
            const now = new Date()
            const greeting = now.getHours() < 12 ? "Good morning"
              : now.getHours() < 18 ? "Good afternoon" : "Good evening"
            const name = (profile?.full_name ?? "").split(" ")[0] || "..."
            return (
              <div>
                <p className="text-xs text-muted-foreground">{greeting},</p>
                <p className="text-lg font-semibold text-foreground">{name} 👋</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {new Date().toLocaleDateString("en-GB", {
                    weekday: "long", day: "numeric", month: "long",
                  })}
                </p>
              </div>
            )
          })()}

          {/* Admin/HR/Manager quick access */}
          {isAdminRole && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                {role === "admin" && <Shield className="size-4 text-destructive" />}
                {role === "hr"    && <Briefcase className="size-4 text-primary" />}
                {role === "manager" && <Users className="size-4 text-chart-2" />}
                <p className="text-xs font-semibold text-foreground capitalize">{role} Access</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <QuickAction icon={Users}        label="Employees"    sublabel="Manage staff"
                  color="text-primary"   bg="bg-primary/10"   onClick={() => window.location.href = "/"} />
                <QuickAction icon={BarChart3}    label="Reports"      sublabel="View attendance"
                  color="text-chart-3"   bg="bg-chart-3/10"   onClick={() => window.location.href = "/"} />
                <QuickAction icon={CalendarCheck} label="Leave Requests" sublabel={`${pendingLeaves} pending`}
                  color="text-chart-2"   bg="bg-chart-2/10"   onClick={() => window.location.href = "/"} />
                <QuickAction icon={Megaphone}    label="Announcements" sublabel="Post update"
                  color="text-chart-4"   bg="bg-chart-4/10"   onClick={() => window.location.href = "/"} />
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-3">
                Tap any item to switch to Desktop view
              </p>
            </div>
          )}

          {/* Employee — Today status */}
          {!isAdminRole && (
            <>
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
                      {new Date(todayCheckin.checkin_at).toLocaleTimeString("en-GB", {
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => router.push("/m/checkin")}
                    className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold active:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <MapPin className="size-4" />
                    Check In Now
                  </button>
                )}
              </div>

              {/* Quick Actions Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <QuickAction
                  icon={ClipboardList} label="Attendance"    sublabel="Time sheet & requests"
                  color="text-primary"  bg="bg-primary/10"
                  onClick={() => router.push("/m/attendance")}
                />
                <QuickAction
                  icon={CalendarCheck} label="Leave"          sublabel={`${pendingLeaves} pending`}
                  color="text-chart-2"  bg="bg-chart-2/10"
                  onClick={() => router.push("/m/leave")}
                />
                <QuickAction
                  icon={Timer}         label="Overtime"       sublabel="Request or view OT"
                  color="text-chart-3"  bg="bg-chart-3/10"
                  onClick={() => router.push("/m/attendance")}
                />
                <QuickAction
                  icon={Wallet}        label="My Payslip"     sublabel="View latest"
                  color="text-chart-4"  bg="bg-chart-4/10"
                  onClick={() => router.push("/m/payslip")}
                />
                <QuickAction
                  icon={Megaphone}     label="Announcements"  sublabel={`${unreadAnnouncements} active`}
                  color="text-chart-2"  bg="bg-chart-2/10"
                />
                <QuickAction
                  icon={FileText}      label="Documents"      sublabel="View your files"
                  color="text-muted-foreground" bg="bg-secondary"
                />
              </div>
            </>
          )}

          <div className="h-2" />
        </div>
      </main>

      {/* Bottom Nav (inline — mirrors MobileBottomNav) */}
      <nav
        className="shrink-0 bg-card border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5">
          {[
            { href: "/m",            label: "Home",       icon: Home },
            { href: "/m/checkin",    label: "Check-In",   icon: MapPin },
            { href: "/m/attendance", label: "Attendance", icon: ClipboardList },
            { href: "/m/leave",      label: "Leave",      icon: CalendarCheck },
            { href: "/m/profile",    label: "Profile",    icon: User },
          ].map(item => {
            const Icon = item.icon
            const isActive = typeof window !== "undefined" && window.location.pathname === item.href
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className="flex flex-col items-center justify-center py-2 gap-0.5 active:bg-secondary/30 transition-colors"
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

function QuickAction({
  icon: Icon, label, sublabel, color, bg, onClick,
}: {
  icon: typeof Home; label: string; sublabel: string
  color: string; bg: string; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="bg-card border border-border rounded-2xl p-3 text-left active:bg-secondary/30 transition-colors"
    >
      <div className={`size-9 rounded-xl ${bg} flex items-center justify-center mb-2`}>
        <Icon className={`size-4 ${color}`} />
      </div>
      <p className="text-xs font-semibold text-foreground leading-tight">{label}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{sublabel}</p>
    </button>
  )
}
