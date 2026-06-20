"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Wallet, Calendar, Calculator, CheckCircle2, Lock,
  Loader2, Plus, X, FileText, TrendingUp, AlertCircle, Eye
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type {
  PayrollPeriod, PayrollRecord, Employee, PayrollStatus
} from "@/lib/types"

const statusConfig: Record<PayrollStatus, { label: string; color: string }> = {
  draft:      { label: "Draft",      color: "bg-secondary text-secondary-foreground" },
  calculated: { label: "Calculated", color: "bg-primary/15 text-primary" },
  approved:   { label: "Approved",   color: "bg-chart-2/15 text-chart-2" },
  paid:       { label: "Paid",       color: "bg-chart-3/15 text-chart-3" },
  cancelled:  { label: "Cancelled",  color: "bg-destructive/15 text-destructive" },
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

function fmtEGP(amount: number): string {
  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function PayrollTab() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null)
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)

  // New period modal
  const [showNewPeriod, setShowNewPeriod] = useState(false)
  const [newPeriodYear, setNewPeriodYear] = useState(new Date().getFullYear())
  const [newPeriodMonth, setNewPeriodMonth] = useState(new Date().getMonth() + 1)
  const [newPeriodPayDate, setNewPeriodPayDate] = useState("")
  const [periodError, setPeriodError] = useState<string | null>(null)
  const [creatingPeriod, setCreatingPeriod] = useState(false)

  // Payslip detail
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null)

  async function loadData() {
    setLoading(true)
    const [periodsRes, empRes] = await Promise.all([
      supabase.from("payroll_periods").select("*").order("period_year", { ascending: false }).order("period_month", { ascending: false }),
      supabase.from("employees").select("*").eq("status", "active").order("full_name"),
    ])
    const periodsData = (periodsRes.data ?? []) as PayrollPeriod[]
    setPeriods(periodsData)
    setEmployees((empRes.data ?? []) as Employee[])

    if (!selectedPeriod && periodsData.length > 0) {
      setSelectedPeriod(periodsData[0])
    }
    setLoading(false)
  }

  async function loadRecords(periodId: string) {
    const { data } = await supabase
      .from("payroll_records")
      .select("*")
      .eq("period_id", periodId)
      .order("created_at", { ascending: false })
    setRecords((data ?? []) as PayrollRecord[])
  }

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (selectedPeriod) loadRecords(selectedPeriod.id)
    else setRecords([])
  }, [selectedPeriod])

  async function createPeriod() {
    setPeriodError(null)
    if (!newPeriodPayDate) return setPeriodError("Pay date is required")

    setCreatingPeriod(true)

    const startDate = new Date(newPeriodYear, newPeriodMonth - 1, 1)
    const endDate = new Date(newPeriodYear, newPeriodMonth, 0)
    const periodName = `${monthNames[newPeriodMonth - 1]} ${newPeriodYear}`

    const { error } = await supabase.from("payroll_periods").insert({
      period_year: newPeriodYear,
      period_month: newPeriodMonth,
      period_name: periodName,
      start_date: startDate.toISOString().split("T")[0],
      end_date: endDate.toISOString().split("T")[0],
      pay_date: newPeriodPayDate,
      status: "draft" as PayrollStatus,
    })

    setCreatingPeriod(false)

    if (error) {
      setPeriodError(error.message)
      return
    }

    setShowNewPeriod(false)
    setNewPeriodPayDate("")
    await loadData()
  }

  async function calculatePayroll() {
    if (!selectedPeriod) return
    if (employees.length === 0) {
      alert("No active employees to calculate payroll for")
      return
    }

    setCalculating(true)

    // Delete existing records for this period (recalculate from scratch)
    await supabase.from("payroll_records").delete().eq("period_id", selectedPeriod.id)

    // Working days in period
    const startDate = new Date(selectedPeriod.start_date)
    const endDate = new Date(selectedPeriod.end_date)
    let workingDays = 0
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const day = d.getDay()
      if (day !== 5 && day !== 6) workingDays++ // Exclude Fri & Sat
    }

    // Calculate for each employee
    let totalGross = 0
    let totalNet = 0
    let totalTax = 0
    let totalInsurance = 0

    for (const emp of employees) {
      const basic = emp.basic_salary || 0
      if (basic === 0) continue

      // Get attendance for the period
      const { data: attendance } = await supabase
        .from("attendance_logs")
        .select("status, overtime_minutes")
        .eq("employee_id", emp.id)
        .gte("checkin_at", startDate.toISOString())
        .lte("checkin_at", endDate.toISOString())

      const attendedDays = (attendance ?? []).filter(a => a.status === "present" || a.status === "late").length
      const absentDays = Math.max(0, workingDays - attendedDays)
      const overtimeMinutes = (attendance ?? []).reduce((sum, a) => sum + (a.overtime_minutes ?? 0), 0)
      const overtimeHours = overtimeMinutes / 60

      // Earnings
      const dailyRate = basic / workingDays
      const earnedBasic = dailyRate * attendedDays
      const hourlyRate = basic / (workingDays * 8)
      const overtimeAmount = overtimeHours * hourlyRate * 1.35 // 35% premium (Egypt law)

      const allowances = 0 // TODO: read from employee_salary_components
      const grossSalary = earnedBasic + allowances + overtimeAmount

      // Social insurance (using DB function)
      const { data: siData } = await supabase.rpc("calculate_social_insurance", {
        p_monthly_salary: grossSalary,
        p_year: selectedPeriod.period_year,
      })
      const siEmployee = siData?.[0]?.employee_share ?? 0
      const siEmployer = siData?.[0]?.employer_share ?? 0

      // Income tax (annualized then divided by 12)
      const annualGross = grossSalary * 12
      const annualTaxable = Math.max(0, annualGross - 20000) // Personal exemption
      const { data: taxData } = await supabase.rpc("calculate_income_tax", {
        p_annual_taxable_salary: annualTaxable,
        p_year: selectedPeriod.period_year,
      })
      const monthlyTax = (taxData ?? 0) / 12

      const absenceDeduction = absentDays * dailyRate
      const totalDeductions = siEmployee + monthlyTax + absenceDeduction
      const netSalary = grossSalary - totalDeductions

      totalGross += grossSalary
      totalNet += netSalary
      totalTax += monthlyTax
      totalInsurance += siEmployee + siEmployer

      await supabase.from("payroll_records").insert({
        period_id: selectedPeriod.id,
        employee_id: emp.id,
        working_days: workingDays,
        attended_days: attendedDays,
        absent_days: absentDays,
        basic_salary: basic,
        total_allowances: allowances,
        overtime_hours: overtimeHours,
        overtime_amount: overtimeAmount,
        gross_salary: grossSalary,
        social_insurance_employee: siEmployee,
        social_insurance_employer: siEmployer,
        income_tax: monthlyTax,
        absence_deduction: absenceDeduction,
        total_deductions: totalDeductions,
        taxable_salary: annualTaxable / 12,
        net_salary: netSalary,
        status: "calculated" as PayrollStatus,
        calculated_at: new Date().toISOString(),
      })
    }

    // Update period totals
    await supabase.from("payroll_periods").update({
      total_gross: totalGross,
      total_net: totalNet,
      total_tax: totalTax,
      total_insurance: totalInsurance,
      total_employees: employees.filter(e => (e.basic_salary || 0) > 0).length,
      status: "calculated" as PayrollStatus,
      calculated_at: new Date().toISOString(),
    }).eq("id", selectedPeriod.id)

    setCalculating(false)
    await loadData()
    if (selectedPeriod) await loadRecords(selectedPeriod.id)
  }

  async function approvePayroll() {
    if (!selectedPeriod) return
    if (!confirm("Approve this payroll? All records will be locked for editing.")) return

    await supabase.from("payroll_periods").update({
      status: "approved" as PayrollStatus,
      approved_at: new Date().toISOString(),
    }).eq("id", selectedPeriod.id)

    await supabase.from("payroll_records").update({
      status: "approved" as PayrollStatus,
    }).eq("period_id", selectedPeriod.id)

    await loadData()
    if (selectedPeriod) await loadRecords(selectedPeriod.id)
  }

  async function markPaid() {
    if (!selectedPeriod) return
    if (!confirm("Mark this payroll as paid?")) return

    await supabase.from("payroll_periods").update({
      status: "paid" as PayrollStatus,
      paid_at: new Date().toISOString(),
    }).eq("id", selectedPeriod.id)

    await supabase.from("payroll_records").update({
      status: "paid" as PayrollStatus,
    }).eq("period_id", selectedPeriod.id)

    await loadData()
    if (selectedPeriod) await loadRecords(selectedPeriod.id)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading payroll...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Payroll</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {periods.length} period{periods.length !== 1 ? "s" : ""} · {employees.length} active employees
          </p>
        </div>
        <button
          onClick={() => setShowNewPeriod(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="size-4" />
          New Payroll Period
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Periods sidebar */}
        <div className="col-span-12 lg:col-span-4">
          <Card className="border-border bg-card">
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-medium text-muted-foreground uppercase">Payroll Periods</p>
              </div>
              {periods.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No payroll periods yet.<br />Click <strong>New Payroll Period</strong> to start.
                </div>
              ) : (
                periods.map((p) => {
                  const isSelected = selectedPeriod?.id === p.id
                  const cfg = statusConfig[p.status]
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPeriod(p)}
                      className={`w-full text-left px-4 py-3 border-b border-border/50 transition-colors ${
                        isSelected ? "bg-primary/8" : "hover:bg-secondary/30"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className={`text-sm font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>
                          {p.period_name}
                        </span>
                        <Badge variant="secondary" className={`text-[10px] ${cfg.color}`}>
                          {cfg.label}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Pay date: {p.pay_date ? new Date(p.pay_date).toLocaleDateString("en-GB") : "—"}
                      </p>
                      {p.total_net > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Net: <span className="text-foreground font-mono">{fmtEGP(p.total_net)}</span>
                        </p>
                      )}
                    </button>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Period detail */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
          {selectedPeriod ? (
            <>
              {/* Summary */}
              <Card className="border-border bg-card">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="size-4 text-primary" />
                        <h2 className="text-sm font-semibold text-foreground">{selectedPeriod.period_name}</h2>
                        <Badge variant="secondary" className={`text-[10px] ${statusConfig[selectedPeriod.status].color}`}>
                          {statusConfig[selectedPeriod.status].label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(selectedPeriod.start_date).toLocaleDateString("en-GB")} → {new Date(selectedPeriod.end_date).toLocaleDateString("en-GB")}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedPeriod.status === "draft" && (
                        <button onClick={calculatePayroll} disabled={calculating}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                          {calculating ? <Loader2 className="size-3 animate-spin" /> : <Calculator className="size-3" />}
                          {calculating ? "Calculating..." : "Calculate"}
                        </button>
                      )}
                      {selectedPeriod.status === "calculated" && (
                        <>
                          <button onClick={calculatePayroll} disabled={calculating}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-foreground rounded-lg text-xs font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50">
                            {calculating ? <Loader2 className="size-3 animate-spin" /> : <Calculator className="size-3" />}
                            Recalculate
                          </button>
                          <button onClick={approvePayroll}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-chart-2 text-white rounded-lg text-xs font-medium hover:bg-chart-2/90 transition-colors">
                            <CheckCircle2 className="size-3" />
                            Approve
                          </button>
                        </>
                      )}
                      {selectedPeriod.status === "approved" && (
                        <button onClick={markPaid}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-chart-3 text-white rounded-lg text-xs font-medium hover:bg-chart-3/90 transition-colors">
                          <Wallet className="size-3" />
                          Mark as Paid
                        </button>
                      )}
                      {selectedPeriod.status === "paid" && (
                        <Badge variant="secondary" className="bg-chart-3/15 text-chart-3 flex items-center gap-1">
                          <Lock className="size-2.5" /> Paid & Locked
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                    <StatBox label="Employees" value={selectedPeriod.total_employees.toString()} color="text-primary" />
                    <StatBox label="Gross" value={fmtEGP(selectedPeriod.total_gross)} color="text-chart-2" />
                    <StatBox label="Net Payable" value={fmtEGP(selectedPeriod.total_net)} color="text-chart-3" />
                    <StatBox label="Tax + Insurance" value={fmtEGP(selectedPeriod.total_tax + selectedPeriod.total_insurance)} color="text-destructive" />
                  </div>
                </CardContent>
              </Card>

              {/* Records */}
              <Card className="border-border bg-card">
                <CardContent className="p-0">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Payroll Records</p>
                    <Badge variant="secondary" className="text-xs">{records.length} records</Badge>
                  </div>

                  {records.length === 0 ? (
                    <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                      {selectedPeriod.status === "draft"
                        ? "Click Calculate to generate payroll records."
                        : "No records found."}
                    </div>
                  ) : (
                    <div className="max-h-[500px] overflow-auto">
                      <div className="grid grid-cols-12 text-[10px] uppercase tracking-wide text-muted-foreground px-4 py-2 border-b border-border bg-secondary/20 sticky top-0">
                        <span className="col-span-4">Employee</span>
                        <span className="col-span-2 text-right">Gross</span>
                        <span className="col-span-2 text-right">Tax</span>
                        <span className="col-span-2 text-right">Net</span>
                        <span className="col-span-2 text-right">Action</span>
                      </div>
                      {records.map((r) => {
                        const emp = employees.find((e) => e.id === r.employee_id)
                        return (
                          <div key={r.id} className="grid grid-cols-12 px-4 py-2.5 text-xs items-center border-b border-border/50 hover:bg-secondary/20 transition-colors">
                            <div className="col-span-4 min-w-0">
                              <p className="font-medium text-foreground truncate">{emp?.full_name ?? "—"}</p>
                              <p className="text-[10px] text-muted-foreground">{emp?.employee_no}</p>
                            </div>
                            <span className="col-span-2 text-right font-mono text-foreground">{fmtEGP(r.gross_salary)}</span>
                            <span className="col-span-2 text-right font-mono text-destructive">-{fmtEGP(r.income_tax + r.social_insurance_employee)}</span>
                            <span className="col-span-2 text-right font-mono font-semibold text-chart-3">{fmtEGP(r.net_salary)}</span>
                            <div className="col-span-2 text-right">
                              <button
                                onClick={() => setSelectedRecord(r)}
                                className="text-[10px] text-primary hover:underline inline-flex items-center gap-1"
                              >
                                <Eye className="size-2.5" /> Payslip
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-border bg-card">
              <CardContent className="py-20 text-center text-sm text-muted-foreground">
                <FileText className="size-8 mx-auto mb-3 opacity-50" />
                Select a payroll period from the list, or create a new one.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* New Period Modal */}
      {showNewPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">New Payroll Period</h2>
              <button onClick={() => setShowNewPeriod(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3">
              {periodError && (
                <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                  {periodError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Year">
                  <input type="number" min="2020" max="2030" value={newPeriodYear}
                    onChange={(e) => setNewPeriodYear(Number(e.target.value))}
                    className="form-field" />
                </FormField>
                <FormField label="Month">
                  <select value={newPeriodMonth} onChange={(e) => setNewPeriodMonth(Number(e.target.value))} className="form-field">
                    {monthNames.map((name, i) => (
                      <option key={name} value={i + 1}>{name}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              <FormField label="Pay Date">
                <input type="date" value={newPeriodPayDate}
                  onChange={(e) => setNewPeriodPayDate(e.target.value)}
                  className="form-field" />
              </FormField>

              <div className="bg-secondary/30 rounded-lg p-3 text-xs text-muted-foreground">
                Period will cover {monthNames[newPeriodMonth - 1]} {newPeriodYear} (full calendar month). Fridays & Saturdays are excluded from working days.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/20">
              <button onClick={() => setShowNewPeriod(false)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button onClick={createPeriod} disabled={creatingPeriod}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                {creatingPeriod && <Loader2 className="size-3 animate-spin" />}
                Create Period
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payslip Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Payslip Details</h2>
                <p className="text-xs text-muted-foreground">{selectedPeriod?.period_name}</p>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5">
              {(() => {
                const emp = employees.find((e) => e.id === selectedRecord.employee_id)
                return (
                  <div className="space-y-4">
                    <div className="text-center pb-3 border-b border-border">
                      <h3 className="text-base font-semibold text-foreground">{emp?.full_name ?? "—"}</h3>
                      <p className="text-xs text-muted-foreground font-mono">{emp?.employee_no}</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Attendance</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <PayslipItem label="Working" value={selectedRecord.working_days.toString()} />
                        <PayslipItem label="Attended" value={selectedRecord.attended_days.toString()} />
                        <PayslipItem label="Absent" value={selectedRecord.absent_days.toString()} />
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-chart-3 uppercase mb-2">Earnings</p>
                      <div className="space-y-1.5">
                        <PayslipRow label="Basic Salary" value={fmtEGP(selectedRecord.basic_salary)} />
                        <PayslipRow label="Allowances" value={fmtEGP(selectedRecord.total_allowances)} />
                        <PayslipRow label={`Overtime (${selectedRecord.overtime_hours.toFixed(1)}h)`} value={fmtEGP(selectedRecord.overtime_amount)} />
                        <PayslipRow label="Gross Salary" value={fmtEGP(selectedRecord.gross_salary)} bold />
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-destructive uppercase mb-2">Deductions</p>
                      <div className="space-y-1.5">
                        <PayslipRow label="Social Insurance" value={fmtEGP(selectedRecord.social_insurance_employee)} negative />
                        <PayslipRow label="Income Tax" value={fmtEGP(selectedRecord.income_tax)} negative />
                        <PayslipRow label="Absence" value={fmtEGP(selectedRecord.absence_deduction)} negative />
                        <PayslipRow label="Total Deductions" value={fmtEGP(selectedRecord.total_deductions)} negative bold />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border">
                      <div className="flex items-center justify-between bg-chart-3/10 px-3 py-2.5 rounded-lg">
                        <span className="text-sm font-semibold text-chart-3">Net Salary</span>
                        <span className="text-base font-bold text-chart-3 font-mono">{fmtEGP(selectedRecord.net_salary)}</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-center text-muted-foreground">
                      Generated {selectedRecord.calculated_at ? new Date(selectedRecord.calculated_at).toLocaleString("en-GB") : "—"}
                    </p>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.form-field) {
          width: 100%;
          background: oklch(from var(--secondary) l c h / 60%);
          color: var(--foreground);
          font-size: 0.875rem;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          outline: none;
          border: 1px solid transparent;
          transition: border-color 150ms;
        }
        :global(.form-field:focus) {
          border-color: var(--primary);
        }
      `}</style>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-secondary/30 rounded-lg p-3">
      <p className="text-[10px] text-muted-foreground uppercase mb-1">{label}</p>
      <p className={`text-base font-semibold ${color} tabular-nums`}>{value}</p>
    </div>
  )
}

function PayslipItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-secondary/30 rounded-lg p-2 text-center">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground tabular-nums">{value}</p>
    </div>
  )
}

function PayslipRow({ label, value, bold, negative }: { label: string; value: string; bold?: boolean; negative?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-xs ${bold ? "pt-1.5 border-t border-border/50" : ""}`}>
      <span className={`${bold ? "font-medium text-foreground" : "text-muted-foreground"}`}>{label}</span>
      <span className={`font-mono ${bold ? "font-semibold" : ""} ${negative ? "text-destructive" : "text-foreground"}`}>
        {negative && value !== fmtEGP(0) ? "-" : ""}{value}
      </span>
    </div>
  )
}
