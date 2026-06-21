"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Star, Plus, X, Loader2, Pencil, Trash2, Users, Filter,
  TrendingUp, Award, Target, Calendar, CheckCircle2, Send, Lock
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type {
  PerformanceReview, Employee, Profile
} from "@/lib/types"

type ReviewType = "annual" | "semi_annual" | "quarterly" | "probation" | "project"
type ReviewStatus = "draft" | "submitted" | "acknowledged" | "finalized"

const statusConfig: Record<ReviewStatus, { label: string; color: string }> = {
  draft:        { label: "Draft",        color: "bg-secondary text-secondary-foreground" },
  submitted:    { label: "Submitted",    color: "bg-primary/15 text-primary" },
  acknowledged: { label: "Acknowledged", color: "bg-chart-2/15 text-chart-2" },
  finalized:    { label: "Finalized",    color: "bg-chart-3/15 text-chart-3" },
}

const reviewTypeLabels: Record<ReviewType, string> = {
  annual:      "Annual",
  semi_annual: "Semi-Annual",
  quarterly:   "Quarterly",
  probation:   "Probation",
  project:     "Project",
}

const scoreFields = [
  { key: "productivity_score", label: "Productivity", icon: TrendingUp },
  { key: "quality_score",      label: "Quality",      icon: Award },
  { key: "teamwork_score",     label: "Teamwork",     icon: Users },
  { key: "attendance_score",   label: "Attendance",   icon: Calendar },
  { key: "initiative_score",   label: "Initiative",   icon: Target },
] as const

type FormState = {
  employee_id: string
  reviewer_id: string
  review_type: ReviewType
  review_period_start: string
  review_period_end: string
  productivity_score: number
  quality_score: number
  teamwork_score: number
  attendance_score: number
  initiative_score: number
  strengths: string
  areas_for_improvement: string
  goals_next_period: string
  reviewer_comments: string
  employee_comments: string
  status: ReviewStatus
}

const emptyForm: FormState = {
  employee_id: "",
  reviewer_id: "",
  review_type: "annual",
  review_period_start: "",
  review_period_end: "",
  productivity_score: 3,
  quality_score: 3,
  teamwork_score: 3,
  attendance_score: 3,
  initiative_score: 3,
  strengths: "",
  areas_for_improvement: "",
  goals_next_period: "",
  reviewer_comments: "",
  employee_comments: "",
  status: "draft",
}

