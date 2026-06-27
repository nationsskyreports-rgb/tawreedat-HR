"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Users, Search, Plus, Truck, Package, MapPin, Monitor, Shield,
  X, Pencil, Trash2, Loader2, Filter
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type {
  Employee, Department, Position, Site,
  EmployeeCategory, EmployeeStatus, ContractType, GenderType
} from "@/lib/types"

const categoryConfig: Record<EmployeeCategory, { label: string; color: string; icon: typeof Truck }> = {
  driver:     { label: "Driver",     color: "bg-chart-1/15 text-chart-1",       icon: Truck },
  warehouse:  { label: "Warehouse",  color: "bg-chart-2/15 text-chart-2",       icon: Package },
  field_ops:  { label: "Field Ops",  color: "bg-chart-3/15 text-chart-3",       icon: MapPin },
  office:     { label: "Office",     color: "bg-primary/15 text-primary",       icon: Monitor },
  supervisor: { label: "Supervisor", color: "bg-destructive/15 text-destructive", icon: Shield },
}

const statusConfig: Record<EmployeeStatus, { label: string; color: string }> = {
  active:     { label: "Active",     color: "bg-chart-3/15 text-chart-3" },
  on_leave:   { label: "On Leave",   color: "bg-primary/15 text-primary" },
  suspended:  { label: "Suspended",  color: "bg-destructive/15 text-destructive" },
  terminated: { label: "Terminated", color: "bg-destructive/15 text-destructive" },
  resigned:   { label: "Resigned",   color: "bg-secondary text-secondary-foreground" },
}

type FormState = {
  employee_no: string
  full_name: string
  category: EmployeeCategory
  status: EmployeeStatus
  national_id: string
  phone: string
  email: string
  dob: string
  gender: GenderType | ""
  hire_date: string
  contract_type: ContractType
  department_id: string
  position_id: string
  site_id: string
  basic_salary: string
  bank_account: string
  address: string
  emergency_contact_name: string
  emergency_contact_phone: string
}

const emptyForm: FormState = {
  employee_no: "",
  full_name: "",
  category: "office",
  status: "active",
  national_id: "",
  phone: "",
  email: "",
  dob: "",
  gender: "",
  hire_date: new Date().toISOString().split("T")[0],
  contract_type: "permanent",
  department_id: "",
  position_id: "",
  site_id: "",
  basic_salary: "",
  bank_account: "",
  address: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
}

