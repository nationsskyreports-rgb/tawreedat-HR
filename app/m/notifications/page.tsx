"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Bell, BellOff, Check, CheckCheck,
  Trash2, Loader2, CalendarCheck, DollarSign,
  Megaphone, RefreshCw, FileText, Star, Info,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Notification, NotificationType } from "@/lib/types"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const typeConfig: Record<NotificationType, { label: string; icon: typeof Bell; color: string; bg: string }> = {
  leave_request:      { label: "Leave Request",     icon: CalendarCheck, color: "text-chart-2",     bg: "bg-chart-2/15" },
  leave_approved:     { label: "Leave Approved",    icon: CalendarCheck, color: "text-chart-3",     bg: "bg-chart-3/15" },
  leave_rejected:     { label: "Leave Rejected",    icon: CalendarCheck, color: "text-destructive",  bg: "bg-destructive/15" },
  shift_assigned:     { label: "Shift Assigned",    icon: Bell,          color: "text-primary",      bg: "bg-primary/15" },
  shift_swap_request: { label: "Shift Swap",        icon: RefreshCw,     color: "text-chart-4",     bg: "bg-chart-4/15" },
  payroll_ready:      { label: "Payroll Ready",     icon: DollarSign,    color: "text-chart-3",     bg: "bg-chart-3/15" },
  document_expiring:  { label: "Doc Expiring",      icon: FileText,      color: "text-chart-2",     bg: "bg-chart-2/15" },
  announcement:       { label: "Announcement",      icon: Megaphone,     color: "text-primary",      bg: "bg-primary/15" },
  review_due:         { label: "Review Due",        icon: Star,          color: "text-chart-4",     bg: "bg-chart-4/15" },
  general:            { label: "General",           icon: Info,          color: "text-muted-foreground", bg: "bg-secondary" },
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const router  = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading,       setLoading]       = useState(true)
  const [userId,        setUserId]        = useState<string | null>(null)
  const [actionId,      setActionId]      = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }
    setUserId(user.id)

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40)

    setNotifications((data ?? []) as Notification[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function markRead(id: string) {
    setActionId(id)
    await supabase.from("notifications").update({
      is_read: true, read_at: new Date().toISOString(),
    }).eq("id", id)
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, is_read: true } : n))
    setActionId(null)
  }

  async function deleteNotif(id: string) {
    setActionId(id)
    await supabase.from("notifications").delete().eq("id", id)
    setNotifications(ns => ns.filter(n => n.id !== id))
    setActionId(null)
  }

  async function markAllRead() {
    if (!userId) return
    setActionId("all")
    await supabase.from("notifications").update({
      is_read: true, read_at: new Date().toISOString(),
    }).eq("user_id", userId).eq("is_read", false)
    setNotifications(ns => ns.map(n => ({ ...n, is_read: true })))
    setActionId(null)
  }

  const unread = notifications.filter(n => !n.is_read).length

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <header className="shrink-0 bg-card border-b border-border px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => router.push("/m")} className="p-1.5 text-muted-foreground">
            <ArrowLeft className="size-4" />
          </button>
          <h1 className="text-sm font-semibold text-foreground flex items-center gap-2">
            Notifications
            {unread > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {unread}
              </span>
            )}
          </h1>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} disabled={actionId === "all"}
            className="flex items-center gap-1 text-[11px] text-primary font-medium">
            {actionId === "all"
              ? <Loader2 className="size-3 animate-spin" />
              : <CheckCheck className="size-3.5" />}
            Mark all read
          </button>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto overscroll-contain">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-20">
            <BellOff className="size-12 opacity-30" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {notifications.map(n => {
              const cfg = typeConfig[n.notification_type] ?? typeConfig.general
              const Icon = cfg.icon
              const isLoading = actionId === n.id

              return (
                <div key={n.id}
                  className={`flex items-start gap-3 px-4 py-3.5 transition-colors ${
                    n.is_read ? "opacity-60" : "bg-primary/5"
                  }`}>

                  {/* Icon */}
                  <div className={`size-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${cfg.bg}`}>
                    <Icon className={`size-4 ${cfg.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0" onClick={() => !n.is_read && markRead(n.id)}>
                    <p className={`text-sm font-medium leading-snug ${n.is_read ? "text-muted-foreground" : "text-foreground"}`}>
                      {n.title}
                    </p>
                    {n.message && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                      {!n.is_read && (
                        <span className="size-1.5 rounded-full bg-primary inline-block" />
                      )}
                    </div>
                  </div>

                  {/* Delete */}
                  <button onClick={() => deleteNotif(n.id)} disabled={isLoading}
                    className="shrink-0 p-1.5 text-muted-foreground active:text-destructive transition-colors mt-0.5">
                    {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <MobileBottomNav />
    </>
  )
}
