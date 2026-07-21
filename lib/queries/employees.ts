/**
 * All Supabase queries related to employees + supporting lookups.
 * Components import these functions instead of writing .from() inline.
 */
import { supabase } from "@/lib/supabase"
import type {
  Employee, Department, Position, Site,
  EmployeeCategory, EmployeeStatus, ContractType, GenderType,
} from "@/lib/types"

// ── Types ────────────────────────────────────────────────────────────────────
export type EmployeePayload = {
  employee_no:              string
  full_name:                string
  category:                 EmployeeCategory
  status:                   EmployeeStatus
  national_id:              string | null
  phone:                    string | null
  email:                    string | null
  dob:                      string | null
  gender:                   GenderType | null
  hire_date:                string | null
  contract_type:            ContractType
  department_id:            string | null
  position_id:              string | null
  site_id:                  string | null
  basic_salary:             number
  bank_account:             string | null
  address:                  string | null
  emergency_contact_name:   string | null
  emergency_contact_phone:  string | null
}

export type EmployeeLookups = {
  employees:   Employee[]
  departments: Department[]
  positions:   Position[]
  sites:       Site[]
  probationIds: Set<string>
}

// ── Queries ──────────────────────────────────────────────────────────────────

/** Full load: employees list + all dropdown lookups in one parallel call */
export async function fetchEmployeesAndLookups(): Promise<EmployeeLookups> {
  const [empRes, deptRes, posRes, siteRes, probRes] = await Promise.all([
    supabase.from("employees").select("*").order("created_at", { ascending: false }),
    supabase.from("departments").select("*").eq("is_active", true).order("name"),
    supabase.from("positions").select("*").eq("is_active", true).order("title"),
    supabase.from("sites").select("*").eq("is_active", true).order("name"),
    supabase.from("probation_records")
      .select("employee_id, status")
      .in("status", ["ongoing", "extended"]),
  ])
  return {
    employees:    (empRes.data  ?? []) as Employee[],
    departments:  (deptRes.data ?? []) as Department[],
    positions:    (posRes.data  ?? []) as Position[],
    sites:        (siteRes.data ?? []) as Site[],
    probationIds: new Set((probRes.data ?? []).map((p: { employee_id: string }) => p.employee_id)),
  }
}

/** Just the dropdown lookups (departments, positions, sites) */
export async function fetchLookups(): Promise<Pick<EmployeeLookups, "departments"|"positions"|"sites">> {
  const [deptRes, posRes, siteRes] = await Promise.all([
    supabase.from("departments").select("*").eq("is_active", true).order("name"),
    supabase.from("positions").select("*").eq("is_active", true).order("title"),
    supabase.from("sites").select("*").eq("is_active", true).order("name"),
  ])
  return {
    departments: (deptRes.data ?? []) as Department[],
    positions:   (posRes.data  ?? []) as Position[],
    sites:       (siteRes.data ?? []) as Site[],
  }
}

/** Create a new employee */
export async function createEmployee(payload: EmployeePayload) {
  return supabase.from("employees").insert(payload)
}

/** Update an existing employee */
export async function updateEmployee(id: string, payload: EmployeePayload) {
  return supabase.from("employees").update(payload).eq("id", id)
}

/** Delete an employee (admin only — enforced by RLS) */
export async function deleteEmployee(id: string) {
  return supabase.from("employees").delete().eq("id", id)
}
