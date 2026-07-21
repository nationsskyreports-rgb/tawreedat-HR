/**
 * Supabase queries for attendance (check-in/out) and the requests tab
 * (overtime records + missing punch requests).
 */
import { supabase } from "@/lib/supabase"
import type { Employee, Site, AttendanceLog, AttendanceStatus, CheckinResultType } from "@/lib/types"

// ── Types ────────────────────────────────────────────────────────────────────

export type OTRow = {
  id: string
  employee_id: string
  employee_name: string | null
  employee_no:   string | null
  date:          string
  hours:         number
  reason:        string
  notes:         string | null
  status:        string
  source:        string
  created_at:    string
  approved_by:   string | null
  approved_at:   string | null
}

export type PunchRow = {
  id:             string
  employee_id:    string
  employee_name:  string | null
  employee_no:    string | null
  requested_date: string
  requested_time: string
  // Supabase DB columns (aliased in older schema versions)
  date?:          string
  expected_time?: string
  punch_type:     string
  reason:         string
  status:         string
  created_at:     string
  approved_by:    string | null
  approved_at:    string | null
}

// ── Checkin Tab ──────────────────────────────────────────────────────────────

export async function fetchCheckinData(todayStartISO: string): Promise<{
  employees: Employee[]
  sites: Site[]
  todayLogs: AttendanceLog[]
}> {
  const [empRes, siteRes, logsRes] = await Promise.all([
    supabase.from("employees").select("*").eq("status", "active").order("full_name"),
    supabase.from("sites").select("*").eq("is_active", true).order("name"),
    supabase.from("attendance_logs")
      .select("*")
      .gte("checkin_at", todayStartISO)
      .order("checkin_at", { ascending: false }),
  ])
  return {
    employees: (empRes.data  ?? []) as Employee[],
    sites:     (siteRes.data ?? []) as Site[],
    todayLogs: (logsRes.data ?? []) as AttendanceLog[],
  }
}

export type CheckinPayload = {
  employee_id:    string
  site_id:        string
  checkin_at:     string
  lat:            number
  lng:            number
  status:         AttendanceStatus
  checkin_result: CheckinResultType
  checkin_method: string
  device_info:    Record<string, unknown>
}

export async function insertCheckin(payload: CheckinPayload) {
  return supabase.from("attendance_logs").insert(payload)
}

export async function updateCheckout(logId: string) {
  return supabase.from("attendance_logs")
    .update({ checkout_at: new Date().toISOString() })
    .eq("id", logId)
}

// ── Requests Tab ─────────────────────────────────────────────────────────────

export async function fetchRequestsData(): Promise<{
  otList:    OTRow[]
  punchList: PunchRow[]
  employees: Pick<Employee, "id" | "full_name" | "employee_no">[]
  currentUserId: string | null
}> {
  const { data: { user } } = await supabase.auth.getUser()

  const [otRes, punchRes, empRes] = await Promise.all([
    supabase.from("overtime_records")
      .select("*, employees(full_name, employee_no)")
      .order("created_at", { ascending: false }),
    supabase.from("missing_punch_requests")
      .select("*, employees(full_name, employee_no)")
      .order("created_at", { ascending: false }),
    supabase.from("employees")
      .select("id, full_name, employee_no")
      .eq("status", "active")
      .order("full_name"),
  ])

  const mapWithEmployee = (data: any[]) => data.map(r => ({
    ...r,
    employee_name: r.employees?.full_name  ?? null,
    employee_no:   r.employees?.employee_no ?? null,
  }))

  return {
    otList:    mapWithEmployee(otRes.data   ?? []) as OTRow[],
    punchList: mapWithEmployee(punchRes.data ?? []) as PunchRow[],
    employees: (empRes.data ?? []) as Pick<Employee, "id" | "full_name" | "employee_no">[],
    currentUserId: user?.id ?? null,
  }
}

// ── OT mutations ─────────────────────────────────────────────────────────────

export async function approveOT(id: string, approverId: string) {
  return supabase.from("overtime_records").update({
    status:      "approved",
    approved_by: approverId,
    approved_at: new Date().toISOString(),
  }).eq("id", id)
}

export async function rejectOT(id: string, approverId: string) {
  return supabase.from("overtime_records").update({
    status:      "rejected",
    approved_by: approverId,
    approved_at: new Date().toISOString(),
  }).eq("id", id)
}

export type ManualOTPayload = {
  employee_id: string
  date:        string
  hours:       number
  reason:      string
  notes:       string | null
  source:      "hr_manual"
  status:      "approved"
  approved_by: string | null
  approved_at: string
}

export async function insertManualOT(payload: ManualOTPayload) {
  return supabase.from("overtime_records").insert(payload)
}

// ── Missing Punch mutations ───────────────────────────────────────────────────

export async function approvePunch(id: string, approverId: string) {
  return supabase.rpc("approve_missing_punch", {
    request_id:  id,
    approver_id: approverId,
  })
}

export async function rejectPunch(id: string, approverId: string) {
  return supabase.from("missing_punch_requests").update({
    status:      "rejected",
    approved_by: approverId,
    approved_at: new Date().toISOString(),
  }).eq("id", id)
}
