"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Bot, CheckCircle2, AlertTriangle, Briefcase, MapPin,
  Plus, Upload, X, Loader2, Pencil, Users, Filter, Eye
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type {
  JobPosting, Candidate, Department, JobPostingStatus,
  CandidateStatus, EmploymentType
} from "@/lib/types"

const jobStatusConfig: Record<JobPostingStatus, { label: string; color: string }> = {
  draft:  { label: "Draft",   color: "bg-secondary text-secondary-foreground" },
  open:   { label: "Open",    color: "bg-chart-3/15 text-chart-3" },
  paused: { label: "Paused",  color: "bg-primary/15 text-primary" },
  closed: { label: "Closed",  color: "bg-destructive/15 text-destructive" },
  filled: { label: "Filled",  color: "bg-chart-2/15 text-chart-2" },
}

const candidateStatusConfig: Record<CandidateStatus, { label: string; color: string }> = {
  new:                  { label: "New",            color: "bg-secondary text-secondary-foreground" },
  screening:            { label: "AI Screened",    color: "bg-primary/15 text-primary" },
  shortlisted:          { label: "Shortlisted",    color: "bg-chart-2/15 text-chart-2" },
  interview_scheduled:  { label: "Interview",      color: "bg-chart-3/15 text-chart-3" },
  interviewed:          { label: "Interviewed",    color: "bg-chart-3/15 text-chart-3" },
  offer_extended:       { label: "Offer",          color: "bg-chart-4/15 text-chart-4" },
  hired:                { label: "Hired",          color: "bg-chart-3/15 text-chart-3" },
  rejected:             { label: "Rejected",       color: "bg-destructive/15 text-destructive" },
  withdrawn:            { label: "Withdrawn",      color: "bg-secondary text-secondary-foreground" },
}

type JobFormState = {
  title: string
  department_id: string
  location: string
  description: string
  responsibilities: string
  status: JobPostingStatus
  employment_type: EmploymentType
  openings: string
  experience_min_years: string
  salary_min: string
  salary_max: string
  closing_date: string
}

