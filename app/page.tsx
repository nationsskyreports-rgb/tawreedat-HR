"use client"

import { useState, useRef, useEffect } from "react"
import { useTheme } from "next-themes"
import { Sidebar } from "@/components/sidebar"
import { OverviewTab } from "@/components/overview-tab"
import { CheckinTab } from "@/components/checkin-tab"
import { ATSTab } from "@/components/ats-tab"
import { EmployeesTab } from "@/components/employees-tab"
import { SchedulingTab } from "@/components/scheduling-tab"
import { SettingsTab } from "@/components/settings-tab"
import { PayrollTab } from "@/components/payroll-tab"
import { LeavesTab } from "@/components/leaves-tab"
import { ReportsTab } from "@/components/reports-tab"
import { AnnouncementsTab } from "@/components/announcements-tab"
import { DocumentsTab } from "@/components/documents-tab"
import { HolidaysTab } from "@/components/holidays-tab"
import { PerformanceTab } from "@/components/performance-tab"
import { RequestsTab } from "@/components/requests-tab"
import { Bell, X, Sun, Moon, Shield, Briefcase, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { toast } from "@/components/toast"
import type { Profile, UserRole } from "@/lib/types"
import { CompetencesTab } from "@/components/competences-tab"
import { MyTeamTab }        from "@/components/my-team-tab"
import { NotificationsTab } from "@/components/notifications-tab"
import { ProbationTab }     from "@/components/probation-tab"

const roleConfig: Record<UserRole, { label: string; color: string; icon: typeof Shield }> = {
  admin:    { label: "Admin",    color: "bg-destructive/15 text-destructive", icon: Shield },
  hr:       { label: "HR",       color: "bg-primary/15 text-primary",         icon: Briefcase },
  manager:  { label: "Manager",  color: "bg-chart-2/15 text-chart-2",         icon: Briefcase },
  employee: { label: "Employee", color: "bg-secondary text-secondary-foreground", icon: User },
}

function getInitials(name: string | null | undefined, fallback: string): string {
  if (!name) return fallback.charAt(0).toUpperCase()
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export default function Page() {
  const [activeTab, setActiveTab] = useState("overview")
  const [showNotifications, setShowNotifications] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [notifs, setNotifs] = useState<Array<{
    id: string
    title: string
    message: string | null
    is_read: boolean
    created_at: string
  }>>([])
  const { theme, setTheme } = useTheme()
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserEmail(user.email ?? null)

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (profileData) {
        setProfile(profileData as Profile)

        // Auto-redirect: employees go to mobile view
        if (profileData.role === "employee") {
          window.location.href = "/m"
        }
      }
    }

    loadUser()

    // ── Real bell notifications for the current user ─────────────────────
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function loadNotifs() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("notifications")
        .select("id, title, message, is_read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20)

      setNotifs((data ?? []) as typeof notifs)

      // Live updates via Supabase Realtime
      channel = supabase
        .channel(`notif:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const n = payload.new as typeof notifs[number]
            setNotifs(prev => [n, ...prev].slice(0, 20))
            // Fire a toast so HR sees new arrivals even without opening the bell
            toast(n.title, "info")
          }
        )
        .subscribe()
    }
    loadNotifs()

    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  const unreadCount = notifs.filter(n => !n.is_read).length
  const displayName = profile?.full_name ?? userEmail ?? "..."
  const initials = getInitials(profile?.full_name, userEmail ?? "?")
  const role = profile?.role ?? "employee"
  const RoleIcon = roleConfig[role].icon

  const tabContent: Record<string, React.ReactNode> = {
    overview:      <OverviewTab />,
    checkin:       <CheckinTab />,
    ats:           <ATSTab />,
    employees:     <EmployeesTab />,
    scheduling:    <SchedulingTab />,
    settings:      <SettingsTab />,
    payroll:       <PayrollTab />,
    leaves:        <LeavesTab />,
    requests:      <RequestsTab />,
    reports:       <ReportsTab />,
    announcements: <AnnouncementsTab />,
    documents:     <DocumentsTab />,
    holidays:      <HolidaysTab />,
    performance:   <PerformanceTab />,
    competences:   <CompetencesTab />,
    probation:     <ProbationTab />,
    my_team:       <MyTeamTab />,
    notifications: <NotificationsTab />,
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-foreground">Tawreedat HR</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>

            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative"
                aria-label="Notifications"
              >
                <Bell className="size-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
                {unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 size-3 bg-destructive rounded-full flex items-center justify-center">
                    <span className="text-[8px] text-white font-bold">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  </div>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-8 w-72 bg-card border border-border rounded-xl shadow-2xl z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="text-xs font-medium text-foreground">
                      Notifications {unreadCount > 0 && <span className="text-muted-foreground font-normal">· {unreadCount} new</span>}
                    </span>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={async () => {
                            const { data: { user } } = await supabase.auth.getUser()
                            if (!user) return
                            await supabase.from("notifications")
                              .update({ is_read: true, read_at: new Date().toISOString() })
                              .eq("user_id", user.id).eq("is_read", false)
                            setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
                          }}
                          className="text-[10px] text-primary hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                      <button onClick={() => setShowNotifications(false)} aria-label="Close">
                        <X className="size-3.5 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col py-1 max-h-96 overflow-y-auto">
                    {notifs.length === 0 && (
                      <p className="px-4 py-6 text-xs text-muted-foreground text-center">
                        No notifications yet
                      </p>
                    )}
                    {notifs.map((n) => (
                      <div
                        key={n.id}
                        className={`px-4 py-2.5 border-b border-border/40 last:border-0 hover:bg-secondary/50 transition-colors ${
                          !n.is_read ? "bg-primary/5" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs ${!n.is_read ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                            {n.title}
                          </p>
                          {!n.is_read && <div className="size-1.5 bg-primary rounded-full mt-1 shrink-0" />}
                        </div>
                        {n.message && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {new Date(n.created_at).toLocaleString("en-GB", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="h-4 w-px bg-border" />

            <div className="flex items-center gap-2.5">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="size-7 rounded-full object-cover"
                />
              ) : (
                <div className="size-7 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-[10px] font-semibold text-primary">{initials}</span>
                </div>
              )}
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-medium text-foreground">{displayName}</span>
                <div className="flex items-center gap-1">
                  <RoleIcon className="size-2.5 text-muted-foreground" />
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${roleConfig[role].color}`}>
                    {roleConfig[role].label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex items-center gap-1 px-6 py-2 border-b border-border/50 bg-sidebar/60 shrink-0 overflow-x-auto">
          {[
            { id: "overview",  label: "Command Center" },
            { id: "checkin",   label: "Field Check-In" },
            { id: "ats",       label: "AI Recruitment" },
            { id: "payroll",   label: "Payroll" },
            { id: "employees", label: "Employees" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors ${
                activeTab === t.id
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <main className="flex-1 overflow-auto p-6">
          {tabContent[activeTab] ?? tabContent["overview"]}
        </main>
      </div>
    </div>
  )
}
