"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  MapPin, CheckCircle2, XCircle, AlertTriangle, Camera,
  Wifi, Clock, Smartphone, User, Navigation, RefreshCw
} from "lucide-react"

type CheckinState = "idle" | "locating" | "verifying_face" | "success" | "failure_geofence" | "failure_face"

const recentEvents = [
  { name: "Ahmed Hassan", emp: "DRV-4821", site: "Cairo Warehouse B", time: "07:03", status: "success", match: 94.7 },
  { name: "Mohamed Ali", emp: "DRV-4822", site: "Ring Road Depot", time: "07:08", status: "success", match: 97.2 },
  { name: "Sara Mahmoud", emp: "WH-1042", site: "Cairo Warehouse B", time: "07:12", status: "pending", match: 82.4 },
  { name: "Omar Khalil", emp: "DRV-4830", site: "10th of Ramadan Hub", time: "07:15", status: "failed", match: 0 },
  { name: "Fatma Ibrahim", emp: "WH-1044", site: "Cairo Warehouse B", time: "07:19", status: "success", match: 91.1 },
  { name: "Karim Nasser", emp: "DRV-4835", site: "Alexandria Port", time: "07:22", status: "success", match: 88.9 },
  { name: "Layla Saad", emp: "SP-0214", site: "Cairo Warehouse B", time: "07:31", status: "success", match: 95.3 },
  { name: "Hassan Youssef", emp: "DRV-4840", site: "Suez Checkpoint", time: "07:33", status: "pending", match: 76.0 },
]

const sites = [
  { id: "WH-CAIRO-B", name: "Cairo Warehouse B", checkins: 124, expected: 140, lat: "30.0444", lng: "31.2357" },
  { id: "RING-DEPOT", name: "Ring Road Depot", checkins: 88, expected: 95, lat: "30.0200", lng: "31.4100" },
  { id: "10TH-HUB", name: "10th of Ramadan Hub", checkins: 62, expected: 70, lat: "30.3000", lng: "31.7500" },
  { id: "ALEX-PORT", name: "Alexandria Port", checkins: 45, expected: 50, lat: "31.2001", lng: "29.9187" },
  { id: "SUEZ-CP", name: "Suez Checkpoint", checkins: 31, expected: 35, lat: "29.9668", lng: "32.5498" },
]

const steps = [
  { id: "locating", label: "Acquiring GPS Signal", icon: Navigation },
  { id: "geofence", label: "Validating Geofence", icon: MapPin },
  { id: "verifying_face", label: "Face Recognition", icon: Camera },
  { id: "logging", label: "Recording Attendance", icon: CheckCircle2 },
]

