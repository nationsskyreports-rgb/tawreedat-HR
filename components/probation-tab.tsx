"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import {
  Plus, Loader2, CheckCircle2, XCircle, Clock,
  AlertTriangle, RefreshCw, X, Search, CalendarDays,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type ProbationStatus = "ongoing" | "extended" | "passed" | "failed"

interface ProbationRecord {
  id: string
  employee_id: string
  start_date: string
  end_date: string
  extended_end_date: string | null
  status: ProbationStatus
  outcome_notes: string | null
  decided_by: string | null
  decided_at: string | null
  created_at: string
  updated_at: string
}

interface EmpRow {
  id: string
  employee_no: string
  full_name: string
  contract_type: string
  hire_date: string | null
  departments: { name: string } | null
  positions: { title: string } | null
}

interface ProbationRow {
  emp_id: string
  emp_no: string
  full_name: string
  department: string
  position: string
  hire_date: string | null
  record: ProbationRecord | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<ProbationStatus, { label: string; color: string }> = {
  ongoing:  { label: "Ongoing",  color: "bg-primary/15 text-primary" },
  extended: { label: "Extended", color: "bg-chart-2/15 text-chart-2" },
  passed:   { label: "Passed",   color: "bg-chart-3/15 text-chart-3" },
  failed:   { label: "Failed",   color: "bg-destructive/15 text-destructive" },
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function daysRemaining(endDate: string, extended: string | null): number {
  const end = new Date(extended || endDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  return Math.ceil((end.getTime() - today.getTime()) / 86400000)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function defaultEndDate() {
  const d = new Date()
  d.setMonth(d.getMonth() + 3)
  return d.toISOString().split("T")[0]
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export function ProbationTab() {
  const [rows,          setRows]          = useState<ProbationRow[]>([])
  const [allEmps,       setAllEmps]       = useState<EmpRow[]>([])
  const [loading,       setLoading]       = useState(true)
  const [filter,        setFilter]        = useState<"all" | ProbationStatus | "expiring">("all")
  const [search,        setSearch]        = useState("")
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null)
  const [saving,        setSaving]        = useState(false)

  // Add modal
  const [showAdd,  setShowAdd]  = useState(false)
  const [addForm,  setAddForm]  = useState({ employee_id: "", start_date: new Date().toISOString().split("T")[0], end_date: defaultEndDate(), notes: "" })

  // Extend modal
  const [extRec,   setExtRec]   = useState<ProbationRecord | null>(null)
  const [extForm,  setExtForm]  = useState({ extended_end_date: "", notes: "" })

  function toast$(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // ── load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const [empRes, recRes] = await Promise.all([
      supabase
        .from("employees")
        .select("id, employee_no, full_name, contract_type, hire_date, departments(name), positions(title)")
        .order("full_name"),
      supabase
        .from("probation_records")
        .select("*")
        .order("created_at", { ascending: false }),
    ])

    const emps = (empRes.data ?? []) as unknown as EmpRow[]
    const recs = (recRes.data ?? []) as ProbationRecord[]
    const recMap = new Map(recs.map(r => [r.employee_id, r]))
    const recEmpIds = new Set(recs.map(r => r.employee_id))

    // Show employees that have a record OR contract_type = 'probation'
    const combined: ProbationRow[] = emps
      .filter(e => recEmpIds.has(e.id) || e.contract_type === "probation")
      .map(e => ({
        emp_id:     e.id,
        emp_no:     e.employee_no,
        full_name:  e.full_name,
        department: (e.departments as any)?.name ?? "—",
        position:   (e.positions  as any)?.title ?? "—",
        hire_date:  e.hire_date,
        record:     recMap.get(e.id) ?? null,
      }))

    setRows(combined)
    setAllEmps(emps)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── add ────────────────────────────────────────────────────────────────────
  async function handleAdd() {
    if (!addForm.employee_id || !addForm.start_date || !addForm.end_date) return
    setSaving(true)
    const { error } = await supabase.from("probation_records").insert({
      employee_id:   addForm.employee_id,
      start_date:    addForm.start_date,
      end_date:      addForm.end_date,
      status:        "ongoing",
      outcome_notes: addForm.notes || null,
    })
    if (!error) {
      await supabase
        .from("employees")
        .update({ contract_type: "probation" })
        .eq("id", addForm.employee_id)
    }
    setSaving(false)
    if (error) { toast$(error.message, false); return }
    setShowAdd(false)
    setAddForm({ employee_id: "", start_date: new Date().toISOString().split("T")[0], end_date: defaultEndDate(), notes: "" })
    toast$("Probation period created ✓")
    await load()
  }

  // ── extend ─────────────────────────────────────────────────────────────────
  async function handleExtend() {
    if (!extRec || !extForm.extended_end_date) return
    setSaving(true)
    const { error } = await supabase
      .from("probation_records")
      .update({ status: "extended", extended_end_date: extForm.extended_end_date, outcome_notes: extForm.notes || null })
      .eq("id", extRec.id)
    setSaving(false)
    if (error) { toast$(error.message, false); return }
    setExtRec(null)
    toast$("Probation extended ✓")
    await load()
  }

  // ── pass / fail ────────────────────────────────────────────────────────────
  async function handleDecision(rec: ProbationRecord, decision: "passed" | "failed") {
    const confirmMsg = decision === "passed"
      ? "Mark this employee as PASSED probation? Their contract type will be updated to Permanent."
      : "Mark this employee as FAILED probation? Their status will be set to Terminated."
    if (!window.confirm(confirmMsg)) return

    const notes = window.prompt("Outcome notes (optional):") ?? null
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from("probation_records")
      .update({
        status:        decision,
        outcome_notes: notes,
        decided_by:    user?.id ?? null,
        decided_at:    new Date().toISOString(),
      })
      .eq("id", rec.id)
    if (error) { toast$(error.message, false); return }

    if (decision === "passed") {
      await supabase.from("employees").update({ contract_type: "permanent" }).eq("id", rec.employee_id)
      toast$("Probation passed — contract updated to Permanent ✓")
    } else {
      await supabase.from("employees").update({
        status:           "terminated",
        termination_date: new Date().toISOString().split("T")[0],
      }).eq("id", rec.employee_id)
      toast$("Probation failed — employee terminated")
    }
    await load()
  }

  // ── derived ────────────────────────────────────────────────────────────────
  const stats = {
    active:    rows.filter(r => r.record?.status === "ongoing" || r.record?.status === "extended").length,
    expiring:  rows.filter(r => {
      if (!r.record || r.record.status === "passed" || r.record.status === "failed") return false
      const d = daysRemaining(r.record.end_date, r.record.extended_end_date)
      return d >= 0 && d <= 14
    }).length,
    completed: rows.filter(r => r.record?.status === "passed" || r.record?.status === "failed").length,
  }

  const filtered = rows.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = !q || r.full_name.toLowerCase().includes(q) || r.emp_no.toLowerCase().includes(q)
    if (!matchSearch) return false
    if (filter === "all") return true
    if (filter === "expiring") {
      if (!r.record || r.record.status === "passed" || r.record.status === "failed") return false
      const d = daysRemaining(r.record.end_date, r.record.extended_end_date)
      return d >= 0 && d <= 14
    }
    return r.record?.status === filter
  })

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-lg text-sm font-medium shadow-xl transition-all ${toast.ok ? "bg-foreground text-background" : "bg-destructive text-destructive-foreground"}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Probation Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track employee probation periods and outcomes</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="size-4" /> Add to Probation
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {([
          { label: "Currently in Probation", value: stats.active,    Icon: Clock,          color: "text-primary" },
          { label: "Expiring ≤ 14 days",     value: stats.expiring,  Icon: AlertTriangle,   color: "text-chart-2" },
          { label: "Completed",               value: stats.completed, Icon: CheckCircle2,    color: "text-chart-3" },
        ] as const).map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
            <div className="size-10 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0">
              <s.Icon className={`size-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-secondary/60 rounded-lg px-3 py-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employee..."
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-44"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {([
            { key: "all",      label: "All" },
            { key: "ongoing",  label: "Ongoing" },
            { key: "extended", label: "Extended" },
            { key: "expiring", label: "Expiring Soon" },
            { key: "passed",   label: "Passed" },
            { key: "failed",   label: "Failed" },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                filter === f.key
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 text-xs font-medium text-muted-foreground px-4 py-3 border-b border-border uppercase tracking-wide">
          <span className="col-span-1">Emp No</span>
          <span className="col-span-2">Name</span>
          <span className="col-span-2">Department</span>
          <span className="col-span-2">Start Date</span>
          <span className="col-span-2">End Date</span>
          <span className="col-span-1">Days Left</span>
          <span className="col-span-1">Status</span>
          <span className="col-span-1 text-right">Actions</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {rows.length === 0
              ? "No employees in probation. Click \"Add to Probation\" to get started."
              : "No results match your filters."}
          </div>
        ) : (
          filtered.map(row => {
            const rec = row.record
            const effEnd = rec?.extended_end_date || rec?.end_date || ""
            const days   = rec ? daysRemaining(rec.end_date, rec.extended_end_date) : null
            const isActive  = rec?.status === "ongoing" || rec?.status === "extended"
            const isDanger  = days !== null && days >= 0 && days <= 7
            const isWarn    = days !== null && days >= 0 && days <= 14
            const cfg = rec ? STATUS_CFG[rec.status] : STATUS_CFG.ongoing

            return (
              <div key={row.emp_id} className="grid grid-cols-12 px-4 py-3 border-b border-border/50 text-sm items-center hover:bg-secondary/30 transition-colors">
                <span className="col-span-1 font-mono text-xs text-muted-foreground">{row.emp_no}</span>
                <span className="col-span-2 font-medium text-foreground truncate">{row.full_name}</span>
                <span className="col-span-2 text-xs text-muted-foreground truncate">{row.department}</span>
                <span className="col-span-2 text-xs text-muted-foreground">{rec ? fmtDate(rec.start_date) : "—"}</span>
                <span className="col-span-2 text-xs text-muted-foreground">
                  {effEnd ? fmtDate(effEnd) : "—"}
                  {rec?.extended_end_date && (
                    <span className="ml-1 text-chart-2 text-[10px] font-medium">(ext)</span>
                  )}
                </span>
                <span className={`col-span-1 text-xs font-mono font-semibold ${
                  days === null       ? "text-muted-foreground" :
                  days < 0            ? "text-destructive"      :
                  isDanger            ? "text-destructive"      :
                  isWarn              ? "text-chart-2"          :
                                        "text-foreground"
                }`}>
                  {days === null ? "—" : days < 0 ? "Overdue" : `${days}d`}
                </span>
                <div className="col-span-1">
                  {rec && (
                    <Badge variant="secondary" className={`text-[10px] ${cfg.color}`}>
                      {cfg.label}
                    </Badge>
                  )}
                  {!rec && (
                    <Badge variant="secondary" className="text-[10px] bg-chart-2/15 text-chart-2">
                      No record
                    </Badge>
                  )}
                </div>
                <div className="col-span-1 flex items-center justify-end gap-1">
                  {isActive && rec && (
                    <>
                      <button
                        onClick={() => { setExtRec(rec); setExtForm({ extended_end_date: "", notes: "" }) }}
                        title="Extend"
                        className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <RefreshCw className="size-3.5" />
                      </button>
                      <button
                        onClick={() => handleDecision(rec, "passed")}
                        title="Mark as Passed"
                        className="p-1.5 rounded hover:bg-chart-3/10 text-muted-foreground hover:text-chart-3 transition-colors"
                      >
                        <CheckCircle2 className="size-3.5" />
                      </button>
                      <button
                        onClick={() => handleDecision(rec, "failed")}
                        title="Mark as Failed"
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <XCircle className="size-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Add Modal ────────────────────────────────────────────────────────── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Add Employee to Probation</h2>
              <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">Employee *</span>
                <select
                  value={addForm.employee_id}
                  onChange={e => setAddForm(f => ({ ...f, employee_id: e.target.value }))}
                  className="bg-secondary/60 text-foreground text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-primary"
                >
                  <option value="">— Select employee —</option>
                  {allEmps.map(e => (
                    <option key={e.id} value={e.id}>{e.employee_no} — {e.full_name}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted-foreground">Start Date *</span>
                  <input type="date" value={addForm.start_date}
                    onChange={e => setAddForm(f => ({ ...f, start_date: e.target.value }))}
                    className="bg-secondary/60 text-foreground text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-primary" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted-foreground">End Date *</span>
                  <input type="date" value={addForm.end_date}
                    onChange={e => setAddForm(f => ({ ...f, end_date: e.target.value }))}
                    className="bg-secondary/60 text-foreground text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-primary" />
                </label>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">Notes (optional)</span>
                <textarea rows={2} value={addForm.notes}
                  onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                  className="bg-secondary/60 text-foreground text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-primary resize-none" />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button
                onClick={handleAdd}
                disabled={saving || !addForm.employee_id || !addForm.start_date || !addForm.end_date}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {saving && <Loader2 className="size-4 animate-spin" />} Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Extend Modal ─────────────────────────────────────────────────────── */}
      {extRec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Extend Probation Period</h2>
              <button onClick={() => setExtRec(null)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Current end date:{" "}
                <strong className="text-foreground">{fmtDate(extRec.extended_end_date || extRec.end_date)}</strong>
              </p>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">New End Date *</span>
                <input type="date" value={extForm.extended_end_date}
                  onChange={e => setExtForm(f => ({ ...f, extended_end_date: e.target.value }))}
                  className="bg-secondary/60 text-foreground text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-primary" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">Reason (optional)</span>
                <textarea rows={2} value={extForm.notes}
                  onChange={e => setExtForm(f => ({ ...f, notes: e.target.value }))}
                  className="bg-secondary/60 text-foreground text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-primary resize-none" />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <button onClick={() => setExtRec(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button
                onClick={handleExtend}
                disabled={saving || !extForm.extended_end_date}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {saving && <Loader2 className="size-4 animate-spin" />} Extend
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
