"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Calendar, Plus, Loader2, Pencil, Trash2, X,
  PartyPopper, CalendarDays, RefreshCw
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Holiday, Profile } from "@/lib/types"

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

type FormState = {
  name: string
  holiday_date: string
  is_paid: boolean
  is_recurring: boolean
  notes: string
}

const emptyForm: FormState = {
  name: "",
  holiday_date: "",
  is_paid: true,
  is_recurring: false,
  notes: "",
}

export function HolidaysTab() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear())

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const [holRes, profRes] = await Promise.all([
      supabase.from("holidays").select("*").order("holiday_date", { ascending: true }),
      user ? supabase.from("profiles").select("*").eq("id", user.id).single() : Promise.resolve({ data: null }),
    ])

    setHolidays((holRes.data ?? []) as Holiday[])
    setCurrentProfile(profRes.data as Profile | null)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const filteredHolidays = useMemo(() =>
    holidays.filter(h => new Date(h.holiday_date).getFullYear() === yearFilter),
    [holidays, yearFilter]
  )

  // Group by month
  const byMonth = useMemo(() => {
    const map = new Map<number, Holiday[]>()
    filteredHolidays.forEach(h => {
      const m = new Date(h.holiday_date).getMonth()
      if (!map.has(m)) map.set(m, [])
      map.get(m)!.push(h)
    })
    return map
  }, [filteredHolidays])

  function openCreate() {
    setEditingId(null)
    setForm({ ...emptyForm, holiday_date: `${yearFilter}-01-01` })
    setErr(null)
    setShowModal(true)
  }

  function openEdit(h: Holiday) {
    setEditingId(h.id)
    setForm({
      name: h.name ?? "",
      holiday_date: h.holiday_date,
      is_paid: h.is_paid,
      is_recurring: h.is_recurring,
      notes: h.notes ?? "",
    })
    setErr(null)
    setShowModal(true)
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function save() {
    setErr(null)
    if (!form.name.trim()) return setErr("Holiday name is required")
    if (!form.holiday_date) return setErr("Date is required")

    setSaving(true)

    const payload = {
      name: form.name.trim(),
      holiday_date: form.holiday_date,
      is_paid: form.is_paid,
      is_recurring: form.is_recurring,
      notes: form.notes.trim() || null,
    }

    const res = editingId
      ? await supabase.from("holidays").update(payload).eq("id", editingId)
      : await supabase.from("holidays").insert(payload)

    setSaving(false)

    if (res.error) { setErr(res.error.message); return }

    setShowModal(false)
    await loadData()
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete holiday "${name}"?`)) return
    const { error } = await supabase.from("holidays").delete().eq("id", id)
    if (error) return alert(error.message)
    await loadData()
  }

  async function copyRecurringToNextYear() {
    const recurring = filteredHolidays.filter(h => h.is_recurring)
    if (recurring.length === 0) {
      alert("No recurring holidays to copy in the current year.")
      return
    }
    if (!confirm(`Copy ${recurring.length} recurring holidays to ${yearFilter + 1}?`)) return

    const newRecords = recurring.map(h => {
      const newDate = new Date(h.holiday_date)
      newDate.setFullYear(yearFilter + 1)
      return {
        name: h.name,
        holiday_date: newDate.toISOString().split("T")[0],
        is_paid: h.is_paid,
        is_recurring: h.is_recurring,
        notes: h.notes,
      }
    })

    const { error } = await supabase.from("holidays").insert(newRecords)
    if (error) {
      alert(`Some holidays may already exist: ${error.message}`)
    } else {
      alert(`Successfully copied ${newRecords.length} holidays to ${yearFilter + 1}`)
    }
    setYearFilter(yearFilter + 1)
    await loadData()
  }

  const canManage = currentProfile && ["admin", "hr"].includes(currentProfile.role)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading holidays...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Holidays</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filteredHolidays.length} holidays in {yearFilter} · {filteredHolidays.filter(h => h.is_recurring).length} recurring
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <>
              <button onClick={copyRecurringToNextYear}
                className="flex items-center gap-2 px-3 py-2 bg-secondary text-foreground rounded-lg text-xs font-medium hover:bg-secondary/80 transition-colors">
                <RefreshCw className="size-3.5" />
                Copy to {yearFilter + 1}
              </button>
              <button onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                <Plus className="size-4" />
                Add Holiday
              </button>
            </>
          )}
        </div>
      </div>

      {/* Year selector */}
      <div className="flex items-center gap-2">
        <CalendarDays className="size-3.5 text-muted-foreground" />
        <div className="flex items-center gap-1 bg-secondary/40 rounded-lg p-1">
          {[yearFilter - 1, yearFilter, yearFilter + 1].map(y => (
            <button
              key={y}
              onClick={() => setYearFilter(y)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                y === yearFilter
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {filteredHolidays.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="py-20 text-center text-sm text-muted-foreground">
            <PartyPopper className="size-8 mx-auto mb-3 opacity-50" />
            No holidays added for {yearFilter}.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from(byMonth.entries()).sort(([a], [b]) => a - b).map(([month, monthHolidays]) => (
            <Card key={month} className="border-border bg-card">
              <CardContent className="p-0">
                <div className="px-4 py-2.5 border-b border-border bg-secondary/30 flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">{monthNames[month]}</p>
                  <Badge variant="secondary" className="text-[10px]">{monthHolidays.length}</Badge>
                </div>
                <div className="divide-y divide-border/50">
                  {monthHolidays.map(h => {
                    const date = new Date(h.holiday_date)
                    const isPast = date < today
                    return (
                      <div key={h.id} className={`px-4 py-2.5 hover:bg-secondary/20 transition-colors ${isPast ? "opacity-60" : ""}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <div className="flex flex-col items-center justify-center size-9 rounded-lg bg-primary/15 text-primary shrink-0">
                              <span className="text-[9px] uppercase font-medium leading-none">{date.toLocaleDateString("en-GB", { weekday: "short" })}</span>
                              <span className="text-sm font-bold leading-none mt-0.5">{date.getDate()}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-foreground truncate">{h.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {h.is_paid ? (
                                  <Badge variant="secondary" className="text-[9px] bg-chart-3/15 text-chart-3">Paid</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[9px]">Unpaid</Badge>
                                )}
                                {h.is_recurring && (
                                  <Badge variant="secondary" className="text-[9px] bg-chart-2/15 text-chart-2">
                                    <RefreshCw className="size-2 mr-0.5" />
                                    Yearly
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          {canManage && (
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button onClick={() => openEdit(h)}
                                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                                <Pencil className="size-3" />
                              </button>
                              <button onClick={() => remove(h.id, h.name)}
                                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">
                {editingId ? "Edit Holiday" : "Add Holiday"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3">
              {err && (
                <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                  {err}
                </div>
              )}

              <Field label="Holiday Name *">
                <input type="text" value={form.name} onChange={e => update("name", e.target.value)}
                  placeholder="e.g. Eid al-Fitr Day 1" className="form-field" />
              </Field>

              <Field label="Date *">
                <input type="date" value={form.holiday_date} onChange={e => update("holiday_date", e.target.value)}
                  className="form-field" />
              </Field>

              <Field label="Notes">
                <textarea value={form.notes} onChange={e => update("notes", e.target.value)}
                  rows={2} className="form-field resize-none" />
              </Field>

              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={form.is_paid} onChange={e => update("is_paid", e.target.checked)} className="size-3.5" />
                  <span className="text-foreground">Paid holiday</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={form.is_recurring} onChange={e => update("is_recurring", e.target.checked)} className="size-3.5" />
                  <span className="text-foreground">Recurring yearly (e.g. Labour Day, New Year)</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/20">
              <button onClick={() => setShowModal(false)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button onClick={save} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                {saving && <Loader2 className="size-3 animate-spin" />}
                {editingId ? "Save" : "Add"}
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
