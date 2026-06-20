"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Users, UserCheck, Calendar, Briefcase, TrendingUp, TrendingDown,
  AlertTriangle, Clock, Loader2, MapPin, Truck, Package, Monitor, Shield
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { EmployeeCategory, EmployeeStatus, AttendanceStatus } from "@/lib/types"

type KPIs = {
  totalEmployees: number
  activeEmployees: number
  todayPresent: number
  todayAbsent: number
  todayLate: number
  onLeave: number
  openJobs: number
  pendingLeaves: number
  totalSites: number
}

type CategoryCount = { category: EmployeeCategory; count: number }
type SiteCount = { site_name: string; count: number }
type RecentAttendance = {
  id: string
  employee_name: string
  status: AttendanceStatus
  checkin_at: string
  site_name: string | null
}

const categoryConfig: Record<EmployeeCategory, { label: string; color: string; icon: typeof Truck }> = {
  driver:     { label: "Drivers",     color: "text-chart-1", icon: Truck },
  warehouse:  { label: "Warehouse",   color: "text-chart-2", icon: Package },
  field_ops:  { label: "Field Ops",   color: "text-chart-3", icon: MapPin },
  office:     { label: "Office",      color: "text-primary", icon: Monitor },
  supervisor: { label: "Supervisors", color: "text-destructive", icon: Shield },
}

const attendanceColors: Record<AttendanceStatus, string> = {
  present:   "bg-chart-3/15 text-chart-3",
  late:      "bg-primary/15 text-primary",
  absent:    "bg-destructive/15 text-destructive",
  on_leave:  "bg-chart-2/15 text-chart-2",
  holiday:   "bg-secondary text-secondary-foreground",
  half_day:  "bg-chart-4/15 text-chart-4",
}

