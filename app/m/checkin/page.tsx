"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, MapPin, Navigation, CheckCircle2, XCircle,
  Loader2, Clock, LogOut, AlertTriangle, User, CalendarClock
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type {
  Site, Employee, AttendanceLog, AttendanceStatus, CheckinResultType,
  ShiftAssignment, Shift
} from "@/lib/types"

type GeoPosition = { lat: number; lng: number; accuracy: number }

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// Convert "HH:MM:SS" to minutes since midnight
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + (m ?? 0)
}

export default function MobileCheckinPage() {
  const router = useRouter()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [sites, setSites] = useState<Site[]>([])
  const [todayLogs, setTodayLogs] = useState<AttendanceLog[]>([])
  const [todayShift, setTodayShift] = useState<{ shift: Shift; assignment: ShiftAssignment } | null>(null)
  const [loading, setLoading] = useState(true)

  const [selectedSiteId, setSelectedSiteId] = useState<string>("")
  const [position, setPosition] = useState<GeoPosition | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [fetchingGps, setFetchingGps] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resultMsg, setResultMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    const { data: profileData } = await supabase
      .from("profiles").select("*").eq("id", user.id).single()
    if (!profileData?.employee_id) { setLoading(false); return }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayStr = todayStart.toISOString().split("T")[0]

    const [empRes, sitesRes, logsRes, shiftRes] = await Promise.all([
      supabase.from("employees").select("*").eq("id", profileData.employee_id).single(),
      supabase.from("sites").select("*").eq("is_active", true).order("name"),
      supabase.from("attendance_logs")
        .select("*")
        .eq("employee_id", profileData.employee_id)
        .gte("checkin_at", todayStart.toISOString())
        .order("checkin_at", { ascending: false }),
      supabase.from("shift_assignments").select("*, shifts(*)")
        .eq("employee_id", profileData.employee_id)
        .eq("assignment_date", todayStr).maybeSingle(),
    ])

    setEmployee(empRes.data as Employee | null)
    setSites((sitesRes.data ?? []) as Site[])
    setTodayLogs((logsRes.data ?? []) as AttendanceLog[])

    if (shiftRes.data) {
      const sd = shiftRes.data as any
      setTodayShift({ shift: sd.shifts, assignment: sd })
      // Auto-select shift's site if present
      if (sd.site_id) setSelectedSiteId(sd.site_id)
      else if (sd.shifts?.site_id) setSelectedSiteId(sd.shifts.site_id)
    }

    if (!selectedSiteId) {
      if (empRes.data?.site_id) setSelectedSiteId(empRes.data.site_id)
      else if (sitesRes.data && sitesRes.data.length > 0) setSelectedSiteId(sitesRes.data[0].id)
    }

    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  function captureGPS() {
    setGpsError(null); setResultMsg(null)
    if (!navigator.geolocation) { setGpsError("GPS not supported"); return }

    setFetchingGps(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })
        setFetchingGps(false)
      },
      (err) => {
        setGpsError(
          err.code === 1 ? "Permission denied. Enable location in settings."
          : err.code === 2 ? "Position unavailable. Check GPS."
          : err.code === 3 ? "Timed out. Try again."
          : "Failed to get location"
        )
        setFetchingGps(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  const selectedSite = sites.find((s) => s.id === selectedSiteId)
  const distance =
    position && selectedSite && selectedSite.lat && selectedSite.lng
      ? distanceMeters(position.lat, position.lng, selectedSite.lat, selectedSite.lng)
      : null
  const withinGeofence =
    distance !== null && selectedSite?.radius_meters ? distance <= selectedSite.radius_meters : null

  const existingCheckin = todayLogs.find((l) => !l.checkout_at)

  // Compute shift validation
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  let shiftValidation: {
    hasShift: boolean
    isOnTime: boolean
    isLate: boolean
    isEarly: boolean
    lateMinutes: number
    message: string
    color: string
  } = {
    hasShift: false,
    isOnTime: false,
    isLate: false,
    isEarly: false,
    lateMinutes: 0,
    message: "No shift scheduled today",
    color: "text-muted-foreground",
  }

  if (todayShift) {
    const startMin = timeToMinutes(todayShift.shift.start_time)
    const endMin = timeToMinutes(todayShift.shift.end_time)
    const grace = todayShift.shift.grace_period_minutes ?? 15

    shiftValidation.hasShift = true

    if (currentMinutes < startMin - 30) {
      shiftValidation.isEarly = true
      shiftValidation.message = `Too early. Shift starts at ${todayShift.shift.start_time.slice(0, 5)}.`
      shiftValidation.color = "text-primary"
    } else if (currentMinutes <= startMin + grace) {
      shiftValidation.isOnTime = true
      shiftValidation.message = `On time! Shift: ${todayShift.shift.start_time.slice(0, 5)}-${todayShift.shift.end_time.slice(0, 5)}`
      shiftValidation.color = "text-chart-3"
    } else if (currentMinutes <= endMin) {
      shiftValidation.isLate = true
      shiftValidation.lateMinutes = currentMinutes - startMin
      shiftValidation.message = `Late by ${shiftValidation.lateMinutes} minutes`
      shiftValidation.color = "text-destructive"
    } else {
      shiftValidation.message = `Shift ended at ${todayShift.shift.end_time.slice(0, 5)}`
      shiftValidation.color = "text-destructive"
    }
  }

  async function handleCheckIn() {
    if (!employee || !selectedSiteId || !position) return
    setSubmitting(true); setResultMsg(null)

    let checkinResult: CheckinResultType = "success"
    let status: AttendanceStatus = "present"
    let lateMinutes = 0

    if (withinGeofence === false) {
      checkinResult = "failed_geofence"
      status = "absent"
    } else if (shiftValidation.isLate) {
      status = "late"
      lateMinutes = shiftValidation.lateMinutes
    }

    const { error } = await supabase.from("attendance_logs").insert({
      employee_id: employee.id,
      site_id: selectedSiteId,
      checkin_at: new Date().toISOString(),
      lat: position.lat,
      lng: position.lng,
      status,
      checkin_result: checkinResult,
      late_minutes: lateMinutes,
      checkin_method: "mobile",
      device_info: {
        accuracy_meters: Math.round(position.accuracy),
        user_agent: navigator.userAgent,
        shift_id: todayShift?.shift.id ?? null,
      },
    })

    setSubmitting(false)

    if (error) { setResultMsg({ ok: false, text: error.message }); return }

    let msg = "Check-in successful!"
    if (checkinResult === "failed_geofence") {
      msg = `Recorded but outside geofence (${Math.round(distance ?? 0)}m away)`
    } else if (status === "late") {
      msg = `Checked in — late by ${lateMinutes} min`
    }

    setResultMsg({ ok: checkinResult === "success", text: msg })
    setPosition(null)
    await loadData()
  }

  async function handleCheckOut(logId: string, checkinAt: string) {
    if (!confirm("Confirm check-out?")) return

    // Compute overtime if applicable
    let overtimeMinutes = 0
    if (todayShift) {
      const endMin = timeToMinutes(todayShift.shift.end_time)
      const nowMin = currentMinutes
      if (nowMin > endMin) overtimeMinutes = nowMin - endMin
    }

    const { error } = await supabase.from("attendance_logs")
      .update({
        checkout_at: new Date().toISOString(),
        overtime_minutes: overtimeMinutes,
      })
      .eq("id", logId)
    if (error) return alert(error.message)
    await loadData()
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" /> Loading...
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <User className="size-10 text-muted-foreground mb-3" />
        <p className="text-sm text-foreground">No employee record linked.</p>
        <button onClick={() => router.push("/m")} className="mt-4 text-xs text-primary">Back home</button>
      </div>
    )
  }

  return (
    <>
      <header className="shrink-0 bg-card border-b border-border px-3 py-2.5 flex items-center gap-2">
        <button onClick={() => router.push("/m")} className="p-1.5 text-muted-foreground active:text-foreground">
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-sm font-semibold text-foreground">Field Check-In</h1>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 py-3 space-y-3">

          {/* Shift Card */}
          <div className={`rounded-2xl p-4 border ${
            shiftValidation.hasShift
              ? shiftValidation.isOnTime
                ? "bg-chart-3/5 border-chart-3/30"
                : shiftValidation.isLate
                  ? "bg-destructive/5 border-destructive/30"
                  : "bg-primary/5 border-primary/30"
              : "bg-card border-border"
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <CalendarClock className={`size-4 ${shiftValidation.color}`} />
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Your Shift Today</p>
            </div>

            {todayShift ? (
              <>
                <p className="text-sm font-semibold text-foreground">{todayShift.shift.name}</p>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                  {todayShift.shift.start_time.slice(0, 5)} – {todayShift.shift.end_time.slice(0, 5)}
                </p>
                <p className={`text-xs font-medium mt-2 ${shiftValidation.color}`}>
                  {shiftValidation.message}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground italic">No shift assigned for today. Contact your supervisor.</p>
            )}
          </div>

          {/* Site selector */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Site</p>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="w-full bg-secondary/60 text-foreground text-sm rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-primary"
            >
              <option value="">Select site...</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.radius_meters ? `(${s.radius_meters}m)` : ""}
                </option>
              ))}
            </select>
          </div>

          {existingCheckin && (
            <div className="bg-primary/10 border border-primary/30 rounded-2xl p-3 flex items-start gap-2.5">
              <AlertTriangle className="size-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-primary">Already checked in</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Since {new Date(existingCheckin.checkin_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.
                  Use Check-out below.
                </p>
              </div>
            </div>
          )}

          {/* GPS */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">GPS Location</p>
              <button
                onClick={captureGPS}
                disabled={fetchingGps}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] bg-primary/10 text-primary rounded-lg active:bg-primary/20 disabled:opacity-60 transition-colors"
              >
                {fetchingGps ? <Loader2 className="size-3 animate-spin" /> : <Navigation className="size-3" />}
                {position ? "Re-capture" : "Capture"}
              </button>
            </div>

            {gpsError && (
              <p className="text-[11px] text-destructive flex items-center gap-1.5 mb-2">
                <XCircle className="size-3" /> {gpsError}
              </p>
            )}

            {position ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-secondary/40 rounded-lg px-3 py-2">
                    <p className="text-[9px] text-muted-foreground uppercase">Coordinates</p>
                    <p className="text-[10px] font-mono text-foreground truncate">{position.lat.toFixed(4)}, {position.lng.toFixed(4)}</p>
                  </div>
                  <div className="bg-secondary/40 rounded-lg px-3 py-2">
                    <p className="text-[9px] text-muted-foreground uppercase">Accuracy</p>
                    <p className="text-[10px] font-mono text-foreground">±{Math.round(position.accuracy)}m</p>
                  </div>
                </div>

                {selectedSite?.lat && selectedSite?.lng && distance !== null && (
                  <div className={`rounded-lg px-3 py-2.5 flex items-center justify-between ${
                    withinGeofence ? "bg-chart-3/10 border border-chart-3/30" : "bg-destructive/10 border border-destructive/30"
                  }`}>
                    <div className="flex items-center gap-2">
                      {withinGeofence ? <CheckCircle2 className="size-3.5 text-chart-3" /> : <XCircle className="size-3.5 text-destructive" />}
                      <span className={`text-xs font-medium ${withinGeofence ? "text-chart-3" : "text-destructive"}`}>
                        {withinGeofence ? "Inside geofence" : "Outside geofence"}
                      </span>
                    </div>
                    <span className={`text-xs font-mono ${withinGeofence ? "text-chart-3" : "text-destructive"}`}>
                      {distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(2)}km`}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">Tap Capture to get your location</p>
            )}
          </div>

          {resultMsg && (
            <div className={`rounded-xl px-3 py-2.5 text-xs flex items-center gap-2 ${
              resultMsg.ok ? "bg-chart-3/10 border border-chart-3/30 text-chart-3" : "bg-destructive/10 border border-destructive/30 text-destructive"
            }`}>
              {resultMsg.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <XCircle className="size-4 shrink-0" />}
              <span>{resultMsg.text}</span>
            </div>
          )}

          <button
            onClick={handleCheckIn}
            disabled={submitting || !selectedSiteId || !position || !!existingCheckin}
            className="w-full py-4 bg-primary text-primary-foreground rounded-2xl text-base font-semibold active:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
          >
            {submitting ? (
              <><Loader2 className="size-5 animate-spin" /> Submitting...</>
            ) : (
              <><CheckCircle2 className="size-5" /> Check In</>
            )}
          </button>

          {/* Today's activity */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Today's Activity</p>
              <span className="text-[10px] text-muted-foreground">{todayLogs.length} entries</span>
            </div>

            {todayLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">No activity yet today</p>
            ) : (
              <div className="space-y-2">
                {todayLogs.map(log => {
                  const site = sites.find(s => s.id === log.site_id)
                  const isCheckedOut = !!log.checkout_at
                  const statusColor =
                    log.status === "late" ? "bg-destructive/15 text-destructive"
                    : log.checkin_result === "success" ? "bg-chart-3/15 text-chart-3"
                    : log.checkin_result === "failed_geofence" ? "bg-destructive/15 text-destructive"
                    : "bg-primary/15 text-primary"

                  return (
                    <div key={log.id} className="bg-secondary/30 rounded-xl p-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                          <Clock className="size-3.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground">
                            {new Date(log.checkin_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                            {isCheckedOut && (
                              <span className="text-muted-foreground">
                                {" → "}{new Date(log.checkout_at!).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {site?.name ?? "—"}
                            {(log.late_minutes ?? 0) > 0 && <span className="text-destructive ml-1">· Late {log.late_minutes}m</span>}
                            {(log.overtime_minutes ?? 0) > 0 && <span className="text-chart-3 ml-1">· OT {log.overtime_minutes}m</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor}`}>
                          {log.status === "late" ? "late" : log.checkin_result?.replace("_", " ") ?? log.status}
                        </span>
                        {!isCheckedOut && (
                          <button
                            onClick={() => handleCheckOut(log.id, log.checkin_at)}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] bg-secondary text-foreground rounded active:bg-secondary/60"
                          >
                            <LogOut className="size-2.5" />Out
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="h-3" />
        </div>
      </main>
    </>
  )
}
