/**
 * All Supabase queries for the Command Center (Overview) dashboard.
 */
import { supabase } from "@/lib/supabase"
import type { EmployeeCategory, AttendanceStatus } from "@/lib/types"

export type KPIs = {
  totalEmployees:  number
  activeEmployees: number
  todayPresent:    number
  todayAbsent:     number
  todayLate:       number
  onLeave:         number
  openJobs:        number
  pendingLeaves:   number
  totalSites:      number
}

export type CategoryCount     = { category: EmployeeCategory; count: number }
export type SiteCount         = { site_name: string; count: number }
export type RecentAttendance  = {
  id:            string
  employee_name: string
  status:        AttendanceStatus
  checkin_at:    string
  site_name:     string | null
}

export async function fetchOverviewKPIs(todayStartISO: string): Promise<KPIs> {
  const [empRes, attendanceRes, jobsRes, leavesRes, sitesRes] = await Promise.all([
    supabase.from("employees").select("id, status"),
    supabase.from("attendance_logs").select("status, employee_id").gte("checkin_at", todayStartISO),
    supabase.from("job_postings").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("sites").select("id").eq("is_active", true),
  ])

  const emps       = empRes.data       ?? []
  const attendance = attendanceRes.data ?? []

  const activeEmployees = emps.filter(e => e.status === "active").length
  const onLeave         = emps.filter(e => e.status === "on_leave").length
  const todayPresent    = attendance.filter(a => a.status === "present").length
  const todayLate       = attendance.filter(a => a.status === "late").length
  const checkedInIds    = new Set(attendance.map(a => a.employee_id))

  return {
    totalEmployees:  emps.length,
    activeEmployees,
    todayPresent,
    todayAbsent:     Math.max(0, activeEmployees - checkedInIds.size),
    todayLate,
    onLeave,
    openJobs:        jobsRes.count  ?? 0,
    pendingLeaves:   leavesRes.count ?? 0,
    totalSites:      (sitesRes.data ?? []).length,
  }
}

export async function fetchCategoryBreakdown(): Promise<CategoryCount[]> {
  const { data } = await supabase.from("employees").select("category")
  const map = new Map<EmployeeCategory, number>()
  ;(data ?? []).forEach(e => {
    const c = e.category as EmployeeCategory
    map.set(c, (map.get(c) ?? 0) + 1)
  })
  return Array.from(map.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
}

export async function fetchSiteBreakdown(): Promise<SiteCount[]> {
  const { data } = await supabase
    .from("employees").select("site_id, sites(name)").not("site_id", "is", null)
  const map = new Map<string, number>()
  ;(data ?? [] as any[]).forEach((e: { sites?: { name?: string } | null }) => {
    const name = e.sites?.name ?? "Unassigned"
    map.set(name, (map.get(name) ?? 0) + 1)
  })
  return Array.from(map.entries())
    .map(([site_name, count]) => ({ site_name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
}

export async function fetchRecentAttendance(): Promise<RecentAttendance[]> {
  const { data } = await supabase
    .from("attendance_logs")
    .select("id, status, checkin_at, employees(full_name), sites(name)")
    .order("checkin_at", { ascending: false })
    .limit(8)
  return (data ?? [] as any[]).map((r: {
    id: string; status: AttendanceStatus; checkin_at: string
    employees?: { full_name?: string } | null
    sites?: { name?: string } | null
  }) => ({
    id:            r.id,
    employee_name: r.employees?.full_name ?? "Unknown",
    status:        r.status,
    checkin_at:    r.checkin_at,
    site_name:     r.sites?.name ?? null,
  }))
}
