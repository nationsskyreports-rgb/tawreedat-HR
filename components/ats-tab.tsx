"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Bot, Star, CheckCircle2, XCircle, AlertTriangle, FileText,
  MapPin, Clock, Truck, Shield, Award, ChevronRight, User
} from "lucide-react"

const candidates = [
  {
    id: "C-001",
    name: "Ahmed Hassan Mahmoud",
    initials: "AH",
    position: "Senior Heavy Vehicle Driver",
    exp_years: 8,
    location: "Cairo, Egypt",
    match_score: 94,
    status: "shortlisted",
    applied: "2 days ago",
    skills: {
      license_class: { value: "D+E", required: "D", match: true },
      years_exp: { value: 8, required: 5, match: true },
      hazmat: { value: true, required: true, match: true },
      medical: { value: "Fit (2024)", required: "Current", match: true },
      gps_exp: { value: true, required: false, match: true },
      arabic: { value: true, required: true, match: true },
    },
    ai_summary: "Strong candidate. 8 years cross-governorate experience with Class D+E license. Hazmat certified. Clean driving record — 0 incidents in last 3 years. Previous employer confirms punctuality rate of 97.4%.",
    red_flags: [],
    salary_expect: "EGP 8,500/mo",
    availability: "Immediate",
  },
  {
    id: "C-002",
    name: "Mohamed Ibrahim Ali",
    initials: "MI",
    position: "Senior Heavy Vehicle Driver",
    exp_years: 6,
    location: "Giza, Egypt",
    match_score: 78,
    status: "in_review",
    applied: "3 days ago",
    skills: {
      license_class: { value: "D", required: "D", match: true },
      years_exp: { value: 6, required: 5, match: true },
      hazmat: { value: false, required: true, match: false },
      medical: { value: "Fit (2023)", required: "Current", match: false },
      gps_exp: { value: true, required: false, match: true },
      arabic: { value: true, required: true, match: true },
    },
    ai_summary: "Adequate experience with valid Class D license. Missing Hazmat certification — would need 2-week training. Medical check expired 8 months ago. Strong GPS tracking system familiarity.",
    red_flags: ["Hazmat cert missing", "Medical check overdue"],
    salary_expect: "EGP 7,200/mo",
    availability: "2 weeks notice",
  },
  {
    id: "C-003",
    name: "Khaled Mostafa Nour",
    initials: "KM",
    position: "Senior Heavy Vehicle Driver",
    exp_years: 12,
    location: "Alexandria, Egypt",
    match_score: 88,
    status: "shortlisted",
    applied: "1 day ago",
    skills: {
      license_class: { value: "D+E", required: "D", match: true },
      years_exp: { value: 12, required: 5, match: true },
      hazmat: { value: true, required: true, match: true },
      medical: { value: "Fit (2024)", required: "Current", match: true },
      gps_exp: { value: false, required: false, match: false },
      arabic: { value: true, required: true, match: true },
    },
    ai_summary: "Highly experienced with 12 years logistics driving. D+E license, Hazmat certified. Based in Alexandria — commute to Cairo may be a concern. No modern GPS/TMS experience but trainable.",
    red_flags: ["Alexandria-based (relocation needed)"],
    salary_expect: "EGP 9,800/mo",
    availability: "1 month notice",
  },
]

const jobRequirements = [
  { label: "License Class", value: "Class D (minimum)", icon: Truck },
  { label: "Experience", value: "5+ years HGV", icon: Award },
  { label: "Hazmat Cert", value: "Required", icon: Shield },
  { label: "Medical", value: "Current (2024)", icon: CheckCircle2 },
  { label: "Location", value: "Cairo / Greater Cairo", icon: MapPin },
  { label: "Start Date", value: "Immediate preferred", icon: Clock },
]

const pipeline = [
  { stage: "Applied", count: 47, color: "bg-muted-foreground" },
  { stage: "AI Screened", count: 31, color: "bg-chart-2" },
  { stage: "Shortlisted", count: 12, color: "bg-primary" },
  { stage: "Interview", count: 5, color: "bg-chart-3" },
  { stage: "Offer", count: 2, color: "bg-chart-3" },
  { stage: "Hired", count: 0, color: "bg-chart-3" },
]

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
          <circle
            cx="28" cy="28" r="22" fill="none" strokeWidth="4"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round"
            className={`${ringColor} transition-all duration-700`}
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

