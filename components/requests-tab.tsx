"use client"

import { useState, useEffect } from "react"
import {
  Loader2, CheckCircle2, XCircle, Plus, X,
  Calendar, Timer, FileSearch, AlertCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { toast } from "@/components/toast"
import type { Employee, OvertimeRecord, MissingPunchRequest } from "@/lib/types"

type OTRow    = OvertimeRecord      & { employee_name?: string; employee_no?: string; employee_id: string }
type PunchRow = MissingPunchRequest & { employee_name?: string; employee_no?: string; employee_id: string }

const statusColors: Record<string, string> = {
  pending:  "bg-primary/15 text-primary",
  approved: "bg-chart-3/15 text-chart-3",
  rejected: "bg-destructive/15 text-destructive",
}

// ── Helper: send push to an employee's devices ────────────────────────────────
async function notifyEmployee(
  employeeId: string,
  title: string,
  body: string,
  url = "/m/attendance"
) {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("employee_id", employeeId)
      .single()

    if (!profile?.id) return

    await fetch("/api/send-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: profile.id, title, body, url }),
    })
  } catch {
    // Push is best-effort — don't block UI
  }
}

export function RequestsTab() {
  const [activeTab,     setActiveTab]     = useState<"overtime" | "missing_punch">("overtime")
  const [loading,       setLoading]       = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [otList,    setOtList]    = useState<OTRow[]>([])
  const [punchList, setPunchList] = useState<PunchRow[]>([])
  const [employees, setEmployees] = useState<Pick<Employee, "id" | "full_name" | "employee_no">[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [otFilter,    setOtFilter]    = useState<"pending" | "all">("pending")
  const [punchFilter, setPunchFilter] = useState<"pending" | "all">("pending")

  // Manual OT form
  const [showManualOT, setShowManualOT] = useState(false)
  const [manualForm,   setManualForm]   = useState({
    employee_id: "", date: "", hours: "", reason: "", notes: "",
  })
  const [manualSaving, setManualSaving] = useState(false)
  const [manualErr,    setManualErr]    = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id ?? null)

    const [otRes, punchRes, empRes] = await Promise.all([
      supabase
        .from("overtime_records")
        .select("*, employees(full_name, employee_no)")
        .order("created_at", { ascending: false }),
      supabase
        .from("missing_punch_requests")
        .select("*, employees(full_name, employee_no)")
        .order("created_at", { ascending: false }),
      supabase
        .from("employees")
        .select("id, full_name, employee_no")
        .eq("status", "active")
        .order("full_name"),
    ])

    setOtList((otRes.data ?? []).map((r: any) => ({
      ...r,
      employee_name: r.employees?.full_name,
      employee_no:   r.employees?.employee_no,
    })))
    setPunchList((punchRes.data ?? []).map((r: any) => ({
      ...r,
      employee_name: r.employees?.full_name,
      employee_no:   r.employees?.employee_no,
    })))
    setEmployees((empRes.data ?? []) as any)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  // ── Overtime actions ──────────────────────────────────────────────────────
  async function approveOT(id: string, employeeId: string, employeeName: string) {
    setActionLoading(id)
    const { error } = await supabase.from("overtime_records").update({
      status:      "approved",
      approved_by: currentUserId,
      approved_at: new Date().toISOString(),
    }).eq("id", id)

    if (error) {
      toast("Failed to approve request", "error")
    } else {
      toast(`Overtime approved for ${employeeName}`, "success")
      notifyEmployee(
        employeeId,
        "Overtime Approved ✅",
        "Your overtime request has been approved",
        "/m/attendance"
      )
    }
    await loadData()
    setActionLoading(null)
  }

  async function rejectOT(id: string, employeeId: string, employeeName: string) {
    setActionLoading(id)
    const { error } = await supabase.from("overtime_records").update({
      status:      "rejected",
      approved_by: currentUserId,
      approved_at: new Date().toISOString(),
    }).eq("id", id)

    if (error) {
      toast("Failed to reject request", "error")
    } else {
      toast(`Overtime rejected for ${employeeName}`, "warning")
      notifyEmployee(
        employeeId,
        "Overtime Request Update",
        "Your overtime request was not approved",
        "/m/attendance"
      )
    }
    await loadData()
    setActionLoading(null)
  }

  // ── Missing Punch actions ─────────────────────────────────────────────────
  async function approvePunch(id: string, employeeId: string, employeeName: string) {
    if (!currentUserId) return
    setActionLoading(id)
    const { error } = await supabase.rpc("approve_missing_punch", {
      request_id:  id,
      approver_id: currentUserId,
    })

    if (error) {
      toast("Failed to approve — " + error.message, "error")
    } else {
      toast(`Missing punch approved for ${employeeName}`, "success")
      notifyEmployee(
        employeeId,
        "Missing Punch Approved ✅",
        "Your missing punch request has been approved and attendance updated",
        "/m/attendance"
      )
    }
    await loadData()
    setActionLoading(null)
  }

  async function rejectPunch(id: string, employeeId: string, employeeName: string) {
    setActionLoading(id)
    const { error } = await supabase.from("missing_punch_requests").update({
      status:      "rejected",
      approved_by: currentUserId,
      approved_at: new Date().toISOString(),
    }).eq("id", id)

    if (error) {
      toast("Failed to reject request", "error")
    } else {
      toast(`Missing punch rejected for ${employeeName}`, "warning")
      notifyEmployee(
        employeeId,
        "Missing Punch Request Update",
        "Your missing punch request was not approved",
        "/m/attendance"
      )
    }
    await loadData()
    setActionLoading(null)
  }

  // ── Manual OT ─────────────────────────────────────────────────────────────
  async function submitManualOT() {
    setManualErr(null)
    if (!manualForm.employee_id || !manualForm.date || !manualForm.hours || !manualForm.reason.trim()) {
      setManualErr("Please fill all required fields")
      return
    }
    const hrs = parseFloat(manualForm.hours)
    if (isNaN(hrs) || hrs <= 0 || hrs > 24) {
      setManualErr("Hours must be between 0.5 and 24")
      return
    }
    setManualSaving(true)
    const { error } = await supabase.from("overtime_records").insert({
      employee_id: manualForm.employee_id,
      date:        manualForm.date,
      hours:       hrs,
      reason:      manualForm.reason.trim(),
      notes:       manualForm.notes.trim() || null,
      source:      "hr_manual",
      status:      "approved",
      approved_by: currentUserId,
      approved_at: new Date().toISOString(),
    })
    setManualSaving(false)

    if (error) {
      if (error.code === "23505") setManualErr("OT already recorded for this employee on this date")
      else setManualErr(error.message)
    } else {
      const emp = employees.find(e => e.id === manualForm.employee_id)
      toast(`Manual OT added for ${emp?.full_name ?? "employee"}`, "success")
      notifyEmployee(
        manualForm.employee_id,
        "Overtime Recorded ✅",
        `${hrs}h overtime has been recorded by HR`,
        "/m/attendance"
      )
      setShowManualOT(false)
      setManualForm({ employee_id: "", date: "", hours: "", reason: "", notes: "" })
      await loadData()
    }
  }

  const filteredOT    = otFilter    === "pending" ? otList.filter(r => r.status    === "pending") : otList
  const filteredPunch = punchFilter === "pending" ? punchList.filter(r => r.status === "pending") : punchList
  const pendingOT    = otList.filter(r => r.status    === "pending").length
  const pendingPunch = punchList.filter(r => r.status === "pending").length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" /> Loading requests...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">HR Requests</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Overtime and missing punch approvals
          </p>
        </div>
        <div className="flex gap-2">
          {pendingOT > 0 && (
            <Badge className="bg-primary/15 text-primary text-xs border-0">
              {pendingOT} OT pending
            </Badge>
          )}
          {pendingPunch > 0 && (
            <Badge className="bg-chart-4/15 text-chart-4 text-xs border-0">
              {pendingPunch} punch pending
            </Badge>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          { id: "overtime"      as const, label: "Overtime",      icon: Timer,      count: pendingOT },
          { id: "missing_punch" as const, label: "Missing Punch", icon: FileSearch, count: pendingPunch },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors ${
              activeTab === t.id
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="size-4" />
            {t.label}
            {t.count > 0 && (
              <span className="bg-destructive/15 text-destructive text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════ OVERTIME TAB ═══════════ */}
      {activeTab === "overtime" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {(["pending", "all"] as const).map(f => (
                <button key={f} onClick={() => setOtFilter(f)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    otFilter === f
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  {f === "all" ? "All" : "Pending"}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowManualOT(!showManualOT)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium"
            >
              <Plus className="size-3.5" /> Add Manual OT
            </button>
          </div>

          {/* Manual OT Form */}
          {showManualOT && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Manual Overtime Entry</p>
                <button onClick={() => { setShowManualOT(false); setManualErr(null) }}
                  className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground block mb-1">Employee *</label>
                  <select
                    value={manualForm.employee_id}
                    onChange={e => setManualForm(f => ({ ...f, employee_id: e.target.value }))}
                    className="w-full bg-secondary/60 text-foreground text-sm rounded-lg px-2.5 py-2 outline-none border border-transparent focus:border-primary"
                  >
                    <option value="">Select employee...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.employee_no} — {emp.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Date *</label>
                  <input type="date" value={manualForm.date}
                    onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full bg-secondary/60 text-foreground text-sm rounded-lg px-2.5 py-2 outline-none border border-transparent focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Hours *</label>
                  <input type="number" min="0.5" max="24" step="0.5"
                    value={manualForm.hours}
                    onChange={e => setManualForm(f => ({ ...f, hours: e.target.value }))}
                    placeholder="e.g. 3"
                    className="w-full bg-secondary/60 text-foreground text-sm rounded-lg px-2.5 py-2 outline-none border border-transparent focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Reason *</label>
                  <input type="text" value={manualForm.reason}
                    onChange={e => setManualForm(f => ({ ...f, reason: e.target.value }))}
                    placeholder="Project deadline, etc."
                    className="w-full bg-secondary/60 text-foreground text-sm rounded-lg px-2.5 py-2 outline-none border border-transparent focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Notes</label>
                  <input type="text" value={manualForm.notes}
                    onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional"
                    className="w-full bg-secondary/60 text-foreground text-sm rounded-lg px-2.5 py-2 outline-none border border-transparent focus:border-primary"
                  />
                </div>
              </div>

              {manualErr && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                  <AlertCircle className="size-3.5 shrink-0" /> {manualErr}
                </div>
              )}

              <div className="flex justify-end">
                <button onClick={submitManualOT} disabled={manualSaving}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium disabled:opacity-50 flex items-center gap-1.5">
                  {manualSaving ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                  Add & Approve
                </button>
              </div>
            </div>
          )}

          {/* OT List */}
          {filteredOT.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No {otFilter === "pending" ? "pending" : ""} overtime requests
            </div>
          ) : (
            <div className="space-y-2">
              {filteredOT.map(ot => (
                <div key={ot.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="size-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-semibold text-primary">
                            {(ot.employee_name ?? "?").charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{ot.employee_name ?? "—"}</p>
                          <p className="text-[10px] text-muted-foreground">{ot.employee_no}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {new Date(ot.date + "T00:00:00").toLocaleDateString("en-GB", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-primary">
                          <Timer className="size-3" />
                          {ot.hours}h OT
                        </span>
                        {ot.source === "hr_manual" && (
                          <Badge className="bg-chart-2/15 text-chart-2 text-[10px] border-0">Manual</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{ot.reason}</p>
                      {ot.notes && (
                        <p className="text-[11px] text-muted-foreground mt-1 italic">{ot.notes}</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge className={`text-[10px] border-0 ${statusColors[ot.status]}`}>
                        {ot.status.charAt(0).toUpperCase() + ot.status.slice(1)}
                      </Badge>
                      {ot.status === "pending" && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => approveOT(ot.id, ot.employee_id, ot.employee_name ?? "")}
                            disabled={actionLoading === ot.id}
                            className="px-2.5 py-1 bg-chart-3/15 text-chart-3 rounded-lg text-[11px] font-medium hover:bg-chart-3/25 transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            {actionLoading === ot.id
                              ? <Loader2 className="size-3 animate-spin" />
                              : <CheckCircle2 className="size-3" />}
                            Approve
                          </button>
                          <button
                            onClick={() => rejectOT(ot.id, ot.employee_id, ot.employee_name ?? "")}
                            disabled={actionLoading === ot.id}
                            className="px-2.5 py-1 bg-destructive/15 text-destructive rounded-lg text-[11px] font-medium hover:bg-destructive/25 transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            <XCircle className="size-3" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ MISSING PUNCH TAB ═══════════ */}
      {activeTab === "missing_punch" && (
        <div className="space-y-4">
          <div className="flex gap-1.5">
            {(["pending", "all"] as const).map(f => (
              <button key={f} onClick={() => setPunchFilter(f)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  punchFilter === f
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {f === "all" ? "All" : "Pending"}
              </button>
            ))}
          </div>

          {filteredPunch.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No {punchFilter === "pending" ? "pending" : ""} missing punch requests
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPunch.map(p => (
                <div key={p.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="size-7 rounded-full bg-chart-4/15 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-semibold text-chart-4">
                            {(p.employee_name ?? "?").charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.employee_name ?? "—"}</p>
                          <p className="text-[10px] text-muted-foreground">{p.employee_no}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {new Date(p.date + "T00:00:00").toLocaleDateString("en-GB", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </span>
                        <span className="capitalize font-medium text-foreground">
                          {p.punch_type.replace("_", " ")}
                        </span>
                        <span className="font-mono">{p.expected_time.slice(0, 5)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{p.reason}</p>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge className={`text-[10px] border-0 ${statusColors[p.status]}`}>
                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </Badge>
                      {p.status === "pending" && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => approvePunch(p.id, p.employee_id, p.employee_name ?? "")}
                            disabled={actionLoading === p.id}
                            className="px-2.5 py-1 bg-chart-3/15 text-chart-3 rounded-lg text-[11px] font-medium hover:bg-chart-3/25 transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            {actionLoading === p.id
                              ? <Loader2 className="size-3 animate-spin" />
                              : <CheckCircle2 className="size-3" />}
                            Approve
                          </button>
                          <button
                            onClick={() => rejectPunch(p.id, p.employee_id, p.employee_name ?? "")}
                            disabled={actionLoading === p.id}
                            className="px-2.5 py-1 bg-destructive/15 text-destructive rounded-lg text-[11px] font-medium hover:bg-destructive/25 transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            <XCircle className="size-3" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
