"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Search, Plus, Truck, Package, MapPin, Monitor, Shield } from "lucide-react"
import { supabase } from "@/lib/supabase"

type Employee = {
  id: string
  employee_no: string
  full_name: string
  category: string
  status: string
}

const categoryConfig: Record<string, { label: string; color: string; icon: any }> = {
  driver: { label: "Driver", color: "bg-chart-1/15 text-chart-1", icon: Truck },
  warehouse: { label: "Warehouse", color: "bg-chart-2/15 text-chart-2", icon: Package },
  field_ops: { label: "Field Ops", color: "bg-chart-3/15 text-chart-3", icon: MapPin },
  office: { label: "Office", color: "bg-primary/15 text-primary", icon: Monitor },
  supervisor: { label: "Supervisor", color: "bg-destructive/15 text-destructive", icon: Shield },
}

export function EmployeesTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    async function fetchEmployees() {
      const { data } = await supabase.from("employees").select("*").order("created_at", { ascending: false })
      setEmployees(data ?? [])
      setLoading(false)
    }
    fetchEmployees()
  }, [])

  const filtered = employees.filter(e =>
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_no.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{employees.length} active employees</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="size-4" />
          Add Employee
        </button>
      </div>

      <div className="flex items-center gap-2 bg-secondary/60 rounded-lg px-3 py-2 w-80">
        <Search className="size-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1"
        />
      </div>

      <Card className="border-border bg-card">
        <CardContent className="p-0">
          <div className="grid grid-cols-5 text-xs text-muted-foreground px-4 py-3 border-b border-border">
            <span>Employee ID</span>
            <span className="col-span-2">Full Name</span>
            <span>Category</span>
            <span className="text-right">Status</span>
          </div>
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No employees found</div>
          ) : (
            filtered.map((emp) => {
              const cat = categoryConfig[emp.category] ?? { label: emp.category, color: "bg-secondary text-secondary-foreground", icon: Users }
              const Icon = cat.icon
              return (
                <div key={emp.id} className="grid grid-cols-5 px-4 py-3 border-b border-border/50 text-sm items-center hover:bg-secondary/30 transition-colors">
                  <span className="font-mono text-xs text-muted-foreground">{emp.employee_no}</span>
                  <span className="col-span-2 font-medium text-foreground">{emp.full_name}</span>
                  <div className="flex items-center gap-1.5">
                    <Icon className="size-3.5 text-muted-foreground" />
                    <Badge variant="secondary" className={`text-xs ${cat.color}`}>{cat.label}</Badge>
                  </div>
                  <div className="flex justify-end">
                    <Badge variant="secondary" className={`text-xs ${emp.status === "active" ? "bg-chart-3/15 text-chart-3" : "bg-destructive/15 text-destructive"}`}>
                      {emp.status}
                    </Badge>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
