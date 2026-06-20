"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Settings, Users, MapPin, Building2, Loader2, Plus, X,
  Pencil, Trash2, Shield, Briefcase, User
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type {
  Profile, Site, Department, UserRole, SiteType, Employee
} from "@/lib/types"

type Tab = "users" | "sites" | "departments"

const roleConfig: Record<UserRole, { label: string; color: string; icon: typeof Shield }> = {
  admin:    { label: "Admin",    color: "bg-destructive/15 text-destructive", icon: Shield },
  hr:       { label: "HR",       color: "bg-primary/15 text-primary",         icon: Briefcase },
  manager:  { label: "Manager",  color: "bg-chart-2/15 text-chart-2",         icon: Briefcase },
  employee: { label: "Employee", color: "bg-secondary text-secondary-foreground", icon: User },
}

const siteTypeLabels: Record<SiteType, string> = {
  warehouse: "Warehouse",
  depot:     "Depot",
  office:    "Office",
  hub:       "Hub",
  port:      "Port",
  checkpoint: "Checkpoint",
}

type ProfileWithEmail = Profile & { email: string | null }

export function SettingsTab() {
  const [activeTab, setActiveTab] = useState<Tab>("users")

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage users, sites, departments, and system configuration</p>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 border-b border-border">
        {[
          { id: "users",       label: "Users & Roles", icon: Users },
          { id: "sites",       label: "Sites",         icon: MapPin },
          { id: "departments", label: "Departments",   icon: Building2 },
        ].map(t => {
          const Icon = t.icon
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as Tab)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors ${
                isActive
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {activeTab === "users"       && <UsersSection />}
      {activeTab === "sites"       && <SitesSection />}
      {activeTab === "departments" && <DepartmentsSection />}
    </div>
  )
}

// =============================================================================
// USERS
// =============================================================================
function UsersSection() {
  const [profiles, setProfiles] = useState<ProfileWithEmail[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ full_name: string; role: UserRole; employee_id: string }>({
    full_name: "", role: "employee", employee_id: ""
  })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const [profRes, empRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("employees").select("*").order("full_name"),
    ])

    // Fetch emails from auth.users (need to join manually since profiles doesn't have email)
    const profilesData = (profRes.data ?? []) as Profile[]
    const profilesWithEmail: ProfileWithEmail[] = await Promise.all(
      profilesData.map(async (p) => {
        // We can't query auth.users directly from client. So we leave email null
        // unless we add it to profiles table. For now, show ID.
        return { ...p, email: null }
      })
    )
    setProfiles(profilesWithEmail)
    setEmployees((empRes.data ?? []) as Employee[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openEdit(p: Profile) {
    setEditingId(p.id)
    setEditForm({
      full_name: p.full_name ?? "",
      role: p.role,
      employee_id: p.employee_id ?? "",
    })
  }

  async function saveEdit() {
    if (!editingId) return
    setSaving(true)
    const { error } = await supabase.from("profiles").update({
      full_name: editForm.full_name.trim() || null,
      role: editForm.role,
      employee_id: editForm.employee_id || null,
    }).eq("id", editingId)

    setSaving(false)

    if (error) {
      alert(error.message)
      return
    }

    setEditingId(null)
    await load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2" />
        Loading users...
      </div>
    )
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-0">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase">Authenticated Users</p>
          <Badge variant="secondary" className="text-xs">{profiles.length} users</Badge>
        </div>

        {profiles.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No users yet. Users are created when they sign up through the login page.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {profiles.map(p => {
              const linkedEmp = employees.find(e => e.id === p.employee_id)
              const cfg = roleConfig[p.role]
              const RoleIcon = cfg.icon

              return (
                <div key={p.id} className="px-4 py-3 hover:bg-secondary/20 transition-colors">
                  {editingId === p.id ? (
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={editForm.full_name}
                          onChange={(e) => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                          placeholder="Full name"
                          className="bg-secondary/60 text-foreground text-sm rounded-lg px-3 py-1.5 outline-none border border-transparent focus:border-primary"
                        />
                        <select
                          value={editForm.role}
                          onChange={(e) => setEditForm(f => ({ ...f, role: e.target.value as UserRole }))}
                          className="bg-secondary/60 text-foreground text-sm rounded-lg px-3 py-1.5 outline-none border border-transparent focus:border-primary"
                        >
                          {(Object.entries(roleConfig) as [UserRole, { label: string }][]).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                        <select
                          value={editForm.employee_id}
                          onChange={(e) => setEditForm(f => ({ ...f, employee_id: e.target.value }))}
                          className="bg-secondary/60 text-foreground text-sm rounded-lg px-3 py-1.5 outline-none border border-transparent focus:border-primary"
                        >
                          <option value="">— Link employee —</option>
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.employee_no} · {emp.full_name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">
                          Cancel
                        </button>
                        <button onClick={saveEdit} disabled={saving}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                          {saving && <Loader2 className="size-3 animate-spin" />}
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-9 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                          {(p.full_name ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate">{p.full_name ?? "(unnamed)"}</p>
                            <Badge variant="secondary" className={`text-[10px] ${cfg.color} flex items-center gap-1`}>
                              <RoleIcon className="size-2.5" />
                              {cfg.label}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            {p.id.slice(0, 8)}... {linkedEmp ? ` · linked to ${linkedEmp.employee_no}` : " · no employee link"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// =============================================================================
// SITES
// =============================================================================
function SitesSection() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "", code: "", city: "", address: "",
    site_type: "warehouse" as SiteType,
    lat: "", lng: "", radius_meters: "100",
    is_active: true, expected_headcount: "0",
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from("sites").select("*").order("name")
    setSites((data ?? []) as Site[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditingId(null)
    setForm({
      name: "", code: "", city: "", address: "",
      site_type: "warehouse", lat: "", lng: "", radius_meters: "100",
      is_active: true, expected_headcount: "0",
    })
    setErr(null)
    setShowModal(true)
  }

  function openEdit(s: Site) {
    setEditingId(s.id)
    setForm({
      name: s.name ?? "",
      code: s.code ?? "",
      city: s.city ?? "",
      address: s.address ?? "",
      site_type: s.site_type,
      lat: s.lat?.toString() ?? "",
      lng: s.lng?.toString() ?? "",
      radius_meters: s.radius_meters?.toString() ?? "100",
      is_active: s.is_active,
      expected_headcount: s.expected_headcount?.toString() ?? "0",
    })
    setErr(null)
    setShowModal(true)
  }

  async function save() {
    setErr(null)
    if (!form.name.trim()) return setErr("Site name is required")
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      city: form.city.trim() || null,
      address: form.address.trim() || null,
      site_type: form.site_type,
      lat: form.lat ? Number(form.lat) : null,
      lng: form.lng ? Number(form.lng) : null,
      radius_meters: form.radius_meters ? Number(form.radius_meters) : null,
      is_active: form.is_active,
      expected_headcount: form.expected_headcount ? Number(form.expected_headcount) : 0,
    }

    const res = editingId
      ? await supabase.from("sites").update(payload).eq("id", editingId)
      : await supabase.from("sites").insert(payload)

    setSaving(false)

    if (res.error) {
      setErr(res.error.message)
      return
    }

    setShowModal(false)
    await load()
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete site "${name}"?`)) return
    const { error } = await supabase.from("sites").delete().eq("id", id)
    if (error) return alert(error.message)
    await load()
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase">{sites.length} sites</p>
        <button onClick={openCreate} className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
          <Plus className="size-3.5" /> Add Site
        </button>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Loading sites...
            </div>
          ) : sites.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No sites yet. Add your first site to enable check-ins.
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {sites.map(s => (
                <div key={s.id} className="px-4 py-3 hover:bg-secondary/20 transition-colors flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-lg bg-chart-1/15 flex items-center justify-center shrink-0">
                      <MapPin className="size-4 text-chart-1" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                        <Badge variant="secondary" className="text-[10px]">{siteTypeLabels[s.site_type]}</Badge>
                        {!s.is_active && <Badge variant="secondary" className="text-[10px] bg-destructive/15 text-destructive">Inactive</Badge>}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {s.city ?? "—"} {s.lat && s.lng ? ` · ${s.lat.toFixed(4)}, ${s.lng.toFixed(4)} (${s.radius_meters}m)` : " · no GPS"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="size-3.5" />
                    </button>
                    <button onClick={() => remove(s.id, s.name)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Site Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">{editingId ? "Edit Site" : "Add Site"}</h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5 grid grid-cols-2 gap-3">
              {err && (
                <div className="col-span-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                  {err}
                </div>
              )}

              <Field label="Name *">
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. 6th October Warehouse" className="form-field" />
              </Field>
              <Field label="Code">
                <input type="text" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. WH-6OCT" className="form-field" />
              </Field>
              <Field label="Type">
                <select value={form.site_type} onChange={e => setForm(f => ({ ...f, site_type: e.target.value as SiteType }))} className="form-field">
                  {(Object.entries(siteTypeLabels) as [SiteType, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="City">
                <input type="text" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="e.g. Giza" className="form-field" />
              </Field>
              <Field label="Address" className="col-span-2">
                <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Street, district" className="form-field" />
              </Field>
              <Field label="Latitude">
                <input type="number" step="any" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))}
                  placeholder="29.9700" className="form-field" />
              </Field>
              <Field label="Longitude">
                <input type="number" step="any" value={form.lng} onChange={e => setForm(f => ({ ...f, lng: e.target.value }))}
                  placeholder="30.9700" className="form-field" />
              </Field>
              <Field label="Geofence Radius (m)">
                <input type="number" min="10" value={form.radius_meters} onChange={e => setForm(f => ({ ...f, radius_meters: e.target.value }))}
                  className="form-field" />
              </Field>
              <Field label="Expected Headcount">
                <input type="number" min="0" value={form.expected_headcount} onChange={e => setForm(f => ({ ...f, expected_headcount: e.target.value }))}
                  className="form-field" />
              </Field>
              <label className="col-span-2 flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="size-3.5" />
                <span className="text-foreground">Active site</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/20">
              <button onClick={() => setShowModal(false)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button onClick={save} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                {saving && <Loader2 className="size-3 animate-spin" />}
                {editingId ? "Save Changes" : "Create Site"}
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
    </>
  )
}

// =============================================================================
// DEPARTMENTS
// =============================================================================
function DepartmentsSection() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ code: "", name: "", description: "", is_active: true })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from("departments").select("*").order("name")
    setDepartments((data ?? []) as Department[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditingId(null)
    setForm({ code: "", name: "", description: "", is_active: true })
    setErr(null)
    setShowModal(true)
  }

  function openEdit(d: Department) {
    setEditingId(d.id)
    setForm({
      code: d.code ?? "",
      name: d.name ?? "",
      description: d.description ?? "",
      is_active: d.is_active,
    })
    setErr(null)
    setShowModal(true)
  }

  async function save() {
    setErr(null)
    if (!form.code.trim()) return setErr("Code is required")
    if (!form.name.trim()) return setErr("Name is required")
    setSaving(true)
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      is_active: form.is_active,
    }
    const res = editingId
      ? await supabase.from("departments").update(payload).eq("id", editingId)
      : await supabase.from("departments").insert(payload)
    setSaving(false)
    if (res.error) { setErr(res.error.message); return }
    setShowModal(false)
    await load()
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete department "${name}"?`)) return
    const { error } = await supabase.from("departments").delete().eq("id", id)
    if (error) return alert(error.message)
    await load()
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase">{departments.length} departments</p>
        <button onClick={openCreate} className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
          <Plus className="size-3.5" /> Add Department
        </button>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Loading...
            </div>
          ) : departments.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No departments yet.</div>
          ) : (
            <div className="divide-y divide-border/50">
              {departments.map(d => (
                <div key={d.id} className="px-4 py-3 hover:bg-secondary/20 transition-colors flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-lg bg-chart-2/15 flex items-center justify-center shrink-0">
                      <Building2 className="size-4 text-chart-2" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{d.name}</p>
                        <Badge variant="secondary" className="text-[10px] font-mono">{d.code}</Badge>
                        {!d.is_active && <Badge variant="secondary" className="text-[10px] bg-destructive/15 text-destructive">Inactive</Badge>}
                      </div>
                      {d.description && <p className="text-[11px] text-muted-foreground truncate">{d.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(d)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="size-3.5" />
                    </button>
                    <button onClick={() => remove(d.id, d.name)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">{editingId ? "Edit" : "Add"} Department</h2>
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
              <Field label="Code *">
                <input type="text" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. OPS" className="form-field" />
              </Field>
              <Field label="Name *">
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Operations" className="form-field" />
              </Field>
              <Field label="Description">
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3} className="form-field resize-none" />
              </Field>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="size-3.5" />
                <span className="text-foreground">Active department</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/20">
              <button onClick={() => setShowModal(false)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button onClick={save} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                {saving && <Loader2 className="size-3 animate-spin" />}
                {editingId ? "Save" : "Create"}
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
    </>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      {children}
    </label>
  )
}