export function ATSTab() {
  const [selectedCandidate, setSelectedCandidate] = useState(candidates[0])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">AI Recruitment — ATS</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Senior Heavy Vehicle Driver — Cairo Region</p>
        </div>
        <div className="flex items-center gap-2">
          <Bot className="size-4 text-primary" />
          <span className="text-xs text-muted-foreground">AI-powered screening active</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Left: Job + Pipeline */}
        <div className="flex flex-col gap-4">
          {/* Job Requirements */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground">Job Requirements</CardTitle>
              <CardDescription className="text-xs">JD-2024-DRV-SENIOR-001</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2.5">
                {jobRequirements.map((req) => {
                  const Icon = req.icon
                  return (
                    <div key={req.label} className="flex items-center gap-2.5">
                      <Icon className="size-3.5 text-primary shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] text-muted-foreground">{req.label}</span>
                        <span className="text-xs text-foreground">{req.value}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Pipeline Funnel */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground">Hiring Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {pipeline.map((stage, i) => (
                  <div key={stage.stage}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{stage.stage}</span>
                      <span className="text-xs text-foreground font-medium">{stage.count}</span>
                    </div>
                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${stage.color}`}
                        style={{ width: `${(stage.count / 47) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center: Candidate List */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">Shortlisted Candidates</p>
            <Badge variant="secondary" className="text-xs">3 of 12</Badge>
          </div>
          {candidates.map((c) => (
            <Card
              key={c.id}
              className={`border-border cursor-pointer transition-colors ${selectedCandidate.id === c.id ? "bg-secondary/60 border-primary/30" : "bg-card hover:bg-secondary/30"}`}
              onClick={() => setSelectedCandidate(c)}
            >
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start gap-3">
                  <Avatar className="size-10 shrink-0">
                    <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">{c.initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground truncate">{c.name}</p>
                      <ScoreRing score={c.match_score} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{c.exp_years} yrs exp • {c.location}</p>
                    <p className="text-[10px] text-muted-foreground">{c.applied}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${c.status === "shortlisted" ? "bg-chart-3/15 text-chart-3" : "bg-primary/15 text-primary"}`}
                      >
                        {c.status === "shortlisted" ? "Shortlisted" : "In Review"}
                      </Badge>
                      {c.red_flags.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] bg-destructive/15 text-destructive">
                          {c.red_flags.length} flag{c.red_flags.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Right: Candidate Detail + AI Analysis */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium text-foreground">{selectedCandidate.name}</CardTitle>
                <CardDescription className="text-xs">{selectedCandidate.position}</CardDescription>
              </div>
              <ScoreRing score={selectedCandidate.match_score} />
            </div>
          </CardHeader>
          <CardContent>
            {/* Quick facts */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { label: "Expected Salary", value: selectedCandidate.salary_expect },
                { label: "Availability", value: selectedCandidate.availability },
                { label: "Experience", value: `${selectedCandidate.exp_years} years` },
                { label: "Location", value: selectedCandidate.location },
              ].map((f) => (
                <div key={f.label} className="bg-secondary/50 rounded-lg px-2.5 py-2">
                  <p className="text-[10px] text-muted-foreground">{f.label}</p>
                  <p className="text-xs font-medium text-foreground mt-0.5">{f.value}</p>
                </div>
              ))}
            </div>

            <Separator className="my-3" />

            {/* Skills Match Matrix */}
            <p className="text-xs font-medium text-foreground mb-2">Requirements Match</p>
            <div className="flex flex-col gap-2 mb-4">
              {Object.entries(selectedCandidate.skills).map(([key, skill]) => {
                const labels: Record<string, string> = {
                  license_class: "License Class",
                  years_exp: "Experience",
                  hazmat: "Hazmat Cert",
                  medical: "Medical Status",
                  gps_exp: "GPS/TMS Exp.",
                  arabic: "Arabic Language",
                }
                return (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{labels[key]}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-foreground">
                        {typeof skill.value === "boolean" ? (skill.value ? "Yes" : "No") : String(skill.value)}
                      </span>
                      {skill.match ? (
                        <CheckCircle2 className="size-3.5 text-chart-3 shrink-0" />
                      ) : (
                        <XCircle className="size-3.5 text-destructive shrink-0" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <Separator className="my-3" />

            {/* AI Summary */}
            <div className="rounded-lg bg-primary/8 border border-primary/15 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Bot className="size-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">AI Screening Summary</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{selectedCandidate.ai_summary}</p>
            </div>

            {/* Red Flags */}
            {selectedCandidate.red_flags.length > 0 && (
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

            {/* Actions */}
            <div className="flex gap-2 mt-4">
              <button className="flex-1 py-2 text-xs rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
                Schedule Interview
              </button>
              <button className="flex-1 py-2 text-xs rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                Reject
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
