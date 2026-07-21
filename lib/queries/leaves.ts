/**
 * Supabase queries for leave management (types, balances, requests).
 */
import { supabase } from "@/lib/supabase"
import type { Employee, LeaveType, LeaveBalance, LeaveRequestStatus } from "@/lib/types"

export type RequestWithRelations = {
  id: string
  employee_id: string
  leave_type_id: string
  start_date: string
  end_date: string
  total_days: number
  reason: string | null
  contact_during_leave: string | null
  handover_notes: string | null
  status: LeaveRequestStatus
  approved_at: string | null
  rejection_reason: string | null
  cancelled_at: string | null
  created_at: string
  // flattened from joins
  employee_name: string | null
  employee_no: string | null
  leave_type_name: string | null
  leave_type_color: string | null
}

export type LeavesData = {
  employees:          Employee[]
  leaveTypes:         LeaveType[]
  balances:           LeaveBalance[]
  requests:           RequestWithRelations[]
  currentUserProfile: { id: string; role: string } | null
}

export async function fetchLeavesData(): Promise<LeavesData> {
  const { data: { user } } = await supabase.auth.getUser()

  const [empRes, typesRes, balRes, reqRes, profRes] = await Promise.all([
    supabase.from("employees").select("*").eq("status", "active").order("full_name"),
    supabase.from("leave_types").select("*").eq("is_active", true).order("name"),
    supabase.from("leave_balances").select("*").eq("year", new Date().getFullYear()),
    supabase.from("leave_requests")
      .select("*, employees(full_name, employee_no), leave_types(name, color)")
      .order("created_at", { ascending: false }),
    user
      ? supabase.from("profiles").select("id, role").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
  ])

  const requests: RequestWithRelations[] = (reqRes.data ?? [] as any[]).map((r: any) => ({
    ...r,
    employee_name:    r.employees?.full_name  ?? null,
    employee_no:      r.employees?.employee_no ?? null,
    leave_type_name:  r.leave_types?.name  ?? null,
    leave_type_color: r.leave_types?.color ?? null,
  }))

  return {
    employees:          (empRes.data  ?? []) as Employee[],
    leaveTypes:         (typesRes.data ?? []) as LeaveType[],
    balances:           (balRes.data  ?? []) as LeaveBalance[],
    requests,
    currentUserProfile: profRes.data as { id: string; role: string } | null,
  }
}

export type CreateLeavePayload = {
  employee_id:          string
  leave_type_id:        string
  start_date:           string
  end_date:             string
  total_days:           number
  reason:               string | null
  contact_during_leave: string | null
  handover_notes:       string | null
  status:               LeaveRequestStatus
}

export async function createLeaveRequest(payload: CreateLeavePayload) {
  return supabase.from("leave_requests").insert(payload)
}

export async function updateLeaveStatus(
  id: string,
  newStatus: LeaveRequestStatus,
  extra?: { rejection_reason?: string }
) {
  const updates: Record<string, unknown> = { status: newStatus }
  if (newStatus === "approved")   updates.approved_at      = new Date().toISOString()
  if (newStatus === "rejected")   updates.rejection_reason = extra?.rejection_reason ?? "Rejected"
  if (newStatus === "cancelled")  updates.cancelled_at     = new Date().toISOString()
  return supabase.from("leave_requests").update(updates).eq("id", id)
}
