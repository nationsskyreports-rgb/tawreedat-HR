"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  FileText, Upload, Loader2, Trash2, Download, X,
  AlertTriangle, CheckCircle2, Filter, User, Calendar
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type {
  Employee, EmployeeDocument, DocumentType, Profile
} from "@/lib/types"

const docTypeLabels: Record<DocumentType, string> = {
  national_id:           "National ID",
  passport:              "Passport",
  driver_license:        "Driver License",
  contract:              "Contract",
  medical_certificate:   "Medical Certificate",
  education_certificate: "Education Certificate",
  cv:                    "CV",
  photo:                 "Photo",
  bank_statement:        "Bank Statement",
  social_insurance_card: "Social Insurance Card",
  other:                 "Other",
}

const docTypeColors: Record<DocumentType, string> = {
  national_id:           "bg-primary/15 text-primary",
  passport:              "bg-chart-1/15 text-chart-1",
  driver_license:        "bg-chart-2/15 text-chart-2",
  contract:              "bg-chart-3/15 text-chart-3",
  medical_certificate:   "bg-destructive/15 text-destructive",
  education_certificate: "bg-chart-4/15 text-chart-4",
  cv:                    "bg-primary/15 text-primary",
  photo:                 "bg-secondary text-secondary-foreground",
  bank_statement:        "bg-chart-2/15 text-chart-2",
  social_insurance_card: "bg-chart-3/15 text-chart-3",
  other:                 "bg-secondary text-secondary-foreground",
}

type FormState = {
  employee_id: string
  document_type: DocumentType
  document_name: string
  document_number: string
  issue_date: string
  expiry_date: string
  issuing_authority: string
  notes: string
  file: File | null
}

const emptyForm: FormState = {
  employee_id: "",
  document_type: "national_id",
  document_name: "",
  document_number: "",
  issue_date: "",
  expiry_date: "",
  issuing_authority: "",
  notes: "",
  file: null,
}

