"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingUp, TrendingDown, DollarSign, Users, Clock, BarChart3 } from "lucide-react"
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, AreaChart, Area, Cell
} from "recharts"

const projects = [
  {
    id: "PROJ-2024-SUEZ-01",
    name: "Suez Canal Corridor Logistics",
    client: "Egypt Ports Authority",
    type: "freight_forwarding",
    status: "active",
    contractValue: 14200000,
    budgetedLabor: 2800000,
    actualLabor: 2340000,
    budgetedHours: 18400,
    actualHours: 15200,
    billable: 3180000,
    headcount: 84,
    margin: 26.4,
    budgetUsed: 83.6,
  },
  {
    id: "PROJ-2024-CAIRO-LAST",
    name: "Cairo Metro Last-Mile Delivery",
    client: "E-Commerce Alliance",
    type: "last_mile_delivery",
    status: "active",
    contractValue: 8900000,
    budgetedLabor: 1900000,
    actualLabor: 2180000,
    budgetedHours: 12000,
    actualHours: 14100,
    billable: 2450000,
    headcount: 62,
    margin: 11.0,
    budgetUsed: 114.7,
  },
  {
    id: "PROJ-2024-10TH-WH",
    name: "10th of Ramadan Warehouse Ops",
    client: "Misr Industrial Zone",
    type: "warehousing_op",
    status: "active",
    contractValue: 6400000,
    budgetedLabor: 1200000,
    actualLabor: 980000,
    budgetedHours: 8800,
    actualHours: 7100,
    billable: 1440000,
    headcount: 41,
    margin: 31.9,
    budgetUsed: 81.7,
  },
  {
    id: "PROJ-2024-ALEX-PORT",
    name: "Alexandria Port Stevedoring",
    client: "Alexandria Container Terminal",
    type: "supply_contract",
    status: "active",
    contractValue: 11600000,
    budgetedLabor: 2400000,
    actualLabor: 2290000,
    budgetedHours: 15600,
    actualHours: 14800,
    billable: 2740000,
    headcount: 73,
    margin: 16.5,
    budgetUsed: 95.4,
  },
  {
    id: "PROJ-2024-KSA-FLEET",
    name: "KSA Cross-Border Fleet Ops",
    client: "Saudi Logistics Co.",
    type: "fleet_operation",
    status: "active",
    contractValue: 9200000,
    budgetedLabor: 2100000,
    actualLabor: 1760000,
    budgetedHours: 13200,
    actualHours: 11100,
    billable: 2520000,
    headcount: 56,
    margin: 30.2,
    budgetUsed: 83.8,
  },
]

const monthlyLaborData = [
  { month: "May", revenue: 3.2, laborCost: 2.1, overhead: 0.4, profit: 0.7 },
  { month: "Jun", revenue: 3.8, laborCost: 2.4, overhead: 0.5, profit: 0.9 },
  { month: "Jul", revenue: 4.1, laborCost: 2.6, overhead: 0.5, profit: 1.0 },
  { month: "Aug", revenue: 4.4, laborCost: 2.8, overhead: 0.6, profit: 1.0 },
  { month: "Sep", revenue: 4.8, laborCost: 3.0, overhead: 0.6, profit: 1.2 },
  { month: "Oct", revenue: 5.2, laborCost: 3.2, overhead: 0.7, profit: 1.3 },
]

const hourTypeBreakdown = [
  { type: "Regular", hours: 62400, cost: 3.12, color: "oklch(0.72 0.18 55)" },
  { type: "Overtime 125%", hours: 8200, cost: 0.61, color: "oklch(0.55 0.18 250)" },
  { type: "Night Shift", hours: 6800, cost: 0.54, color: "oklch(0.60 0.14 185)" },
  { type: "Holiday", hours: 1400, cost: 0.17, color: "oklch(0.62 0.22 25)" },
]

const kpis = [
  { label: "Total Contract Value", value: "EGP 50.3M", sub: "5 active projects", icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
  { label: "Avg Gross Margin", value: "23.2%", sub: "+2.1pp vs last month", icon: TrendingUp, color: "text-chart-3", bg: "bg-chart-3/10" },
  { label: "Total Man-Hours", value: "62,300h", sub: "Oct MTD — 316 workers", icon: Clock, color: "text-chart-2", bg: "bg-chart-2/10" },
  { label: "Labor Cost Ratio", value: "61.5%", sub: "of total revenue", icon: BarChart3, color: "text-chart-1", bg: "bg-chart-1/10" },
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
        <p className="font-medium text-foreground mb-1">{label} — EGP M</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color || p.fill }}>{p.name}: {p.value}M</p>
        ))}
      </div>
    )
  }
  return null
}

