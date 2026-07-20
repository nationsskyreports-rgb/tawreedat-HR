"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Bell, BellOff, Check, CheckCheck, Trash2,
  Megaphone, Loader2, Plus, X, AlertCircle,
  CalendarCheck, FileText, DollarSign, Star,
  RefreshCw, Info,
} from "lucide-react"
import type { Notification, NotificationType, UserRole } from "@/lib/types"

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const typeConfig: Record<NotificationType, { label: string; icon: typeof Bell; color: string }> = {
  leave_request:     { label: "Leave Request",      icon: CalendarCheck, color: "text-chart-2" },
  leave_approved:    { label: "Leave Approved",     icon: CalendarCheck, color: "text-chart-3" },
  leave_rejected:    { label: "Leave Rejected",     icon: CalendarCheck, color: "text-destructive" },
  shift_assigned:    { label: "Shift Assigned",     icon: Bell,          color: "text-primary" },
  shift_swap_request:{ label: "Shift Swap",         icon: RefreshCw,     color: "text-chart-4" },
  payroll_ready:     { label: "Payroll Ready",      icon: DollarSign,    color: "text-chart-3" },
  document_expiring: { label: "Document Expiring",  icon: FileText,      color: "text-chart-2" },
  announcement:      { label: "Announcement",       icon: Megaphone,     color: "text-primary" },
  review_due:        { label: "Review Due",         icon: Star,          color: "text-chart-4" },
  general:           { label: "General",            icon: Info,          color: "text-muted-foreground" },
}

