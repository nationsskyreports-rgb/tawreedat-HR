"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  BarChart3, Calendar, Download, Filter, Loader2,
  CheckCircle2, XCircle, Clock, TrendingUp, Users, MapPin
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type {
  Employee, Site, AttendanceLog, EmployeeCategory, AttendanceStatus
} from "@/lib/types"

type ReportRow = {
  employee_id: string
  employee_no: string
  full_name: string
  category: EmployeeCategory
  site_name: string
  working_days: number
  present: number
  late: number
  absent: number
  on_leave: number
  holidays: number
  overtime_hours: number
  late_minutes: number
  attendance_rate: number
}

const categoryLabels: Record<EmployeeCategory, string> = {
  driver:     "Driver",
  warehouse:  "Warehouse",
  field_ops:  "Field Ops",
  office:     "Office",
  supervisor: "Supervisor",
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

function getMonthRange(year: number, month: number): { start: string; end: string } {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0)
  return {
    start: startDate.toISOString().split("T")[0],
    end: endDate.toISOString().split("T")[0],
  }
}

function countWorkingDays(start: string, end: string): number {
  const s = new Date(start)
  const e = new Date(end)
  let count = 0
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const day = d.getDay()
    if (day !== 5 && day !== 6) count++ // Exclude Friday & Saturday
  }
  return count
}

