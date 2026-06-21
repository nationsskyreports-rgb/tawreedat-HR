"use client"

import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  LayoutDashboard,
  MapPin,
  DollarSign,
  FolderKanban,
  Calendar,
  CalendarCheck,
  Users,
  Bot,
  BarChart3,
  Settings,
  ChevronRight,
  Megaphone,
  FileText,
  PartyPopper,
  Star,
  Truck,
} from "lucide-react"
import { LogoutButton } from "@/components/logout-button"

interface SidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const navItems = [
  { id: "overview",      label: "Overview",        icon: LayoutDashboard },
  { id: "checkin",       label: "Field Check-In",  icon: MapPin },
  { id: "profitability", label: "Project P&L",     icon: BarChart3 },
  { id: "ats",           label: "AI Recruitment",  icon: Bot },
  { id: "payroll",       label: "Payroll",         icon: DollarSign },
  { id: "leaves",        label: "Leaves",          icon: CalendarCheck },
  { id: "scheduling",    label: "Shift Roster",    icon: Calendar },
  { id: "reports",       label: "Reports",         icon: BarChart3 },
  { id: "announcements", label: "Announcements",   icon: Megaphone },
  { id: "documents",     label: "Documents",       icon: FileText },
  { id: "holidays",      label: "Holidays",        icon: PartyPopper },
  { id: "performance",   label: "Performance",     icon: Star },
  { id: "projects",      label: "Projects",        icon: FolderKanban },
  { id: "employees",     label: "Employees",       icon: Users },
]

const bottomItems = [
  { id: "settings", label: "Settings", icon: Settings },
]

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
    })
  }, [])

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-sidebar border-r border-border shrink-0">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="flex items-center justify-center size-9 rounded-lg bg-primary">
          <Truck className="size-5 text-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground leading-tight">Tawreedat</span>
          <span className="text-xs text-muted-foreground leading-tight">HRIS Platform</span>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 py-4 flex-1 overflow-y-auto">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 mb-2">
          Modules
        </p>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors w-full text-left",
                isActive
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {isActive && <ChevronRight className="size-3 ml-auto shrink-0 text-primary" />}
            </button>
          )
        })}
      </nav>

      <div className="px-3 pb-4 border-t border-border pt-3">
        {bottomItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors w-full text-left"
            >
              <Icon className="size-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          )
        })}
        <div className="flex items-center gap-3 px-3 py-2 mt-2">
          <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-primary">
              {userEmail?.charAt(0).toUpperCase() ?? "?"}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-foreground truncate">
              {userEmail ?? "..."}
            </span>
            <span className="text-xs text-muted-foreground truncate">HR Admin</span>
          </div>
        </div>
        <LogoutButton />
      </div>
    </aside>
  )
}
