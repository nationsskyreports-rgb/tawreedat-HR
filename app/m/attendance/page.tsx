"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Loader2, ChevronLeft, ChevronRight,
  Plus, X, CheckCircle2, AlertCircle,
  ClipboardList, Timer, FileSearch,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type {
  Employee, AttendanceLog, AttendanceStatus,
  OvertimeRecord, MissingPunchRequest,
} from "@/lib/types"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"

type InternalTab = "timesheet" | "missing_punch" | "overtime"

const attendanceStatusConfig: Record<AttendanceStatus, { label: string; color: string }> = {
  present:  { label: "Present",  color: "bg-chart-3/15 text-chart-3" },
  late:     { label: "Late",     color: "bg-primary/15 text-primary" },
  absent:   { label: "Absent",   color: "bg-destructive/15 text-destructive" },
  on_leave: { label: "On Leave", color: "bg-chart-4/15 text-chart-4" },
  holiday:  { label: "Holiday",  color: "bg-chart-2/15 text-chart-2" },
  half_day: { label: "Half Day", color: "bg-secondary text-secondary-foreground" },
}

const reqStatusConfig: Record<string, { label: string; color: string }> = {
  pending:  { label: "Pending",  color: "bg-primary/15 text-primary" },
  approved: { label: "Approved", color: "bg-chart-3/15 text-chart-3" },
  rejected: { label: "Rejected", color: "bg-destructive/15 text-destructive" },
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
}

function fmtMins(mins: number): string {
  if (!mins || mins <= 0) return "—"
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function getMonthBounds(ym: string): { start: string; end: string } {
  const [y, m] = ym.split("-").map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 0, 23, 59, 59)
  return { start: start.toISOString(), end: end.toISOString() }
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
}

