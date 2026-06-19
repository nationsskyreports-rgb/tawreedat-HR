"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { OverviewTab } from "@/components/overview-tab"
import { CheckinTab } from "@/components/checkin-tab"
import { ProfitabilityTab } from "@/components/profitability-tab"
import { ATSTab } from "@/components/ats-tab"
import { RoadmapTab } from "@/components/roadmap-tab"
import { Bell, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const tabContent: Record<string, React.ReactNode> = {
  overview: <OverviewTab />,
  checkin: <CheckinTab />,
  profitability: <ProfitabilityTab />,
  ats: <ATSTab />,
  roadmap: <RoadmapTab />,
}

const placeholderTabs = ["payroll", "scheduling", "projects", "employees", "settings"]

export default function Page() {
  const [activeTab, setActiveTab] = useState("overview")

  const handleTabChange = (tab: string) => {
    if (placeholderTabs.includes(tab)) {
      setActiveTab("roadmap")
    } else {
      setActiveTab(tab)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
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
            <div className="relative">
              <Bell className="size-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
              <div className="absolute -top-1 -right-1 size-3 bg-destructive rounded-full flex items-center justify-center">
                <span className="text-[8px] text-white font-bold">4</span>
              </div>
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

        {/* Secondary nav — tab pills */}
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

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          {tabContent[activeTab] ?? tabContent["overview"]}
        </main>
      </div>
    </div>
  )
}