export function ReportsTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [logs, setLogs] = useState<AttendanceLog[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [categoryFilter, setCategoryFilter] = useState<EmployeeCategory | "all">("all")
  const [siteFilter, setSiteFilter] = useState<string>("all")

  async function loadReport() {
    setLoading(true)
    const { start, end } = getMonthRange(year, month)

    const [empRes, siteRes, logsRes] = await Promise.all([
      supabase.from("employees").select("*").eq("status", "active").order("full_name"),
      supabase.from("sites").select("*").eq("is_active", true).order("name"),
      supabase.from("attendance_logs")
        .select("*")
        .gte("checkin_at", `${start}T00:00:00`)
        .lte("checkin_at", `${end}T23:59:59`),
    ])

    setEmployees((empRes.data ?? []) as Employee[])
    setSites((siteRes.data ?? []) as Site[])
    setLogs((logsRes.data ?? []) as AttendanceLog[])
    setLoading(false)
  }

  useEffect(() => { loadReport() }, [year, month])

  const report: ReportRow[] = useMemo(() => {
    if (employees.length === 0) return []

    const { start, end } = getMonthRange(year, month)
    const workingDays = countWorkingDays(start, end)

    return employees
      .filter(e => categoryFilter === "all" || e.category === categoryFilter)
      .filter(e => siteFilter === "all" || e.site_id === siteFilter)
      .map(emp => {
        const empLogs = logs.filter(l => l.employee_id === emp.id)

        // Count UNIQUE days (an employee can check in/out, but counts as 1 day)
        const presentDates = new Set<string>()
        const lateDates = new Set<string>()
        const absentDates = new Set<string>()
        const leaveDates = new Set<string>()
        const holidayDates = new Set<string>()

        empLogs.forEach(l => {
          const dateKey = l.checkin_at.split("T")[0]
          switch (l.status as AttendanceStatus) {
            case "present":  presentDates.add(dateKey); break
            case "late":     lateDates.add(dateKey); presentDates.add(dateKey); break
            case "absent":   absentDates.add(dateKey); break
            case "on_leave": leaveDates.add(dateKey); break
            case "holiday":  holidayDates.add(dateKey); break
          }
        })

        const presentCount = presentDates.size
        const lateCount = lateDates.size
        const leaveCount = leaveDates.size
        const holidayCount = holidayDates.size
        const explicitAbsent = absentDates.size
        const calculatedAbsent = Math.max(0, workingDays - presentCount - leaveCount - holidayCount - explicitAbsent)
        const totalAbsent = explicitAbsent + calculatedAbsent

        const overtimeMinutes = empLogs.reduce((sum, l) => sum + (l.overtime_minutes ?? 0), 0)
        const lateMinutes = empLogs.reduce((sum, l) => sum + (l.late_minutes ?? 0), 0)

        const attendanceRate = workingDays > 0
          ? Math.round((presentCount / workingDays) * 100)
          : 0

        const site = sites.find(s => s.id === emp.site_id)

        return {
          employee_id: emp.id,
          employee_no: emp.employee_no ?? "—",
          full_name: emp.full_name ?? "—",
          category: emp.category,
          site_name: site?.name ?? "—",
          working_days: workingDays,
          present: presentCount,
          late: lateCount,
          absent: totalAbsent,
          on_leave: leaveCount,
          holidays: holidayCount,
          overtime_hours: Math.round((overtimeMinutes / 60) * 10) / 10,
          late_minutes: lateMinutes,
          attendance_rate: attendanceRate,
        }
      })
      .sort((a, b) => b.attendance_rate - a.attendance_rate)
  }, [employees, logs, sites, year, month, categoryFilter, siteFilter])

  // Aggregate KPIs
  const totals = useMemo(() => {
    if (report.length === 0) return null
    return {
      employees: report.length,
      avgAttendance: Math.round(report.reduce((s, r) => s + r.attendance_rate, 0) / report.length),
      totalPresent: report.reduce((s, r) => s + r.present, 0),
      totalLate: report.reduce((s, r) => s + r.late, 0),
      totalAbsent: report.reduce((s, r) => s + r.absent, 0),
      totalLeave: report.reduce((s, r) => s + r.on_leave, 0),
      totalOvertime: Math.round(report.reduce((s, r) => s + r.overtime_hours, 0) * 10) / 10,
    }
  }, [report])

  async function exportToExcel() {
    if (report.length === 0) return
    setExporting(true)

    try {
      const XLSX = await import("xlsx")

      const sheetData = [
        ["Employee No", "Full Name", "Category", "Site", "Working Days",
         "Present", "Late", "Absent", "On Leave", "Holiday",
         "Overtime (h)", "Late (min)", "Attendance Rate"],
        ...report.map(r => [
          r.employee_no, r.full_name, categoryLabels[r.category], r.site_name,
          r.working_days, r.present, r.late, r.absent, r.on_leave, r.holidays,
          r.overtime_hours, r.late_minutes, `${r.attendance_rate}%`
        ])
      ]

      const ws = XLSX.utils.aoa_to_sheet(sheetData)

      // Column widths
      ws["!cols"] = [
        { wch: 12 }, { wch: 25 }, { wch: 12 }, { wch: 18 }, { wch: 13 },
        { wch: 9 }, { wch: 7 }, { wch: 9 }, { wch: 10 }, { wch: 10 },
        { wch: 12 }, { wch: 11 }, { wch: 16 },
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, `${monthNames[month - 1]} ${year}`)

      const fileName = `Attendance_${monthNames[month - 1]}_${year}.xlsx`
      XLSX.writeFile(wb, fileName)
    } catch (err: any) {
      alert(`Export failed: ${err?.message ?? "unknown error"}`)
      console.error(err)
    }

    setExporting(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Attendance Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monthly attendance summary · {monthNames[month - 1]} {year}
          </p>
        </div>
        <button
          onClick={exportToExcel}
          disabled={exporting || report.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-chart-3 text-white rounded-lg text-sm font-medium hover:bg-chart-3/90 transition-colors disabled:opacity-50"
        >
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Export to Excel
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="size-3.5 text-muted-foreground" />
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-secondary/60 text-foreground text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-primary"
          >
            {monthNames.map((name, i) => (
              <option key={name} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-secondary/60 text-foreground text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-primary"
          >
            {[year - 2, year - 1, year, year + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="size-3.5 text-muted-foreground" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as EmployeeCategory | "all")}
            className="bg-secondary/60 text-foreground text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-primary"
          >
            <option value="all">All Categories</option>
            {(Object.entries(categoryLabels) as [EmployeeCategory, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="bg-secondary/60 text-foreground text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-primary"
          >
            <option value="all">All Sites</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs */}
      {totals && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <KPIBox icon={Users}        label="Employees"    value={totals.employees.toString()}        color="text-primary"  bg="bg-primary/10" />
          <KPIBox icon={TrendingUp}   label="Avg Rate"     value={`${totals.avgAttendance}%`}         color="text-chart-3"  bg="bg-chart-3/10" />
          <KPIBox icon={CheckCircle2} label="Present"      value={totals.totalPresent.toString()}     color="text-chart-3"  bg="bg-chart-3/10" />
          <KPIBox icon={Clock}        label="Late"         value={totals.totalLate.toString()}        color="text-primary"  bg="bg-primary/10" />
          <KPIBox icon={XCircle}      label="Absent"       value={totals.totalAbsent.toString()}      color="text-destructive" bg="bg-destructive/10" />
          <KPIBox icon={TrendingUp}   label="Overtime (h)" value={totals.totalOvertime.toString()}    color="text-chart-4"  bg="bg-chart-4/10" />
        </div>
      )}

      {/* Report table */}
      <Card className="border-border bg-card">
        <CardContent className="p-0 overflow-auto">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Loading...
            </div>
          ) : report.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <BarChart3 className="size-8 mx-auto mb-2 opacity-50" />
              No data matches the selected filters.
            </div>
          ) : (
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[100px_1fr_100px_140px_70px_70px_70px_70px_70px_90px_90px_80px] gap-2 px-3 py-2.5 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border bg-secondary/30 sticky top-0">
                <span>Emp No</span>
                <span>Name</span>
                <span>Category</span>
                <span>Site</span>
                <span className="text-center">Working</span>
                <span className="text-center text-chart-3">Present</span>
                <span className="text-center text-primary">Late</span>
                <span className="text-center text-destructive">Absent</span>
                <span className="text-center text-chart-2">Leave</span>
                <span className="text-center">Overtime</span>
                <span className="text-center">Late (m)</span>
                <span className="text-center">Rate</span>
              </div>

              {report.map((r) => (
                <div key={r.employee_id}
                  className="grid grid-cols-[100px_1fr_100px_140px_70px_70px_70px_70px_70px_90px_90px_80px] gap-2 px-3 py-2 text-xs items-center border-b border-border/50 hover:bg-secondary/20 transition-colors">
                  <span className="font-mono text-muted-foreground">{r.employee_no}</span>
                  <span className="font-medium text-foreground truncate">{r.full_name}</span>
                  <Badge variant="secondary" className="text-[10px] justify-self-start">{categoryLabels[r.category]}</Badge>
                  <span className="text-muted-foreground text-[11px] truncate">{r.site_name}</span>
                  <span className="text-center text-muted-foreground font-mono">{r.working_days}</span>
                  <span className="text-center font-mono text-chart-3">{r.present}</span>
                  <span className="text-center font-mono text-primary">{r.late || "—"}</span>
                  <span className="text-center font-mono text-destructive">{r.absent || "—"}</span>
                  <span className="text-center font-mono text-chart-2">{r.on_leave || "—"}</span>
                  <span className="text-center font-mono text-chart-4">{r.overtime_hours || "—"}</span>
                  <span className="text-center font-mono text-muted-foreground">{r.late_minutes || "—"}</span>
                  <div className="flex items-center gap-1.5 justify-center">
                    <div className="w-10 h-1 bg-secondary/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          r.attendance_rate >= 90 ? "bg-chart-3"
                          : r.attendance_rate >= 75 ? "bg-primary"
                          : "bg-destructive"
                        }`}
                        style={{ width: `${r.attendance_rate}%` }}
                      />
                    </div>
                    <span className={`font-mono text-[11px] font-semibold tabular-nums ${
                      r.attendance_rate >= 90 ? "text-chart-3"
                      : r.attendance_rate >= 75 ? "text-primary"
                      : "text-destructive"
                    }`}>
                      {r.attendance_rate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground text-center">
        Working days exclude Fridays & Saturdays. Attendance rate = Present ÷ Working Days.
      </p>
    </div>
  )
}

function KPIBox({
  icon: Icon, label, value, color, bg
}: {
  icon: typeof Users; label: string; value: string; color: string; bg: string
}) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div className={`size-7 rounded-lg ${bg} flex items-center justify-center`}>
            <Icon className={`size-3.5 ${color}`} />
          </div>
          <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
        </div>
        <p className={`text-lg font-semibold ${color} tabular-nums`}>{value}</p>
      </CardContent>
    </Card>
  )
}