export function ProfitabilityTab() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Project Profitability</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Real-time labor cost vs contract revenue — Oct 2024</p>
        </div>
        <Badge className="bg-chart-3/15 text-chart-3 border-0 text-xs">5 Active Projects</Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label} className="border-border bg-card">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    <p className="text-xl font-semibold text-foreground mt-1">{kpi.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${kpi.bg}`}>
                    <Icon className={`size-5 ${kpi.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2 border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium text-foreground">Revenue vs Labor Cost vs Profit</CardTitle>
                <CardDescription className="text-xs">EGP Millions — 6-month trend</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={monthlyLaborData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "oklch(0.55 0.015 250)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.55 0.015 250)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="laborCost" name="Labor Cost" stackId="a" fill="oklch(0.55 0.18 250)" radius={[0, 0, 3, 3]} />
                <Bar dataKey="overhead" name="Overhead" stackId="a" fill="oklch(0.48 0.09 240)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="profit" name="Profit" stackId="a" fill="oklch(0.60 0.14 185)" radius={[3, 3, 0, 0]} />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="oklch(0.72 0.18 55)" strokeWidth={2.5} dot={{ r: 3, fill: "oklch(0.72 0.18 55)" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Hour Type Breakdown */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground">Hour Type Breakdown</CardTitle>
            <CardDescription className="text-xs">Oct MTD — all projects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              {hourTypeBreakdown.map((h) => (
                <div key={h.type}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full" style={{ backgroundColor: h.color }} />
                      <span className="text-xs text-muted-foreground">{h.type}</span>
                    </div>
                    <span className="text-xs text-foreground font-medium">{h.hours.toLocaleString()}h</span>
                  </div>
                  <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(h.hours / 78800) * 100}%`,
                        backgroundColor: h.color,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">EGP {h.cost}M loaded cost</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects Table */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-foreground">Project P&L Detail</CardTitle>
            <p className="text-xs text-muted-foreground">Click row to expand</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-0">
            <div className="grid grid-cols-8 text-xs text-muted-foreground pb-2 border-b border-border gap-2">
              <span className="col-span-2">Project</span>
              <span>Contract</span>
              <span>Budget</span>
              <span>Actual Cost</span>
              <span>Margin</span>
              <span>Budget Use</span>
              <span className="text-right">Status</span>
            </div>
            {projects.map((p) => {
              const isOver = p.budgetUsed > 100
              const isSelected = selectedProject === p.id
              return (
                <div
                  key={p.id}
                  className={`border-b border-border/50 transition-colors cursor-pointer ${isSelected ? "bg-secondary/50" : "hover:bg-secondary/30"}`}
                  onClick={() => setSelectedProject(isSelected ? null : p.id)}
                >
                  <div className="grid grid-cols-8 py-3 text-xs items-center gap-2">
                    <div className="col-span-2">
                      <p className="text-foreground font-medium truncate">{p.name}</p>
                      <p className="text-muted-foreground truncate">{p.client}</p>
                    </div>
                    <span className="text-foreground font-medium">
                      {(p.contractValue / 1000000).toFixed(1)}M
                    </span>
                    <span className="text-muted-foreground">
                      {(p.budgetedLabor / 1000000).toFixed(1)}M
                    </span>
                    <span className={isOver ? "text-destructive font-medium" : "text-foreground"}>
                      {(p.actualLabor / 1000000).toFixed(2)}M
                    </span>
                    <div className="flex items-center gap-1">
                      {p.margin >= 25 ? (
                        <TrendingUp className="size-3 text-chart-3 shrink-0" />
                      ) : p.margin >= 15 ? (
                        <TrendingUp className="size-3 text-primary shrink-0" />
                      ) : (
                        <TrendingDown className="size-3 text-destructive shrink-0" />
                      )}
                      <span className={
                        p.margin >= 25 ? "text-chart-3 font-medium" :
                        p.margin >= 15 ? "text-primary font-medium" :
                        "text-destructive font-medium"
                      }>{p.margin}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={Math.min(p.budgetUsed, 100)}
                        className="flex-1 h-1.5"
                      />
                      <span className={`shrink-0 ${isOver ? "text-destructive" : "text-muted-foreground"}`}>
                        {p.budgetUsed}%
                      </span>
                    </div>
                    <div className="flex justify-end">
                      <Badge
                        variant="secondary"
                        className="text-xs bg-chart-3/15 text-chart-3 border-0"
                      >
                        {p.headcount} workers
                      </Badge>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="pb-3 px-0 grid grid-cols-4 gap-3">
                      {[
                        { label: "Budgeted Hours", value: `${p.budgetedHours.toLocaleString()}h` },
                        { label: "Actual Hours", value: `${p.actualHours.toLocaleString()}h` },
                        { label: "Billable Amount", value: `EGP ${(p.billable / 1000000).toFixed(2)}M` },
                        { label: "Variance", value: `EGP ${((p.budgetedLabor - p.actualLabor) / 1000).toFixed(0)}K`, over: p.actualLabor > p.budgetedLabor },
                      ].map((stat) => (
                        <div key={stat.label} className="bg-secondary/50 rounded-lg px-3 py-2">
                          <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                          <p className={`text-sm font-semibold mt-0.5 ${'over' in stat && stat.over ? "text-destructive" : "text-foreground"}`}>{stat.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