export function EmployeesTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<EmployeeCategory | "all">("all")
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | "all">("all")

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [deletingId,   setDeletingId]   = useState<string | null>(null)
  const [probationIds,    setProbationIds]    = useState<Set<string>>(new Set())
  const [attrPeriod,      setAttrPeriod]      = useState<"monthly"|"quarterly"|"semi_annual"|"custom">("monthly")
  const [attrCustomStart, setAttrCustomStart] = useState("")
  const [attrCustomEnd,   setAttrCustomEnd]   = useState("")
  const [showExcluded,    setShowExcluded]    = useState(false)

  // ── Attrition helpers ───────────────────────────────────────────────────────
  function getAttrDates() {
    const now = new Date(); now.setHours(23,59,59,999)
    if (attrPeriod === "custom") {
      if (!attrCustomStart || !attrCustomEnd) return null
      const s = new Date(attrCustomStart); s.setHours(0,0,0,0)
      const e = new Date(attrCustomEnd);   e.setHours(23,59,59,999)
      return { start: s, end: e }
    }
    let start: Date
    if (attrPeriod === "monthly") {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (attrPeriod === "quarterly") {
      const q = Math.floor(now.getMonth() / 3)
      start = new Date(now.getFullYear(), q * 3, 1)
    } else {
      start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    }
    start.setHours(0,0,0,0)
    return { start, end: now }
  }

  function calcAttrition(emps: Employee[], excIds: Set<string>) {
    const dates = getAttrDates()
    if (!dates) return null
    const { start, end } = dates
    const isExcluded = (e: Employee) => excIds.has(e.id) || e.contract_type === "probation"
    const activeAtStart = emps.filter(e => {
      if (isExcluded(e)) return false
      const hire = e.hire_date ? new Date(e.hire_date) : null
      const term = e.termination_date ? new Date(e.termination_date) : null
      return hire && hire <= start && (!term || term >= start)
    })
    const left = emps.filter(e => {
      if (isExcluded(e)) return false
      const term = e.termination_date ? new Date(e.termination_date) : null
      return term && term >= start && term <= end && (e.status === "terminated" || e.status === "resigned")
    })
    const excluded = emps.filter(e => isExcluded(e))
    const hc = activeAtStart.length
    return {
      left:         left.length,
      leftList:     left,
      headcount:    hc,
      rate:         hc > 0 ? (left.length / hc) * 100 : 0,
      excludedList: excluded,
      start,
      end,
    }
  }

  async function loadAll() {
    setLoading(true)
    const [empRes, deptRes, posRes, siteRes, probRes] = await Promise.all([
      supabase.from("employees").select("*").order("created_at", { ascending: false }),
      supabase.from("departments").select("*").eq("is_active", true).order("name"),
      supabase.from("positions").select("*").eq("is_active", true).order("title"),
      supabase.from("sites").select("*").eq("is_active", true).order("name"),
      supabase.from("probation_records").select("employee_id, status").in("status", ["ongoing", "extended"]),
    ])
    setEmployees((empRes.data ?? []) as Employee[])
    setDepartments((deptRes.data ?? []) as Department[])
    setPositions((posRes.data ?? []) as Position[])
    setSites((siteRes.data ?? []) as Site[])
    setProbationIds(new Set((probRes.data ?? []).map((p: any) => p.employee_id as string)))
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
    setShowModal(true)
  }

  function openEdit(emp: Employee) {
    setEditingId(emp.id)
    setForm({
      employee_no: emp.employee_no ?? "",
      full_name: emp.full_name ?? "",
      category: emp.category,
      status: emp.status,
      national_id: emp.national_id ?? "",
      phone: emp.phone ?? "",
      email: emp.email ?? "",
      dob: emp.dob ?? "",
      gender: emp.gender ?? "",
      hire_date: emp.hire_date ?? "",
      contract_type: emp.contract_type ?? "permanent",
      department_id: emp.department_id ?? "",
      position_id: emp.position_id ?? "",
      site_id: emp.site_id ?? "",
      basic_salary: emp.basic_salary?.toString() ?? "",
      bank_account: emp.bank_account ?? "",
      address: emp.address ?? "",
      emergency_contact_name: emp.emergency_contact_name ?? "",
      emergency_contact_phone: emp.emergency_contact_phone ?? "",
    })
    setError(null)
    setShowModal(true)
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit() {
    setError(null)

    if (!form.employee_no.trim()) return setError("Employee number is required")
    if (!form.full_name.trim()) return setError("Full name is required")

    setSaving(true)

    const payload = {
      employee_no: form.employee_no.trim(),
      full_name: form.full_name.trim(),
      category: form.category,
      status: form.status,
      national_id: form.national_id.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      dob: form.dob || null,
      gender: form.gender || null,
      hire_date: form.hire_date || null,
      contract_type: form.contract_type,
      department_id: form.department_id || null,
      position_id: form.position_id || null,
      site_id: form.site_id || null,
      basic_salary: form.basic_salary ? Number(form.basic_salary) : 0,
      bank_account: form.bank_account.trim() || null,
      address: form.address.trim() || null,
      emergency_contact_name: form.emergency_contact_name.trim() || null,
      emergency_contact_phone: form.emergency_contact_phone.trim() || null,
    }

    let res
    if (editingId) {
      res = await supabase.from("employees").update(payload).eq("id", editingId)
    } else {
      res = await supabase.from("employees").insert(payload)
    }

    setSaving(false)

    if (res.error) {
      setError(res.error.message)
      return
    }

    setShowModal(false)
    setForm(emptyForm)
    setEditingId(null)
    await loadAll()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete employee "${name}"? This cannot be undone.`)) return
    setDeletingId(id)
    const { error: delErr } = await supabase.from("employees").delete().eq("id", id)
    setDeletingId(null)
    if (delErr) {
      alert(`Delete failed: ${delErr.message}`)
      return
    }
    await loadAll()
  }

  const filtered = employees.filter((e) => {
    const s = search.toLowerCase()
    const matchesSearch =
      !s ||
      e.full_name?.toLowerCase().includes(s) ||
      e.employee_no?.toLowerCase().includes(s) ||
      e.email?.toLowerCase().includes(s) ||
      e.phone?.toLowerCase().includes(s)
    const matchesCategory = categoryFilter === "all" || e.category === categoryFilter
    const matchesStatus = statusFilter === "all" || e.status === statusFilter
    return matchesSearch && matchesCategory && matchesStatus
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} of {employees.length} employees
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="size-4" />
          Add Employee
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-secondary/60 rounded-lg px-3 py-2 w-80">
          <Search className="size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, ID, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as EmployeeCategory | "all")}
            className="bg-secondary/60 text-foreground text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-primary"
          >
            <option value="all">All Categories</option>
            {(Object.entries(categoryConfig) as [EmployeeCategory, { label: string }][]).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as EmployeeStatus | "all")}
            className="bg-secondary/60 text-foreground text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-primary"
          >
            <option value="all">All Statuses</option>
            {(Object.entries(statusConfig) as [EmployeeStatus, { label: string }][]).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Attrition Overview ────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attrition Overview</p>

        {/* Period selector */}
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { key: "monthly",      label: "This Month"   },
            { key: "quarterly",    label: "This Quarter" },
            { key: "semi_annual",  label: "Last 6 Months"},
            { key: "custom",       label: "Custom Range" },
          ] as const).map(p => (
            <button
              key={p.key}
              onClick={() => setAttrPeriod(p.key)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                attrPeriod === p.key
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {p.label}
            </button>
          ))}
          {attrPeriod === "custom" && (
            <div className="flex items-center gap-2 ml-1">
              <input
                type="date"
                value={attrCustomStart}
                onChange={e => setAttrCustomStart(e.target.value)}
                className="bg-secondary/60 text-foreground text-xs rounded-lg px-2 py-1.5 outline-none border border-transparent focus:border-primary"
              />
              <span className="text-xs text-muted-foreground">→</span>
              <input
                type="date"
                value={attrCustomEnd}
                onChange={e => setAttrCustomEnd(e.target.value)}
                className="bg-secondary/60 text-foreground text-xs rounded-lg px-2 py-1.5 outline-none border border-transparent focus:border-primary"
              />
            </div>
          )}
        </div>

        {/* Result */}
        {(() => {
          const a = calcAttrition(employees, probationIds)
          if (!a) return (
            <p className="text-xs text-muted-foreground py-2">اختار التاريخين عشان يحسب</p>
          )
          return (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-secondary/40 rounded-lg p-3 text-center">
                  <p className="text-[11px] text-muted-foreground mb-1">Attrition Rate</p>
                  <p className={`text-2xl font-bold font-mono ${a.rate > 5 ? "text-destructive" : a.rate > 2 ? "text-chart-2" : "text-foreground"}`}>
                    {a.rate.toFixed(1)}%
                  </p>
                </div>
                <div className="bg-secondary/40 rounded-lg p-3 text-center">
                  <p className="text-[11px] text-muted-foreground mb-1">Employees Left</p>
                  <p className="text-2xl font-bold font-mono text-foreground">{a.left}</p>
                  {a.leftList.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {a.leftList.map(e => (
                        <p key={e.id} className="text-[10px] text-muted-foreground truncate">{e.full_name}</p>
                      ))}
                    </div>
                  )}
                </div>
                <div className="bg-secondary/40 rounded-lg p-3 text-center">
                  <p className="text-[11px] text-muted-foreground mb-1">Headcount (start)</p>
                  <p className="text-2xl font-bold font-mono text-foreground">{a.headcount}</p>
                </div>
              </div>

              {/* Excluded transparency */}
              <button
                onClick={() => setShowExcluded(v => !v)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className={`transition-transform ${showExcluded ? "rotate-90" : ""}`}>▶</span>
                <span>
                  {a.excludedList.length === 0
                    ? "No employees excluded (0 in probation)"
                    : `${a.excludedList.length} ${a.excludedList.length === 1 ? "employee" : "employees"} excluded from calculation — in probation`
                  }
                </span>
                {a.excludedList.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-chart-2/15 text-chart-2 text-[10px] font-semibold ml-1">
                    {a.excludedList.length}
                  </span>
                )}
              </button>

              {showExcluded && a.excludedList.length > 0 && (
                <div className="border border-border/60 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-3 py-2 border-b border-border/60 bg-secondary/20">
                    <span className="col-span-2">Emp No</span>
                    <span className="col-span-4">Name</span>
                    <span className="col-span-3">Contract Type</span>
                    <span className="col-span-3">Status</span>
                  </div>
                  {a.excludedList.map(e => (
                    <div key={e.id} className="grid grid-cols-12 px-3 py-2 border-b border-border/40 text-xs items-center last:border-0">
                      <span className="col-span-2 font-mono text-muted-foreground">{e.employee_no}</span>
                      <span className="col-span-4 text-foreground">{e.full_name}</span>
                      <span className="col-span-3">
                        <span className="px-1.5 py-0.5 rounded bg-chart-2/15 text-chart-2 text-[10px] font-medium">
                          {e.contract_type}
                        </span>
                      </span>
                      <span className="col-span-3 text-muted-foreground capitalize">{e.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )
        })()}
      </div>

      <Card className="border-border bg-card">
        <CardContent className="p-0">
          <div className="grid grid-cols-12 text-xs text-muted-foreground px-4 py-3 border-b border-border">
            <span className="col-span-2">Employee ID</span>
            <span className="col-span-3">Full Name</span>
            <span className="col-span-2">Category</span>
            <span className="col-span-2">Phone</span>
            <span className="col-span-2">Status</span>
            <span className="col-span-1 text-right">Actions</span>
          </div>
          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              {employees.length === 0 ? "No employees yet. Click Add Employee to get started." : "No employees match your filters."}
            </div>
          ) : (
            filtered.map((emp) => {
              const cat = categoryConfig[emp.category] ?? { label: emp.category, color: "bg-secondary text-secondary-foreground", icon: Users }
              const stat = statusConfig[emp.status] ?? { label: emp.status, color: "bg-secondary text-secondary-foreground" }
              const Icon = cat.icon
              return (
                <div key={emp.id} className="grid grid-cols-12 px-4 py-3 border-b border-border/50 text-sm items-center hover:bg-secondary/30 transition-colors">
                  <span className="col-span-2 font-mono text-xs text-muted-foreground">{emp.employee_no}</span>
                  <span className="col-span-3 font-medium text-foreground truncate">{emp.full_name}</span>
                  <div className="col-span-2 flex items-center gap-1.5">
                    <Icon className="size-3.5 text-muted-foreground shrink-0" />
                    <Badge variant="secondary" className={`text-xs ${cat.color}`}>{cat.label}</Badge>
                  </div>
                  <span className="col-span-2 text-xs text-muted-foreground truncate">{emp.phone ?? "—"}</span>
                  <div className="col-span-2 flex items-center gap-1.5 flex-wrap">
                    <Badge variant="secondary" className={`text-xs ${stat.color}`}>{stat.label}</Badge>
                    {emp.contract_type === "probation" && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-chart-2/15 text-chart-2 font-semibold tracking-wide">PROB</span>
                    )}
                  </div>
                  <div className="col-span-1 flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEdit(emp)}
                      className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(emp.id, emp.full_name)}
                      disabled={deletingId === emp.id}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      {deletingId === emp.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">
                {editingId ? "Edit Employee" : "Add New Employee"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto px-6 py-5">
              {error && (
                <div className="mb-4 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                  {error}
                </div>
              )}

              {/* Personal Info */}
              <div className="mb-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Personal Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Employee No *">
                    <input
                      type="text"
                      value={form.employee_no}
                      onChange={(e) => update("employee_no", e.target.value)}
                      placeholder="e.g. DRV-001"
                      className="form-input"
                    />
                  </Field>
                  <Field label="Full Name *">
                    <input
                      type="text"
                      value={form.full_name}
                      onChange={(e) => update("full_name", e.target.value)}
                      placeholder="e.g. Ahmed Hassan"
                      className="form-input"
                    />
                  </Field>
                  <Field label="National ID">
                    <input
                      type="text"
                      value={form.national_id}
                      onChange={(e) => update("national_id", e.target.value)}
                      placeholder="14 digits"
                      maxLength={14}
                      className="form-input"
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      placeholder="+20 1XX XXX XXXX"
                      className="form-input"
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      placeholder="employee@example.com"
                      className="form-input"
                    />
                  </Field>
                  <Field label="Date of Birth">
                    <input
                      type="date"
                      value={form.dob}
                      onChange={(e) => update("dob", e.target.value)}
                      className="form-input"
                    />
                  </Field>
                  <Field label="Gender">
                    <select
                      value={form.gender}
                      onChange={(e) => update("gender", e.target.value as GenderType | "")}
                      className="form-input"
                    >
                      <option value="">—</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </Field>
                  <Field label="Address">
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => update("address", e.target.value)}
                      placeholder="Street, City"
                      className="form-input"
                    />
                  </Field>
                </div>
              </div>

              {/* Employment Info */}
              <div className="mb-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Employment</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Category *">
                    <select
                      value={form.category}
                      onChange={(e) => update("category", e.target.value as EmployeeCategory)}
                      className="form-input"
                    >
                      {(Object.entries(categoryConfig) as [EmployeeCategory, { label: string }][]).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Status *">
                    <select
                      value={form.status}
                      onChange={(e) => update("status", e.target.value as EmployeeStatus)}
                      className="form-input"
                    >
                      {(Object.entries(statusConfig) as [EmployeeStatus, { label: string }][]).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Department">
                    <select
                      value={form.department_id}
                      onChange={(e) => update("department_id", e.target.value)}
                      className="form-input"
                    >
                      <option value="">—</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Position">
                    <select
                      value={form.position_id}
                      onChange={(e) => update("position_id", e.target.value)}
                      className="form-input"
                    >
                      <option value="">—</option>
                      {positions.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Site">
                    <select
                      value={form.site_id}
                      onChange={(e) => update("site_id", e.target.value)}
                      className="form-input"
                    >
                      <option value="">—</option>
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Contract Type">
                    <select
                      value={form.contract_type}
                      onChange={(e) => update("contract_type", e.target.value as ContractType)}
                      className="form-input"
                    >
                      <option value="permanent">Permanent</option>
                      <option value="temporary">Temporary</option>
                      <option value="contract">Contract</option>
                      <option value="probation">Probation</option>
                      <option value="internship">Internship</option>
                    </select>
                  </Field>
                  <Field label="Hire Date">
                    <input
                      type="date"
                      value={form.hire_date}
                      onChange={(e) => update("hire_date", e.target.value)}
                      className="form-input"
                    />
                  </Field>
                  <Field label="Basic Salary (EGP)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.basic_salary}
                      onChange={(e) => update("basic_salary", e.target.value)}
                      placeholder="0"
                      className="form-input"
                    />
                  </Field>
                  <Field label="Bank Account">
                    <input
                      type="text"
                      value={form.bank_account}
                      onChange={(e) => update("bank_account", e.target.value)}
                      placeholder="Account number"
                      className="form-input"
                    />
                  </Field>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Emergency Contact</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Contact Name">
                    <input
                      type="text"
                      value={form.emergency_contact_name}
                      onChange={(e) => update("emergency_contact_name", e.target.value)}
                      className="form-input"
                    />
                  </Field>
                  <Field label="Contact Phone">
                    <input
                      type="tel"
                      value={form.emergency_contact_phone}
                      onChange={(e) => update("emergency_contact_phone", e.target.value)}
                      className="form-input"
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-secondary/20">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                {editingId ? "Save Changes" : "Create Employee"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.form-input) {
          width: 100%;
          background: oklch(from var(--secondary) l c h / 60%);
          color: var(--foreground);
          font-size: 0.875rem;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          outline: none;
          border: 1px solid transparent;
          transition: border-color 150ms;
        }
        :global(.form-input:focus) {
          border-color: var(--primary);
        }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
