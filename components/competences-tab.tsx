"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import {
  Plus, Trash2, Save, Download, Printer,
  AlertTriangle, ChevronDown, ChevronUp, Loader2,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Competency {
  name: string
  desc: string
  weight: number
  rating: number   // 0–5
}

interface DevItem {
  area: string
  plan: string
  measure: string
  training: string
  duration: string
}

interface EvalData {
  competencies: Competency[]
  devPlan: DevItem[]
  savedAt: string | null
}

interface EmpRow {
  id: string
  full_name: string
  employee_no: string
  department?: { name: string } | null
  position?: { title: string } | null
  manager?: { full_name: string } | null
}

interface HistoryItem {
  id: string
  period: string
  competencies: Competency[]
  dev_plan: DevItem[]
  saved_at: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const COLORS = ["#275d55","#9c7a33","#5b6f8c","#7a5c8e","#8e6c4f","#4f7a5e","#8e3b3b","#b06a3a"]

const DEFAULT_COMPETENCIES: Competency[] = [
  { name: "People Development",             desc: "Leads performance and recruitment processes while building individual growth plans.", weight: 30, rating: 0 },
  { name: "Initiative & Drive for Results", desc: "Drives recruitment from job description to onboarding, proactively improving processes.", weight: 20, rating: 0 },
  { name: "Integrity & Compliance Mindset", desc: "Ensures fair, objective decisions while maintaining compliance with laws and policy.",  weight: 20, rating: 0 },
  { name: "Collaboration & Stakeholder Mgt",desc: "Partners with department heads on hiring needs, payroll accuracy, and performance.",    weight: 15, rating: 0 },
  { name: "Analytical & Data-Driven Thinking",desc: "Analyzes HR metrics and translates data into strategic insights.",                   weight: 15, rating: 0 },
]

const RATING_LABELS: Record<number, string> = {
  1: "Unsatisfactory", 2: "Needs Improvement", 3: "Meets Expectations",
  4: "Exceeds Expectations", 5: "Outstanding",
}

function thisMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)) }

function weightedScore(c: Competency) { return (clamp(c.rating, 0, 5) / 5) * c.weight }

function totalScore(comps: Competency[]) {
  return comps.reduce((s, c) => s + weightedScore(c), 0)
}

function totalWeight(comps: Competency[]) {
  return comps.reduce((s, c) => s + (Number(c.weight) || 0), 0)
}

function finalRating(score: number) {
  if (score >= 90) return { label: "Outstanding",          color: "#3f7a5e", bg: "#dbe8de" }
  if (score >= 80) return { label: "Exceeds Expectations", color: "#275d55", bg: "#dde9e6" }
  if (score >= 70) return { label: "Meets Expectations",   color: "#9c7a33", bg: "#e3d3ab" }
  if (score >= 60) return { label: "Needs Improvement",    color: "#b06a3a", bg: "#f3e2d4" }
  return                  { label: "Unsatisfactory",       color: "#8e3b3b", bg: "#f1d9d6" }
}

function promotionReady(comps: Competency[]) {
  const rated = comps.filter(c => c.rating > 0)
  if (!rated.length) return false
  return rated.reduce((s, c) => s + c.rating, 0) / rated.length >= 4
}

