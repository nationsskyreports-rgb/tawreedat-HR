"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Loader2, Wallet, AlertTriangle,
  TrendingUp, TrendingDown, Calendar
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Employee, PayrollRecord, PayrollPeriod } from "@/lib/types"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"

function fmtEGP(n: number) {
  return new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n)
}

export default function MobilePayslipPage() {
  const router = useRouter()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [records, setRecords] = useState<(PayrollRecord & { period?: PayrollPeriod })[]>([])
  const [selected, setSelected] = useState<(PayrollRecord & { period?: PayrollPeriod }) | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }

      const { data: profileData } = await supabase
        .from("profiles").select("*").eq("id", user.id).single()
      if (!profileData?.employee_id) { setLoading(false); return }

      const { data: empData } = await supabase
        .from("employees").select("*").eq("id", profileData.employee_id).single()
      setEmployee(empData as Employee | null)

      const { data: recs } = await supabase
        .from("payroll_records")
        .select("*, payroll_periods(*)")
        .eq("employee_id", profileData.employee_id)
        .in("status", ["approved", "paid"])
        .order("created_at", { ascending: false })
        .limit(12)

      const formatted = (recs ?? []).map((r: any) => ({
        ...r,
        period: r.payroll_periods,
      }))
      setRecords(formatted)
      if (formatted.length > 0) setSelected(formatted[0])

      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <AlertTriangle className="size-10 text-muted-foreground mb-3" />
        <p className="text-sm text-foreground font-medium mb-1">No employee profile linked</p>
        <p className="text-xs text-muted-foreground mb-4">Ask HR to link your account</p>
        <button onClick={() => router.push("/m")} className="text-xs text-primary">← Back</button>
      </div>
    )
  }

  return (
    <>
      <header className="shrink-0 bg-card border-b border-border px-3 py-2.5 flex items-center gap-2">
        <button onClick={() => router.push("/m")} className="p-1.5 text-muted-foreground">
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-sm font-semibold text-foreground">My Payslip</h1>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 py-3 space-y-3">

          {records.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <Wallet className="size-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-foreground font-medium">No payslips yet</p>
              <p className="text-xs text-muted-foreground mt-1">Your payslips will appear here after HR processes payroll</p>
            </div>
          ) : (
            <>
              {/* Period selector */}
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Select Period</p>
                <select
                  value={selected?.id ?? ""}
                  onChange={e => setSelected(records.find(r => r.id === e.target.value) ?? null)}
                  className="w-full bg-secondary/60 text-foreground text-sm rounded-xl px-3 py-2.5 outline-none"
                >
                  {records.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.period?.period_name ?? "—"} · {r.status}
                    </option>
                  ))}
                </select>
              </div>

              {selected && (
                <>
                  {/* Net salary big display */}
                  <div className="bg-card border border-border rounded-2xl p-5 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Net Salary</p>
                    <p className="text-3xl font-bold text-chart-3">{fmtEGP(selected.net_salary)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{selected.period?.period_name}</p>
                    <div className={`inline-flex items-center gap-1 mt-2 text-[10px] px-2 py-0.5 rounded ${
                      selected.status === "paid" ? "bg-chart-3/15 text-chart-3" : "bg-chart-2/15 text-chart-2"
                    }`}>
                      {selected.status === "paid" ? "✓ Paid" : "Approved"}
                    </div>
                  </div>

                  {/* Attendance */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Working", value: selected.working_days, color: "text-foreground" },
                      { label: "Attended", value: selected.attended_days, color: "text-chart-3" },
                      { label: "Absent", value: selected.absent_days, color: "text-destructive" },
                    ].map(item => (
                      <div key={item.label} className="bg-card border border-border rounded-xl p-3 text-center">
                        <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                        <p className="text-[10px] text-muted-foreground">{item.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Earnings */}
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="size-3.5 text-chart-3" />
                      <p className="text-[10px] font-semibold text-chart-3 uppercase tracking-wide">Earnings</p>
                    </div>
                    <div className="space-y-2">
                      <PayRow label="Basic Salary" value={fmtEGP(selected.basic_salary)} />
                      {selected.total_allowances > 0 && <PayRow label="Allowances" value={fmtEGP(selected.total_allowances)} />}
                      {selected.overtime_amount > 0 && (
                        <PayRow label={`Overtime (${selected.overtime_hours.toFixed(1)}h)`} value={fmtEGP(selected.overtime_amount)} />
                      )}
                      {selected.bonus > 0 && <PayRow label="Bonus" value={fmtEGP(selected.bonus)} />}
                      <div className="pt-2 border-t border-border/50">
                        <PayRow label="Gross Salary" value={fmtEGP(selected.gross_salary)} bold />
                      </div>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingDown className="size-3.5 text-destructive" />
                      <p className="text-[10px] font-semibold text-destructive uppercase tracking-wide">Deductions</p>
                    </div>
                    <div className="space-y-2">
                      {selected.social_insurance_employee > 0 && (
                        <PayRow label="Social Insurance" value={`-${fmtEGP(selected.social_insurance_employee)}`} negative />
                      )}
                      {selected.income_tax > 0 && (
                        <PayRow label="Income Tax" value={`-${fmtEGP(selected.income_tax)}`} negative />
                      )}
                      {selected.absence_deduction > 0 && (
                        <PayRow label="Absence Deduction" value={`-${fmtEGP(selected.absence_deduction)}`} negative />
                      )}
                      {selected.loan_deduction > 0 && (
                        <PayRow label="Loan Deduction" value={`-${fmtEGP(selected.loan_deduction)}`} negative />
                      )}
                      <div className="pt-2 border-t border-border/50">
                        <PayRow label="Total Deductions" value={`-${fmtEGP(selected.total_deductions)}`} negative bold />
                      </div>
                    </div>
                  </div>

                  {/* Net */}
                  <div className="bg-chart-3/10 border border-chart-3/30 rounded-2xl p-4 flex items-center justify-between">
                    <span className="text-sm font-semibold text-chart-3">Net Salary</span>
                    <span className="text-xl font-bold text-chart-3">{fmtEGP(selected.net_salary)}</span>
                  </div>

                  {selected.period?.pay_date && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                      <Calendar className="size-3.5" />
                      Pay date: {new Date(selected.period.pay_date).toLocaleDateString("en-GB")}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          <div className="h-2" />
        </div>
      </main>

      <MobileBottomNav />
    </>
  )
}

function PayRow({ label, value, bold, negative }: { label: string; value: string; bold?: boolean; negative?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-xs ${bold ? "pt-1" : ""}`}>
      <span className={bold ? "font-medium text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className={`font-mono ${bold ? "font-semibold" : ""} ${negative ? "text-destructive" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  )
}
