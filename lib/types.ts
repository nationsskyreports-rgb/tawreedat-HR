// =============================================================================
// Tawreedat HRIS — Central TypeScript types
// File: lib/types.ts
// Matches Supabase schema (10 migration files + checkin_result_type)
// =============================================================================

// -----------------------------------------------------------------------------
// ENUMS
// -----------------------------------------------------------------------------
export type UserRole = "admin" | "hr" | "manager" | "employee"

export type EmployeeCategory =
  | "driver"
  | "warehouse"
  | "field_ops"
  | "office"
  | "supervisor"

export type EmployeeStatus =
  | "active"
  | "on_leave"
  | "suspended"
  | "terminated"
  | "resigned"

export type GenderType = "male" | "female"

export type MaritalStatusType = "single" | "married" | "divorced" | "widowed"

export type ContractType =
  | "permanent"
  | "temporary"
  | "contract"
  | "probation"
  | "internship"

export type AttendanceStatus =
  | "present"
  | "late"
  | "absent"
  | "on_leave"
  | "holiday"
  | "half_day"

export type CheckinResultType =
  | "success"
  | "failed_geofence"
  | "failed_face"
  | "failed_other"
  | "pending"

export type DocumentType =
  | "national_id"
  | "passport"
  | "driver_license"
  | "contract"
  | "medical_certificate"
  | "education_certificate"
  | "cv"
  | "photo"
  | "bank_statement"
  | "social_insurance_card"
  | "other"

export type LeaveRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"

export type ShiftType =
  | "morning"
  | "afternoon"
  | "night"
  | "split"
  | "flexible"

export type PayrollStatus =
  | "draft"
  | "calculated"
  | "approved"
  | "paid"
  | "cancelled"

export type SalaryComponentType =
  | "allowance"
  | "deduction"
  | "tax"
  | "insurance"
  | "bonus"
  | "overtime"

export type CalculationMethod =
  | "fixed"
  | "percentage_of_basic"
  | "percentage_of_gross"
  | "formula"

export type JobPostingStatus =
  | "draft"
  | "open"
  | "paused"
  | "closed"
  | "filled"

export type CandidateStatus =
  | "new"
  | "screening"
  | "shortlisted"
  | "interview_scheduled"
  | "interviewed"
  | "offer_extended"
  | "hired"
  | "rejected"
  | "withdrawn"

export type EmploymentType =
  | "full_time"
  | "part_time"
  | "contract"
  | "internship"

export type SiteType =
  | "warehouse"
  | "depot"
  | "office"
  | "hub"
  | "port"
  | "checkpoint"

export type NotificationType =
  | "leave_request"
  | "leave_approved"
  | "leave_rejected"
  | "shift_assigned"
  | "shift_swap_request"
  | "payroll_ready"
  | "document_expiring"
  | "announcement"
  | "review_due"
  | "general"