// ─────────────────────────────────────────────────────────────────────────────
// Gauge SVG
// ─────────────────────────────────────────────────────────────────────────────
function Gauge({ score }: { score: number }) {
  const r = 80, circumference = Math.PI * r
  const pct = clamp(score, 0, 100) / 100
  const dash = circumference * pct
  const rt = finalRating(score)
  return (
    <div className="relative flex items-center justify-center w-[200px] h-[120px] shrink-0">
      <svg viewBox="0 0 200 120" width="200" height="120">
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e1e4e1" strokeWidth="16" strokeLinecap="round" />
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={rt.color} strokeWidth="16"
          strokeLinecap="round" strokeDasharray={`${dash} ${circumference}`} />
      </svg>
      <div className="absolute text-center" style={{ top: 50 }}>
        <p className="text-3xl font-bold font-mono" style={{ color: "#1b443e" }}>{score.toFixed(1)}</p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Final Score</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Weight Allocation Bar
// ─────────────────────────────────────────────────────────────────────────────
function WeightBar({ comps }: { comps: Competency[] }) {
  const tw = totalWeight(comps) || 1
  const sum = totalWeight(comps)
  return (
    <div className="space-y-2">
      <div className="flex h-8 rounded overflow-hidden border border-border">
        {comps.map((c, i) => {
          const pct = (Number(c.weight || 0) / tw) * 100
          return (
            <div key={i} title={`${c.name} — ${c.weight}%`}
              className="flex items-center justify-center text-[11px] font-semibold text-white overflow-hidden transition-all"
              style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}
            >
              {pct > 8 ? `${c.weight}%` : ""}
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {comps.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="size-2.5 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
            {c.name} ({c.weight}%)
          </span>
        ))}
      </div>
      {Math.round(sum) !== 100 && (
        <p className="text-xs font-semibold" style={{ color: "#8e3b3b" }}>
          ⚠ Total weight is {sum}% — should be 100%
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sparkline
// ─────────────────────────────────────────────────────────────────────────────
function Sparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null
  const w = 280, h = 44, pad = 4
  const pts = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * (w - 2 * pad)
    const y = h - pad - (clamp(s, 0, 100) / 100) * (h - 2 * pad)
    return `${x},${y}`
  }).join(" ")
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="mt-2">
      <polyline points={pts} fill="none" stroke="#275d55" strokeWidth="2" />
      {scores.map((s, i) => {
        const x = pad + (i / (scores.length - 1)) * (w - 2 * pad)
        const y = h - pad - (clamp(s, 0, 100) / 100) * (h - 2 * pad)
        return <circle key={i} cx={x} cy={y} r="3" fill="#275d55" />
      })}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export function CompetencesTab() {
  const [employees,    setEmployees]    = useState<EmpRow[]>([])
  const [empId,        setEmpId]        = useState<string>("")
  const [period,       setPeriod]       = useState(thisMonth)
  const [evalData,     setEvalData]     = useState<EvalData>({ competencies: DEFAULT_COMPETENCIES.map(c => ({ ...c })), devPlan: [], savedAt: null })
  const [history,      setHistory]      = useState<HistoryItem[]>([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState<string | null>(null)
  const [scaleOpen,    setScaleOpen]    = useState(false)

  // ── toast helper ───────────────────────────────────────────────────────────
  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // ── load employees ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("employees")
        .select("id, full_name, employee_no, departments(name), positions(title), manager:employees!manager_id(full_name)")
        .eq("status", "active")
        .order("full_name")
      if (data?.length) {
        setEmployees(data as any)
        setEmpId(data[0].id)
      }
      setLoading(false)
    }
    load()
  }, [])

  // ── load evaluation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!empId) return
    async function loadEval() {
      const { data } = await supabase
        .from("performance_evaluations")
        .select("*")
        .eq("employee_id", empId)
        .eq("period", period)
        .single()

      if (data) {
        setEvalData({
          competencies: data.competencies as Competency[],
          devPlan:      data.dev_plan     as DevItem[],
          savedAt:      data.saved_at,
        })
      } else {
        // No eval for this period — carry forward competency structure
        const { data: last } = await supabase
          .from("performance_evaluations")
          .select("competencies, dev_plan")
          .eq("employee_id", empId)
          .order("period", { ascending: false })
          .limit(1)
          .single()

        setEvalData({
          competencies: last
            ? (last.competencies as Competency[]).map(c => ({ ...c, rating: 0 }))
            : DEFAULT_COMPETENCIES.map(c => ({ ...c })),
          devPlan:  last ? (last.dev_plan as DevItem[]) : [],
          savedAt: null,
        })
      }
    }
    loadEval()
  }, [empId, period])

  // ── load history ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!empId) return
    async function loadHistory() {
      const { data } = await supabase
        .from("performance_evaluations")
        .select("id, period, competencies, dev_plan, saved_at")
        .eq("employee_id", empId)
        .not("saved_at", "is", null)
        .order("period", { ascending: false })
        .limit(12)
      setHistory((data ?? []) as HistoryItem[])
    }
    loadHistory()
  }, [empId, saving])

  // ── save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!empId) return
    setSaving(true)
    const now = new Date().toISOString()
    const { error } = await supabase.from("performance_evaluations").upsert({
      employee_id:  empId,
      period,
      competencies: evalData.competencies,
      dev_plan:     evalData.devPlan,
      saved_at:     now,
      updated_at:   now,
    }, { onConflict: "employee_id,period" })

    setSaving(false)
    if (error) { showToast("Save failed: " + error.message); return }
    setEvalData(d => ({ ...d, savedAt: now }))
    showToast("Review saved ✓")
  }

  // ── competency helpers ─────────────────────────────────────────────────────
  function updateComp(i: number, patch: Partial<Competency>) {
    setEvalData(d => ({
      ...d,
      competencies: d.competencies.map((c, idx) => idx === i ? { ...c, ...patch } : c),
    }))
  }

  function setRating(i: number, r: number) {
    updateComp(i, { rating: evalData.competencies[i].rating === r ? 0 : r })
  }

  function addComp() {
    setEvalData(d => ({
      ...d,
      competencies: [...d.competencies, { name: "New Competency", desc: "", weight: 0, rating: 0 }],
    }))
  }

  function removeComp(i: number) {
    setEvalData(d => ({ ...d, competencies: d.competencies.filter((_, idx) => idx !== i) }))
  }

  // ── dev plan helpers ───────────────────────────────────────────────────────
  function updateDev(i: number, patch: Partial<DevItem>) {
    setEvalData(d => ({
      ...d,
      devPlan: d.devPlan.map((item, idx) => idx === i ? { ...item, ...patch } : item),
    }))
  }

  function addDev() {
    setEvalData(d => ({
      ...d,
      devPlan: [...d.devPlan, { area: "", plan: "", measure: "", training: "", duration: "" }],
    }))
  }

  function removeDev(i: number) {
    setEvalData(d => ({ ...d, devPlan: d.devPlan.filter((_, idx) => idx !== i) }))
  }

  // ── export CSV ────────────────────────────────────────────────────────────
  function exportCSV() {
    const emp = employees.find(e => e.id === empId)
    const score = totalScore(evalData.competencies)
    const rt = finalRating(score)
    const rows = [
      ["Employee", "Employee No", "Period", "Final Score", "Final Rating", "Competency", "Weight%", "Rating (1-5)", "Weighted Score"],
      ...evalData.competencies.map(c => [
        emp?.full_name ?? "", emp?.employee_no ?? "", period,
        score.toFixed(1), rt.label,
        c.name, c.weight, c.rating, weightedScore(c).toFixed(1),
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n")
    const a = document.createElement("a")
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv)
    a.download = `competences-${empId}-${period}.csv`
    a.click()
    showToast("Exported ✓")
  }

  // ── derived ────────────────────────────────────────────────────────────────
  const score    = totalScore(evalData.competencies)
  const rating   = finalRating(score)
  const ready    = promotionReady(evalData.competencies)
  const selEmp   = employees.find(e => e.id === empId)
  const histScores = [...history].reverse().map(h => totalScore(h.competencies as Competency[]))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" /> Loading employees...
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-5 py-2.5 rounded-lg text-sm font-medium shadow-xl">
          {toast}
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Performance Management System
          </p>
          <h2 className="text-2xl font-bold text-foreground mt-1">Competences Form</h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <Download className="size-3.5" /> Export CSV
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <Printer className="size-3.5" /> Print / PDF
          </button>
        </div>
      </div>

      {/* ── Employee Information ────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Employee Information
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="col-span-2 md:col-span-1">
            <label className="text-[11px] text-muted-foreground block mb-1.5">Employee</label>
            <select
              value={empId}
              onChange={e => setEmpId(e.target.value)}
              className="w-full bg-secondary/60 text-foreground text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-primary"
            >
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.employee_no} — {e.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] text-muted-foreground block mb-1.5">Review Period</label>
            <input type="month" value={period} onChange={e => setPeriod(e.target.value || thisMonth())}
              className="w-full bg-secondary/60 text-foreground text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-primary"
            />
          </div>

          <div>
            <label className="text-[11px] text-muted-foreground block mb-1.5">Department</label>
            <input readOnly value={(selEmp as any)?.departments?.name ?? "—"}
              className="w-full bg-secondary/30 text-muted-foreground text-sm rounded-lg px-3 py-2 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-muted-foreground block mb-1.5">Position</label>
            <input readOnly value={(selEmp as any)?.positions?.title ?? "—"}
              className="w-full bg-secondary/30 text-muted-foreground text-sm rounded-lg px-3 py-2 outline-none"
            />
          </div>
        </div>
      </div>

      {/* ── Dashboard ──────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Performance Dashboard
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <Gauge score={score} />
          <div className="flex flex-col gap-3 flex-1">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-36">Final Rating</span>
              <span className="text-xs font-bold px-3 py-1.5 rounded border"
                style={{ color: rating.color, background: rating.bg, borderColor: rating.color + "66" }}>
                {rating.label}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-36">Promotion Readiness</span>
              <span className={`text-xs font-bold px-3 py-1.5 rounded border ${
                ready
                  ? "text-[#3f7a5e] bg-[#dbe8de]"
                  : "text-muted-foreground bg-secondary"
              }`} style={{ borderColor: ready ? "#3f7a5e66" : undefined }}>
                {ready ? "Ready for Promotion" : "Development Required"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-36">Competency Total</span>
              <span className="text-sm font-bold font-mono" style={{ color: "#1b443e" }}>
                {score.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Competencies ───────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Competencies — Weighted Assessment
          </p>
          <button onClick={addComp}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <Plus className="size-3.5" /> Add Competency
          </button>
        </div>

        <WeightBar comps={evalData.competencies} />

        <div className="space-y-3 pt-1">
          {evalData.competencies.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              No competencies yet — click "Add Competency"
            </p>
          ) : (
            evalData.competencies.map((c, i) => {
              const ws = weightedScore(c)
              const col = COLORS[i % COLORS.length]
              return (
                <div key={i} className="border border-border rounded-xl p-4"
                  style={{ borderLeftWidth: 4, borderLeftColor: col }}>
                  {/* Comp head */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <input
                        value={c.name}
                        onChange={e => updateComp(i, { name: e.target.value })}
                        className="bg-transparent font-semibold text-sm text-foreground outline-none border-b border-transparent focus:border-b-primary w-full pb-0.5"
                      />
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>Weight</span>
                        <input type="number" min={0} max={100}
                          value={c.weight}
                          onChange={e => updateComp(i, { weight: Number(e.target.value) || 0 })}
                          className="w-14 bg-secondary/60 text-foreground text-xs rounded px-2 py-1 outline-none border border-transparent focus:border-primary text-center font-mono"
                        />
                        <span>%</span>
                      </div>
                      <button onClick={() => removeComp(i)}
                        className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <textarea
                    value={c.desc}
                    onChange={e => updateComp(i, { desc: e.target.value })}
                    rows={2}
                    placeholder="Competency description..."
                    className="w-full mt-2 bg-transparent text-xs text-muted-foreground outline-none resize-none focus:bg-secondary/30 rounded px-1 py-0.5 transition-colors"
                  />

                  {/* Rating */}
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <span className="text-xs text-muted-foreground w-20">Rating (1–5)</span>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => setRating(i, n)}
                          title={RATING_LABELS[n]}
                          className={`size-8 rounded text-xs font-semibold font-mono border transition-colors ${
                            c.rating === n
                              ? "text-white border-transparent"
                              : "border-border text-muted-foreground hover:border-primary"
                          }`}
                          style={c.rating === n ? { background: col, borderColor: col } : {}}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground ml-auto">
                      Weighted: <strong className="font-mono text-foreground">{ws.toFixed(1)}</strong>
                    </span>
                  </div>

                  {c.rating > 0 && c.rating < 3 && (
                    <p className="text-xs font-semibold mt-2 flex items-center gap-1"
                      style={{ color: "#8e3b3b" }}>
                      <AlertTriangle className="size-3.5" /> Development Required
                    </p>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Development Plan ───────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Development Plan
          </p>
          <button onClick={addDev}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <Plus className="size-3.5" /> Add Item
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-foreground text-muted-foreground uppercase text-[10px] tracking-wider">
                <th className="text-left pb-2 pr-3 min-w-[130px]">Development Area</th>
                <th className="text-left pb-2 pr-3 min-w-[160px]">Development Plan</th>
                <th className="text-left pb-2 pr-3 min-w-[130px]">Success Measure</th>
                <th className="text-left pb-2 pr-3 min-w-[120px]">Training</th>
                <th className="text-left pb-2 pr-3 min-w-[100px]">Duration</th>
                <th className="pb-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {evalData.devPlan.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    No development items yet
                  </td>
                </tr>
              ) : (
                evalData.devPlan.map((d, i) => (
                  <tr key={i} className="hover:bg-secondary/20 transition-colors">
                    {(["area", "plan", "measure", "training", "duration"] as (keyof DevItem)[]).map(field => (
                      <td key={field} className="py-2 pr-3">
                        <input
                          value={d[field]}
                          onChange={e => updateDev(i, { [field]: e.target.value })}
                          placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                          className="w-full bg-transparent text-foreground text-xs outline-none focus:bg-secondary/30 rounded px-1 py-0.5"
                        />
                      </td>
                    ))}
                    <td className="py-2">
                      <button onClick={() => removeDev(i)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1">
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Save bar ───────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-muted-foreground">
          Last saved:{" "}
          <span className="font-mono text-foreground">
            {evalData.savedAt ? new Date(evalData.savedAt).toLocaleString("en-GB") : "Not saved yet"}
          </span>
        </p>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors"
          style={{ background: "#275d55" }}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save Review
        </button>
      </div>

      {/* ── History ────────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Review History
        </p>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No saved reviews yet — save a review to see history here
          </p>
        ) : (
          <>
            <div className="divide-y divide-border/50">
              {history.map(h => {
                const sc = totalScore(h.competencies as Competency[])
                const rt = finalRating(sc)
                return (
                  <div key={h.id}
                    className="flex items-center gap-4 py-2.5 hover:bg-secondary/20 rounded px-2 cursor-pointer transition-colors"
                    onClick={() => setPeriod(h.period)}
                  >
                    <span className="font-mono font-semibold text-xs text-foreground w-20">{h.period}</span>
                    <span className="font-mono font-bold text-sm w-12" style={{ color: "#1b443e" }}>
                      {sc.toFixed(1)}
                    </span>
                    <span className="text-xs flex-1" style={{ color: rt.color }}>{rt.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {h.saved_at ? new Date(h.saved_at).toLocaleDateString("en-GB") : ""}
                    </span>
                  </div>
                )
              })}
            </div>
            <Sparkline scores={histScores} />
          </>
        )}
      </div>

      {/* ── Rating Scale Reference ─────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setScaleOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-secondary/20 transition-colors"
        >
          <span className="text-xs font-semibold" style={{ color: "#275d55" }}>
            Rating Scale Reference
          </span>
          {scaleOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </button>
        {scaleOpen && (
          <div className="px-5 pb-4 divide-y divide-border/50">
            {[
              { range: "90% – 100%",  label: "Outstanding",           color: "#3f7a5e", desc: "Consistently delivers exceptional results, significantly exceeds expectations." },
              { range: "80% – <90%",  label: "Exceeds Expectations",  color: "#275d55", desc: "Frequently performs above required standards and delivers results beyond expectations." },
              { range: "70% – <80%",  label: "Meets Expectations",    color: "#9c7a33", desc: "Consistently meets job requirements and achieves expected performance standards." },
              { range: "60% – <70%",  label: "Needs Improvement",     color: "#b06a3a", desc: "Meets some expectations but requires development in key performance areas." },
              { range: "Below 60%",   label: "Unsatisfactory",        color: "#8e3b3b", desc: "Performance does not meet required standards and requires immediate improvement." },
            ].map(s => (
              <div key={s.label} className="py-2.5 grid grid-cols-[100px_160px_1fr] gap-3 text-xs">
                <span className="font-mono font-semibold text-muted-foreground">{s.range}</span>
                <span className="font-semibold" style={{ color: s.color }}>{s.label}</span>
                <span className="text-muted-foreground">{s.desc}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