export function CheckinTab() {
  const [simState, setSimState] = useState<CheckinState>("idle")
  const [progress, setProgress] = useState(0)
  const [activeStep, setActiveStep] = useState(0)

  const runSimulation = (outcome: CheckinState) => {
    setSimState("locating")
    setProgress(10)
    setActiveStep(0)

    setTimeout(() => { setProgress(30); setActiveStep(1) }, 800)
    setTimeout(() => {
      if (outcome === "failure_geofence") {
        setSimState("failure_geofence")
        setProgress(45)
        return
      }
      setProgress(60); setActiveStep(2)
    }, 1600)
    setTimeout(() => {
      if (outcome === "failure_face") {
        setSimState("failure_face")
        setProgress(75)
        return
      }
      if (outcome !== "failure_geofence") {
        setProgress(85); setActiveStep(3)
      }
    }, 2400)
    setTimeout(() => {
      if (outcome === "success") {
        setSimState("success")
        setProgress(100)
      }
    }, 3200)
  }

  const reset = () => {
    setSimState("idle")
    setProgress(0)
    setActiveStep(0)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Field Check-In Monitor</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Real-time geofencing attendance — Oct 15, 2024</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-chart-3/15 text-chart-3 border-0 text-xs">350 checked in today</Badge>
          <Badge variant="secondary" className="text-xs">6,248 / 10,000 present</Badge>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Mobile App Wireframe Simulation */}
        <Card className="border-border bg-card col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <Smartphone className="size-4 text-primary" />
              Mobile App — Field Worker View
            </CardTitle>
            <CardDescription className="text-xs">Simulate the check-in flow</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Phone mockup */}
            <div className="mx-auto w-52 border-2 border-border rounded-3xl overflow-hidden bg-background shadow-2xl">
              {/* Phone notch bar */}
              <div className="bg-sidebar px-4 py-2 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">07:03</span>
                <div className="flex gap-1">
                  <Wifi className="size-3 text-muted-foreground" />
                </div>
              </div>

              {/* App header */}
              <div className="bg-sidebar px-4 py-3 border-b border-border">
                <p className="text-[11px] font-semibold text-foreground">تواريدات HRIS</p>
                <p className="text-[10px] text-muted-foreground">مرحباً، Ahmed Hassan</p>
              </div>

              {/* Main content area */}
              <div className="px-4 py-4 min-h-60 bg-background">
                {simState === "idle" && (
                  <div className="flex flex-col items-center gap-4 pt-2">
                    <div className="size-16 rounded-full bg-primary/15 flex items-center justify-center">
                      <MapPin className="size-8 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold text-foreground">Cairo Warehouse B</p>
                      <p className="text-[10px] text-muted-foreground mt-1">مستودع القاهرة - ب</p>
                      <p className="text-[10px] text-muted-foreground">Shift: 07:00 – 15:00</p>
                    </div>
                    <div
                      className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold text-center cursor-pointer active:scale-95 transition-transform"
                      onClick={() => runSimulation("success")}
                    >
                      تسجيل الحضور / Check In
                    </div>
                  </div>
                )}

                {(simState === "locating" || simState === "verifying_face") && (
                  <div className="flex flex-col items-center gap-4 pt-2">
                    <div className="size-16 rounded-full border-2 border-primary flex items-center justify-center animate-pulse">
                      <Navigation className="size-7 text-primary" />
                    </div>
                    <p className="text-xs font-medium text-foreground text-center">
                      {simState === "locating" ? "Acquiring location..." : "Scanning face..."}
                    </p>
                    <Progress value={progress} className="w-full h-1.5" />
                    <div className="flex flex-col gap-2 w-full">
                      {steps.map((step, i) => {
                        const Icon = step.icon
                        const done = i < activeStep
                        const active = i === activeStep
                        return (
                          <div key={step.id} className={`flex items-center gap-2 text-[10px] ${done ? "text-chart-3" : active ? "text-primary" : "text-muted-foreground"}`}>
                            <Icon className="size-3 shrink-0" />
                            {step.label}
                            {done && <CheckCircle2 className="size-3 ml-auto text-chart-3" />}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {simState === "success" && (
                  <div className="flex flex-col items-center gap-3 pt-2">
                    <div className="size-14 rounded-full bg-chart-3/15 flex items-center justify-center">
                      <CheckCircle2 className="size-8 text-chart-3" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-chart-3">تم تسجيل الحضور!</p>
                      <p className="text-[10px] text-foreground mt-1">Check-In Confirmed</p>
                      <p className="text-[10px] text-muted-foreground">07:03 AM — 147m from site</p>
                      <p className="text-[10px] text-muted-foreground">Face match: 94.7%</p>
                    </div>
                    <div className="bg-secondary rounded-lg px-3 py-2 w-full">
                      <p className="text-[10px] text-muted-foreground">Today&apos;s Schedule</p>
                      <p className="text-[10px] text-foreground font-medium">07:00 – 15:00 (8h shift)</p>
                      <p className="text-[10px] text-muted-foreground">Break: 12:00 – 13:00</p>
                    </div>
                  </div>
                )}

                {simState === "failure_geofence" && (
                  <div className="flex flex-col items-center gap-3 pt-2">
                    <div className="size-14 rounded-full bg-destructive/15 flex items-center justify-center">
                      <XCircle className="size-8 text-destructive" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-destructive">خارج النطاق!</p>
                      <p className="text-[10px] text-foreground mt-1">Outside Geofence</p>
                      <p className="text-[10px] text-muted-foreground">Distance: 412m (max 200m)</p>
                    </div>
                    <div className="bg-destructive/10 rounded-lg px-3 py-2 w-full border border-destructive/20">
                      <p className="text-[10px] text-destructive">Move closer to the site entry point and retry.</p>
                    </div>
                  </div>
                )}

                {simState === "failure_face" && (
                  <div className="flex flex-col items-center gap-3 pt-2">
                    <div className="size-14 rounded-full bg-primary/15 flex items-center justify-center">
                      <AlertTriangle className="size-8 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-primary">مراجعة HR مطلوبة</p>
                      <p className="text-[10px] text-foreground mt-1">Face Match: 83% (threshold 90%)</p>
                      <p className="text-[10px] text-muted-foreground">Queued for HR review</p>
                    </div>
                    <div className="bg-primary/10 rounded-lg px-3 py-2 w-full border border-primary/20">
                      <p className="text-[10px] text-primary">Request saved. HR will review within 2 hours.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom nav */}
              <div className="bg-sidebar border-t border-border px-2 py-2 flex items-center justify-around">
                {[
                  { icon: MapPin, label: "Attend" },
                  { icon: Clock, label: "Shifts" },
                  { icon: User, label: "Profile" },
                ].map((n) => (
                  <div key={n.label} className="flex flex-col items-center gap-0.5">
                    <n.icon className="size-4 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground">{n.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Scenario buttons */}
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-xs text-muted-foreground text-center">Simulate scenario:</p>
              <div className="flex gap-2">
                <button onClick={() => { reset(); setTimeout(() => runSimulation("success"), 50) }}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-chart-3/15 text-chart-3 hover:bg-chart-3/25 transition-colors">
                  Success
                </button>
                <button onClick={() => { reset(); setTimeout(() => runSimulation("failure_geofence"), 50) }}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors">
                  Outside Zone
                </button>
                <button onClick={() => { reset(); setTimeout(() => runSimulation("failure_face"), 50) }}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors">
                  Face Fail
                </button>
              </div>
              {simState !== "idle" && (
                <button onClick={reset} className="flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                  <RefreshCw className="size-3" /> Reset
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right side: live events + site status */}
        <div className="col-span-2 flex flex-col gap-4">
          {/* Site Status */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground">Live Site Coverage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {sites.map((site) => {
                  const pct = Math.round((site.checkins / site.expected) * 100)
                  return (
                    <div key={site.id} className="flex items-center gap-4">
                      <div className="flex items-center gap-2 w-44 shrink-0">
                        <MapPin className="size-3.5 text-primary shrink-0" />
                        <span className="text-xs text-foreground truncate">{site.name}</span>
                      </div>
                      <Progress value={pct} className="flex-1 h-2" />
                      <div className="flex items-center gap-2 shrink-0 w-24 justify-end">
                        <span className="text-xs text-muted-foreground">{site.checkins}/{site.expected}</span>
                        <Badge
                          variant="secondary"
                          className={`text-xs ${pct >= 90 ? "bg-chart-3/15 text-chart-3" : pct >= 70 ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}
                        >
                          {pct}%
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Live Event Stream */}
          <Card className="border-border bg-card flex-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-foreground">Live Event Stream</CardTitle>
                <div className="flex items-center gap-1.5">
                  <div className="size-1.5 rounded-full bg-chart-3 animate-pulse" />
                  <span className="text-xs text-muted-foreground">Updating</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-0">
                <div className="grid grid-cols-5 text-xs text-muted-foreground pb-2 border-b border-border">
                  <span>Employee</span>
                  <span>ID</span>
                  <span>Site</span>
                  <span>Time</span>
                  <span className="text-right">Status</span>
                </div>
                {recentEvents.map((ev, i) => (
                  <div key={i} className="grid grid-cols-5 py-2.5 border-b border-border/50 text-xs items-center">
                    <span className="text-foreground font-medium truncate pr-2">{ev.name}</span>
                    <span className="text-muted-foreground font-mono">{ev.emp}</span>
                    <span className="text-muted-foreground truncate pr-2">{ev.site}</span>
                    <span className="text-muted-foreground">{ev.time}</span>
                    <div className="flex items-center justify-end gap-1.5">
                      {ev.status === "success" && (
                        <>
                          <CheckCircle2 className="size-3.5 text-chart-3" />
                          <span className="text-chart-3">{ev.match}%</span>
                        </>
                      )}
                      {ev.status === "pending" && (
                        <>
                          <AlertTriangle className="size-3.5 text-primary" />
                          <span className="text-primary">{ev.match}%</span>
                        </>
                      )}
                      {ev.status === "failed" && (
                        <>
                          <XCircle className="size-3.5 text-destructive" />
                          <span className="text-destructive">OOB</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
