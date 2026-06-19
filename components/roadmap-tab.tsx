"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  CheckCircle2, Clock, Circle, Users, MapPin, DollarSign,
  Bot, BarChart3, Zap, Shield, Globe, TrendingUp, ChevronDown, ChevronRight
} from "lucide-react"

const phases = [
  {
    id: 1,
    title: "Phase 1 — Core HR & Authentication",
    weeks: "Weeks 1–6",
    duration: 6,
    status: "complete",
    businessValue: "Digital employee records replace paper. HR team gains full visibility into 10,000-worker roster in a single system. Foundation for all future modules.",
    roi: "Eliminate EGP 180K/yr in paper admin costs",
    features: [
      { label: "Multi-tenant role-based auth (HR Admin, Field Supervisor, Worker, Finance)", done: true },
      { label: "Employee master data (personal, contract, bank, documents)", done: true },
      { label: "Organizational hierarchy — project > cost center > team", done: true },
      { label: "Document vault (visas, IDs, licenses) with expiry alerts", done: true },
      { label: "Arabic + English bilingual UI (RTL support)", done: true },
      { label: "Mobile-responsive Progressive Web App foundation", done: true },
    ],
    tech: ["Next.js 16", "Neon PostgreSQL", "Better Auth", "Drizzle ORM", "Tailwind CSS v4"],
    color: "text-chart-3",
    bg: "bg-chart-3/10",
    borderColor: "border-chart-3/30",
  },
  {
    id: 2,
    title: "Phase 2 — Field Attendance & Payroll Engine",
    weeks: "Weeks 7–14",
    duration: 8,
    status: "in_progress",
    businessValue: "Real-time geofenced attendance eliminates buddy-punching. Automated payroll reduces HR workload by 40%. Direct integration with Egyptian labor law and GOSI compliance.",
    roi: "Prevent EGP 2.4M/yr in ghost-worker fraud",
    features: [
      { label: "GPS geofencing attendance (200m radius, configurable per site)", done: true },
      { label: "Face recognition anti-spoofing via mobile selfie (confidence scoring)", done: true },
      { label: "Multi-site live dashboard with real-time check-in streams", done: true },
      { label: "Payroll engine: regular pay, overtime (125%/150%), night shift premiums", done: false },
      { label: "Egyptian labor law compliance: Form 1, 6, 2 digital generation", done: false },
      { label: "WPS-ready bank transfer files (Egyptian Central Bank format)", done: false },
      { label: "Payslip PDF generation in Arabic + English", done: false },
    ],
    tech: ["Google Maps Geofencing API", "AWS Rekognition", "Vercel Edge Functions", "Stripe (WPS)"],
    color: "text-primary",
    bg: "bg-primary/10",
    borderColor: "border-primary/30",
  },
  {
    id: 3,
    title: "Phase 3 — Project Profitability & Supply Contracts",
    weeks: "Weeks 15–22",
    duration: 8,
    status: "planned",
    businessValue: "Real-time project P&L gives ops directors live margin visibility. Finance can renegotiate supply contracts with actual data. Stops cost overruns before they hit 120%.",
    roi: "Recover EGP 4.1M/yr from undetected overruns",
    features: [
      { label: "Project-cost-center labor allocation (auto from attendance data)", done: false },
      { label: "Supply contract revenue tracker: billable vs actual vs budget", done: false },
      { label: "Project P&L dashboard: margin per project, per client, per job type", done: false },
      { label: "Hour-type breakdown: regular, OT, night, holiday with loaded costs", done: false },
      { label: "Budget burn alerts (notify at 80%, 95%, 105% thresholds)", done: false },
      { label: "BI reports: export to Excel / PDF, scheduled email delivery", done: false },
      { label: "API integration with SAP ERP / Oracle Finance for GL sync", done: false },
    ],
    tech: ["Recharts", "tRPC", "Zod", "SAP BAPI connectors", "Vercel Cron Jobs"],
    color: "text-chart-2",
    bg: "bg-chart-2/10",
    borderColor: "border-chart-2/30",
  },
  {
    id: 4,
    title: "Phase 4 — AI ATS & Predictive Analytics",
    weeks: "Weeks 23–32",
    duration: 10,
    status: "planned",
    businessValue: "AI screening cuts time-to-hire from 18 days to 4 days. Predictive churn analytics retain top drivers. Platform becomes the most advanced logistics HR tool in the MENA region.",
    roi: "Save EGP 1.8M/yr in recruitment agency fees",
    features: [
      { label: "AI CV parser: Arabic/English, extracts license class, exp, certifications", done: false },
      { label: "Smart Match Score: weighted KPI scoring vs job requirements", done: false },
      { label: "Driver-specific screening: license validity API (Traffic Authority)", done: false },
      { label: "Churn prediction model: flag high-risk employees 60 days in advance", done: false },
      { label: "AI scheduling optimization: min OT cost, max coverage per shift", done: false },
      { label: "WhatsApp notifications: shifts, payslips, leave approvals (Arabic)", done: false },
      { label: "Multi-country payroll: Egypt, KSA, UAE labor law modules", done: false },
    ],
    tech: ["Vercel AI SDK", "OpenAI GPT-4", "Python ML service", "WhatsApp Business API", "Vercel Blob"],
    color: "text-chart-1",
    bg: "bg-chart-1/10",
    borderColor: "border-chart-1/30",
  },
]

