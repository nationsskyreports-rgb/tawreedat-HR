"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock } from "lucide-react"

export function SchedulingTab() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Shift Roster</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Shift scheduling and roster management</p>
        </div>
        <Badge variant="secondary" className="text-xs bg-primary/15 text-primary">Phase 2</Badge>
      </div>
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Calendar className="size-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Shift Roster coming in Phase 2</p>
            <p className="text-xs text-muted-foreground mt-1">Automated scheduling, swap requests, and overtime tracking</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            <span>Estimated: Weeks 7–14</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
