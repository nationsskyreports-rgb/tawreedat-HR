"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Megaphone, Plus, X, Loader2, Pencil, Trash2, Pin,
  AlertTriangle, Info, Bell, BellRing, Calendar, Filter
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type {
  Announcement, Department, Site, UserRole, Profile
} from "@/lib/types"

type Priority = "low" | "normal" | "high" | "urgent"

const priorityConfig: Record<Priority, { label: string; color: string; icon: typeof Info }> = {
  low:    { label: "Low",    color: "bg-secondary text-secondary-foreground",   icon: Info },
  normal: { label: "Normal", color: "bg-primary/15 text-primary",               icon: Bell },
  high:   { label: "High",   color: "bg-chart-4/15 text-chart-4",               icon: BellRing },
  urgent: { label: "Urgent", color: "bg-destructive/15 text-destructive",       icon: AlertTriangle },
}

const roleOptions: { value: UserRole | ""; label: string }[] = [
  { value: "",         label: "All Roles" },
  { value: "admin",    label: "Admins only" },
  { value: "hr",       label: "HR only" },
  { value: "manager",  label: "Managers only" },
  { value: "employee", label: "Employees only" },
]

type FormState = {
  title: string
  body: string
  priority: Priority
  target_role: UserRole | ""
  target_department_id: string
  target_site_id: string
  is_pinned: boolean
  publish_at: string
  expires_at: string
}

const emptyForm: FormState = {
  title: "",
  body: "",
  priority: "normal",
  target_role: "",
  target_department_id: "",
  target_site_id: "",
  is_pinned: false,
  publish_at: new Date().toISOString().slice(0, 16),
  expires_at: "",
}

