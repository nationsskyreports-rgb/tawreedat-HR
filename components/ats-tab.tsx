"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Bot, CheckCircle2, XCircle, AlertTriangle, Clock,
  Truck, Shield, Award, MapPin, Plus, Upload, X, Loader2
} from "lucide-react"
import { supabase } from "@/lib/supabase"

type Candidate = {
  id: string
  job_id: string
  full_name: string
  location: string
  exp_years: number
  match_score: number
  status: string
  ai_summary: string
  salary_expect: string
  availability: string
  red_flags: string[]
  skills: Record<string, any>
  created_at: string
}

type JobPosting = {
  id: string
  title: string
  location: string
  requirements: Record<string, any>
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 90 ? "text-chart-3" : score >= 75 ? "text-primary" : "text-destructive"
  const ringColor = score >= 90 ? "stroke-chart-3" : score >= 75 ? "stroke-primary" : "stroke-destructive"
  const circumference = 2 * Math.PI * 22
  const offset = circumference - (score / 100) * circumference
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative size-16">
        <svg className="size-16 -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="22" fill="none" stroke="oklch(1 0 0 / 8%)" strokeWidth="4" />
          <circle cx="28" cy="28" r="22" fill="none" strokeWidth="4"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" className={`${ringColor} transition-all duration-700`}
          />
        </svg>
        <div className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${color}`}>
          {score}%
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground">AI Match</span>
    </div>
  )
}

const skillLabels: Record<string, string> = {
  license_class: "License Class",
  years_exp: "Experience",
  hazmat: "Hazmat Cert",
  medical: "Medical Status",
  gps_exp: "GPS/TMS Exp.",
  arabic: "Arabic Language",
}

export function ATSTab() {
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [cvText, setCvText] = useState("")
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzed, setAnalyzed] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data: jobsData } = await supabase.from("job_postings").select("*").eq("status", "active")
    const { data: candidatesData } = await supabase.from("candidates").select("*").order("created_at", { ascending: false })
    setJobs(jobsData ?? [])
    setCandidates(candidatesData ?? [])
    if (jobsData && jobsData.length > 0) setSelectedJob(jobsData[0])
    if (candidatesData && candidatesData.length > 0) setSelectedCandidate(candidatesData[0])
    setLoading(false)
  }

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
    setSaving(true)
    const { data, error } = await supabase.from("candidates").insert({
      job_id: selectedJob.id,
      full_name: analyzed.full_name,
      location: analyzed.location,
      exp_years: analyzed.exp_years,
      match_score: analyzed.match_score,
      status: "ai_screened",
      ai_summary: analyzed.ai_summary,
      salary_expect: analyzed.salary_expect,
      availability: analyzed.availability,
      red_flags: analyzed.red_flags,
      skills: analyzed.skills,
    }).select().single()
    if (!error && data) {
      setCandidates(prev => [data, ...prev])
      setSelectedCandidate(data)
    }
    setSaving(false)
    setShowModal(false)
    setCvText("")
    setAnalyzed(null)
  }

  async function updateStatus(candidateId: string, status: string) {
    await supabase.from("candidates").update({ status }).eq("id", candidateId)
    setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, status } : c))
    if (selectedCandidate?.id === candidateId) setSelectedCandidate(prev => prev ? { ...prev, status } : null)
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setCvText(ev.target?.result as string ?? "")
    reader.readAsText(file)
  }

  function closeModal() {
    setShowModal(false)
    setCvText("")
    setAnalyzed(null)
  }

  const jobCandidates = candidates.filter(c => !selectedJob || c.job_id === selectedJob.id)

  const pipeline = [
    { stage: "Applied", count: jobCandidates.length },
    { stage: "AI Screened", count: jobCandidates.filter(c => ["ai_screened","shortlisted","interview","offer","hired"].includes(c.status)).length },
    { stage: "Shortlisted", count: jobCandidates.filter(c => ["shortlisted","interview","offer","hired"].includes(c.status)).length },
    { stage: "Interview", count: jobCandidates.filter(c => ["interview","offer","hired"].includes(c.status)).length },
    { stage: "Offer", count: jobCandidates.filter(c => ["offer","hired"].includes(c.status)).length },
    { stage: "Hired", count: jobCandidates.filter(c => c.status === "hired").length },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">AI Recruitment — ATS</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {selectedJob?.title ?? "No active jobs"} — {selectedJob?.location ?? ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-primary" />
            <span className="text-xs text-muted-foreground">AI-powered screening active</span>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="size-3.5" />
            New Candidate
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 text-primary animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {/* Left */}
          <div className="flex flex-col gap-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-foreground">Job Requirements</CardTitle>
                <CardDescription className="text-xs">{selectedJob?.title ?? "—"}</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedJob?.requirements ? (
                  <div className="flex flex-col gap-2.5">
                    {Object.entries(selectedJob.requirements).map(([key, value]) => {
                      const icons: Record<string, any> = { license_class: Truck, exp_years: Award, hazmat: Shield, medical: CheckCircle2, location: MapPin, start_date: Clock }
                      const Icon = icons[key] ?? Award
                      return (
                        <div key={key} className="flex items-center gap-2.5">
                          <Icon className="size-3.5 text-primary shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                            <span className="text-xs text-foreground">{String(value)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No requirements set</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-foreground">Hiring Pipeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {pipeline.map((stage) => (
                    <div key={stage.stage}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{stage.stage}</span>
                        <span className="text-xs text-foreground font-medium">{stage.count}</span>
                      </div>
                      <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${jobCandidates.length > 0 ? (stage.count / jobCandidates.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Center */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-foreground">Candidates</p>
              <Badge variant="secondary" className="text-xs">{jobCandidates.length} total</Badge>
            </div>
            {jobCandidates.length === 0 ? (
              <Card className="border-border bg-card">
                <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
                  <Bot className="size-8 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground text-center">No candidates yet</p>
                  <button onClick={() => setShowModal(true)} className="text-xs text-primary hover:underline">Add first candidate</button>
                </CardContent>
              </Card>
            ) : (
              jobCandidates.map((c) => (
                <Card key={c.id}
                  className={`border-border cursor-pointer transition-colors ${selectedCandidate?.id === c.id ? "bg-secondary/60 border-primary/30" : "bg-card hover:bg-secondary/30"}`}
                  onClick={() => setSelectedCandidate(c)}
                >
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start gap-3">
                      <Avatar className="size-10 shrink-0">
                        <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                          {c.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-foreground truncate">{c.full_name}</p>
                          <ScoreRing score={c.match_score} />
                        </div>
                        <p className="text-[10px] text-muted-foreground">{c.exp_years} yrs exp • {c.location}</p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <Badge variant="secondary" className={`text-[10px] ${
                            c.status === "hired" ? "bg-chart-3/15 text-chart-3" :
                            c.status === "shortlisted" ? "bg-primary/15 text-primary" :
                            c.status === "rejected" ? "bg-destructive/15 text-destructive" :
                            "bg-secondary text-secondary-foreground"
                          }`}>{c.status.replace("_", " ")}</Badge>
                          {c.red_flags?.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] bg-destructive/15 text-destructive">
                              {c.red_flags.length} flag{c.red_flags.length > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Right */}
          {selectedCandidate ? (
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-medium text-foreground">{selectedCandidate.full_name}</CardTitle>
                    <CardDescription className="text-xs">{selectedJob?.title}</CardDescription>
                  </div>
                  <ScoreRing score={selectedCandidate.match_score} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { label: "Expected Salary", value: selectedCandidate.salary_expect },
                    { label: "Availability", value: selectedCandidate.availability },
                    { label: "Experience", value: `${selectedCandidate.exp_years} years` },
                    { label: "Location", value: selectedCandidate.location },
                  ].map((f) => (
                    <div key={f.label} className="bg-secondary/50 rounded-lg px-2.5 py-2">
                      <p className="text-[10px] text-muted-foreground">{f.label}</p>
                      <p className="text-xs font-medium text-foreground mt-0.5">{f.value ?? "—"}</p>
                    </div>
                  ))}
                </div>

                {selectedCandidate.skills && Object.keys(selectedCandidate.skills).length > 0 && (
                  <>
                    <Separator className="my-3" />
                    <p className="text-xs font-medium text-foreground mb-2">Requirements Match</p>
                    <div className="flex flex-col gap-2 mb-4">
                      {Object.entries(selectedCandidate.skills).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{skillLabels[key] ?? key}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-foreground">
                              {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
                            </span>
                            <CheckCircle2 className="size-3.5 text-chart-3 shrink-0" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <Separator className="my-3" />

                <div className="rounded-lg bg-primary/8 border border-primary/15 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Bot className="size-3.5 text-primary" />
                    <span className="text-xs font-medium text-primary">AI Screening Summary</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{selectedCandidate.ai_summary}</p>
                </div>

                {selectedCandidate.red_flags?.length > 0 && (
                  <div className="mt-3 rounded-lg bg-destructive/8 border border-destructive/15 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="size-3.5 text-destructive" />
                      <span className="text-xs font-medium text-destructive">Flags</span>
                    </div>
                    {selectedCandidate.red_flags.map((f) => (
                      <p key={f} className="text-[11px] text-destructive/80">• {f}</p>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  {!["shortlisted","hired","rejected"].includes(selectedCandidate.status) && (
                    <button onClick={() => updateStatus(selectedCandidate.id, "shortlisted")}
                      className="flex-1 py-2 text-xs rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
                      Shortlist
                    </button>
                  )}
                  {selectedCandidate.status === "shortlisted" && (
                    <button onClick={() => updateStatus(selectedCandidate.id, "interview")}
                      className="flex-1 py-2 text-xs rounded-lg bg-chart-3/15 text-chart-3 font-medium hover:bg-chart-3/25 transition-colors">
                      Schedule Interview
                    </button>
                  )}
                  {selectedCandidate.status === "interview" && (
                    <button onClick={() => updateStatus(selectedCandidate.id, "hired")}
                      className="flex-1 py-2 text-xs rounded-lg bg-chart-3/15 text-chart-3 font-medium hover:bg-chart-3/25 transition-colors">
                      Mark Hired
                    </button>
                  )}
                  {!["rejected","hired"].includes(selectedCandidate.status) && (
                    <button onClick={() => updateStatus(selectedCandidate.id, "rejected")}
                      className="flex-1 py-2 text-xs rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                      Reject
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border bg-card flex items-center justify-center">
              <CardContent className="py-12 text-center">
                <p className="text-xs text-muted-foreground">Select a candidate to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-foreground">New Candidate</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Paste CV text for AI analysis</p>
              </div>
              <button onClick={closeModal}><X className="size-4 text-muted-foreground hover:text-foreground" /></button>
            </div>

            <div className="flex-1 overflow-auto p-5 flex flex-col gap-4">
              {!analyzed ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-muted-foreground">Job Position</label>
                    <select
                      value={selectedJob?.id ?? ""}
                      onChange={(e) => setSelectedJob(jobs.find(j => j.id === e.target.value) ?? null)}
                      className="bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none"
                    >
                      {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-muted-foreground">CV Text</label>
                    <textarea
                      value={cvText}
                      onChange={(e) => setCvText(e.target.value)}
                      placeholder="Paste the candidate's CV text here..."
                      rows={10}
                      className="bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none focus:border-primary transition-colors"
                    />
                  </div>

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
                    className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {analyzing ? <><Loader2 className="size-4 animate-spin" /> Analyzing...</> : <><Bot className="size-4" /> Analyze with AI</>}
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
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
                        <p className="text-xs font-medium text-foreground">{f.value}</p>
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
                        <span className="text-xs font-medium text-destructive">Flags</span>
                      </div>
                      {analyzed.red_flags.map((f: string) => (
                        <p key={f} className="text-[11px] text-destructive/80">• {f}</p>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => setAnalyzed(null)}
                      className="flex-1 py-2 text-xs rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                      Re-analyze
                    </button>
                    <button onClick={saveCandidate} disabled={saving}
                      className="flex-1 py-2 text-xs rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                      {saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                      Save Candidate
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
