"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2, Globe, Database } from "lucide-react"

const settingsSections = [
  {
    title: "Organization",
    icon: Building2,
    items: [
      { label: "Company Name", value: "Tawreedat" },
      { label: "Country", value: "Egypt" },
      { label: "Currency", value: "EGP — Egyptian Pound" },
      { label: "Timezone", value: "Africa/Cairo (GMT+2)" },
    ],
  },
  {
    title: "System",
    icon: Globe,
    items: [
      { label: "Language", value: "English" },
      { label: "Date Format", value: "DD/MM/YYYY" },
      { label: "Working Week", value: "Sunday – Thursday" },
      { label: "Weekend", value: "Friday – Saturday" },
    ],
  },
  {
    title: "Database",
    icon: Database,
    items: [
      { label: "Provider", value: "Supabase PostgreSQL" },
      { label: "Region", value: "AWS eu-central-1" },
      { label: "Status", value: "Connected ✓" },
    ],
  },
]

export function SettingsTab() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">System configuration and preferences</p>
        </div>
        <Badge variant="secondary" className="text-xs">v0.1.0 — MVP</Badge>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {settingsSections.map((section) => {
          const Icon = section.icon
          return (
            <Card key={section.title} className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Icon className="size-4 text-primary" />
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {section.items.map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                      <span className="text-xs text-foreground font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
