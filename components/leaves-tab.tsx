"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Calendar, Plus, X, Loader2, CheckCircle2, XCircle,
  Clock, FileText, User, Filter
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type {
  Employee, LeaveType, LeaveBalance, LeaveRequest,
  LeaveRequestStatus, UserRole, Profile
} from "@/lib/types"

const statusConfig: Record<LeaveRequestStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending:   { label: "Pending",   color: "bg-primary/15 text-primary",         icon: Clock },
  approved:  { label: "Approved",  color: "bg-chart-3/15 text-chart-3",         icon: CheckCircle2 },
  rejected:  { label: "Rejected",  color: "bg-destructive/15 text-destructive", icon: XCircle },
  cancelled: { label: "Cancelled", color: "bg-secondary text-secondary-foreground", icon: X },
}

type RequestWithRelations = LeaveRequest & {
  employee_name?: string
  employee_no?: string
  leave_type_name?: string
  leave_type_color?: string
}

export function LeavesTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [requests, setRequests] = useState<RequestWithRelations[]>([])
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<LeaveRequestStatus | "all">("pending")

  // Request modal
  const [showRequest, setShowRequest] = useState(false)
  const [form, setForm] = useState({
    employee_id: "",
    leave_type_id: "",
    start_date: "",
    end_date: "",
    reason: "",
    contact_during_leave: "",
    handover_notes: "",
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Selected employee for balance display
  const [selectedEmpForBalance, setSelectedEmpForBalance] = useState<string>("")

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const [empRes, typesRes, balRes, reqRes, profRes] = await Promise.all([
      supabase.from("employees").select("*").eq("status", "active").order("full_name"),
      supabase.from("leave_types").select("*").eq("is_active", true).order("name"),
      supabase.from("leave_balances").select("*").eq("year", new Date().getFullYear()),
      supabase.from("leave_requests")
        .select("*, employees(full_name, employee_no), leave_types(name, color)")
        .order("created_at", { ascending: false }),
      user ? supabase.from("profiles").select("*").eq("id", user.id).single() : Promise.resolve({ data: null }),
    ])

    setEmployees((empRes.data ?? []) as Employee[])
    setLeaveTypes((typesRes.data ?? []) as LeaveType[])
    setBalances((balRes.data ?? []) as LeaveBalance[])
    setCurrentUserProfile(profRes.data as Profile | null)

    // Flatten the joined data
    const flatRequests: RequestWithRelations[] = (reqRes.data ?? []).map((r: any) => ({
      ...r,
      employee_name: r.employees?.full_name,
      employee_no: r.employees?.employee_no,
      leave_type_name: r.leave_types?.name,
      leave_type_color: r.leave_types?.color,
    }))
    setRequests(flatRequests)

    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  function calcDays(start: string, end: string): number {
    if (!start || !end) return 0
    const s = new Date(start)
    const e = new Date(end)
    if (e < s) return 0
    let count = 0
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const day = d.getDay()
      if (day !== 5 && day !== 6) count++ // Exclude Fri & Sat
    }
    return count
  }

  function openRequest() {
    setForm({
      employee_id: employees[0]?.id ?? "",
      leave_type_id: leaveTypes[0]?.id ?? "",
      start_date: "",
      end_date: "",
      reason: "",
      contact_during_leave: "",
      handover_notes: "",
    })
    setErr(null)
    setShowRequest(true)
  }

  async function submitRequest() {
    setErr(null)
    if (!form.employee_id) return setErr("Select employee")
    if (!form.leave_type_id) return setErr("Select leave type")
    if (!form.start_date || !form.end_date) return setErr("Set dates")

    const days = calcDays(form.start_date, form.end_date)
    if (days === 0) return setErr("Invalid date range")

    // Check balance
    const balance = balances.find(b =>
      b.employee_id === form.employee_id && b.leave_type_id === form.leave_type_id
    )
    if (balance && days > balance.remaining_days) {
      return setErr(`Insufficient balance. Only ${balance.remaining_days} days available.`)
    }

    setSaving(true)

    const { error } = await supabase.from("leave_requests").insert({
      employee_id: form.employee_id,
      leave_type_id: form.leave_type_id,
      start_date: form.start_date,
      end_date: form.end_date,
      total_days: days,
      reason: form.reason.trim() || null,
      contact_during_leave: form.contact_during_leave.trim() || null,
      handover_notes: form.handover_notes.trim() || null,
      status: "pending" as LeaveRequestStatus,
    })

    setSaving(false)

    if (error) {
      setErr(error.message)
      return
    }

    setShowRequest(false)
    await loadData()
  }

  async function updateRequestStatus(id: string, newStatus: LeaveRequestStatus, rejectionReason?: string) {
    const updates: any = { status: newStatus }
    if (newStatus === "approved") {
      updates.approved_at = new Date().toISOString()
    } else if (newStatus === "rejected") {
      updates.rejection_reason = rejectionReason ?? "Rejected"
    } else if (newStatus === "cancelled") {
      updates.cancelled_at = new Date().toISOString()
    }

    const { error } = await supabase.from("leave_requests").update(updates).eq("id", id)
    if (error) return alert(error.message)
    await loadData()
  }

  async function approveRequest(id: string) {
    if (!confirm("Approve this leave request?")) return
    await updateRequestStatus(id, "approved")
  }

  async function rejectRequest(id: string) {
    const reason = prompt("Rejection reason (optional):")
    if (reason === null) return
    await updateRequestStatus(id, "rejected", reason || "Rejected")
  }

  async function cancelRequest(id: string) {
    if (!confirm("Cancel this request?")) return
    await updateRequestStatus(id, "cancelled")
  }

  const filteredRequests = statusFilter === "all"
    ? requests
    : requests.filter(r => r.status === statusFilter)

  const balanceEmpId = selectedEmpForBalance || employees[0]?.id
  const empBalances = balances.filter(b => b.employee_id === balanceEmpId)

  const canApprove = currentUserProfile && ["admin", "hr", "manager"].includes(currentUserProfile.role)
  const requestedDays = calcDays(form.start_date, form.end_date)
  const formBalance = balances.find(b =>
    b.employee_id === form.employee_id && b.leave_type_id === form.leave_type_id
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading leaves...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Leave Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {requests.filter(r => r.status === "pending").length} pending · {requests.length} total requests
          </p>
        </div>
        <button
          onClick={openRequest}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="size-4" />
          New Leave Request
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Leave Balances panel */}
        <Card className="col-span-12 lg:col-span-4 border-border bg-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Leave Balances</h2>
              <Badge variant="secondary" className="text-[10px]">{new Date().getFullYear()}</Badge>
            </div>

            <select
              value={balanceEmpId}
              onChange={(e) => setSelectedEmpForBalance(e.target.value)}
              className="w-full bg-secondary/60 text-foreground text-sm rounded-lg px-3 py-2 mb-3 outline-none border border-transparent focus:border-primary"
            >
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.employee_no} — {e.full_name}</option>
              ))}
            </select>

            {empBalances.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                No balances set up for this employee. Run the SQL seed script.
              </p>
            ) : (
              <div className="space-y-3">
                {empBalances.map(b => {
                  const lt = leaveTypes.find(t => t.id === b.leave_type_id)
                  if (!lt) return null
                  const used = b.used_days + b.pending_days
                  const pct = b.entitled_days > 0 ? Math.min(100, (used / b.entitled_days) * 100) : 0
                  return (
                    <div key={b.id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-1.5">
                          <div className="size-2 rounded-full" style={{ background: lt.color }} />
                          <span className="text-foreground font-medium">{lt.name}</span>
                        </div>
                        <span className="text-muted-foreground font-mono">
                          {b.remaining_days.toFixed(1)} / {b.entitled_days.toFixed(0)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: lt.color }}
                        />
                      </div>
                      {b.pending_days > 0 && (
                        <p className="text-[10px] text-primary mt-1">
                          {b.pending_days.toFixed(1)} day{b.pending_days !== 1 ? "s" : ""} pending approval
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Requests panel */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-3">
          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="size-3.5 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as LeaveRequestStatus | "all")}
              className="bg-secondary/60 text-foreground text-xs rounded-lg px-3 py-1.5 outline-none border border-transparent focus:border-primary"
            >
              <option value="all">All Requests</option>
              {(Object.entries(statusConfig) as [LeaveRequestStatus, { label: string }][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground ml-2">
              {filteredRequests.length} shown
            </span>
          </div>

          <Card className="border-border bg-card">
            <CardContent className="p-0">
              {filteredRequests.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <FileText className="size-8 mx-auto mb-2 opacity-50" />
                  No {statusFilter !== "all" ? statusConfig[statusFilter].label.toLowerCase() : ""} requests.
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {filteredRequests.map(r => {
                    const cfg = statusConfig[r.status]
                    const StatusIcon = cfg.icon
                    return (
                      <div key={r.id} className="px-4 py-3 hover:bg-secondary/20 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div
                              className="size-9 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: `${r.leave_type_color}25` }}
                            >
                              <Calendar className="size-4" style={{ color: r.leave_type_color ?? "#666" }} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-foreground truncate">{r.employee_name ?? "—"}</p>
                                <Badge
                                  variant="secondary"
                                  className="text-[10px]"
                                  style={{ background: `${r.leave_type_color}20`, color: r.leave_type_color ?? "#666" }}
                                >
                                  {r.leave_type_name}
                                </Badge>
                                <Badge variant="secondary" className={`text-[10px] ${cfg.color} flex items-center gap-1`}>
                                  <StatusIcon className="size-2.5" />
                                  {cfg.label}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {new Date(r.start_date).toLocaleDateString("en-GB")} → {new Date(r.end_date).toLocaleDateString("en-GB")}
                                <span className="mx-1.5">·</span>
                                <strong>{r.total_days} day{r.total_days !== 1 ? "s" : ""}</strong>
                              </p>
                              {r.reason && (
                                <p className="text-[11px] text-muted-foreground italic mt-1 line-clamp-2">
                                  "{r.reason}"
                                </p>
                              )}
                              {r.rejection_reason && r.status === "rejected" && (
                                <p className="text-[11px] text-destructive mt-1">
                                  Reason: {r.rejection_reason}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            {r.status === "pending" && canApprove && (
                              <>
                                <button
                                  onClick={() => approveRequest(r.id)}
                                  className="flex items-center gap-1 px-2 py-1 text-[10px] bg-chart-3/15 text-chart-3 rounded hover:bg-chart-3/25 transition-colors"
                                >
                                  <CheckCircle2 className="size-2.5" /> Approve
                                </button>
                                <button
                                  onClick={() => rejectRequest(r.id)}
                                  className="flex items-center gap-1 px-2 py-1 text-[10px] bg-destructive/15 text-destructive rounded hover:bg-destructive/25 transition-colors"
                                >
                                  <XCircle className="size-2.5" /> Reject
                                </button>
                              </>
                            )}
                            {r.status === "pending" && !canApprove && (
                              <button
                                onClick={() => cancelRequest(r.id)}
                                className="px-2 py-1 text-[10px] bg-secondary text-foreground rounded hover:bg-secondary/80 transition-colors"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* New Request Modal */}
      {showRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">New Leave Request</h2>
              <button onClick={() => setShowRequest(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5 flex flex-col gap-3">
              {err && (
                <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                  {err}
                </div>
              )}

              <Field label="Employee">
                <select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} className="form-field">
                  <option value="">Select...</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.employee_no} — {e.full_name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Leave Type">
                <select value={form.leave_type_id} onChange={e => setForm(f => ({ ...f, leave_type_id: e.target.value }))} className="form-field">
                  <option value="">Select...</option>
                  {leaveTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Start Date">
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="form-field" />
                </Field>
                <Field label="End Date">
                  <input type="date" value={form.end_date} min={form.start_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="form-field" />
                </Field>
              </div>

              {requestedDays > 0 && (
                <div className="bg-secondary/30 rounded-lg p-2.5 text-xs flex items-center justify-between">
                  <span className="text-muted-foreground">Total working days</span>
                  <span className={`font-semibold ${formBalance && requestedDays > formBalance.remaining_days ? "text-destructive" : "text-foreground"}`}>
                    {requestedDays} day{requestedDays !== 1 ? "s" : ""}
                    {formBalance && ` / ${formBalance.remaining_days.toFixed(1)} available`}
                  </span>
                </div>
              )}

              <Field label="Reason">
                <textarea
                  value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  rows={2}
                  placeholder="Why are you requesting leave?"
                  className="form-field resize-none"
                />
              </Field>

              <Field label="Contact During Leave">
                <input
                  type="text"
                  value={form.contact_during_leave}
                  onChange={e => setForm(f => ({ ...f, contact_during_leave: e.target.value }))}
                  placeholder="Phone or email"
                  className="form-field"
                />
              </Field>

              <Field label="Handover Notes">
                <textarea
                  value={form.handover_notes}
                  onChange={e => setForm(f => ({ ...f, handover_notes: e.target.value }))}
                  rows={2}
                  placeholder="Who will cover your tasks?"
                  className="form-field resize-none"
                />
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/20">
              <button onClick={() => setShowRequest(false)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button onClick={submitRequest} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                {saving && <Loader2 className="size-3 animate-spin" />}
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.form-field) {
          width: 100%;
          background: oklch(from var(--secondary) l c h / 60%);
          color: var(--foreground);
          font-size: 0.75rem;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          outline: none;
          border: 1px solid transparent;
        }
        :global(.form-field:focus) { border-color: var(--primary); }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      {children}
    </label>
  )
}
