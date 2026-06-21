"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Loader2, CalendarCheck, Plus, X,
  CheckCircle2, XCircle, Clock, AlertTriangle
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Employee, LeaveType, LeaveBalance, LeaveRequest, LeaveRequestStatus } from "@/lib/types"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"

const statusColors: Record<LeaveRequestStatus, string> = {
  pending:   "bg-primary/15 text-primary",
  approved:  "bg-chart-3/15 text-chart-3",
  rejected:  "bg-destructive/15 text-destructive",
  cancelled: "bg-secondary text-secondary-foreground",
}

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0
  const s = new Date(start), e = new Date(end)
  if (e < s) return 0
  let count = 0
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const day = d.getDay()
    if (day !== 5 && day !== 6) count++
  }
  return count
}

export default function MobileLeavePage() {
  const router = useRouter()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    leave_type_id: "",
    start_date: "",
    end_date: "",
    reason: "",
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    const { data: profileData } = await supabase
      .from("profiles").select("*").eq("id", user.id).single()

    if (!profileData?.employee_id) { setLoading(false); return }

    const [empRes, typesRes, balRes, reqRes] = await Promise.all([
      supabase.from("employees").select("*").eq("id", profileData.employee_id).single(),
      supabase.from("leave_types").select("*").eq("is_active", true).order("name"),
      supabase.from("leave_balances").select("*")
        .eq("employee_id", profileData.employee_id)
        .eq("year", new Date().getFullYear()),
      supabase.from("leave_requests").select("*, leave_types(name, color)")
        .eq("employee_id", profileData.employee_id)
        .order("created_at", { ascending: false }).limit(10),
    ])

    setEmployee(empRes.data as Employee | null)
    setLeaveTypes((typesRes.data ?? []) as LeaveType[])
    setBalances((balRes.data ?? []) as LeaveBalance[])
    setRequests((reqRes.data ?? []) as LeaveRequest[])
    if (typesRes.data?.[0]) setForm(f => ({ ...f, leave_type_id: typesRes.data![0].id }))
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  async function submitRequest() {
    setErr(null)
    if (!form.start_date || !form.end_date) return setErr("Please select dates")
    const days = calcDays(form.start_date, form.end_date)
    if (days === 0) return setErr("Invalid date range")

    const balance = balances.find(b =>
      b.employee_id === employee?.id && b.leave_type_id === form.leave_type_id
    )
    if (balance && days > balance.remaining_days) {
      return setErr(`Only ${balance.remaining_days.toFixed(1)} days available`)
    }

    setSaving(true)
    const { error } = await supabase.from("leave_requests").insert({
      employee_id: employee!.id,
      leave_type_id: form.leave_type_id,
      start_date: form.start_date,
      end_date: form.end_date,
      total_days: days,
      reason: form.reason.trim() || null,
      status: "pending",
    })
    setSaving(false)

    if (error) { setErr(error.message); return }
    setSuccess(true)
    setShowForm(false)
    setForm(f => ({ ...f, start_date: "", end_date: "", reason: "" }))
    await loadData()
  }

  const days = calcDays(form.start_date, form.end_date)
  const selectedBalance = balances.find(b =>
    b.employee_id === employee?.id && b.leave_type_id === form.leave_type_id
  )

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <AlertTriangle className="size-10 text-muted-foreground mb-3" />
        <p className="text-sm text-foreground font-medium mb-1">No employee profile linked</p>
        <p className="text-xs text-muted-foreground mb-4">Ask HR to link your account to an employee record</p>
        <button onClick={() => router.push("/m")} className="text-xs text-primary">← Back</button>
      </div>
    )
  }

  return (
    <>
      <header className="shrink-0 bg-card border-b border-border px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => router.push("/m")} className="p-1.5 text-muted-foreground">
            <ArrowLeft className="size-4" />
          </button>
          <h1 className="text-sm font-semibold text-foreground">Leave Requests</h1>
        </div>
        <button onClick={() => { setShowForm(true); setSuccess(false); setErr(null) }}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg">
          <Plus className="size-3.5" /> New
        </button>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 py-3 space-y-3">

          {success && (
            <div className="bg-chart-3/10 border border-chart-3/30 rounded-xl px-3 py-2.5 text-xs text-chart-3 flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0" />
              Leave request submitted successfully!
            </div>
          )}

          {/* Balances */}
          {balances.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                My Balance — {new Date().getFullYear()}
              </p>
              <div className="space-y-2.5">
                {balances.map(b => {
                  const lt = leaveTypes.find(t => t.id === b.leave_type_id)
                  if (!lt) return null
                  const pct = b.entitled_days > 0 ? Math.min(100, ((b.entitled_days - b.remaining_days) / b.entitled_days) * 100) : 0
                  return (
                    <div key={b.id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-1.5">
                          <div className="size-2 rounded-full" style={{ background: lt.color }} />
                          <span className="text-foreground">{lt.name}</span>
                        </div>
                        <span className="text-muted-foreground font-mono">
                          {b.remaining_days.toFixed(1)} / {b.entitled_days.toFixed(0)} days
                        </span>
                      </div>
                      <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: lt.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Requests */}
          <div className="bg-card border border-border rounded-2xl">
            <div className="px-4 py-3 border-b border-border/50">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Recent Requests</p>
            </div>
            {requests.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No requests yet</p>
            ) : (
              <div className="divide-y divide-border/50">
                {requests.map((r: any) => (
                  <div key={r.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground">{r.leave_types?.name ?? "—"}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(r.start_date).toLocaleDateString("en-GB")} → {new Date(r.end_date).toLocaleDateString("en-GB")}
                          {" · "}<strong>{r.total_days}d</strong>
                        </p>
                        {r.reason && <p className="text-[10px] text-muted-foreground italic mt-0.5 truncate">"{r.reason}"</p>}
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${statusColors[r.status as LeaveRequestStatus]}`}>
                        {r.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="h-2" />
        </div>
      </main>

      {/* New Request Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="bg-card w-full max-h-[85vh] rounded-t-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">New Leave Request</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {err && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2 text-xs text-destructive flex items-center gap-2">
                  <XCircle className="size-3.5 shrink-0" /> {err}
                </div>
              )}

              <div>
                <label className="text-[10px] text-muted-foreground uppercase mb-1.5 block">Leave Type</label>
                <select value={form.leave_type_id} onChange={e => setForm(f => ({ ...f, leave_type_id: e.target.value }))}
                  className="w-full bg-secondary/60 text-foreground text-sm rounded-xl px-3 py-2.5 outline-none">
                  {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {selectedBalance && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Available: <strong>{selectedBalance.remaining_days.toFixed(1)} days</strong>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase mb-1.5 block">From</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full bg-secondary/60 text-foreground text-sm rounded-xl px-3 py-2.5 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase mb-1.5 block">To</label>
                  <input type="date" value={form.end_date} min={form.start_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full bg-secondary/60 text-foreground text-sm rounded-xl px-3 py-2.5 outline-none" />
                </div>
              </div>

              {days > 0 && (
                <div className="bg-secondary/30 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Total working days</span>
                  <span className={`font-semibold ${selectedBalance && days > selectedBalance.remaining_days ? "text-destructive" : "text-foreground"}`}>
                    {days} day{days !== 1 ? "s" : ""}
                  </span>
                </div>
              )}

              <div>
                <label className="text-[10px] text-muted-foreground uppercase mb-1.5 block">Reason (optional)</label>
                <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  rows={3} placeholder="Why are you requesting leave?"
                  className="w-full bg-secondary/60 text-foreground text-sm rounded-xl px-3 py-2.5 outline-none resize-none" />
              </div>
            </div>

            <div className="px-4 py-3 border-t border-border">
              <button onClick={submitRequest} disabled={saving}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 className="size-4 animate-spin" />}
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      <MobileBottomNav />
    </>
  )
}