type FeatureValue = boolean | "partial"

const competitors: { feature: string; zenhr: FeatureValue; ukg: FeatureValue; tawreedat: FeatureValue }[] = [
  { feature: "Geofenced Attendance (Arabic UX)", zenhr: false, ukg: "partial", tawreedat: true },
  { feature: "Project-level Labor P&L", zenhr: false, ukg: false, tawreedat: true },
  { feature: "Egyptian Labor Law Forms (1, 6, 2)", zenhr: "partial", ukg: false, tawreedat: true },
  { feature: "AI ATS with Driver License Validation", zenhr: false, ukg: false, tawreedat: true },
  { feature: "Supply Contract Revenue Tracking", zenhr: false, ukg: false, tawreedat: true },
  { feature: "WPS Bank File Generation", zenhr: true, ukg: false, tawreedat: true },
  { feature: "Multi-country MENA Payroll", zenhr: true, ukg: "partial", tawreedat: true },
  { feature: "Face Recognition Anti-Spoofing", zenhr: false, ukg: false, tawreedat: true },
  { feature: "Churn Prediction AI", zenhr: false, ukg: "partial", tawreedat: true },
  { feature: "WhatsApp Payslip Delivery", zenhr: false, ukg: false, tawreedat: true },
]

function FeatureCheck({ value }: { value: boolean | "partial" }) {
  if (value === true) return <CheckCircle2 className="size-4 text-chart-3 mx-auto" />
  if (value === "partial") return <span className="text-xs text-primary mx-auto block text-center">Partial</span>
  return <XIcon />
}