type FilterType = "all" | "unread" | NotificationType

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
export function NotificationsTab() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading,       setLoading]       = useState(true)
  const [role,          setRole]          = useState<UserRole>("employee")
  const [userId,        setUserId]        = useState<string | null>(null)
  const [filter,        setFilter]        = useState<FilterType>("all")
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Broadcast form
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [bcTitle,       setBcTitle]       = useState("")
  const [bcMessage,     setBcMessage]     = useState("")
  const [bcType,        setBcType]        = useState<NotificationType>("announcement")
  const [bcTargetRole,  setBcTargetRole]  = useState<UserRole | "all">("all")
  const [bcSending,     setBcSending]     = useState(false)
  const [bcErr,         setBcErr]         = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)

    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).single()
    if (profile) setRole(profile.role as UserRole)

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    setNotifications((data ?? []) as Notification[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function markRead(id: string) {
    setActionLoading(id)
    await supabase.from("notifications").update({
      is_read: true, read_at: new Date().toISOString(),
    }).eq("id", id)
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, is_read: true } : n))
    setActionLoading(null)
  }

  async function markAllRead() {
    if (!userId) return
    setActionLoading("all")
    await supabase.from("notifications").update({
      is_read: true, read_at: new Date().toISOString(),
    }).eq("user_id", userId).eq("is_read", false)
    setNotifications(ns => ns.map(n => ({ ...n, is_read: true })))
    setActionLoading(null)
  }

  async function deleteNotif(id: string) {
    setActionLoading(id)
    await supabase.from("notifications").delete().eq("id", id)
    setNotifications(ns => ns.filter(n => n.id !== id))
    setActionLoading(null)
  }

  async function clearRead() {
    if (!userId) return
    setActionLoading("clear")
    await supabase.from("notifications").delete()
      .eq("user_id", userId).eq("is_read", true)
    setNotifications(ns => ns.filter(n => !n.is_read))
    setActionLoading(null)
  }

  // ── Broadcast ──────────────────────────────────────────────────────────────
  async function sendBroadcast() {
    setBcErr(null)
    if (!bcTitle.trim()) { setBcErr("Title is required"); return }
    setBcSending(true)

    // Load target profiles
    let query = supabase.from("profiles").select("id")
    if (bcTargetRole !== "all") query = query.eq("role", bcTargetRole)
    const { data: profiles, error: pErr } = await query
    if (pErr || !profiles?.length) {
      setBcSending(false)
      setBcErr("No users found for this target")
      return
    }

    // Insert notification for each
    const rows = profiles.map(p => ({
      user_id:           p.id,
      notification_type: bcType,
      title:             bcTitle.trim(),
      message:           bcMessage.trim() || null,
      is_read:           false,
    }))

    const { error } = await supabase.from("notifications").insert(rows)
    if (error) { setBcSending(false); setBcErr(error.message); return }

    // Push to devices too (best-effort)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        await fetch("/api/send-push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            user_ids: profiles.map(p => p.id),
            title:    bcTitle.trim(),
            body:     (bcMessage.trim() || "").slice(0, 120),
            url:      "/m/notifications",
          }),
        })
      }
    } catch { /* best-effort */ }

    setBcSending(false)

    setBcTitle(""); setBcMessage(""); setShowBroadcast(false)
    await load()
  }

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = notifications.filter(n => {
    if (filter === "all")    return true
    if (filter === "unread") return !n.is_read
    return n.notification_type === filter
  })

  const unreadCount = notifications.filter(n => !n.is_read).length

  const isAdminOrHR = role === "admin" || role === "hr"

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" /> Loading notifications...
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            Notifications
            {unreadCount > 0 && (
              <Badge className="bg-primary/15 text-primary border-0">{unreadCount} unread</Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your notification inbox
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {unreadCount > 0 && (
            <button onClick={markAllRead} disabled={actionLoading === "all"}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              {actionLoading === "all" ? <Loader2 className="size-3 animate-spin" /> : <CheckCheck className="size-3.5" />}
              Mark all read
            </button>
          )}
          <button onClick={clearRead} disabled={actionLoading === "clear"}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors">
            {actionLoading === "clear" ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3.5" />}
            Clear read
          </button>
          {isAdminOrHR && (
            <button onClick={() => setShowBroadcast(!showBroadcast)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium">
              <Megaphone className="size-3.5" /> Broadcast
            </button>
          )}
        </div>
      </div>

      {/* Broadcast form */}
      {showBroadcast && isAdminOrHR && (
        <Card className="border-border bg-card border-l-4 border-l-primary">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Megaphone className="size-4 text-primary" /> Broadcast Notification
              </p>
              <button onClick={() => { setShowBroadcast(false); setBcErr(null) }}
                className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground block mb-1">Title *</label>
                <input value={bcTitle} onChange={e => setBcTitle(e.target.value)}
                  placeholder="e.g. Payroll released for June"
                  className="w-full bg-secondary/60 text-foreground text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-primary"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground block mb-1">Message (optional)</label>
                <textarea value={bcMessage} onChange={e => setBcMessage(e.target.value)}
                  rows={2} placeholder="Additional details..."
                  className="w-full bg-secondary/60 text-foreground text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-primary resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Type</label>
                <select value={bcType} onChange={e => setBcType(e.target.value as NotificationType)}
                  className="w-full bg-secondary/60 text-foreground text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-primary">
                  {(Object.keys(typeConfig) as NotificationType[]).map(t => (
                    <option key={t} value={t}>{typeConfig[t].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Send to</label>
                <select value={bcTargetRole} onChange={e => setBcTargetRole(e.target.value as any)}
                  className="w-full bg-secondary/60 text-foreground text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-primary">
                  <option value="all">All Users</option>
                  <option value="employee">Employees only</option>
                  <option value="manager">Managers only</option>
                  <option value="hr">HR only</option>
                  <option value="admin">Admins only</option>
                </select>
              </div>
            </div>

            {bcErr && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                <AlertCircle className="size-3.5 shrink-0" /> {bcErr}
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={sendBroadcast} disabled={bcSending}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium disabled:opacity-50">
                {bcSending ? <Loader2 className="size-3 animate-spin" /> : <Megaphone className="size-3" />}
                Send Broadcast
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter row */}
      <div className="flex gap-2 flex-wrap">
        {([
          { id: "all",    label: "All" },
          { id: "unread", label: `Unread (${unreadCount})` },
          { id: "announcement",   label: "Announcements" },
          { id: "leave_approved", label: "Leave" },
          { id: "payroll_ready",  label: "Payroll" },
          { id: "general",        label: "General" },
        ] as { id: FilterType; label: string }[]).map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <BellOff className="size-10 opacity-30" />
          <p className="text-sm">
            {filter === "unread" ? "No unread notifications" : "No notifications yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => {
            const cfg = typeConfig[n.notification_type] ?? typeConfig.general
            const Icon = cfg.icon
            return (
              <div key={n.id}
                className={`bg-card border rounded-xl px-4 py-3 flex items-start gap-3 transition-colors ${
                  n.is_read ? "border-border opacity-70" : "border-primary/30 bg-primary/5"
                }`}>
                {/* Icon */}
                <div className={`size-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  n.is_read ? "bg-secondary" : "bg-primary/15"
                }`}>
                  <Icon className={`size-4 ${n.is_read ? "text-muted-foreground" : cfg.color}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium ${n.is_read ? "text-muted-foreground" : "text-foreground"}`}>
                      {n.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                      {new Date(n.created_at).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {n.message && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge className="text-[10px] border-0 bg-secondary text-muted-foreground capitalize">
                      {cfg.label}
                    </Badge>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1 shrink-0">
                  {!n.is_read && (
                    <button onClick={() => markRead(n.id)} disabled={actionLoading === n.id}
                      title="Mark as read"
                      className="p-1.5 text-muted-foreground hover:text-chart-3 transition-colors">
                      {actionLoading === n.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    </button>
                  )}
                  <button onClick={() => deleteNotif(n.id)} disabled={actionLoading === n.id}
                    title="Delete"
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
