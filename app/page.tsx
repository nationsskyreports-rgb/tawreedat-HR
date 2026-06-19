"use client"

import { useState, useRef, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { OverviewTab } from "@/components/overview-tab"
import { CheckinTab } from "@/components/checkin-tab"
import { ProfitabilityTab } from "@/components/profitability-tab"
import { ATSTab } from "@/components/ats-tab"
import { RoadmapTab } from "@/components/roadmap-tab"
import { EmployeesTab } from "@/components/employees-tab"
import { ProjectsTab } from "@/components/projects-tab"
import { SchedulingTab } from "@/components/scheduling-tab"
import { SettingsTab } from "@/components/settings-tab"
import { Bell, Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const alerts = [
  { type: "License Expiry", count: 23, urgency: "high" },
  { type: "Medical Check Overdue", count: 11, urgency: "high" },
  { type: "Face Match Flagged", count: 7, urgency: "medium" },
  { type: "Pending Shift Swaps", count: 34, urgency: "low" },
  { type: "Leave Requests", count: 89, urgency: "low" },
]

export default function Page() {
  const [activeTab, setActiveTab] = useState("overview")
  const [showNotifications, setShowNotifications] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const tabContent: Record<string, React.ReactNode> = {
    overview: <OverviewTab />,
    checkin: <CheckinTab />,
    profitability: <ProfitabilityTab />,
    ats: <ATSTab />,
    roadmap: <RoadmapTab />,
    employees: <EmployeesTab />,
    projects: <ProjectsTab />,
    scheduling: <SchedulingTab />,
    settings: <SettingsTab />,
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-sidebar shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-secondary/60 rounded-lg px-3 py-1.5">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search employees, projects..."
                className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none w-52"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">EGY-CAI — Q4 2024</span>
            <div className="relative" ref={notifRef}>
              <button onClick={() => setShowNotifications(!showNotifications)} className="relative">
                <Bell className="size-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
                <div className="absolute -top-1 -right-1 size-3 bg-destructive rounded-full flex items-center justify-center">
                  <span className="text-[8px] text-white font-bold">4</span>
                </div>
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-8 w-72 bg-card border border-border rounded-xl shadow-2xl z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="text-xs font-medium text-foreground">Active Alerts</span>
                    <button onClick={() => setShowNotifications(false)}>
                      <X className="size-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                  <div className="flex flex-col py-2">
                    {alerts.map((alert) => (
                      <div key={alert.type} className="flex items-center justify-between px-4 py-2.5 hover:bg-secondary/50 transition-colors">
                        <span className="text-xs text-muted-foreground">{alert.type}</span>
                        <Badge variant="secondary" className={`text-xs ${
                          alert.urgency === "high" ? "bg-destructive/15 text-destructive" :
                          alert.urgency === "medium" ? "bg-primary/15 text-primary" :
                          "bg-secondary text-secondary-foreground"
                        }`}>{alert.count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-[10px] font-semibold text-primary">NE</span>
              </div>
              <span className="text-xs text-foreground">Nadia El-Masry</span>
            </div>
          </div>
        </header>

        <div className="flex items-center gap-1 px-6 py-2 border-b border-border/50 bg-sidebar/60 shrink-0 overflow-x-auto">
          {[
            { id: "overview", label: "Command Center" },
            { id: "checkin", label: "Field Check-In" },
            { id: "profitability", label: "Project P&L" },
            { id: "ats", label: "AI Recruitment" },
            { id: "roadmap", label: "Roadmap" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors ${
                activeTab === t.id
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="text-[10px] bg-chart-3/10 text-chart-3">
              MVP Live — Phase 2
            </Badge>
          </div>
        </div>

        <main className="flex-1 overflow-auto p-6">
          {tabContent[activeTab] ?? tabContent["roadmap"]}
        </main>
      </div>
    </div>
  )
}