export function DocumentsTab() {
  const [documents, setDocuments] = useState<EmployeeDocument[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const [employeeFilter, setEmployeeFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<DocumentType | "all">("all")

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const [docRes, empRes, profRes] = await Promise.all([
      supabase.from("employee_documents").select("*").order("created_at", { ascending: false }),
      supabase.from("employees").select("*").order("full_name"),
      user ? supabase.from("profiles").select("*").eq("id", user.id).single() : Promise.resolve({ data: null }),
    ])

    setDocuments((docRes.data ?? []) as EmployeeDocument[])
    setEmployees((empRes.data ?? []) as Employee[])
    setCurrentProfile(profRes.data as Profile | null)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  function openUpload() {
    setForm(emptyForm)
    setErr(null)
    setShowModal(true)
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setErr("File too large. Max 10MB.")
      return
    }
    update("file", file)
    if (!form.document_name) update("document_name", file.name)
  }

  async function upload() {
    setErr(null)
    if (!form.employee_id) return setErr("Select employee")
    if (!form.document_name.trim()) return setErr("Document name is required")
    if (!form.file) return setErr("Select a file to upload")

    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()

    try {
      // Upload file to storage
      const fileExt = form.file.name.split(".").pop()
      const fileName = `${form.employee_id}/${Date.now()}_${form.document_type}.${fileExt}`

      const { error: uploadErr } = await supabase.storage
        .from("employee-documents")
        .upload(fileName, form.file)

      if (uploadErr) {
        setErr(`Upload failed: ${uploadErr.message}`)
        setUploading(false)
        return
      }

      // Save document record
      const { error: dbErr } = await supabase.from("employee_documents").insert({
        employee_id: form.employee_id,
        document_type: form.document_type,
        document_name: form.document_name.trim(),
        document_number: form.document_number.trim() || null,
        file_url: fileName,
        file_size_kb: Math.round(form.file.size / 1024),
        mime_type: form.file.type,
        issue_date: form.issue_date || null,
        expiry_date: form.expiry_date || null,
        issuing_authority: form.issuing_authority.trim() || null,
        notes: form.notes.trim() || null,
        uploaded_by: user?.id ?? null,
      })

      if (dbErr) {
        // Cleanup uploaded file if DB insert fails
        await supabase.storage.from("employee-documents").remove([fileName])
        setErr(`DB error: ${dbErr.message}`)
        setUploading(false)
        return
      }

      setUploading(false)
      setShowModal(false)
      await loadData()
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed")
      setUploading(false)
    }
  }

  async function downloadDoc(doc: EmployeeDocument) {
    if (!doc.file_url) return
    const { data, error } = await supabase.storage
      .from("employee-documents")
      .createSignedUrl(doc.file_url, 60) // 60 seconds

    if (error) return alert(error.message)
    if (data?.signedUrl) window.open(data.signedUrl, "_blank")
  }

  async function deleteDoc(doc: EmployeeDocument) {
    if (!confirm(`Delete document "${doc.document_name}"?`)) return

    if (doc.file_url) {
      await supabase.storage.from("employee-documents").remove([doc.file_url])
    }
    const { error } = await supabase.from("employee_documents").delete().eq("id", doc.id)
    if (error) return alert(error.message)
    await loadData()
  }

  const canManage = currentProfile && ["admin", "hr"].includes(currentProfile.role)

  const filtered = documents.filter(d => {
    if (employeeFilter !== "all" && d.employee_id !== employeeFilter) return false
    if (typeFilter !== "all" && d.document_type !== typeFilter) return false
    return true
  })

  // Documents expiring in next 30 days
  const expiringSoon = documents.filter(d => {
    if (!d.expiry_date) return false
    const exp = new Date(d.expiry_date)
    const in30 = new Date()
    in30.setDate(in30.getDate() + 30)
    return exp > new Date() && exp < in30
  })

  const expired = documents.filter(d => {
    if (!d.expiry_date) return false
    return new Date(d.expiry_date) < new Date()
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading documents...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Employee Documents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {documents.length} documents · {expiringSoon.length} expiring soon · {expired.length} expired
          </p>
        </div>
        {canManage && (
          <button onClick={openUpload}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Upload className="size-4" />
            Upload Document
          </button>
        )}
      </div>

      {/* Expiry warnings */}
      {(expiringSoon.length > 0 || expired.length > 0) && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-destructive mb-1.5">Action Required</p>
                {expired.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-destructive">{expired.length}</strong> document{expired.length !== 1 ? "s have" : " has"} expired
                  </p>
                )}
                {expiringSoon.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-primary">{expiringSoon.length}</strong> document{expiringSoon.length !== 1 ? "s expire" : " expires"} within 30 days
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="size-3.5 text-muted-foreground" />
        <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)}
          className="bg-secondary/60 text-foreground text-xs rounded-lg px-3 py-1.5 outline-none border border-transparent focus:border-primary">
          <option value="all">All Employees</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.employee_no} — {e.full_name}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as DocumentType | "all")}
          className="bg-secondary/60 text-foreground text-xs rounded-lg px-3 py-1.5 outline-none border border-transparent focus:border-primary">
          <option value="all">All Types</option>
          {(Object.entries(docTypeLabels) as [DocumentType, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground ml-2">{filtered.length} of {documents.length}</span>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <FileText className="size-8 mx-auto mb-2 opacity-50" />
              {documents.length === 0 ? "No documents uploaded yet." : "No documents match filters."}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map(doc => {
                const emp = employees.find(e => e.id === doc.employee_id)
                const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date()
                const isExpiringSoon = !isExpired && doc.expiry_date && (() => {
                  const in30 = new Date()
                  in30.setDate(in30.getDate() + 30)
                  return new Date(doc.expiry_date) < in30
                })()

                return (
                  <div key={doc.id} className="px-4 py-3 hover:bg-secondary/20 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="size-9 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0">
                          <FileText className="size-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-sm font-medium text-foreground truncate">{doc.document_name}</p>
                            <Badge variant="secondary" className={`text-[10px] ${docTypeColors[doc.document_type]}`}>
                              {docTypeLabels[doc.document_type]}
                            </Badge>
                            {isExpired && <Badge variant="secondary" className="text-[10px] bg-destructive/15 text-destructive">Expired</Badge>}
                            {isExpiringSoon && <Badge variant="secondary" className="text-[10px] bg-primary/15 text-primary">Expiring Soon</Badge>}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <User className="size-2.5" />
                              {emp?.full_name ?? "—"} ({emp?.employee_no ?? "—"})
                            </span>
                            {doc.document_number && (
                              <span className="font-mono">· #{doc.document_number}</span>
                            )}
                            {doc.expiry_date && (
                              <span className={isExpired ? "text-destructive" : isExpiringSoon ? "text-primary" : ""}>
                                · Expires {new Date(doc.expiry_date).toLocaleDateString("en-GB")}
                              </span>
                            )}
                            {doc.file_size_kb && (
                              <span>· {(doc.file_size_kb / 1024).toFixed(1)} MB</span>
                            )}
                          </div>
                          {doc.notes && (
                            <p className="text-[11px] text-muted-foreground italic mt-1">{doc.notes}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {doc.file_url && (
                          <button onClick={() => downloadDoc(doc)}
                            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            title="Download">
                            <Download className="size-3.5" />
                          </button>
                        )}
                        {canManage && (
                          <button onClick={() => deleteDoc(doc)}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete">
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

      {/* Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Upload Document</h2>
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

              <Field label="Employee *">
                <select value={form.employee_id} onChange={e => update("employee_id", e.target.value)} className="form-field">
                  <option value="">Select...</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.employee_no} — {e.full_name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Document Type *">
                <select value={form.document_type} onChange={e => update("document_type", e.target.value as DocumentType)} className="form-field">
                  {(Object.entries(docTypeLabels) as [DocumentType, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </Field>

              <Field label="Document Name *">
                <input type="text" value={form.document_name} onChange={e => update("document_name", e.target.value)}
                  placeholder="e.g. National ID Front" className="form-field" />
              </Field>

              <Field label="Document Number">
                <input type="text" value={form.document_number} onChange={e => update("document_number", e.target.value)}
                  placeholder="ID number or reference" className="form-field" />
              </Field>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Issue Date">
                  <input type="date" value={form.issue_date} onChange={e => update("issue_date", e.target.value)} className="form-field" />
                </Field>
                <Field label="Expiry Date">
                  <input type="date" value={form.expiry_date} onChange={e => update("expiry_date", e.target.value)} className="form-field" />
                </Field>
              </div>

              <Field label="Issuing Authority">
                <input type="text" value={form.issuing_authority} onChange={e => update("issuing_authority", e.target.value)}
                  placeholder="e.g. Civil Affairs Authority" className="form-field" />
              </Field>

              <Field label="Notes">
                <textarea value={form.notes} onChange={e => update("notes", e.target.value)}
                  rows={2} className="form-field resize-none" />
              </Field>

              <Field label="File * (Max 10MB)">
                <button onClick={() => fileRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-3 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors">
                  {form.file ? (
                    <>
                      <CheckCircle2 className="size-3.5 text-chart-3" />
                      <span className="text-foreground">{form.file.name}</span>
                      <span className="text-[10px]">({(form.file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </>
                  ) : (
                    <>
                      <Upload className="size-3.5" />
                      Choose file (PDF, image, doc...)
                    </>
                  )}
                </button>
                <input ref={fileRef} type="file" className="hidden" onChange={handleFileSelect}
                  accept=".pdf,.jpg,.jpeg,.png,.docx,.doc,.xlsx,.xls" />
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/20">
              <button onClick={() => setShowModal(false)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button onClick={upload} disabled={uploading}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                {uploading && <Loader2 className="size-3 animate-spin" />}
                Upload
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