function XIcon() {
  return (
    <svg className="size-4 text-destructive/60 mx-auto" viewBox="0 0 16 16" fill="none">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function RoadmapTab() {
  const [expanded, setExpanded] = useState<number | null>(1)

  const totalWeeks = 32
  const currentWeek = 11

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Implementation Roadmap</h1>
          <p className="text-sm text-muted-foreground mt-0.5">MVP to Full Launch — 32-week delivery plan</p>
        </div>
        <Badge className="bg-primary/15 text-primary border-0 text-xs">Week {currentWeek} of {totalWeeks}</Badge>
      </div>

      {/* Progress Bar */}
      <Card className="border-border bg-card">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-foreground">Overall Progress</p>
            <p className="text-xs text-muted-foreground">{Math.round((currentWeek / totalWeeks) * 100)}% complete</p>
          </div>
          <Progress value={(currentWeek / totalWeeks) * 100} className="h-2" />
          <div className="grid grid-cols-4 mt-3 gap-0">
            {phases.map((p) => (
              <div key={p.id} className="flex flex-col items-center text-center gap-1">
                <span className="text-[10px] text-muted-foreground">Phase {p.id}</span>
                <Badge
                  variant="secondary"
                  className={`text-[10px] ${
                    p.status === "complete" ? "bg-chart-3/15 text-chart-3" :
                    p.status === "in_progress" ? "bg-primary/15 text-primary" :
                    "bg-secondary text-muted-foreground"
                  }`}
                >
                  {p.status === "complete" ? "Done" : p.status === "in_progress" ? "Active" : "Planned"}
                </Badge>
                <span className="text-[10px] text-muted-foreground">{p.weeks}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Phase Cards */}
      <div className="flex flex-col gap-3">
        {phases.map((phase) => {
          const isExpanded = expanded === phase.id
          const doneCount = phase.features.filter((f) => f.done).length
          const totalCount = phase.features.length
          const pct = Math.round((doneCount / totalCount) * 100)

          return (
            <Card
              key={phase.id}
              className={`border bg-card transition-all ${phase.borderColor}`}
            >
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                onClick={() => setExpanded(isExpanded ? null : phase.id)}
              >
                <div className={`p-2.5 rounded-lg ${phase.bg} shrink-0`}>
                  {phase.status === "complete" ? (
                    <CheckCircle2 className={`size-5 ${phase.color}`} />
                  ) : phase.status === "in_progress" ? (
                    <Clock className={`size-5 ${phase.color}`} />
                  ) : (
                    <Circle className={`size-5 ${phase.color}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-foreground">{phase.title}</p>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${
                        phase.status === "complete" ? "bg-chart-3/15 text-chart-3" :
                        phase.status === "in_progress" ? "bg-primary/15 text-primary" :
                        "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {phase.weeks}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <Progress value={pct} className="w-32 h-1.5" />
                    <span className="text-xs text-muted-foreground">{doneCount}/{totalCount} features</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">ROI</p>
                    <p className={`text-xs font-semibold ${phase.color}`}>{phase.roi.split(":")[1]?.trim() || phase.roi}</p>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="px-5 pb-5 border-t border-border">
                  <div className="grid grid-cols-2 gap-6 pt-4">
                    {/* Features */}
                    <div>
                      <p className="text-xs font-medium text-foreground mb-3">Key Features Delivered</p>
                      <div className="flex flex-col gap-2">
                        {phase.features.map((f) => (
                          <div key={f.label} className="flex items-start gap-2">
                            {f.done ? (
                              <CheckCircle2 className="size-3.5 text-chart-3 mt-0.5 shrink-0" />
                            ) : (
                              <Circle className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            )}
                            <span className={`text-xs leading-relaxed ${f.done ? "text-foreground" : "text-muted-foreground"}`}>
                              {f.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Business Value + Tech */}
                    <div className="flex flex-col gap-4">
                      <div>
                        <p className="text-xs font-medium text-foreground mb-2">Business Value</p>
                        <div className={`rounded-lg ${phase.bg} border ${phase.borderColor} p-3`}>
                          <p className="text-xs text-muted-foreground leading-relaxed">{phase.businessValue}</p>
                          <p className={`text-xs font-semibold mt-2 ${phase.color}`}>{phase.roi}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground mb-2">Technology Stack</p>
                        <div className="flex flex-wrap gap-1.5">
                          {phase.tech.map((t) => (
                            <Badge key={t} variant="secondary" className="text-[10px] font-normal">{t}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Competitive Analysis */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium text-foreground">Competitive Landscape</CardTitle>
              <CardDescription className="text-xs">Tawreedat vs ZenHR vs UKG — Logistics Sector</CardDescription>
            </div>
            <Badge className="bg-chart-3/15 text-chart-3 border-0 text-xs">10/10 advantages</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-muted-foreground font-medium pb-2 pr-4 w-72">Feature / Capability</th>
                  <th className="text-center text-muted-foreground font-medium pb-2 w-24">ZenHR</th>
                  <th className="text-center text-muted-foreground font-medium pb-2 w-24">UKG</th>
                  <th className="text-center text-primary font-semibold pb-2 w-28">Tawreedat</th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((row, i) => (
                  <tr key={row.feature} className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-secondary/20"}`}>
                    <td className="py-2.5 pr-4 text-foreground">{row.feature}</td>
                    <td className="py-2.5 text-center"><FeatureCheck value={row.zenhr} /></td>
                    <td className="py-2.5 text-center"><FeatureCheck value={row.ukg} /></td>
                    <td className="py-2.5 text-center"><FeatureCheck value={row.tawreedat} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 rounded-lg bg-primary/8 border border-primary/15 p-4">
            <div className="flex items-start gap-3">
              <TrendingUp className="size-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">Why Tawreedat Wins in Logistics</p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  ZenHR and UKG are generic HCM platforms retrofitted for the region — neither understands the DNA of logistics workforce management. Tawreedat is purpose-built for the realities of blue-collar logistics operations in Egypt and the Gulf: <span className="text-foreground">geofenced check-ins without smartphones</span>, <span className="text-foreground">project-level labor P&L</span> that maps directly to supply contracts, <span className="text-foreground">driver license and medical expiry tracking</span> integrated with Egyptian traffic authority APIs, and <span className="text-foreground">Arabic-first mobile UX</span> that field workers actually use. No consultant required, no 18-month SAP implementation. Full ROI in 4 months.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
