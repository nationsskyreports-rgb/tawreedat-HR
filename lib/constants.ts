/**
 * Shared UI constants used across multiple tabs.
 * Single source of truth — import from here instead of redefining locally.
 */
import { Shield, Truck, Package, MapPin, Monitor } from "lucide-react"
import type { EmployeeCategory, EmployeeStatus, AttendanceStatus, UserRole } from "@/lib/types"

// ── Month names ──────────────────────────────────────────────────────────────
export const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
] as const

// ── Employee category config ─────────────────────────────────────────────────
export const CATEGORY_CONFIG: Record<EmployeeCategory, {
  label: string; color: string; icon: typeof Truck
}> = {
  driver:     { label: "Driver",     color: "bg-chart-1/15 text-chart-1",        icon: Truck   },
  warehouse:  { label: "Warehouse",  color: "bg-chart-2/15 text-chart-2",        icon: Package },
  field_ops:  { label: "Field Ops",  color: "bg-chart-3/15 text-chart-3",        icon: MapPin  },
  office:     { label: "Office",     color: "bg-primary/15 text-primary",        icon: Monitor },
  supervisor: { label: "Supervisor", color: "bg-destructive/15 text-destructive", icon: Shield  },
}

// ── Employee status config ───────────────────────────────────────────────────
export const STATUS_CONFIG: Record<EmployeeStatus, { label: string; color: string }> = {
  active:     { label: "Active",     color: "bg-chart-3/15 text-chart-3"              },
  on_leave:   { label: "On Leave",   color: "bg-primary/15 text-primary"              },
  suspended:  { label: "Suspended",  color: "bg-destructive/15 text-destructive"      },
  terminated: { label: "Terminated", color: "bg-destructive/15 text-destructive"      },
  resigned:   { label: "Resigned",   color: "bg-secondary text-secondary-foreground"  },
}

// ── Attendance status colours ────────────────────────────────────────────────
export const ATTENDANCE_COLORS: Record<AttendanceStatus, string> = {
  present:  "bg-chart-3/15 text-chart-3",
  late:     "bg-primary/15 text-primary",
  absent:   "bg-destructive/15 text-destructive",
  on_leave: "bg-chart-2/15 text-chart-2",
  holiday:  "bg-secondary text-secondary-foreground",
  half_day: "bg-chart-4/15 text-chart-4",
}

// ── Role config (used by Settings + Sidebar) ─────────────────────────────────
export const ROLE_CONFIG: Record<UserRole, { label: string; color: string }> = {
  admin:    { label: "Admin",    color: "bg-destructive/15 text-destructive" },
  hr:       { label: "HR",       color: "bg-chart-3/15 text-chart-3"        },
  manager:  { label: "Manager",  color: "bg-primary/15 text-primary"        },
  employee: { label: "Employee", color: "bg-secondary text-secondary-foreground" },
}

// ── Time formatting ───────────────────────────────────────────────────────────
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