export function PerformanceTab() {
  const [reviews, setReviews] = useState<PerformanceReview[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">("all")
  const [employeeFilter, setEmployeeFilter] = useState<string>("all")

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Bulk cycle creation
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkForm, setBulkForm] = useState({
    review_type: "annual" as ReviewType,
    review_period_start: "",
    review_period_end: "",
    selected_employees: new Set<string>(),
  })
  const [bulkSaving, setBulkSaving] = useState(false)

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const [revRes, empRes, profRes] = await Promise.all([
      supabase.from("performance_reviews")
        .select("*, employees:employee_id(full_name, employee_no), reviewer:reviewer_id(full_name)")
        .order("created_at", { ascending: false }),
      supabase.from("employees").select("*").eq("status", "active").order("full_name"),
      user ? supabase.from("profiles").select("*").eq("id", user.id).single() : Promise.resolve({ data: null }),
    ])

    setReviews((revRes.data ?? []) as PerformanceReview[])
    setEmployees((empRes.data ?? []) as Employee[])
    setCurrentProfile(profRes.data as Profile | null)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  function calcOverallScore(f: FormState): number {
    const sum = f.productivity_score + f.quality_score + f.teamwork_score + f.attendance_score + f.initiative_score
    return Math.round((sum / 5) * 100) / 100
  }

  function openCreate() {
    setEditingId(null)
    const now = new Date()
    setForm({
      ...emptyForm,
      review_period_start: new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0],
      review_period_end: new Date(now.getFullYear(), 11, 31).toISOString().split("T")[0],
    })
    setErr(null)
    setShowModal(true)
  }

  function openEdit(r: PerformanceReview) {
    setEditingId(r.id)
    setForm({
      employee_id: r.employee_id,
      reviewer_id: r.reviewer_id ?? "",
      review_type: r.review_type as ReviewType,
      review_period_start: r.review_period_start,
      review_period_end: r.review_period_end,
      productivity_score: r.productivity_score ?? 3,
      quality_score: r.quality_score ?? 3,
      teamwork_score: r.teamwork_score ?? 3,
      attendance_score: r.attendance_score ?? 3,
      initiative_score: r.initiative_score ?? 3,
      strengths: r.strengths ?? "",
      areas_for_improvement: r.areas_for_improvement ?? "",
      goals_next_period: r.goals_next_period ?? "",
      reviewer_comments: r.reviewer_comments ?? "",
      employee_comments: r.employee_comments ?? "",
      status: r.status as ReviewStatus,
    })
    setErr(null)
    setShowModal(true)
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function save() {
    setErr(null)
    if (!form.employee_id) return setErr("Select employee")
    if (!form.review_period_start || !form.review_period_end) return setErr("Set review period dates")

    setSaving(true)

    const payload = {
      employee_id: form.employee_id,
      reviewer_id: form.reviewer_id || null,
      review_type: form.review_type,
      review_period_start: form.review_period_start,
      review_period_end: form.review_period_end,
      productivity_score: form.productivity_score,
      quality_score: form.quality_score,
      teamwork_score: form.teamwork_score,
      attendance_score: form.attendance_score,
      initiative_score: form.initiative_score,
      overall_score: calcOverallScore(form),
      strengths: form.strengths.trim() || null,
      areas_for_improvement: form.areas_for_improvement.trim() || null,
      goals_next_period: form.goals_next_period.trim() || null,
      reviewer_comments: form.reviewer_comments.trim() || null,
      employee_comments: form.employee_comments.trim() || null,
      status: form.status,
    }

    const res = editingId
      ? await supabase.from("performance_reviews").update(payload).eq("id", editingId)
      : await supabase.from("performance_reviews").insert(payload)

    setSaving(false)

    if (res.error) { setErr(res.error.message); return }

    setShowModal(false)
    await loadData()
  }

  async function updateStatus(id: string, newStatus: ReviewStatus) {
    const updates: any = { status: newStatus }
    if (newStatus === "submitted") updates.submitted_at = new Date().toISOString()
    if (newStatus === "acknowledged") updates.acknowledged_at = new Date().toISOString()
    if (newStatus === "finalized") updates.finalized_at = new Date().toISOString()

    const { error } = await supabase.from("performance_reviews").update(updates).eq("id", id)
    if (error) return alert(error.message)
    await loadData()
  }

  async function remove(id: string) {
    if (!confirm("Delete this review?")) return
    const { error } = await supabase.from("performance_reviews").delete().eq("id", id)
    if (error) return alert(error.message)
    await loadData()
  }

  async function createBulkReviews() {
    if (!bulkForm.review_period_start || !bulkForm.review_period_end) {
      alert("Set period dates")
      return
    }
    if (bulkForm.selected_employees.size === 0) {
      alert("Select at least one employee")
      return
    }

    setBulkSaving(true)

    const records = Array.from(bulkForm.selected_employees).map(empId => ({
      employee_id: empId,
      review_type: bulkForm.review_type,
      review_period_start: bulkForm.review_period_start,
      review_period_end: bulkForm.review_period_end,
      status: "draft" as ReviewStatus,
    }))

    const { error } = await supabase.from("performance_reviews").insert(records)
    setBulkSaving(false)

    if (error) {
      alert(`Failed: ${error.message}`)
      return
    }

    alert(`Created ${records.length} reviews in draft status.`)
    setShowBulkModal(false)
    setBulkForm({
      review_type: "annual",
      review_period_start: "",
      review_period_end: "",
      selected_employees: new Set(),
    })
    await loadData()
  }

  const filtered = reviews.filter(r => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false
    if (employeeFilter !== "all" && r.employee_id !== employeeFilter) return false
    return true
  })

  const stats = useMemo(() => ({
    total: reviews.length,
    draft: reviews.filter(r => r.status === "draft").length,
    submitted: reviews.filter(r => r.status === "submitted").length,
    finalized: reviews.filter(r => r.status === "finalized").length,
    avgScore: reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + (r.overall_score ?? 0), 0) / reviews.length) * 100) / 100
      : 0,
  }), [reviews])

  const canManage = currentProfile && ["admin", "hr", "manager"].includes(currentProfile.role)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading reviews...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Performance Reviews</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats.total} reviews · avg score {stats.avgScore}/5
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-secondary text-foreground rounded-lg text-xs font-medium hover:bg-secondary/80 transition-colors">
              <Users className="size-3.5" />
              Start Cycle
            </button>
            <button onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="size-4" />
              New Review
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatBox label="Total" value={stats.total.toString()} icon={Star} color="text-primary" bg="bg-primary/10" />
        <StatBox label="Draft" value={stats.draft.toString()} icon={Pencil} color="text-muted-foreground" bg="bg-secondary" />
        <StatBox label="Submitted" value={stats.submitted.toString()} icon={Send} color="text-primary" bg="bg-primary/10" />
        <StatBox label="Finalized" value={stats.finalized.toString()} icon={CheckCircle2} color="text-chart-3" bg="bg-chart-3/10" />
        <StatBox label="Avg Score" value={`${stats.avgScore}/5`} icon={TrendingUp} color="text-chart-4" bg="bg-chart-4/10" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="size-3.5 text-muted-foreground" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as ReviewStatus | "all")}
          className="bg-secondary/60 text-foreground text-xs rounded-lg px-3 py-1.5 outline-none border border-transparent focus:border-primary">
          <option value="all">All Statuses</option>
          {(Object.entries(statusConfig) as [ReviewStatus, { label: string }][]).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)}
          className="bg-secondary/60 text-foreground text-xs rounded-lg px-3 py-1.5 outline-none border border-transparent focus:border-primary">
          <option value="all">All Employees</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.employee_no} — {e.full_name}</option>)}
        </select>
        <span className="text-xs text-muted-foreground ml-2">{filtered.length} shown</span>
      </div>

      {/* List */}
      <Card className="border-border bg-card">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Star className="size-8 mx-auto mb-2 opacity-50" />
              {reviews.length === 0 ? "No performance reviews yet." : "No reviews match filters."}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map(r => {
                const emp = employees.find(e => e.id === r.employee_id)
                const cfg = statusConfig[r.status as ReviewStatus]
                const overall = r.overall_score ?? 0
                const scoreColor =
                  overall >= 4.5 ? "text-chart-3"
                  : overall >= 3.5 ? "text-primary"
                  : overall >= 2.5 ? "text-chart-4"
                  : "text-destructive"

                return (
                  <div key={r.id} className="px-4 py-3 hover:bg-secondary/20 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`size-12 rounded-lg bg-secondary/50 flex flex-col items-center justify-center shrink-0`}>
                          <span className={`text-base font-bold leading-none ${scoreColor}`}>{overall.toFixed(1)}</span>
                          <span className="text-[9px] text-muted-foreground mt-0.5">/ 5.0</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-sm font-medium text-foreground truncate">{emp?.full_name ?? "—"}</p>
                            <Badge variant="secondary" className="text-[10px]">{reviewTypeLabels[r.review_type as ReviewType]}</Badge>
                            <Badge variant="secondary" className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(r.review_period_start).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            {" → "}
                            {new Date(r.review_period_end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Status transitions */}
                        {r.status === "draft" && canManage && (
                          <button onClick={() => updateStatus(r.id, "submitted")}
                            className="px-2 py-1 text-[10px] bg-primary/15 text-primary rounded hover:bg-primary/25 transition-colors flex items-center gap-1">
                            <Send className="size-2.5" /> Submit
                          </button>
                        )}
                        {r.status === "submitted" && (
                          <button onClick={() => updateStatus(r.id, "acknowledged")}
                            className="px-2 py-1 text-[10px] bg-chart-2/15 text-chart-2 rounded hover:bg-chart-2/25 transition-colors flex items-center gap-1">
                            <CheckCircle2 className="size-2.5" /> Acknowledge
                          </button>
                        )}
                        {r.status === "acknowledged" && canManage && (
                          <button onClick={() => updateStatus(r.id, "finalized")}
                            className="px-2 py-1 text-[10px] bg-chart-3/15 text-chart-3 rounded hover:bg-chart-3/25 transition-colors flex items-center gap-1">
                            <Lock className="size-2.5" /> Finalize
                          </button>
                        )}
                        <button onClick={() => openEdit(r)}
                          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="size-3.5" />
                        </button>
                        {canManage && (
                          <button onClick={() => remove(r.id)}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="size-3.5" />
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

      {/* Review Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {editingId ? "Edit Review" : "New Performance Review"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Overall Score: <strong className="text-foreground">{calcOverallScore(form).toFixed(2)} / 5.0</strong>
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5 flex flex-col gap-4">
              {err && (
                <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                  {err}
                </div>
              )}

              {/* Basic info */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Review Information</p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Employee *">
                    <select value={form.employee_id} onChange={e => update("employee_id", e.target.value)} className="form-field">
                      <option value="">Select...</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>{e.employee_no} — {e.full_name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Reviewer">
                    <select value={form.reviewer_id} onChange={e => update("reviewer_id", e.target.value)} className="form-field">
                      <option value="">—</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>{e.full_name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Review Type">
                    <select value={form.review_type} onChange={e => update("review_type", e.target.value as ReviewType)} className="form-field">
                      {(Object.entries(reviewTypeLabels) as [ReviewType, string][]).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select value={form.status} onChange={e => update("status", e.target.value as ReviewStatus)} className="form-field">
                      {(Object.entries(statusConfig) as [ReviewStatus, { label: string }][]).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Period Start *">
                    <input type="date" value={form.review_period_start} onChange={e => update("review_period_start", e.target.value)} className="form-field" />
                  </Field>
                  <Field label="Period End *">
                    <input type="date" value={form.review_period_end} onChange={e => update("review_period_end", e.target.value)} className="form-field" />
                  </Field>
                </div>
              </div>

              {/* Scores */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Scores (1-5)</p>
                <div className="space-y-2">
                  {scoreFields.map(({ key, label, icon: Icon }) => {
                    const value = form[key] as number
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <div className="flex items-center gap-2 w-32 shrink-0">
                          <Icon className="size-3.5 text-muted-foreground" />
                          <span className="text-xs text-foreground">{label}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-1">
                          {[1, 2, 3, 4, 5].map(n => (
                            <button
                              key={n}
                              onClick={() => update(key as any, n)}
                              className={`flex-1 h-8 rounded-md text-xs font-medium transition-colors ${
                                value === n
                                  ? "bg-primary text-primary-foreground"
                                  : value >= n
                                    ? "bg-primary/30 text-primary"
                                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Comments */}
              <div className="space-y-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">Comments</p>
                <Field label="Strengths">
                  <textarea value={form.strengths} onChange={e => update("strengths", e.target.value)} rows={2} className="form-field resize-none"
                    placeholder="What does this employee do well?" />
                </Field>
                <Field label="Areas for Improvement">
                  <textarea value={form.areas_for_improvement} onChange={e => update("areas_for_improvement", e.target.value)} rows={2} className="form-field resize-none"
                    placeholder="What could be improved?" />
                </Field>
                <Field label="Goals for Next Period">
                  <textarea value={form.goals_next_period} onChange={e => update("goals_next_period", e.target.value)} rows={2} className="form-field resize-none"
                    placeholder="SMART goals for the upcoming period" />
                </Field>
                <Field label="Reviewer Comments">
                  <textarea value={form.reviewer_comments} onChange={e => update("reviewer_comments", e.target.value)} rows={2} className="form-field resize-none" />
                </Field>
                <Field label="Employee Comments">
                  <textarea value={form.employee_comments} onChange={e => update("employee_comments", e.target.value)} rows={2} className="form-field resize-none"
                    placeholder="Employee's feedback on the review" />
                </Field>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/20">
              <button onClick={() => setShowModal(false)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button onClick={save} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                {saving && <Loader2 className="size-3 animate-spin" />}
                {editingId ? "Save Changes" : "Create Review"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Cycle Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Start Review Cycle</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Create draft reviews for multiple employees at once
                </p>
              </div>
              <button onClick={() => setShowBulkModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Review Type">
                  <select value={bulkForm.review_type} onChange={e => setBulkForm(f => ({ ...f, review_type: e.target.value as ReviewType }))} className="form-field">
                    {(Object.entries(reviewTypeLabels) as [ReviewType, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Field>
                <div />
                <Field label="Period Start">
                  <input type="date" value={bulkForm.review_period_start}
                    onChange={e => setBulkForm(f => ({ ...f, review_period_start: e.target.value }))} className="form-field" />
                </Field>
                <Field label="Period End">
                  <input type="date" value={bulkForm.review_period_end}
                    onChange={e => setBulkForm(f => ({ ...f, review_period_end: e.target.value }))} className="form-field" />
                </Field>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase">
                    Select Employees ({bulkForm.selected_employees.size} / {employees.length})
                  </p>
                  <div className="flex gap-1">
                    <button onClick={() => setBulkForm(f => ({ ...f, selected_employees: new Set(employees.map(e => e.id)) }))}
                      className="text-[10px] text-primary hover:underline">Select All</button>
                    <span className="text-muted-foreground">·</span>
                    <button onClick={() => setBulkForm(f => ({ ...f, selected_employees: new Set() }))}
                      className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
                  </div>
                </div>
                <div className="max-h-[300px] overflow-auto border border-border rounded-lg divide-y divide-border/50">
                  {employees.map(e => {
                    const isSelected = bulkForm.selected_employees.has(e.id)
                    return (
                      <label key={e.id} className="flex items-center gap-2 px-3 py-2 hover:bg-secondary/20 cursor-pointer">
                        <input type="checkbox" checked={isSelected}
                          onChange={() => {
                            setBulkForm(f => {
                              const next = new Set(f.selected_employees)
                              if (isSelected) next.delete(e.id)
                              else next.add(e.id)
                              return { ...f, selected_employees: next }
                            })
                          }} className="size-3.5" />
                        <span className="text-xs font-mono text-muted-foreground w-20">{e.employee_no}</span>
                        <span className="text-xs text-foreground truncate">{e.full_name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/20">
              <button onClick={() => setShowBulkModal(false)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button onClick={createBulkReviews} disabled={bulkSaving || bulkForm.selected_employees.size === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                {bulkSaving && <Loader2 className="size-3 animate-spin" />}
                Create {bulkForm.selected_employees.size} Reviews
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

function StatBox({ label, value, icon: Icon, color, bg }: { label: string; value: string; icon: typeof Star; color: string; bg: string }) {
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
