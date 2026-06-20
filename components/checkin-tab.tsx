"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  MapPin, Navigation, CheckCircle2, XCircle, Loader2,
  Clock, LogOut, AlertTriangle, User
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type {
  Site, Employee, AttendanceLog, AttendanceStatus, CheckinResultType
} from "@/lib/types"

type GeoPosition = {
  lat: number
  lng: number
  accuracy: number
}

// Haversine formula — distance between two GPS points in meters
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function CheckinTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [todayLogs, setTodayLogs] = useState<AttendanceLog[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("")
  const [selectedSiteId, setSelectedSiteId] = useState<string>("")

  const [position, setPosition] = useState<GeoPosition | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [fetchingGps, setFetchingGps] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [resultMsg, setResultMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function loadData() {
    setLoading(true)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [empRes, siteRes, logsRes] = await Promise.all([
      supabase.from("employees").select("*").eq("status", "active").order("full_name"),
      supabase.from("sites").select("*").eq("is_active", true).order("name"),
      supabase.from("attendance_logs")
        .select("*")
        .gte("checkin_at", todayStart.toISOString())
        .order("checkin_at", { ascending: false })
    ])
    setEmployees((empRes.data ?? []) as Employee[])
    setSites((siteRes.data ?? []) as Site[])
    setTodayLogs((logsRes.data ?? []) as AttendanceLog[])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  function captureGPS() {
    setGpsError(null)
    setResultMsg(null)

    if (!navigator.geolocation) {
      setGpsError("Geolocation not supported on this device")
      return
    }

    setFetchingGps(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setFetchingGps(false)
      },
      (err) => {
        setGpsError(
          err.code === 1 ? "Permission denied. Allow location access in browser settings."
          : err.code === 2 ? "Position unavailable. Check GPS/network."
          : err.code === 3 ? "Request timed out. Try again."
          : "Failed to get location"
        )
        setFetchingGps(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  // Compute geofence info for selected site
  const selectedSite = sites.find((s) => s.id === selectedSiteId)
  const distance =
    position && selectedSite && selectedSite.lat && selectedSite.lng
      ? distanceMeters(position.lat, position.lng, selectedSite.lat, selectedSite.lng)
      : null
  const withinGeofence =
    distance !== null && selectedSite?.radius_meters
      ? distance <= selectedSite.radius_meters
      : null

  // Check if selected employee already checked in today
  const existingCheckin = todayLogs.find(
    (l) => l.employee_id === selectedEmployeeId && !l.checkout_at
  )

  async function handleCheckIn() {
    if (!selectedEmployeeId) return setResultMsg({ ok: false, text: "Select an employee" })
    if (!selectedSiteId) return setResultMsg({ ok: false, text: "Select a site" })
    if (!position) return setResultMsg({ ok: false, text: "Capture GPS location first" })

    setSubmitting(true)
    setResultMsg(null)

    let checkinResult: CheckinResultType = "success"
    let status: AttendanceStatus = "present"

    if (withinGeofence === false) {
      checkinResult = "failed_geofence"
      status = "absent"
    }

    const { error } = await supabase.from("attendance_logs").insert({
      employee_id: selectedEmployeeId,
      site_id: selectedSiteId,
      checkin_at: new Date().toISOString(),
      lat: position.lat,
      lng: position.lng,
      status,
      checkin_result: checkinResult,
      checkin_method: "mobile",
      device_info: {
        accuracy_meters: Math.round(position.accuracy),
        user_agent: navigator.userAgent,
      },
    })

    setSubmitting(false)

    if (error) {
      setResultMsg({ ok: false, text: error.message })
      return
    }

    setResultMsg({
      ok: checkinResult === "success",
      text: checkinResult === "success"
        ? "Check-in successful!"
        : `Check-in recorded but outside geofence (${Math.round(distance ?? 0)}m away)`,
    })

    // Reset and reload
    setPosition(null)
    setSelectedEmployeeId("")
    setSelectedSiteId("")
    await loadData()
  }

  async function handleCheckOut(logId: string) {
    if (!confirm("Confirm check-out?")) return

    const { error } = await supabase.from("attendance_logs")
      .update({ checkout_at: new Date().toISOString() })
      .eq("id", logId)

    if (error) return alert(error.message)
    await loadData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Field Check-In</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          GPS-verified attendance · {todayLogs.length} check-ins today
        </p>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Check-in form */}
        <Card className="col-span-12 lg:col-span-5 border-border bg-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="size-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">New Check-In</h2>
            </div>

            <div className="flex flex-col gap-3">
              <FormField label="Employee">
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="form-field"
                >
                  <option value="">Select employee...</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.employee_no} — {e.full_name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Site">
                <select
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="form-field"
                >
                  <option value="">Select site...</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.radius_meters ? `(${s.radius_meters}m radius)` : ""}
                    </option>
                  ))}
                </select>
              </FormField>

              {existingCheckin && (
                <div className="rounded-lg bg-primary/8 border border-primary/15 p-3 flex items-start gap-2">
                  <AlertTriangle className="size-3.5 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-primary">Already checked in today</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      at {new Date(existingCheckin.checkin_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.
                      Check out from the list below.
                    </p>
                  </div>
                </div>
              )}

              {/* GPS Capture */}
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-foreground">GPS Location</span>
                  <button
                    onClick={captureGPS}
                    disabled={fetchingGps}
                    className="flex items-center gap-1.5 px-3 py-1 text-[11px] bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-60 transition-colors"
                  >
                    {fetchingGps ? <Loader2 className="size-3 animate-spin" /> : <Navigation className="size-3" />}
                    {position ? "Re-capture" : "Capture GPS"}
                  </button>
                </div>

                {gpsError && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <XCircle className="size-3" /> {gpsError}
                  </p>
                )}

                {position && (
                  <div className="space-y-1.5 mt-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Coordinates</span>
                      <span className="font-mono text-foreground">
                        {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Accuracy</span>
                      <span className="font-mono text-foreground">±{Math.round(position.accuracy)}m</span>
                    </div>

                    {selectedSite?.lat && selectedSite?.lng && distance !== null && (
                      <>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Distance from site</span>
                          <span className={`font-mono ${withinGeofence ? "text-chart-3" : "text-destructive"}`}>
                            {distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(2)}km`}
                          </span>
                        </div>

                        {withinGeofence !== null && (
                          <div className={`flex items-center gap-1.5 text-[11px] mt-2 px-2 py-1.5 rounded ${
                            withinGeofence
                              ? "bg-chart-3/10 text-chart-3"
                              : "bg-destructive/10 text-destructive"
                          }`}>
                            {withinGeofence ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                            {withinGeofence ? "Inside geofence" : "Outside geofence"}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {resultMsg && (
                <div className={`rounded-lg px-3 py-2 text-xs flex items-center gap-2 ${
                  resultMsg.ok
                    ? "bg-chart-3/10 border border-chart-3/30 text-chart-3"
                    : "bg-destructive/10 border border-destructive/30 text-destructive"
                }`}>
                  {resultMsg.ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                  {resultMsg.text}
                </div>
              )}

              <button
                onClick={handleCheckIn}
                disabled={submitting || !selectedEmployeeId || !selectedSiteId || !position || !!existingCheckin}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {submitting ? "Submitting..." : "Submit Check-In"}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Today's logs */}
        <Card className="col-span-12 lg:col-span-7 border-border bg-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-chart-3" />
                <h2 className="text-sm font-semibold text-foreground">Today's Activity</h2>
              </div>
              <Badge variant="secondary" className="text-xs">{todayLogs.length} entries</Badge>
            </div>

            {todayLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No check-ins yet today.
              </p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-auto">
                {todayLogs.map((log) => {
                  const emp = employees.find((e) => e.id === log.employee_id)
                  const site = sites.find((s) => s.id === log.site_id)
                  const isCheckedOut = !!log.checkout_at
                  const statusColor =
                    log.checkin_result === "success" ? "bg-chart-3/15 text-chart-3"
                    : log.checkin_result === "failed_geofence" ? "bg-destructive/15 text-destructive"
                    : "bg-primary/15 text-primary"

                  return (
                    <div key={log.id} className="bg-secondary/30 rounded-lg p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                          <User className="size-3.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {emp?.full_name ?? "Unknown employee"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {site?.name ?? "—"} · {new Date(log.checkin_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                            {isCheckedOut && ` → ${new Date(log.checkout_at!).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className={`text-[10px] ${statusColor}`}>
                          {log.checkin_result?.replace("_", " ") ?? log.status}
                        </Badge>
                        {!isCheckedOut && (
                          <button
                            onClick={() => handleCheckOut(log.id)}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] bg-secondary text-foreground rounded hover:bg-secondary/80 transition-colors"
                          >
                            <LogOut className="size-2.5" />
                            Check-out
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
