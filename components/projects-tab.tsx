"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FolderKanban, Clock } from "lucide-react"

export function ProjectsTab() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Project management and cost tracking</p>
        </div>
        <Badge variant="secondary" className="text-xs bg-primary/15 text-primary">Phase 3</Badge>
      </div>
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <FolderKanban className="size-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Projects module coming in Phase 3</p>
            <p className="text-xs text-muted-foreground mt-1">Project P&L, cost tracking, and labor allocation</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            <span>Estimated: Weeks 15–22</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
