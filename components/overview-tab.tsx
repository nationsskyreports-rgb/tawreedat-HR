"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Users, MapPin, DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle2, Clock, Truck, Shield
} from "lucide-react"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts"
import { supabase } from "@/lib/supabase"

const attendanceTrend = [
  { day: "Sun", present: 5820, absent: 180 },
  { day: "Mon", present: 6100, absent: 200 },
  { day: "Tue", present: 6340, absent: 160 },
  { day: "Wed", present: 6250, absent: 210 },
  { day: "Thu", present: 6180, absent: 220 },
  { day: "Fri", present: 4100, absent: 100 },
  { day: "Sat", present: 3200, absent: 80 },
]

const payrollMonths = [
  { month: "May", gross: 8.2, net: 6.9 },
  { month: "Jun", gross: 8.5, net: 7.1 },
  { month: "Jul", gross: 8.8, net: 7.3 },
  { month: "Aug", gross: 9.1, net: 7.6 },
  { month: "Sep", gross: 9.4, net: 7.8 },
  { month: "Oct", gross: 9.8, net: 8.1 },
]

const workerCategoryData = [
  { name: "Drivers", value: 3800, color: "oklch(0.72 0.18 55)" },
  { name: "Warehouse", value: 2200, color: "oklch(0.55 0.18 250)" },
  { name: "Field Ops", value: 1800, color: "oklch(0.60 0.14 185)" },
  { name: "Office", value: 1400, color: "oklch(0.48 0.09 240)" },
  { name: "Supervisors", value: 800, color: "oklch(0.62 0.22 25)" },
]

const alertsData = [
  { type: "License Expiry", count: 23, urgency: "high", icon: Truck },
  { type: "Medical Check Overdue", count: 11, urgency: "high", icon: Shield },
  { type: "Face Match Flagged", count: 7, urgency: "medium", icon: AlertTriangle },
  { type: "Pending Shift Swaps", count: 34, urgency: "low", icon: Clock },
  { type: "Leave Requests", count: 89, urgency: "low", icon: CheckCircle2 },
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
        <p className="font-medium text-foreground mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
        ))}
      </div>
    )
  }
  return null
}

export function OverviewTab() {
  const [totalEmployees, setTotalEmployees] = useState<number>(0)
  const [presentToday, setPresentToday] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      const { count: empCount } = await supabase
        .from("employees")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")

      const today = new Date().toISOString().split("T")[0]
      const { count: presentCount } = await supabase
        .from("attendance_logs")
        .select("*", { count: "exact", head: true })
        .gte("checkin_at", today)

      setTotalEmployees(empCount ?? 0)
      setPresentToday(presentCount ?? 0)
      setLoading(false)
    }
    fetchStats()
  }, [])

  const kpis = [
    {
      label: "Active Employees",
      value: loading ? "..." : totalEmployees.toLocaleString(),
      sub: "from Supabase",
      trend: "up",
      icon: Users,
      color: "text-chart-2",
      bg: "bg-chart-2/10",
    },
    {
      label: "Present Today",
      value: loading ? "..." : presentToday.toLocaleString(),
      sub: totalEmployees > 0 ? `${((presentToday / totalEmployees) * 100).toFixed(1)}% attendance` : "—",
      trend: "up",
      icon: CheckCircle2,
      color: "text-chart-1",
      bg: "bg-chart-1/10",
    },
    {
      label: "Active Projects",
      value: "47",
      sub: "EGP 182M total value",
      trend: "up",
      icon: TrendingUp,
      color: "text-chart-3",
      bg: "bg-chart-3/10",
    },
    {
      label: "Oct Payroll",
      value: "EGP 9.8M",
      sub: "Gross — runs Nov 1",
      trend: "neutral",
      icon: DollarSign,
      color: "text-primary",
      bg: "bg-primary/10",
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Command Center</h1>
          <p className="text-sm text-muted-foreground mt-0.5">October 2024 — Live snapshot</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-chart-3 animate-pulse" />
          <span className="text-xs text-muted-foreground">Live data</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label} className="border-border bg-card">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    <p className="text-2xl font-semibold text-foreground mt-1">{kpi.value}</p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      {kpi.trend === "up" && <TrendingUp className="size-3 text-chart-3" />}
                      {kpi.trend === "down" && <TrendingDown className="size-3 text-destructive" />}
                      {kpi.sub}
                    </p>
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

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2 border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium text-foreground">Weekly Attendance</CardTitle>
                <CardDescription className="text-xs">Present vs absent — current week</CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs">Week 42</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={attendanceTrend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.72 0.18 55)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="oklch(0.72 0.18 55)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "oklch(0.55 0.015 250)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.55 0.015 250)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="present" name="Present" stroke="oklch(0.72 0.18 55)" strokeWidth={2} fill="url(#presentGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground">Workforce Mix</CardTitle>
            <CardDescription className="text-xs">By category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie data={workerCategoryData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value">
                  {workerCategoryData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => v.toLocaleString()} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-1.5 mt-2">
              {workerCategoryData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-muted-foreground">{d.name}</span>
                  </div>
                  <span className="text-foreground font-medium">{d.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2 border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium text-foreground">Payroll Trend</CardTitle>
                <CardDescription className="text-xs">Gross vs net — EGP millions</CardDescription>
              </div>
              <Badge className="text-xs bg-primary/20 text-primary border-0">EGP</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={payrollMonths} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "oklch(0.55 0.015 250)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.55 0.015 250)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="gross" name="Gross" fill="oklch(0.72 0.18 55)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="net" name="Net" fill="oklch(0.55 0.18 250)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-foreground">Active Alerts</CardTitle>
              <Badge variant="destructive" className="text-xs">41 critical</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {alertsData.map((alert) => {
                const Icon = alert.icon
                return (
                  <div key={alert.type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`size-4 shrink-0 ${
                        alert.urgency === "high" ? "text-destructive" :
                        alert.urgency === "medium" ? "text-primary" : "text-muted-foreground"
                      }`} />
                      <span className="text-xs text-muted-foreground truncate max-w-[130px]">{alert.type}</span>
                    </div>
                    <Badge variant="secondary" className={`text-xs ${
                      alert.urgency === "high" ? "bg-destructive/15 text-destructive" :
                      alert.urgency === "medium" ? "bg-primary/15 text-primary" :
                      "bg-secondary text-secondary-foreground"
                    }`}>
                      {alert.count}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}