export function AnnouncementsTab() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all")

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const [annRes, deptRes, siteRes, profRes] = await Promise.all([
      supabase.from("announcements").select("*").order("is_pinned", { ascending: false }).order("publish_at", { ascending: false }),
      supabase.from("departments").select("*").eq("is_active", true).order("name"),
      supabase.from("sites").select("*").eq("is_active", true).order("name"),
      user ? supabase.from("profiles").select("*").eq("id", user.id).single() : Promise.resolve({ data: null }),
    ])

    setAnnouncements((annRes.data ?? []) as Announcement[])
    setDepartments((deptRes.data ?? []) as Department[])
    setSites((siteRes.data ?? []) as Site[])
    setCurrentProfile(profRes.data as Profile | null)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setErr(null)
    setShowModal(true)
  }

  function openEdit(a: Announcement) {
    setEditingId(a.id)
    setForm({
      title: a.title ?? "",
      body: a.body ?? "",
      priority: a.priority as Priority,
      target_role: a.target_role ?? "",
      target_department_id: a.target_department_id ?? "",
      target_site_id: a.target_site_id ?? "",
      is_pinned: a.is_pinned,
      publish_at: a.publish_at ? a.publish_at.slice(0, 16) : new Date().toISOString().slice(0, 16),
      expires_at: a.expires_at ? a.expires_at.slice(0, 16) : "",
    })
    setErr(null)
    setShowModal(true)
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function save() {
    setErr(null)
    if (!form.title.trim()) return setErr("Title is required")
    if (!form.body.trim()) return setErr("Body is required")

    setSaving(true)

    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      priority: form.priority,
      target_role: form.target_role || null,
      target_department_id: form.target_department_id || null,
      target_site_id: form.target_site_id || null,
      is_pinned: form.is_pinned,
      publish_at: new Date(form.publish_at).toISOString(),
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    }

    const res = editingId
      ? await supabase.from("announcements").update(payload).eq("id", editingId)
      : await supabase.from("announcements").insert(payload)

    setSaving(false)

    if (res.error) {
      setErr(res.error.message)
      return
    }

    // On CREATE with immediate publish → in-app notification + push to targets
    // (scheduled future announcements are skipped — no cron yet)
    if (!editingId && new Date(payload.publish_at) <= new Date()) {
      await notifyAnnouncementTargets(payload)
    }

    setShowModal(false)
    await loadData()
  }

  // ── Notify: insert bell notifications + send push to targeted users ────────
  async function notifyAnnouncementTargets(payload: {
    title: string
    body: string
    target_role: UserRole | null
    target_department_id: string | null
    target_site_id: string | null
  }) {
    try {
      // 1) Resolve target profiles
      let profQuery = supabase.from("profiles").select("id, employee_id, role")
      if (payload.target_role) profQuery = profQuery.eq("role", payload.target_role)
      const { data: profiles } = await profQuery
      if (!profiles?.length) return

      let targetIds = profiles.map(p => p.id)

      // Narrow by department / site via the employees table
      if (payload.target_department_id || payload.target_site_id) {
        let empQuery = supabase.from("employees").select("id")
        if (payload.target_department_id) empQuery = empQuery.eq("department_id", payload.target_department_id)
        if (payload.target_site_id)       empQuery = empQuery.eq("site_id", payload.target_site_id)
        const { data: emps } = await empQuery
        const empIds = new Set((emps ?? []).map(e => e.id))
        targetIds = profiles
          .filter(p => p.employee_id && empIds.has(p.employee_id))
          .map(p => p.id)
      }

      if (targetIds.length === 0) return

      // 2) In-app bell notifications
      await supabase.from("notifications").insert(
        targetIds.map(user_id => ({
          user_id,
          notification_type: "announcement" as const,
          title:   payload.title,
          message: payload.body.slice(0, 200),
          is_read: false,
        }))
      )

      // 3) Push to devices (best-effort)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      await fetch("/api/send-push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          user_ids: targetIds,
          title:    `📢 ${payload.title}`,
          body:     payload.body.slice(0, 120),
          url:      "/m/notifications",
        }),
      })
    } catch {
      // Notifications are best-effort — never block publishing
    }
  }

  async function remove(id: string, title: string) {
    if (!confirm(`Delete announcement "${title}"?`)) return
    const { error } = await supabase.from("announcements").delete().eq("id", id)
    if (error) return alert(error.message)
    await loadData()
  }

  async function togglePin(a: Announcement) {
    const { error } = await supabase
      .from("announcements")
      .update({ is_pinned: !a.is_pinned })
      .eq("id", a.id)
    if (error) return alert(error.message)
    await loadData()
  }

  const canManage = currentProfile && ["admin", "hr"].includes(currentProfile.role)
  const filtered = priorityFilter === "all"
    ? announcements
    : announcements.filter(a => a.priority === priorityFilter)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading announcements...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Announcements</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {announcements.length} announcements · {announcements.filter(a => a.is_pinned).length} pinned
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="size-4" />
            New Announcement
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="size-3.5 text-muted-foreground" />
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as Priority | "all")}
          className="bg-secondary/60 text-foreground text-xs rounded-lg px-3 py-1.5 outline-none border border-transparent focus:border-primary"
        >
          <option value="all">All Priorities</option>
          {(Object.entries(priorityConfig) as [Priority, { label: string }][]).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="py-20 text-center text-sm text-muted-foreground">
            <Megaphone className="size-8 mx-auto mb-3 opacity-50" />
            {announcements.length === 0
              ? "No announcements yet. Click New Announcement to broadcast a message."
              : "No announcements match this filter."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const pcfg = priorityConfig[a.priority as Priority]
            const PIcon = pcfg.icon
            const isExpired = a.expires_at ? new Date(a.expires_at) < new Date() : false
            const isPending = new Date(a.publish_at) > new Date()
            const dept = departments.find(d => d.id === a.target_department_id)
            const site = sites.find(s => s.id === a.target_site_id)

            return (
              <Card key={a.id} className={`border-border bg-card ${a.is_pinned ? "border-primary/30 bg-primary/[0.02]" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${pcfg.color}`}>
                        <PIcon className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {a.is_pinned && <Pin className="size-3 text-primary fill-primary" />}
                          <h3 className="text-sm font-semibold text-foreground">{a.title}</h3>
                          <Badge variant="secondary" className={`text-[10px] ${pcfg.color}`}>{pcfg.label}</Badge>
                          {isPending && <Badge variant="secondary" className="text-[10px] bg-chart-2/15 text-chart-2">Scheduled</Badge>}
                          {isExpired && <Badge variant="secondary" className="text-[10px] bg-destructive/15 text-destructive">Expired</Badge>}
                        </div>

                        <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{a.body}</p>

                        <div className="flex items-center gap-3 mt-2 flex-wrap text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="size-2.5" />
                            {new Date(a.publish_at).toLocaleString("en-GB", {
                              day: "numeric", month: "short", year: "numeric",
                              hour: "2-digit", minute: "2-digit"
                            })}
                          </span>
                          {a.expires_at && (
                            <span>· Expires {new Date(a.expires_at).toLocaleDateString("en-GB")}</span>
                          )}
                          {a.target_role && (
                            <Badge variant="secondary" className="text-[9px]">→ {a.target_role}</Badge>
                          )}
                          {dept && (
                            <Badge variant="secondary" className="text-[9px]">→ {dept.name}</Badge>
                          )}
                          {site && (
                            <Badge variant="secondary" className="text-[9px]">→ {site.name}</Badge>
                          )}
                          {!a.target_role && !dept && !site && (
                            <span className="italic">All users</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => togglePin(a)}
                          className={`p-1.5 rounded hover:bg-secondary transition-colors ${a.is_pinned ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                          title={a.is_pinned ? "Unpin" : "Pin"}
                        >
                          <Pin className={`size-3.5 ${a.is_pinned ? "fill-primary" : ""}`} />
                        </button>
                        <button
                          onClick={() => openEdit(a)}
                          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => remove(a.id, a.title)}
                          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">
                {editingId ? "Edit Announcement" : "New Announcement"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5 flex flex-col gap-3">
              {err && (
                <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                  {err}
                </div>
              )}

              <Field label="Title *">
                <input
                  type="text"
                  value={form.title}
                  onChange={e => update("title", e.target.value)}
                  placeholder="e.g. Eid holiday schedule"
                  className="form-field"
                />
              </Field>

              <Field label="Body *">
                <textarea
                  value={form.body}
                  onChange={e => update("body", e.target.value)}
                  placeholder="Write the announcement details..."
                  rows={5}
                  className="form-field resize-none"
                />
              </Field>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Priority">
                  <select value={form.priority} onChange={e => update("priority", e.target.value as Priority)} className="form-field">
                    {(Object.entries(priorityConfig) as [Priority, { label: string }][]).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Target Role">
                  <select value={form.target_role} onChange={e => update("target_role", e.target.value as UserRole | "")} className="form-field">
                    {roleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>

                <Field label="Department (optional)">
                  <select value={form.target_department_id} onChange={e => update("target_department_id", e.target.value)} className="form-field">
                    <option value="">All Departments</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </Field>

                <Field label="Site (optional)">
                  <select value={form.target_site_id} onChange={e => update("target_site_id", e.target.value)} className="form-field">
                    <option value="">All Sites</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>

                <Field label="Publish At">
                  <input
                    type="datetime-local"
                    value={form.publish_at}
                    onChange={e => update("publish_at", e.target.value)}
                    className="form-field"
                  />
                </Field>

                <Field label="Expires At (optional)">
                  <input
                    type="datetime-local"
                    value={form.expires_at}
                    onChange={e => update("expires_at", e.target.value)}
                    className="form-field"
                  />
                </Field>
              </div>

              <label className="flex items-center gap-2 text-xs cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={form.is_pinned}
                  onChange={e => update("is_pinned", e.target.checked)}
                  className="size-3.5"
                />
                <Pin className="size-3 text-primary" />
                <span className="text-foreground">Pin to top of announcements</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/20">
              <button onClick={() => setShowModal(false)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button onClick={save} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                {saving && <Loader2 className="size-3 animate-spin" />}
                {editingId ? "Save Changes" : "Publish"}
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