export function OverviewTab() {
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [byCategory, setByCategory] = useState<CategoryCount[]>([])
  const [bySite, setBySite] = useState<SiteCount[]>([])
  const [recentAttendance, setRecentAttendance] = useState<RecentAttendance[]>([])
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayStartISO = todayStart.toISOString()

    const [
      empRes,
      attendanceRes,
      jobsRes,
      leavesRes,
      sitesRes,
      recentRes
    ] = await Promise.all([
      supabase.from("employees").select("id, category, status"),
      supabase.from("attendance_logs").select("status, employee_id").gte("checkin_at", todayStartISO),
      supabase.from("job_postings").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("sites").select("id, name").eq("is_active", true),
      supabase.from("attendance_logs")
        .select("id, status, checkin_at, employee_id, site_id, employees(full_name), sites(name)")
        .order("checkin_at", { ascending: false })
        .limit(8)
    ])

    const employees = empRes.data ?? []
    const attendance = attendanceRes.data ?? []
    const sites = sitesRes.data ?? []

    const activeEmployees = employees.filter((e) => e.status === "active").length
    const onLeave = employees.filter((e) => e.status === "on_leave").length
    const todayPresent = attendance.filter((a) => a.status === "present").length
    const todayLate = attendance.filter((a) => a.status === "late").length
    const todayAbsent = activeEmployees - new Set(attendance.map((a) => a.employee_id)).size

    setKpis({
      totalEmployees: employees.length,
      activeEmployees,
      todayPresent,
      todayAbsent: Math.max(0, todayAbsent),
      todayLate,
      onLeave,
      openJobs: jobsRes.count ?? 0,
      pendingLeaves: leavesRes.count ?? 0,
      totalSites: sites.length,
    })

    // Group by category
    const catMap = new Map<EmployeeCategory, number>()
    employees.forEach((e) => {
      const c = e.category as EmployeeCategory
      catMap.set(c, (catMap.get(c) ?? 0) + 1)
    })
    setByCategory(
      Array.from(catMap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
    )

    // Group by site (need to fetch employees with site)
    const { data: empWithSites } = await supabase
      .from("employees")
      .select("site_id, sites(name)")
      .not("site_id", "is", null)

    const siteMap = new Map<string, number>()
    ;(empWithSites ?? []).forEach((e: any) => {
      const name = e.sites?.name ?? "Unassigned"
      siteMap.set(name, (siteMap.get(name) ?? 0) + 1)
    })
    setBySite(
      Array.from(siteMap.entries())
        .map(([site_name, count]) => ({ site_name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
    )

    // Recent attendance
    setRecentAttendance(
      (recentRes.data ?? []).map((r: any) => ({
        id: r.id,
        employee_name: r.employees?.full_name ?? "Unknown",
        status: r.status,
        checkin_at: r.checkin_at,
        site_name: r.sites?.name ?? null,
      }))
    )

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading || !kpis) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading overview...
      </div>
    )
  }

  const attendanceRate = kpis.activeEmployees > 0
    ? Math.round((kpis.todayPresent / kpis.activeEmployees) * 100)
    : 0

  const maxCategoryCount = Math.max(...byCategory.map((c) => c.count), 1)
  const maxSiteCount = Math.max(...bySite.map((s) => s.count), 1)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Command Center</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time workforce overview · {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <Badge variant="secondary" className="bg-chart-3/10 text-chart-3">Live</Badge>
      </div>

      {/* Top KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Users}
          label="Total Workforce"
          value={kpis.totalEmployees}
          sublabel={`${kpis.activeEmployees} active`}
          color="text-primary"
          bgColor="bg-primary/10"
        />
        <KPICard
          icon={UserCheck}
          label="Present Today"
          value={kpis.todayPresent}
          sublabel={`${attendanceRate}% attendance rate`}
          color="text-chart-3"
          bgColor="bg-chart-3/10"
          trend={attendanceRate >= 80 ? "up" : "down"}
        />
        <KPICard
          icon={Clock}
          label="Late Today"
          value={kpis.todayLate}
          sublabel="checked in late"
          color="text-primary"
          bgColor="bg-primary/10"
        />
        <KPICard
          icon={AlertTriangle}
          label="Absent Today"
          value={kpis.todayAbsent}
          sublabel="no check-in yet"
          color="text-destructive"
          bgColor="bg-destructive/10"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Calendar}
          label="On Leave"
          value={kpis.onLeave}
          sublabel={`${kpis.pendingLeaves} pending requests`}
          color="text-chart-2"
          bgColor="bg-chart-2/10"
        />
        <KPICard
          icon={Briefcase}
          label="Open Positions"
          value={kpis.openJobs}
          sublabel="active job postings"
          color="text-chart-4"
          bgColor="bg-chart-4/10"
        />
        <KPICard
          icon={MapPin}
          label="Active Sites"
          value={kpis.totalSites}
          sublabel="operational locations"
          color="text-chart-1"
          bgColor="bg-chart-1/10"
        />
        <KPICard
          icon={UserCheck}
          label="Active Employees"
          value={kpis.activeEmployees}
          sublabel={`${kpis.totalEmployees - kpis.activeEmployees} inactive`}
          color="text-chart-3"
          bgColor="bg-chart-3/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Category */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground">Workforce by Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byCategory.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No data yet</p>
            ) : (
              byCategory.map(({ category, count }) => {
                const cfg = categoryConfig[category] ?? { label: category, color: "text-muted-foreground", icon: Users }
                const Icon = cfg.icon
                const pct = Math.round((count / maxCategoryCount) * 100)
                return (
                  <div key={category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Icon className={`size-3.5 ${cfg.color}`} />
                        <span className="text-foreground">{cfg.label}</span>
                      </div>
                      <span className="text-muted-foreground font-mono">{count}</span>
                    </div>
                    <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                      <div className={`h-full ${cfg.color.replace("text-", "bg-")} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* By Site */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground">Headcount by Site</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bySite.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No employees assigned to sites yet</p>
            ) : (
              bySite.map(({ site_name, count }) => {
                const pct = Math.round((count / maxSiteCount) * 100)
                return (
                  <div key={site_name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <MapPin className="size-3.5 text-chart-1" />
                        <span className="text-foreground truncate">{site_name}</span>
                      </div>
                      <span className="text-muted-foreground font-mono">{count}</span>
                    </div>
                    <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                      <div className="h-full bg-chart-1 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Attendance */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-foreground">Recent Check-Ins</CardTitle>
          <Badge variant="secondary" className="text-xs">Last 8 entries</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {recentAttendance.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No check-ins yet today.
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {recentAttendance.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary">
                      {a.employee_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">{a.employee_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {a.site_name ?? "No site"} · {new Date(a.checkin_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                  <Badge variant="secondary" className={`text-xs ${attendanceColors[a.status] ?? ""}`}>
                    {a.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KPICard({
  icon: Icon,
  label,
  value,
  sublabel,
  color,
  bgColor,
  trend,
}: {
  icon: typeof Users
  label: string
  value: number
  sublabel: string
  color: string
  bgColor: string
  trend?: "up" | "down"
}) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className={`size-9 rounded-lg ${bgColor} flex items-center justify-center`}>
            <Icon className={`size-4 ${color}`} />
          </div>
          {trend && (
            trend === "up"
              ? <TrendingUp className="size-3.5 text-chart-3" />
              : <TrendingDown className="size-3.5 text-destructive" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-semibold text-foreground tabular-nums">{value.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>
      </CardContent>
    </Card>
  )
}
