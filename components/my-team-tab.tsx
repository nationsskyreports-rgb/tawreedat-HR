"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Users, UserCheck, UserX, Clock, CalendarCheck,
  Loader2, Phone, Mail, MapPin, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, AlertCircle,
} from "lucide-react"
import type { Employee, AttendanceStatus, LeaveRequestStatus } from "@/lib/types"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface TeamMember extends Employee {
  dept_name:     string | null
  pos_title:     string | null
  today_status:  AttendanceStatus | null
  checkin_time:  string | null
  pending_leaves: number
}

interface PendingLeave {
  id:            string
  employee_id:   string
  employee_name: string
  leave_type:    string
  start_date:    string
  end_date:      string
  total_days:    number
}

const statusConfig: Record<AttendanceStatus, { label: string; color: string }> = {
  present:  { label: "Present",  color: "bg-chart-3/15 text-chart-3" },
  late:     { label: "Late",     color: "bg-primary/15 text-primary" },
  absent:   { label: "Absent",   color: "bg-destructive/15 text-destructive" },
  on_leave: { label: "On Leave", color: "bg-chart-4/15 text-chart-4" },
  holiday:  { label: "Holiday",  color: "bg-chart-2/15 text-chart-2" },
  half_day: { label: "Half Day", color: "bg-secondary text-secondary-foreground" },
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
export function MyTeamTab() {
  const [team,          setTeam]          = useState<TeamMember[]>([])
  const [pendingLeaves, setPendingLeaves] = useState<PendingLeave[]>([])
  const [loading,       setLoading]       = useState(true)
  const [expandedId,    setExpandedId]    = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [managerEmpId,  setManagerEmpId]  = useState<string | null>(null)
  const [activeFilter,  setActiveFilter]  = useState<"all" | AttendanceStatus | "not_checked">("all")

  async function load() {
    setLoading(true)

    // 1. Get current user → profile → employee_id
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setCurrentUserId(user.id)

    const { data: profile } = await supabase
      .from("profiles").select("employee_id").eq("id", user.id).single()

    if (!profile?.employee_id) { setLoading(false); return }
    setManagerEmpId(profile.employee_id)

    // 2. Load direct reports
    const { data: reports } = await supabase
      .from("employees")
      .select(`
        *,
        departments(name),
        positions(title)
      `)
      .eq("manager_id", profile.employee_id)
      .eq("status", "active")
      .order("full_name")

    if (!reports?.length) { setLoading(false); return }

    // 3. Today's attendance for each
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const empIds = reports.map(e => e.id)

    const { data: attendance } = await supabase
      .from("attendance_logs")
      .select("employee_id, status, checkin_at")
      .in("employee_id", empIds)
      .gte("checkin_at", todayStart.toISOString())
      .order("checkin_at", { ascending: false })

    // 4. Pending leave counts per employee
    const { data: leaves } = await supabase
      .from("leave_requests")
      .select("employee_id, id, start_date, end_date, total_days, leave_types(name)")
      .in("employee_id", empIds)
      .eq("status", "pending")
      .order("created_at", { ascending: false })

    // Build team members
    const teamData: TeamMember[] = reports.map(emp => {
      const att = attendance?.find(a => a.employee_id === emp.id)
      const pendingCount = leaves?.filter(l => l.employee_id === emp.id).length ?? 0
      return {
        ...emp,
        dept_name:      (emp as any).departments?.name ?? null,
        pos_title:      (emp as any).positions?.title  ?? null,
        today_status:   (att?.status as AttendanceStatus) ?? null,
        checkin_time:   att?.checkin_at ?? null,
        pending_leaves: pendingCount,
      }
    })

    // Build pending leaves with employee names
    const pendingData: PendingLeave[] = (leaves ?? []).map((l: any) => ({
      id:            l.id,
      employee_id:   l.employee_id,
      employee_name: reports.find(e => e.id === l.employee_id)?.full_name ?? "—",
      leave_type:    l.leave_types?.name ?? "—",
      start_date:    l.start_date,
      end_date:      l.end_date,
      total_days:    l.total_days,
    }))

    setTeam(teamData)
    setPendingLeaves(pendingData)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function approveLeave(id: string) {
    setActionLoading(id)
    await supabase.from("leave_requests").update({
      status: "approved", approved_by: currentUserId, approved_at: new Date().toISOString(),
    }).eq("id", id)
    await load()
    setActionLoading(null)
  }

  async function rejectLeave(id: string) {
    setActionLoading(id)
    await supabase.from("leave_requests").update({
      status: "rejected", approved_by: currentUserId, approved_at: new Date().toISOString(),
    }).eq("id", id)
    await load()
    setActionLoading(null)
  }

  // ── Derived stats ──────────────────────────────────────────────────────────
  const present    = team.filter(t => t.today_status === "present" || t.today_status === "late").length
  const absent     = team.filter(t => t.today_status === "absent").length
  const onLeave    = team.filter(t => t.today_status === "on_leave").length
  const notChecked = team.filter(t => !t.today_status).length

  const filteredTeam = team.filter(m => {
    if (activeFilter === "all")        return true
    if (activeFilter === "not_checked") return !m.today_status
    return m.today_status === activeFilter
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" /> Loading your team...
      </div>
    )
  }

  if (!managerEmpId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <Users className="size-12 text-muted-foreground/30" />
        <p className="text-sm font-medium text-foreground">No employee profile linked</p>
        <p className="text-xs text-muted-foreground">Ask Admin to link your account to an employee record</p>
      </div>
    )
  }

  if (team.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <Users className="size-12 text-muted-foreground/30" />
        <p className="text-sm font-medium text-foreground">No direct reports found</p>
        <p className="text-xs text-muted-foreground">
          Employees appear here when their Manager field is set to your employee record
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">My Team</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {team.length} direct report{team.length !== 1 ? "s" : ""} ·{" "}
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Reports",   value: team.length,  icon: Users,      color: "text-primary",     bg: "bg-primary/10",     filter: "all" as const },
          { label: "Present Today",   value: present,      icon: UserCheck,  color: "text-chart-3",     bg: "bg-chart-3/10",     filter: "present" as const },
          { label: "Absent / Leave",  value: absent + onLeave, icon: UserX, color: "text-destructive", bg: "bg-destructive/10", filter: "absent" as const },
          { label: "Not Checked In",  value: notChecked,   icon: Clock,      color: "text-chart-2",     bg: "bg-chart-2/10",     filter: "not_checked" as const },
        ].map(stat => (
          <Card key={stat.label}
            className={`border-border bg-card cursor-pointer transition-colors hover:bg-secondary/30 ${activeFilter === stat.filter ? "ring-1 ring-primary" : ""}`}
            onClick={() => setActiveFilter(activeFilter === stat.filter ? "all" : stat.filter)}>
            <CardContent className="p-4">
              <div className={`size-9 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                <stat.icon className={`size-4 ${stat.color}`} />
              </div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-semibold text-foreground tabular-nums mt-0.5">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending leave approvals */}
      {pendingLeaves.length > 0 && (
        <Card className="border-border bg-card border-l-4 border-l-chart-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarCheck className="size-4 text-chart-2" />
              Pending Leave Requests
              <Badge className="bg-chart-2/15 text-chart-2 text-xs border-0 ml-1">
                {pendingLeaves.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {pendingLeaves.map(l => (
                <div key={l.id} className="flex items-center justify-between px-4 py-3 gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{l.employee_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {l.leave_type} ·{" "}
                      {new Date(l.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      {" → "}
                      {new Date(l.end_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      {" · "}<strong>{l.total_days}d</strong>
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => approveLeave(l.id)} disabled={actionLoading === l.id}
                      className="flex items-center gap-1 px-2.5 py-1 bg-chart-3/15 text-chart-3 rounded-lg text-xs font-medium hover:bg-chart-3/25 transition-colors disabled:opacity-50">
                      {actionLoading === l.id ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                      Approve
                    </button>
                    <button onClick={() => rejectLeave(l.id)} disabled={actionLoading === l.id}
                      className="flex items-center gap-1 px-2.5 py-1 bg-destructive/15 text-destructive rounded-lg text-xs font-medium hover:bg-destructive/25 transition-colors disabled:opacity-50">
                      <XCircle className="size-3" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {([
          { id: "all",         label: "All" },
          { id: "present",     label: "Present" },
          { id: "late",        label: "Late" },
          { id: "absent",      label: "Absent" },
          { id: "on_leave",    label: "On Leave" },
          { id: "not_checked", label: "Not Checked" },
        ] as const).map(f => (
          <button key={f.id} onClick={() => setActiveFilter(f.id)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              activeFilter === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Team list */}
      <div className="space-y-2">
        {filteredTeam.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No employees match this filter</p>
        ) : (
          filteredTeam.map(member => {
            const isExpanded = expandedId === member.id
            const status = member.today_status
              ? statusConfig[member.today_status]
              : { label: "Not Checked", color: "bg-secondary text-muted-foreground" }

            return (
              <Card key={member.id} className="border-border bg-card">
                <div
                  className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-secondary/20 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : member.id)}
                >
                  {/* Avatar */}
                  <div className="size-10 rounded-full bg-primary/15 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                    {member.full_name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{member.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.pos_title ?? "—"} · {member.dept_name ?? "—"}
                    </p>
                  </div>

                  {/* Status + pending */}
                  <div className="flex items-center gap-2 shrink-0">
                    {member.pending_leaves > 0 && (
                      <Badge className="bg-chart-2/15 text-chart-2 text-[10px] border-0">
                        {member.pending_leaves} leave
                      </Badge>
                    )}
                    <Badge className={`text-[10px] border-0 ${status.color}`}>
                      {status.label}
                    </Badge>
                    {isExpanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-border/50 px-4 pb-4 pt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Employee No</p>
                      <p className="text-xs font-mono font-semibold text-foreground">{member.employee_no}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Check-in Time</p>
                      <p className="text-xs font-mono text-foreground">
                        {member.checkin_time
                          ? new Date(member.checkin_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Contract</p>
                      <p className="text-xs text-foreground capitalize">{member.contract_type}</p>
                    </div>
                    {member.phone && (
                      <a href={`tel:${member.phone}`}
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                        <Phone className="size-3" /> {member.phone}
                      </a>
                    )}
                    {member.email && (
                      <a href={`mailto:${member.email}`}
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline col-span-2 md:col-span-1 truncate">
                        <Mail className="size-3" /> {member.email}
                      </a>
                    )}
                  </div>
                )}
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