const emptyJobForm: JobFormState = {
  title: "",
  department_id: "",
  location: "",
  description: "",
  responsibilities: "",
  status: "open",
  employment_type: "full_time",
  openings: "1",
  experience_min_years: "0",
  salary_min: "",
  salary_max: "",
  closing_date: "",
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 90 ? "text-chart-3" : score >= 75 ? "text-primary" : "text-destructive"
  const ringColor = score >= 90 ? "stroke-chart-3" : score >= 75 ? "stroke-primary" : "stroke-destructive"
  const circumference = 2 * Math.PI * 22
  const offset = circumference - (score / 100) * circumference
  return (
    <div className="relative size-14">
      <svg className="size-14 -rotate-90" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="22" fill="none" stroke="oklch(1 0 0 / 8%)" strokeWidth="4" />
        <circle cx="28" cy="28" r="22" fill="none" strokeWidth="4"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className={`${ringColor} transition-all duration-700`}
        />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${color}`}>
        {score}%
      </div>
    </div>
  )
}

export function ATSTab() {
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobStatusFilter, setJobStatusFilter] = useState<JobPostingStatus | "all">("open")

  // Job modal
  const [showJobModal, setShowJobModal] = useState(false)
  const [editingJobId, setEditingJobId] = useState<string | null>(null)
  const [jobForm, setJobForm] = useState<JobFormState>(emptyJobForm)
  const [jobError, setJobError] = useState<string | null>(null)
  const [savingJob, setSavingJob] = useState(false)

  // Candidate modal (CV analysis)
  const [showCandidateModal, setShowCandidateModal] = useState(false)
  const [cvText, setCvText] = useState("")
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzed, setAnalyzed] = useState<any>(null)
  const [savingCandidate, setSavingCandidate] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadData() {
    setLoading(true)
    const [jobsRes, candidatesRes, deptRes] = await Promise.all([
      supabase.from("job_postings").select("*").order("created_at", { ascending: false }),
      supabase.from("candidates").select("*").order("created_at", { ascending: false }),
      supabase.from("departments").select("*").eq("is_active", true).order("name"),
    ])
    const allJobs = (jobsRes.data ?? []) as JobPosting[]
    setJobs(allJobs)
    setCandidates((candidatesRes.data ?? []) as Candidate[])
    setDepartments((deptRes.data ?? []) as Department[])

    if (!selectedJob && allJobs.length > 0) {
      const firstOpen = allJobs.find((j) => j.status === "open") ?? allJobs[0]
      setSelectedJob(firstOpen)
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  // ---- Job CRUD ----
  function openCreateJob() {
    setEditingJobId(null)
    setJobForm(emptyJobForm)
    setJobError(null)
    setShowJobModal(true)
  }

  function openEditJob(job: JobPosting) {
    setEditingJobId(job.id)
    setJobForm({
      title: job.title ?? "",
      department_id: job.department_id ?? "",
      location: job.location ?? "",
      description: job.description ?? "",
      responsibilities: job.responsibilities ?? "",
      status: job.status,
      employment_type: job.employment_type,
      openings: job.openings?.toString() ?? "1",
      experience_min_years: job.experience_min_years?.toString() ?? "0",
      salary_min: job.salary_min?.toString() ?? "",
      salary_max: job.salary_max?.toString() ?? "",
      closing_date: job.closing_date ?? "",
    })
    setJobError(null)
    setShowJobModal(true)
  }

  function updateJobForm<K extends keyof JobFormState>(key: K, value: JobFormState[K]) {
    setJobForm((f) => ({ ...f, [key]: value }))
  }

  async function submitJob() {
    setJobError(null)
    if (!jobForm.title.trim()) return setJobError("Job title is required")

    setSavingJob(true)

    const dept = departments.find((d) => d.id === jobForm.department_id)
    const payload = {
      title: jobForm.title.trim(),
      department_id: jobForm.department_id || null,
      department: dept?.name ?? null,
      location: jobForm.location.trim() || null,
      description: jobForm.description.trim() || null,
      responsibilities: jobForm.responsibilities.trim() || null,
      status: jobForm.status,
      employment_type: jobForm.employment_type,
      openings: jobForm.openings ? Number(jobForm.openings) : 1,
      experience_min_years: jobForm.experience_min_years ? Number(jobForm.experience_min_years) : 0,
      salary_min: jobForm.salary_min ? Number(jobForm.salary_min) : null,
      salary_max: jobForm.salary_max ? Number(jobForm.salary_max) : null,
      closing_date: jobForm.closing_date || null,
      requirements: {},
    }

    let res
    if (editingJobId) {
      res = await supabase.from("job_postings").update(payload).eq("id", editingJobId)
    } else {
      res = await supabase.from("job_postings").insert(payload)
    }

    setSavingJob(false)

    if (res.error) {
      setJobError(res.error.message)
      return
    }

    setShowJobModal(false)
    await loadData()
  }

  async function quickToggleJobStatus(job: JobPosting) {
    const newStatus: JobPostingStatus = job.status === "open" ? "paused" : "open"
    const { error } = await supabase.from("job_postings").update({ status: newStatus }).eq("id", job.id)
    if (error) return alert(error.message)
    await loadData()
  }

  // ---- CV Analysis ----
  async function analyzeCV() {
    if (!cvText || !selectedJob) return
    setAnalyzing(true)
    setAnalyzed(null)
    try {
      const res = await fetch("/api/analyze-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvText, jobRequirements: selectedJob.requirements }),
      })
      const data = await res.json()
      setAnalyzed(data)
    } catch (e) {
      console.error(e)
    }
    setAnalyzing(false)
  }

  async function saveCandidate() {
    if (!analyzed || !selectedJob) return
    setSavingCandidate(true)
    const { data, error } = await supabase.from("candidates").insert({
      job_id: selectedJob.id,
      full_name: analyzed.full_name,
      location: analyzed.location,
      exp_years: analyzed.exp_years,
      match_score: analyzed.match_score,
      status: "screening" as CandidateStatus,
      ai_summary: analyzed.ai_summary,
      salary_expect: analyzed.salary_expect,
      availability: analyzed.availability,
      red_flags: analyzed.red_flags ?? [],
      skills: analyzed.skills ?? {},
    }).select().single()

    if (!error && data) {
      setCandidates((prev) => [data as Candidate, ...prev])
      setSelectedCandidate(data as Candidate)
    }
    setSavingCandidate(false)
    setShowCandidateModal(false)
    setCvText("")
    setAnalyzed(null)
  }

  async function updateCandidateStatus(candidateId: string, status: CandidateStatus) {
    await supabase.from("candidates").update({ status }).eq("id", candidateId)
    setCandidates((prev) => prev.map((c) => c.id === candidateId ? { ...c, status } : c))
    if (selectedCandidate?.id === candidateId) {
      setSelectedCandidate((prev) => prev ? { ...prev, status } : null)
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setCvText(ev.target?.result as string ?? "")
    reader.readAsText(file)
  }

  const filteredJobs = jobStatusFilter === "all"
    ? jobs
    : jobs.filter((j) => j.status === jobStatusFilter)

  const jobCandidates = candidates.filter((c) => !selectedJob || c.job_id === selectedJob.id)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading recruitment data...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">AI Recruitment</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {jobs.filter((j) => j.status === "open").length} open positions · {candidates.length} candidates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openCreateJob}
            className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-foreground rounded-lg text-xs font-medium hover:bg-secondary/80 transition-colors"
          >
            <Plus className="size-3.5" />
            Add Job
          </button>
          <button
            onClick={() => setShowCandidateModal(true)}
            disabled={!selectedJob}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Bot className="size-3.5" />
            Analyze CV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Jobs sidebar */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Filter className="size-3.5 text-muted-foreground" />
            <select
              value={jobStatusFilter}
              onChange={(e) => setJobStatusFilter(e.target.value as JobPostingStatus | "all")}
              className="bg-secondary/60 text-foreground text-xs rounded-lg px-3 py-1.5 outline-none border border-transparent focus:border-primary flex-1"
            >
              <option value="all">All Jobs</option>
              {(Object.entries(jobStatusConfig) as [JobPostingStatus, { label: string }][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          <Card className="border-border bg-card">
            <CardContent className="p-0 max-h-[600px] overflow-auto">
              {filteredJobs.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                  {jobs.length === 0 ? "No jobs yet. Click Add Job." : "No jobs match this filter."}
                </div>
              ) : (
                filteredJobs.map((job) => {
                  const stat = jobStatusConfig[job.status]
                  const count = candidates.filter((c) => c.job_id === job.id).length
                  const isSelected = selectedJob?.id === job.id
                  return (
                    <button
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className={`w-full text-left px-4 py-3 border-b border-border/50 transition-colors ${
                        isSelected ? "bg-primary/8" : "hover:bg-secondary/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className={`text-sm font-medium truncate ${isSelected ? "text-primary" : "text-foreground"}`}>
                          {job.title}
                        </span>
                        <Badge variant="secondary" className={`text-[10px] shrink-0 ${stat.color}`}>
                          {stat.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        {job.location && (
                          <span className="flex items-center gap-1"><MapPin className="size-2.5" />{job.location}</span>
                        )}
                        <span className="flex items-center gap-1"><Users className="size-2.5" />{count}</span>
                        <span>· {job.openings} opening{job.openings !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditJob(job) }}
                          className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          <Pencil className="size-2.5" /> Edit
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); quickToggleJobStatus(job) }}
                          className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          {job.status === "open" ? "Pause" : "Activate"}
                        </button>
                      </div>
                    </button>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Candidates panel */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-3">
          {selectedJob ? (
            <>
              <Card className="border-border bg-card">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Briefcase className="size-4 text-primary" />
                        <h2 className="text-sm font-semibold text-foreground">{selectedJob.title}</h2>
                        <Badge variant="secondary" className={`text-[10px] ${jobStatusConfig[selectedJob.status].color}`}>
                          {jobStatusConfig[selectedJob.status].label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {selectedJob.department ?? "—"} · {selectedJob.location ?? "Remote"} · {selectedJob.openings} opening{selectedJob.openings !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  {/* Pipeline */}
                  <div className="grid grid-cols-6 gap-1.5 mt-3">
                    {(["new", "screening", "shortlisted", "interview_scheduled", "offer_extended", "hired"] as CandidateStatus[]).map((s) => {
                      const cnt = jobCandidates.filter((c) => c.status === s).length
                      const cfg = candidateStatusConfig[s]
                      return (
                        <div key={s} className="bg-secondary/40 rounded-lg px-2 py-2 text-center">
                          <p className="text-base font-semibold text-foreground tabular-nums">{cnt}</p>
                          <p className="text-[9px] text-muted-foreground uppercase">{cfg.label}</p>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-12 gap-3">
                {/* Candidate list */}
                <Card className="col-span-12 md:col-span-5 border-border bg-card">
                  <CardContent className="p-0 max-h-[500px] overflow-auto">
                    {jobCandidates.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                        No candidates yet for this position.
                      </div>
                    ) : (
                      jobCandidates.map((c) => {
                        const cfg = candidateStatusConfig[c.status]
                        const isSelected = selectedCandidate?.id === c.id
                        return (
                          <button
                            key={c.id}
                            onClick={() => setSelectedCandidate(c)}
                            className={`w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors ${
                              isSelected ? "bg-primary/8" : "hover:bg-secondary/30"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className={`text-xs font-medium truncate ${isSelected ? "text-primary" : "text-foreground"}`}>
                                {c.full_name}
                              </span>
                              <span className="text-[10px] font-bold text-primary tabular-nums shrink-0">{c.match_score}%</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground truncate">{c.location ?? "—"} · {c.exp_years}y</span>
                              <Badge variant="secondary" className={`text-[9px] ${cfg.color}`}>{cfg.label}</Badge>
                            </div>
                          </button>
                        )
                      })
                    )}
                  </CardContent>
                </Card>

                {/* Candidate detail */}
                <Card className="col-span-12 md:col-span-7 border-border bg-card">
                  <CardContent className="p-4">
                    {selectedCandidate ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">{selectedCandidate.full_name}</h3>
                            <p className="text-xs text-muted-foreground">{selectedCandidate.location ?? "—"} · {selectedCandidate.exp_years} years exp.</p>
                            {selectedCandidate.email && <p className="text-[11px] text-muted-foreground mt-0.5">{selectedCandidate.email}</p>}
                          </div>
                          <ScoreRing score={selectedCandidate.match_score} />
                        </div>

                        {selectedCandidate.ai_summary && (
                          <div className="rounded-lg bg-primary/8 border border-primary/15 p-2.5">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Bot className="size-3 text-primary" />
                              <span className="text-[10px] font-medium text-primary uppercase">AI Summary</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{selectedCandidate.ai_summary}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          {selectedCandidate.salary_expect && (
                            <div className="bg-secondary/50 rounded-lg px-2.5 py-2">
                              <p className="text-[10px] text-muted-foreground">Salary Expectation</p>
                              <p className="text-xs font-medium text-foreground">{selectedCandidate.salary_expect}</p>
                            </div>
                          )}
                          {selectedCandidate.availability && (
                            <div className="bg-secondary/50 rounded-lg px-2.5 py-2">
                              <p className="text-[10px] text-muted-foreground">Availability</p>
                              <p className="text-xs font-medium text-foreground">{selectedCandidate.availability}</p>
                            </div>
                          )}
                        </div>

                        {selectedCandidate.red_flags?.length > 0 && (
                          <div className="rounded-lg bg-destructive/8 border border-destructive/15 p-2.5">
                            <div className="flex items-center gap-1.5 mb-1">
                              <AlertTriangle className="size-3 text-destructive" />
                              <span className="text-[10px] font-medium text-destructive uppercase">Red Flags</span>
                            </div>
                            {selectedCandidate.red_flags.map((f, i) => (
                              <p key={i} className="text-[11px] text-destructive/80">• {f}</p>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-2 mt-2">
                          {selectedCandidate.status === "screening" && (
                            <button onClick={() => updateCandidateStatus(selectedCandidate.id, "shortlisted")}
                              className="flex-1 py-2 text-xs rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
                              Shortlist
                            </button>
                          )}
                          {selectedCandidate.status === "shortlisted" && (
                            <button onClick={() => updateCandidateStatus(selectedCandidate.id, "interview_scheduled")}
                              className="flex-1 py-2 text-xs rounded-lg bg-chart-3/15 text-chart-3 font-medium hover:bg-chart-3/25 transition-colors">
                              Schedule Interview
                            </button>
                          )}
                          {selectedCandidate.status === "interview_scheduled" && (
                            <button onClick={() => updateCandidateStatus(selectedCandidate.id, "offer_extended")}
                              className="flex-1 py-2 text-xs rounded-lg bg-chart-4/15 text-chart-4 font-medium hover:bg-chart-4/25 transition-colors">
                              Extend Offer
                            </button>
                          )}
                          {selectedCandidate.status === "offer_extended" && (
                            <button onClick={() => updateCandidateStatus(selectedCandidate.id, "hired")}
                              className="flex-1 py-2 text-xs rounded-lg bg-chart-3/15 text-chart-3 font-medium hover:bg-chart-3/25 transition-colors">
                              Mark Hired
                            </button>
                          )}
                          {!["rejected", "hired", "withdrawn"].includes(selectedCandidate.status) && (
                            <button onClick={() => updateCandidateStatus(selectedCandidate.id, "rejected")}
                              className="flex-1 py-2 text-xs rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                              Reject
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                        <Eye className="size-6 opacity-50" />
                        Select a candidate to view details
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card className="border-border bg-card">
              <CardContent className="py-20 text-center text-sm text-muted-foreground">
                Select a job from the list to see candidates, or click <strong>Add Job</strong> to create one.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Job Modal */}
      {showJobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">
                {editingJobId ? "Edit Job Posting" : "New Job Posting"}
              </h2>
              <button onClick={() => setShowJobModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto px-5 py-4">
              {jobError && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                  {jobError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Job Title *" className="col-span-2">
                  <input
                    type="text"
                    value={jobForm.title}
                    onChange={(e) => updateJobForm("title", e.target.value)}
                    placeholder="e.g. Senior Driver"
                    className="form-field"
                  />
                </FormField>

                <FormField label="Department">
                  <select value={jobForm.department_id} onChange={(e) => updateJobForm("department_id", e.target.value)} className="form-field">
                    <option value="">—</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </FormField>

                <FormField label="Location">
                  <input
                    type="text"
                    value={jobForm.location}
                    onChange={(e) => updateJobForm("location", e.target.value)}
                    placeholder="e.g. Cairo, 10th of Ramadan"
                    className="form-field"
                  />
                </FormField>

                <FormField label="Status">
                  <select value={jobForm.status} onChange={(e) => updateJobForm("status", e.target.value as JobPostingStatus)} className="form-field">
                    {(Object.entries(jobStatusConfig) as [JobPostingStatus, { label: string }][]).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Employment Type">
                  <select value={jobForm.employment_type} onChange={(e) => updateJobForm("employment_type", e.target.value as EmploymentType)} className="form-field">
                    <option value="full_time">Full Time</option>
                    <option value="part_time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </select>
                </FormField>

                <FormField label="Openings">
                  <input
                    type="number"
                    min="1"
                    value={jobForm.openings}
                    onChange={(e) => updateJobForm("openings", e.target.value)}
                    className="form-field"
                  />
                </FormField>

                <FormField label="Min Experience (years)">
                  <input
                    type="number"
                    min="0"
                    value={jobForm.experience_min_years}
                    onChange={(e) => updateJobForm("experience_min_years", e.target.value)}
                    className="form-field"
                  />
                </FormField>

                <FormField label="Min Salary (EGP)">
                  <input
                    type="number"
                    min="0"
                    value={jobForm.salary_min}
                    onChange={(e) => updateJobForm("salary_min", e.target.value)}
                    className="form-field"
                  />
                </FormField>

                <FormField label="Max Salary (EGP)">
                  <input
                    type="number"
                    min="0"
                    value={jobForm.salary_max}
                    onChange={(e) => updateJobForm("salary_max", e.target.value)}
                    className="form-field"
                  />
                </FormField>

                <FormField label="Closing Date">
                  <input
                    type="date"
                    value={jobForm.closing_date}
                    onChange={(e) => updateJobForm("closing_date", e.target.value)}
                    className="form-field"
                  />
                </FormField>

                <FormField label="Description" className="col-span-2">
                  <textarea
                    value={jobForm.description}
                    onChange={(e) => updateJobForm("description", e.target.value)}
                    placeholder="Brief job overview..."
                    rows={3}
                    className="form-field resize-none"
                  />
                </FormField>

                <FormField label="Responsibilities" className="col-span-2">
                  <textarea
                    value={jobForm.responsibilities}
                    onChange={(e) => updateJobForm("responsibilities", e.target.value)}
                    placeholder="Key duties and responsibilities..."
                    rows={3}
                    className="form-field resize-none"
                  />
                </FormField>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/20">
              <button onClick={() => setShowJobModal(false)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button onClick={submitJob} disabled={savingJob}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                {savingJob && <Loader2 className="size-3 animate-spin" />}
                {editingJobId ? "Save Changes" : "Create Job"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CV Analysis Modal */}
      {showCandidateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Add Candidate</h2>
                <p className="text-xs text-muted-foreground mt-0.5">AI will analyze the CV for {selectedJob?.title}</p>
              </div>
              <button onClick={() => { setShowCandidateModal(false); setCvText(""); setAnalyzed(null) }} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5 flex flex-col gap-4">
              {!analyzed ? (
                <>
                  <FormField label="CV Text">
                    <textarea
                      value={cvText}
                      onChange={(e) => setCvText(e.target.value)}
                      placeholder="Paste the candidate's CV text here..."
                      rows={10}
                      className="form-field resize-none"
                    />
                  </FormField>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">or upload</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  <button onClick={() => fileRef.current?.click()}
                    className="flex items-center justify-center gap-2 py-2.5 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors">
                    <Upload className="size-3.5" />
                    Upload .txt file
                  </button>
                  <input ref={fileRef} type="file" accept=".txt,.text" className="hidden" onChange={handleFileUpload} />

                  <button onClick={analyzeCV} disabled={!cvText || analyzing}
                    className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {analyzing ? <><Loader2 className="size-4 animate-spin" /> Analyzing...</> : <><Bot className="size-4" /> Analyze with AI</>}
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-chart-3" />
                      <span className="text-sm font-medium text-foreground">Analysis Complete</span>
                    </div>
                    <ScoreRing score={analyzed.match_score} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Name", value: analyzed.full_name },
                      { label: "Location", value: analyzed.location },
                      { label: "Experience", value: `${analyzed.exp_years} years` },
                      { label: "Salary", value: analyzed.salary_expect },
                      { label: "Availability", value: analyzed.availability },
                    ].map(f => (
                      <div key={f.label} className="bg-secondary/50 rounded-lg px-2.5 py-2">
                        <p className="text-[10px] text-muted-foreground">{f.label}</p>
                        <p className="text-xs font-medium text-foreground">{f.value ?? "—"}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg bg-primary/8 border border-primary/15 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Bot className="size-3.5 text-primary" />
                      <span className="text-xs font-medium text-primary">AI Summary</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{analyzed.ai_summary}</p>
                  </div>

                  {analyzed.red_flags?.length > 0 && (
                    <div className="rounded-lg bg-destructive/8 border border-destructive/15 p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="size-3.5 text-destructive" />
                        <span className="text-xs font-medium text-destructive">Red Flags</span>
                      </div>
                      {analyzed.red_flags.map((f: string, i: number) => (
                        <p key={i} className="text-[11px] text-destructive/80">• {f}</p>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => setAnalyzed(null)}
                      className="flex-1 py-2 text-xs rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                      Re-analyze
                    </button>
                    <button onClick={saveCandidate} disabled={savingCandidate}
                      className="flex-1 py-2 text-xs rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                      {savingCandidate ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                      Save Candidate
                    </button>
                  </div>
                </>
              )}
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
          transition: border-color 150ms;
        }
        :global(.form-field:focus) {
          border-color: var(--primary);
        }
      `}</style>
    </div>
  )
}

function FormField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      {children}
    </label>
  )
}