export default function AttendancePage() {
  const router = useRouter()
  const [tab, setTab] = useState<InternalTab>("timesheet")
  const [loading, setLoading] = useState(true)
  const [employee, setEmployee] = useState<Employee | null>(null)

  // --- Time Sheet ---
  const [logs, setLogs] = useState<AttendanceLog[]>([])
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const [logsLoading, setLogsLoading] = useState(false)

  // --- Missing Punch ---
  const [punches, setPunches] = useState<MissingPunchRequest[]>([])
  const [showPunchForm, setShowPunchForm] = useState(false)
  const [punchForm, setPunchForm] = useState({
    date: "",
    punch_type: "check_in" as "check_in" | "check_out",
    expected_time: "",
    reason: "",
  })
  const [punchSaving, setPunchSaving] = useState(false)
  const [punchErr, setPunchErr] = useState<string | null>(null)
  const [punchOk, setPunchOk] = useState(false)

  // --- Overtime ---
  const [otRecords, setOtRecords] = useState<OvertimeRecord[]>([])
  const [showOtForm, setShowOtForm] = useState(false)
  const [otForm, setOtForm] = useState({ date: "", hours: "", reason: "" })
  const [otSaving, setOtSaving] = useState(false)
  const [otErr, setOtErr] = useState<string | null>(null)
  const [otOk, setOtOk] = useState(false)

  const today = new Date().toISOString().split("T")[0]

  async function getEmployee(): Promise<Employee | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return null }
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single()
    if (!prof?.employee_id) return null
    const { data: emp } = await supabase.from("employees").select("*").eq("id", prof.employee_id).single()
    return emp as Employee | null
  }

  async function loadLogs(emp: Employee, ym: string) {
    setLogsLoading(true)
    const { start, end } = getMonthBounds(ym)
    const { data } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("employee_id", emp.id)
      .gte("checkin_at", start)
      .lte("checkin_at", end)
      .order("checkin_at", { ascending: false })
    setLogs((data ?? []) as AttendanceLog[])
    setLogsLoading(false)
  }

  async function loadPunches(emp: Employee) {
    const { data } = await supabase
      .from("missing_punch_requests")
      .select("*")
      .eq("employee_id", emp.id)
      .order("created_at", { ascending: false })
      .limit(30)
    setPunches((data ?? []) as MissingPunchRequest[])
  }

  async function loadOT(emp: Employee) {
    const { data } = await supabase
      .from("overtime_records")
      .select("*")
      .eq("employee_id", emp.id)
      .order("date", { ascending: false })
      .limit(30)
    setOtRecords((data ?? []) as OvertimeRecord[])
  }

  useEffect(() => {
    async function init() {
      setLoading(true)
      const emp = await getEmployee()
      if (emp) {
        setEmployee(emp)
        await Promise.all([loadLogs(emp, month), loadPunches(emp), loadOT(emp)])
      }
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (employee) loadLogs(employee, month)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  function prevMonth() {
    const [y, m] = month.split("-").map(Number)
    const d = new Date(y, m - 2, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }

  function nextMonth() {
    const [y, m] = month.split("-").map(Number)
    const d = new Date(y, m, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }

  async function submitPunch() {
    if (!employee) return
    setPunchErr(null)
    if (!punchForm.date || !punchForm.expected_time || !punchForm.reason.trim()) {
      setPunchErr("Please fill all fields")
      return
    }
    setPunchSaving(true)
    const { error } = await supabase.from("missing_punch_requests").insert({
      employee_id: employee.id,
      date: punchForm.date,
      punch_type: punchForm.punch_type,
      expected_time: punchForm.expected_time + ":00",
      reason: punchForm.reason.trim(),
    })
    setPunchSaving(false)
    if (error) {
      if (error.code === "23505") setPunchErr("You already submitted this request for that date and type")
      else setPunchErr(error.message)
    } else {
      setPunchOk(true)
      setShowPunchForm(false)
      setPunchForm({ date: "", punch_type: "check_in", expected_time: "", reason: "" })
      await loadPunches(employee)
      setTimeout(() => setPunchOk(false), 4000)
    }
  }

  async function submitOT() {
    if (!employee) return
    setOtErr(null)
    if (!otForm.date || !otForm.hours || !otForm.reason.trim()) {
      setOtErr("Please fill all fields")
      return
    }
    const hrs = parseFloat(otForm.hours)
    if (isNaN(hrs) || hrs <= 0 || hrs > 12) {
      setOtErr("Hours must be between 0.5 and 12")
      return
    }
    setOtSaving(true)
    const { error } = await supabase.from("overtime_records").insert({
      employee_id: employee.id,
      date: otForm.date,
      hours: hrs,
      reason: otForm.reason.trim(),
      source: "employee_request",
    })
    setOtSaving(false)
    if (error) {
      if (error.code === "23505") setOtErr("You already submitted OT for this date")
      else setOtErr(error.message)
    } else {
      setOtOk(true)
      setShowOtForm(false)
      setOtForm({ date: "", hours: "", reason: "" })
      await loadOT(employee)
      setTimeout(() => setOtOk(false), 4000)
    }
  }

  const presentDays = logs.filter(l => l.status === "present" || l.status === "late").length
  const lateDays    = logs.filter(l => l.status === "late").length
  const absentDays  = logs.filter(l => l.status === "absent").length

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" /> Loading...
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <header className="shrink-0 bg-card border-b border-border px-3 py-2.5 flex items-center gap-2">
        <button onClick={() => router.push("/m")} className="p-1.5 text-muted-foreground">
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-sm font-semibold text-foreground">Attendance</h1>
      </header>

      {/* Internal Tab Pills */}
      <div className="shrink-0 px-4 pt-3 pb-1 flex gap-1.5">
        {([
          { id: "timesheet"     as const, label: "Time Sheet",    icon: ClipboardList },
          { id: "missing_punch" as const, label: "Missing Punch", icon: FileSearch },
          { id: "overtime"      as const, label: "Overtime",      icon: Timer },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-colors flex-1 justify-center ${
              tab === id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            <Icon className="size-3 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 py-3 space-y-3">

          {/* ═══════════════ TIME SHEET ═══════════════ */}
          {tab === "timesheet" && (
            <>
              {/* Month navigator */}
              <div className="flex items-center justify-between bg-card border border-border rounded-2xl px-4 py-2.5">
                <button onClick={prevMonth} className="p-1 text-muted-foreground active:text-foreground">
                  <ChevronLeft className="size-4" />
                </button>
                <span className="text-sm font-medium text-foreground">{monthLabel(month)}</span>
                <button
                  onClick={nextMonth}
                  disabled={month >= today.slice(0, 7)}
                  className="p-1 text-muted-foreground active:text-foreground disabled:opacity-30"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              {/* Summary row */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Present", value: presentDays, color: "text-chart-3" },
                  { label: "Late",    value: lateDays,    color: "text-primary" },
                  { label: "Absent",  value: absentDays,  color: "text-destructive" },
                ].map(s => (
                  <div key={s.label} className="bg-card border border-border rounded-2xl p-3 text-center">
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Logs list */}
              {logsLoading ? (
                <div className="flex justify-center py-8 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-xs">
                  No records for this month
                </div>
              ) : (
                <div className="bg-card border border-border rounded-2xl divide-y divide-border/50">
                  {logs.map(log => {
                    const cfg = attendanceStatusConfig[log.status] ?? {
                      label: log.status,
                      color: "bg-secondary text-secondary-foreground",
                    }
                    const date = new Date(log.checkin_at)
                    return (
                      <div key={log.id} className="px-4 py-2.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium text-foreground">
                              {date.toLocaleDateString("en-GB", {
                                weekday: "short", day: "numeric", month: "short",
                              })}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                              {fmtTime(log.checkin_at)} → {fmtTime(log.checkout_at)}
                              {log.total_worked_minutes > 0 && ` · ${fmtMins(log.total_worked_minutes)}`}
                            </p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </div>
                        {log.late_minutes > 0 && (
                          <p className="text-[10px] text-primary mt-1">
                            Late by {fmtMins(log.late_minutes)}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ═══════════════ MISSING PUNCH ═══════════════ */}
          {tab === "missing_punch" && (
            <>
              {punchOk && (
                <div className="bg-chart-3/10 border border-chart-3/30 rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-chart-3">
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  Request submitted — pending HR approval
                </div>
              )}

              {!showPunchForm ? (
                <button
                  onClick={() => setShowPunchForm(true)}
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <Plus className="size-4" /> New Missing Punch Request
                </button>
              ) : (
                <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">Missing Punch Request</p>
                    <button
                      onClick={() => { setShowPunchForm(false); setPunchErr(null) }}
                      className="text-muted-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Date *</label>
                    <input
                      type="date"
                      max={today}
                      value={punchForm.date}
                      onChange={e => setPunchForm(f => ({ ...f, date: e.target.value }))}
                      className="w-full bg-secondary/60 text-foreground text-sm rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-primary"
                    />
                  </div>

                  {/* Punch Type */}
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Missing Punch *</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["check_in", "check_out"] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setPunchForm(f => ({ ...f, punch_type: t }))}
                          className={`py-2 rounded-xl text-xs font-medium transition-colors ${
                            punchForm.punch_type === t
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {t === "check_in" ? "Check-In" : "Check-Out"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Expected Time */}
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Expected Time *</label>
                    <input
                      type="time"
                      value={punchForm.expected_time}
                      onChange={e => setPunchForm(f => ({ ...f, expected_time: e.target.value }))}
                      className="w-full bg-secondary/60 text-foreground text-sm rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-primary"
                    />
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Reason *</label>
                    <textarea
                      value={punchForm.reason}
                      onChange={e => setPunchForm(f => ({ ...f, reason: e.target.value }))}
                      placeholder="Explain why the punch is missing..."
                      rows={3}
                      className="w-full bg-secondary/60 text-foreground text-sm rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-primary resize-none"
                    />
                  </div>

                  {punchErr && (
                    <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                      <AlertCircle className="size-3.5 shrink-0" /> {punchErr}
                    </div>
                  )}

                  <button
                    onClick={submitPunch}
                    disabled={punchSaving}
                    className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {punchSaving
                      ? <Loader2 className="size-3.5 animate-spin" />
                      : <Plus className="size-3.5" />}
                    Submit Request
                  </button>
                </div>
              )}

              {/* List */}
              {punches.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-xs">
                  No requests yet
                </div>
              ) : (
                <div className="bg-card border border-border rounded-2xl divide-y divide-border/50">
                  {punches.map(p => {
                    const cfg = reqStatusConfig[p.status]
                    return (
                      <div key={p.id} className="px-4 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground">
                              {new Date(p.date + "T00:00:00").toLocaleDateString("en-GB", {
                                day: "numeric", month: "short", year: "numeric",
                              })}
                              {" · "}
                              <span className="text-muted-foreground capitalize">
                                {p.punch_type.replace("_", " ")}
                              </span>
                            </p>
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              Expected: {p.expected_time.slice(0, 5)}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{p.reason}</p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ═══════════════ OVERTIME ═══════════════ */}
          {tab === "overtime" && (
            <>
              {otOk && (
                <div className="bg-chart-3/10 border border-chart-3/30 rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-chart-3">
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  OT request submitted — pending HR approval
                </div>
              )}

              {!showOtForm ? (
                <button
                  onClick={() => setShowOtForm(true)}
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <Plus className="size-4" /> Request Overtime
                </button>
              ) : (
                <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">Overtime Request</p>
                    <button
                      onClick={() => { setShowOtForm(false); setOtErr(null) }}
                      className="text-muted-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Date *</label>
                    <input
                      type="date"
                      max={today}
                      value={otForm.date}
                      onChange={e => setOtForm(f => ({ ...f, date: e.target.value }))}
                      className="w-full bg-secondary/60 text-foreground text-sm rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">
                      Hours *{" "}
                      <span className="text-muted-foreground font-normal">(max 12, steps of 0.5)</span>
                    </label>
                    <input
                      type="number"
                      min="0.5"
                      max="12"
                      step="0.5"
                      value={otForm.hours}
                      onChange={e => setOtForm(f => ({ ...f, hours: e.target.value }))}
                      placeholder="e.g. 2.5"
                      className="w-full bg-secondary/60 text-foreground text-sm rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Reason *</label>
                    <textarea
                      value={otForm.reason}
                      onChange={e => setOtForm(f => ({ ...f, reason: e.target.value }))}
                      placeholder="Why did you work overtime?"
                      rows={3}
                      className="w-full bg-secondary/60 text-foreground text-sm rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-primary resize-none"
                    />
                  </div>

                  {otErr && (
                    <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                      <AlertCircle className="size-3.5 shrink-0" /> {otErr}
                    </div>
                  )}

                  <button
                    onClick={submitOT}
                    disabled={otSaving}
                    className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {otSaving
                      ? <Loader2 className="size-3.5 animate-spin" />
                      : <Plus className="size-3.5" />}
                    Submit Request
                  </button>
                </div>
              )}

              {/* OT list */}
              {otRecords.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-xs">
                  No overtime records yet
                </div>
              ) : (
                <div className="bg-card border border-border rounded-2xl divide-y divide-border/50">
                  {otRecords.map(ot => {
                    const cfg = reqStatusConfig[ot.status]
                    return (
                      <div key={ot.id} className="px-4 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground">
                              {new Date(ot.date + "T00:00:00").toLocaleDateString("en-GB", {
                                day: "numeric", month: "short", year: "numeric",
                              })}
                              {" · "}
                              <span className="font-semibold text-primary">{ot.hours}h OT</span>
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{ot.reason}</p>
                            {ot.source === "hr_manual" && (
                              <p className="text-[10px] text-chart-2 mt-0.5">Added by HR</p>
                            )}
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          <div className="h-2" />
        </div>
      </main>

      <MobileBottomNav />
    </>
  )
}