// -----------------------------------------------------------------------------
// PROFILES (linked to auth.users)
// -----------------------------------------------------------------------------
export type Profile = {
  id: string
  full_name: string | null
  role: UserRole
  phone: string | null
  avatar_url: string | null
  employee_id: string | null
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// DEPARTMENTS
// -----------------------------------------------------------------------------
export type Department = {
  id: string
  code: string
  name: string
  description: string | null
  manager_id: string | null
  parent_department_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// POSITIONS
// -----------------------------------------------------------------------------
export type Position = {
  id: string
  code: string
  title: string
  department_id: string | null
  category: EmployeeCategory | null
  description: string | null
  min_salary: number | null
  max_salary: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// SITES
// -----------------------------------------------------------------------------
export type Site = {
  id: string
  name: string
  code: string | null
  city: string | null
  address: string | null
  site_type: SiteType
  lat: number | null
  lng: number | null
  radius_meters: number | null
  manager_id: string | null
  is_active: boolean
  expected_headcount: number
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// EMPLOYEES
// -----------------------------------------------------------------------------
export type Employee = {
  id: string
  employee_no: string
  full_name: string
  category: EmployeeCategory
  status: EmployeeStatus
  site_id: string | null

  // Personal
  national_id: string | null
  phone: string | null
  email: string | null
  dob: string | null
  gender: GenderType | null
  marital_status: MaritalStatusType | null
  address: string | null
  city: string | null
  nationality: string | null

  // Employment
  hire_date: string | null
  termination_date: string | null
  contract_type: ContractType
  contract_end_date: string | null
  department_id: string | null
  position_id: string | null
  manager_id: string | null

  // Payroll
  basic_salary: number
  bank_name: string | null
  bank_account: string | null
  iban: string | null
  social_insurance_no: string | null
  tax_number: string | null

  // Emergency
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relation: string | null

  // Misc
  profile_id: string | null
  avatar_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

// Employee with optional joined relations (for queries with select(`*, department:departments(*)`))
export type EmployeeWithRelations = Employee & {
  department?: Department | null
  position?: Position | null
  site?: Site | null
  manager?: Pick<Employee, "id" | "full_name" | "employee_no"> | null
}

// -----------------------------------------------------------------------------
// ATTENDANCE_LOGS
// -----------------------------------------------------------------------------
export type AttendanceLog = {
  id: string
  employee_id: string
  site_id: string | null
  checkin_at: string
  checkout_at: string | null
  lat: number | null
  lng: number | null
  face_score: number | null
  status: AttendanceStatus
  checkin_result: CheckinResultType | null
  break_minutes: number
  overtime_minutes: number
  late_minutes: number
  early_leave_minutes: number
  total_worked_minutes: number
  checkin_photo_url: string | null
  checkout_photo_url: string | null
  checkin_method: string
  device_info: Record<string, unknown> | null
  notes: string | null
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// EMPLOYEE_DOCUMENTS
// -----------------------------------------------------------------------------
export type EmployeeDocument = {
  id: string
  employee_id: string
  document_type: DocumentType
  document_name: string
  document_number: string | null
  file_url: string | null
  file_size_kb: number | null
  mime_type: string | null
  issue_date: string | null
  expiry_date: string | null
  issuing_authority: string | null
  notes: string | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// LEAVES
// -----------------------------------------------------------------------------
export type LeaveType = {
  id: string
  code: string
  name: string
  description: string | null
  default_days_per_year: number
  is_paid: boolean
  requires_approval: boolean
  requires_document: boolean
  max_consecutive_days: number | null
  min_service_months: number
  gender_restriction: GenderType | null
  carries_over: boolean
  max_carryover_days: number | null
  color: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type LeaveBalance = {
  id: string
  employee_id: string
  leave_type_id: string
  year: number
  entitled_days: number
  carried_over_days: number
  used_days: number
  pending_days: number
  remaining_days: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type LeaveRequest = {
  id: string
  employee_id: string
  leave_type_id: string
  start_date: string
  end_date: string
  total_days: number
  reason: string | null
  status: LeaveRequestStatus
  document_url: string | null
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  contact_during_leave: string | null
  handover_notes: string | null
  covering_employee_id: string | null
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// SHIFTS
// -----------------------------------------------------------------------------
export type Shift = {
  id: string
  code: string
  name: string
  shift_type: ShiftType
  start_time: string
  end_time: string
  break_minutes: number
  total_hours: number
  grace_period_minutes: number
  is_overnight: boolean
  weekly_pattern: Record<string, boolean>
  site_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ShiftAssignment = {
  id: string
  employee_id: string
  shift_id: string
  site_id: string | null
  assignment_date: string
  status: "scheduled" | "completed" | "absent" | "swapped" | "cancelled"
  swap_request_id: string | null
  notes: string | null
  assigned_by: string | null
  created_at: string
  updated_at: string
}

export type ShiftSwap = {
  id: string
  requester_id: string
  requester_assignment_id: string
  target_employee_id: string
  target_assignment_id: string | null
  reason: string | null
  status: LeaveRequestStatus
  target_response: "accepted" | "declined" | null
  target_responded_at: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// HOLIDAYS
// -----------------------------------------------------------------------------
export type Holiday = {
  id: string
  name: string
  holiday_date: string
  is_paid: boolean
  is_recurring: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// PAYROLL
// -----------------------------------------------------------------------------
export type SalaryComponent = {
  id: string
  code: string
  name: string
  component_type: SalaryComponentType
  calculation_method: CalculationMethod
  default_value: number
  is_taxable: boolean
  affects_social_insurance: boolean
  is_recurring: boolean
  description: string | null
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export type EmployeeSalaryComponent = {
  id: string
  employee_id: string
  component_id: string
  amount: number | null
  percentage: number | null
  effective_from: string
  effective_to: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type TaxBracket = {
  id: string
  effective_year: number
  bracket_order: number
  from_amount: number
  to_amount: number | null
  tax_rate: number
  notes: string | null
  created_at: string
}

export type SocialInsuranceConfig = {
  id: string
  effective_year: number
  min_subject_salary: number
  max_subject_salary: number
  employee_rate: number
  employer_rate: number
  personal_exemption_annual: number
  notes: string | null
  created_at: string
}

export type PayrollPeriod = {
  id: string
  period_year: number
  period_month: number
  period_name: string
  start_date: string
  end_date: string
  pay_date: string | null
  status: PayrollStatus
  total_gross: number
  total_net: number
  total_tax: number
  total_insurance: number
  total_employees: number
  notes: string | null
  calculated_by: string | null
  calculated_at: string | null
  approved_by: string | null
  approved_at: string | null
  paid_by: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

export type PayrollRecord = {
  id: string
  period_id: string
  employee_id: string

  working_days: number
  attended_days: number
  absent_days: number
  leave_days: number
  holiday_days: number

  basic_salary: number
  total_allowances: number
  overtime_hours: number
  overtime_amount: number
  bonus: number
  gross_salary: number

  total_deductions: number
  social_insurance_employee: number
  social_insurance_employer: number
  income_tax: number
  absence_deduction: number
  loan_deduction: number
  other_deductions: number

  taxable_salary: number
  net_salary: number

  status: PayrollStatus
  payslip_url: string | null
  notes: string | null
  calculated_at: string | null
  created_at: string
  updated_at: string
}

export type PayrollRecordItem = {
  id: string
  record_id: string
  component_id: string | null
  component_code: string
  component_name: string
  component_type: SalaryComponentType
  amount: number
  notes: string | null
  created_at: string
}

export type EmployeeLoan = {
  id: string
  employee_id: string
  loan_type: string
  total_amount: number
  monthly_deduction: number
  remaining_amount: number
  start_date: string
  end_date: string | null
  status: "active" | "paid_off" | "suspended" | "cancelled"
  reason: string | null
  approved_by: string | null
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// JOB POSTINGS & CANDIDATES
// -----------------------------------------------------------------------------
export type JobPosting = {
  id: string
  title: string
  department: string | null
  department_id: string | null
  location: string | null
  status: JobPostingStatus
  requirements: Record<string, unknown>
  description: string | null
  responsibilities: string | null
  salary_min: number | null
  salary_max: number | null
  employment_type: EmploymentType
  openings: number
  experience_min_years: number
  posted_date: string
  closing_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type Candidate = {
  id: string
  job_id: string
  full_name: string
  email: string | null
  phone: string | null
  location: string | null
  exp_years: number
  match_score: number
  status: CandidateStatus
  skills: Record<string, unknown>
  ai_summary: string | null
  salary_expect: string | null
  availability: string | null
  red_flags: string[]
  cv_url: string | null
  cv_text: string | null
  interviewer_notes: string | null
  interview_date: string | null
  source: string | null
  hired_employee_id: string | null
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// ANNOUNCEMENTS / NOTIFICATIONS
// -----------------------------------------------------------------------------
export type Announcement = {
  id: string
  title: string
  body: string
  priority: "low" | "normal" | "high" | "urgent"
  target_role: UserRole | null
  target_department_id: string | null
  target_site_id: string | null
  is_pinned: boolean
  publish_at: string
  expires_at: string | null
  attachment_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type Notification = {
  id: string
  user_id: string
  notification_type: NotificationType
  title: string
  message: string | null
  link_url: string | null
  related_entity_type: string | null
  related_entity_id: string | null
  is_read: boolean
  read_at: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

// -----------------------------------------------------------------------------
// PERFORMANCE REVIEWS
// -----------------------------------------------------------------------------
export type PerformanceReview = {
  id: string
  employee_id: string
  reviewer_id: string | null
  review_period_start: string
  review_period_end: string
  review_type: "annual" | "semi_annual" | "quarterly" | "probation" | "project"
  productivity_score: number | null
  quality_score: number | null
  teamwork_score: number | null
  attendance_score: number | null
  initiative_score: number | null
  overall_score: number | null
  strengths: string | null
  areas_for_improvement: string | null
  goals_next_period: string | null
  reviewer_comments: string | null
  employee_comments: string | null
  status: "draft" | "submitted" | "acknowledged" | "finalized"
  submitted_at: string | null
  acknowledged_at: string | null
  finalized_at: string | null
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// AUDIT LOGS
// -----------------------------------------------------------------------------
export type AuditLog = {
  id: string
  user_id: string | null
  user_email: string | null
  action: string
  entity_type: string
  entity_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

// -----------------------------------------------------------------------------
// COMMON UI HELPERS
// -----------------------------------------------------------------------------
export type SelectOption = {
  value: string
  label: string
}

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }
