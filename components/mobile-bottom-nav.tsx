"use client"

import { useRouter, usePathname } from "next/navigation"
import { Home, MapPin, ClipboardList, CalendarCheck, User } from "lucide-react"

export function MobileBottomNav() {
  const router = useRouter()
  const pathname = usePathname()

  const items = [
    { href: "/m",            label: "Home",       icon: Home },
    { href: "/m/checkin",    label: "Check-In",   icon: MapPin },
    { href: "/m/attendance", label: "Attendance", icon: ClipboardList },
    { href: "/m/leave",      label: "Leave",      icon: CalendarCheck },
    { href: "/m/profile",    label: "Profile",    icon: User },
  ]

  return (
    <nav
      className="shrink-0 bg-card border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5">
        {items.map(item => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className="flex flex-col items-center justify-center py-2 gap-0.5 active:bg-secondary/30 transition-colors"
            >
              <Icon className={`size-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-[10px] ${isActive ? "text-primary font-medium" : "text-muted-foreground"}`}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
