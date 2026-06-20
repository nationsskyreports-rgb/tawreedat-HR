"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Calendar, ChevronLeft, ChevronRight, Loader2, Plus, X,
  Clock, Users, Trash2, Sun, Moon, Sunrise
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type {
  Employee, Shift, ShiftAssignment, Site, ShiftType
} from "@/lib/types"

const shiftIcons: Record<ShiftType, typeof Sun> = {
  morning:   Sunrise,
  afternoon: Sun,
  night:     Moon,
  split:     Clock,
  flexible:  Clock,
}

const shiftColors: Record<ShiftType, string> = {
  morning:   "bg-chart-4/15 text-chart-4 border-chart-4/30",
  afternoon: "bg-primary/15 text-primary border-primary/30",
  night:     "bg-chart-2/15 text-chart-2 border-chart-2/30",
  split:     "bg-chart-3/15 text-chart-3 border-chart-3/30",
  flexible:  "bg-secondary text-secondary-foreground border-border",
}

function getWeekDates(weekOffset = 0): Date[] {
  const today = new Date()
  const day = today.getDay() // Sunday = 0
  const start = new Date(today)
  start.setDate(today.getDate() - day + weekOffset * 7)
  start.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]
}

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function SchedulingTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)

  // Assign modal
  const [showAssign, setShowAssign] = useState(false)
  const [assignTarget, setAssignTarget] = useState<{ employeeId: string; date: string } | null>(null)
  const [pickedShiftId, setPickedShiftId] = useState<string>("")
  const [pickedSiteId, setPickedSiteId] = useState<string>("")
  const [savingAssign, setSavingAssign] = useState(false)

  const weekDates = getWeekDates(weekOffset)
  const weekStart = weekDates[0]
  const weekEnd = weekDates[6]

  async function loadData() {
    setLoading(true)
    const [empRes, shiftsRes, sitesRes, assignRes] = await Promise.all([
      supabase.from("employees").select("*").eq("status", "active").order("full_name"),
      supabase.from("shifts").select("*").eq("is_active", true).order("start_time"),
      supabase.from("sites").select("*").eq("is_active", true).order("name"),
      supabase.from("shift_assignments")
        .select("*")
        .gte("assignment_date", formatDate(weekStart))
        .lte("assignment_date", formatDate(weekEnd)),
    ])
    setEmployees((empRes.data ?? []) as Employee[])
    setShifts((shiftsRes.data ?? []) as Shift[])
    setSites((sitesRes.data ?? []) as Site[])
    setAssignments((assignRes.data ?? []) as ShiftAssignment[])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [weekOffset])

  function findAssignment(employeeId: string, date: string): ShiftAssignment | undefined {
    return assignments.find(a => a.employee_id === employeeId && a.assignment_date === date)
  }

  function openAssign(employeeId: string, date: string) {
    const existing = findAssignment(employeeId, date)
    setAssignTarget({ employeeId, date })
    setPickedShiftId(existing?.shift_id ?? shifts[0]?.id ?? "")
    setPickedSiteId(existing?.site_id ?? "")
    setShowAssign(true)
  }

  async function saveAssignment() {
    if (!assignTarget || !pickedShiftId) return
    setSavingAssign(true)

    const existing = findAssignment(assignTarget.employeeId, assignTarget.date)

    if (existing) {
      // Update
      await supabase.from("shift_assignments").update({
        shift_id: pickedShiftId,
        site_id: pickedSiteId || null,
      }).eq("id", existing.id)
    } else {
      // Insert
      await supabase.from("shift_assignments").insert({
        employee_id: assignTarget.employeeId,
        shift_id: pickedShiftId,
        site_id: pickedSiteId || null,
        assignment_date: assignTarget.date,
        status: "scheduled",
      })
    }

    setSavingAssign(false)
    setShowAssign(false)
    setAssignTarget(null)
    await loadData()
  }

  async function clearAssignment() {
    if (!assignTarget) return
    const existing = findAssignment(assignTarget.employeeId, assignTarget.date)
    if (!existing) {
      setShowAssign(false)
      return
    }
    setSavingAssign(true)
    await supabase.from("shift_assignments").delete().eq("id", existing.id)
    setSavingAssign(false)
    setShowAssign(false)
    setAssignTarget(null)
    await loadData()
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading roster...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Shift Roster</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {employees.length} employees · {shifts.length} shift types · {assignments.length} assignments this week
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(weekOffset - 1)}
            className="p-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="px-3 py-1.5 text-xs bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors"
          >
            Today
          </button>
          <span className="text-sm text-muted-foreground px-2 min-w-[180px] text-center">
            {weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – {weekEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          <button
            onClick={() => setWeekOffset(weekOffset + 1)}
            className="p-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
        <span className="font-medium">Shifts:</span>
        {shifts.map(s => {
          const Icon = shiftIcons[s.shift_type]
          return (
            <div key={s.id} className={`flex items-center gap-1 px-2 py-1 rounded border ${shiftColors[s.shift_type]}`}>
              <Icon className="size-3" />
              <span>{s.code}</span>
              <span className="opacity-70">· {s.start_time.slice(0, 5)}-{s.end_time.slice(0, 5)}</span>
            </div>
          )
        })}
      </div>

      {/* Grid */}
      {employees.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="py-20 text-center text-sm text-muted-foreground">
            <Users className="size-8 mx-auto mb-3 opacity-50" />
            No active employees to schedule.
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-card">
          <CardContent className="p-0 overflow-auto">
            <div className="min-w-[900px]">
              {/* Header row */}
              <div className="grid grid-cols-[200px_repeat(7,1fr)] border-b border-border bg-secondary/30 sticky top-0">
                <div className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">
                  Employee
                </div>
                {weekDates.map((d, i) => {
                  const isToday = d.getTime() === today.getTime()
                  return (
                    <div key={i} className={`px-2 py-2.5 text-center border-l border-border ${isToday ? "bg-primary/10" : ""}`}>
                      <p className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                        {dayLabels[i]}
                      </p>
                      <p className={`text-xs ${isToday ? "text-primary font-semibold" : "text-foreground"}`}>
                        {d.getDate()}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Employee rows */}
              {employees.map(emp => (
                <div key={emp.id} className="grid grid-cols-[200px_repeat(7,1fr)] border-b border-border/50 hover:bg-secondary/10 transition-colors">
                  <div className="px-4 py-3 flex flex-col justify-center">
                    <p className="text-xs font-medium text-foreground truncate">{emp.full_name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{emp.employee_no}</p>
                  </div>
                  {weekDates.map((d, i) => {
                    const dateStr = formatDate(d)
                    const assignment = findAssignment(emp.id, dateStr)
                    const shift = assignment ? shifts.find(s => s.id === assignment.shift_id) : null
                    const isToday = d.getTime() === today.getTime()

                    return (
                      <button
                        key={i}
                        onClick={() => openAssign(emp.id, dateStr)}
                        className={`px-1.5 py-2 border-l border-border/50 text-left hover:bg-primary/5 transition-colors ${isToday ? "bg-primary/[0.03]" : ""}`}
                      >
                        {shift ? (
                          <div className={`text-[10px] rounded px-1.5 py-1 border ${shiftColors[shift.shift_type]}`}>
                            <p className="font-medium truncate">{shift.code}</p>
                            <p className="opacity-70 text-[9px]">{shift.start_time.slice(0, 5)}</p>
                          </div>
                        ) : (
                          <div className="text-[10px] text-muted-foreground/40 text-center py-1.5 border border-dashed border-border/40 rounded hover:border-primary/40 hover:text-primary/60 transition-colors">
                            <Plus className="size-3 mx-auto" />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assignment Modal */}
      {showAssign && assignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {findAssignment(assignTarget.employeeId, assignTarget.date) ? "Edit" : "Assign"} Shift
                </h2>
                <p className="text-xs text-muted-foreground">
                  {employees.find(e => e.id === assignTarget.employeeId)?.full_name} ·{" "}
                  {new Date(assignTarget.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                </p>
              </div>
              <button onClick={() => setShowAssign(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Shift</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {shifts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No shifts defined. Seed data should have created defaults.</p>
                  ) : (
                    shifts.map(s => {
                      const Icon = shiftIcons[s.shift_type]
                      const isPicked = pickedShiftId === s.id
                      return (
                        <button
                          key={s.id}
                          onClick={() => setPickedShiftId(s.id)}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors ${
                            isPicked
                              ? `${shiftColors[s.shift_type]} border-current`
                              : "bg-secondary/30 border-border hover:bg-secondary/50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="size-3.5" />
                            <div>
                              <p className="text-xs font-medium">{s.name}</p>
                              <p className="text-[10px] opacity-70">{s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)} · {s.total_hours}h</p>
                            </div>
                          </div>
                          {isPicked && <div className="size-2 rounded-full bg-current" />}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Site (optional)</label>
                <select
                  value={pickedSiteId}
                  onChange={(e) => setPickedSiteId(e.target.value)}
                  className="w-full bg-secondary/60 text-foreground text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-primary"
                >
                  <option value="">— No specific site —</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border bg-secondary/20">
              {findAssignment(assignTarget.employeeId, assignTarget.date) ? (
                <button
                  onClick={clearAssignment}
                  disabled={savingAssign}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                >
                  <Trash2 className="size-3" /> Clear
                </button>
              ) : <span />}
              <div className="flex items-center gap-2">
                <button onClick={() => setShowAssign(false)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                  Cancel
                </button>
                <button onClick={saveAssignment} disabled={savingAssign || !pickedShiftId}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                  {savingAssign && <Loader2 className="size-3 animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
