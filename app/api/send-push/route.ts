import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

// Roles allowed to trigger push notifications to other users
const ALLOWED_ROLES = ["admin", "hr", "manager"]

export async function POST(req: NextRequest) {
  // ── Lazy init (prevents build-time crash if env vars not yet set) ─────────
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey      = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY
  const vapidPub     = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPriv    = process.env.VAPID_PRIVATE_KEY
  const vapidEmail   = process.env.VAPID_EMAIL ?? "mailto:admin@tawreedat.com"

  if (!supabaseUrl || !anonKey || !serviceKey || !vapidPub || !vapidPriv) {
    return NextResponse.json({ error: "Push notifications not configured" }, { status: 503 })
  }

  // ── AUTH: verify the caller's Supabase JWT ────────────────────────────────
  // Without this check, anyone on the internet could send push notifications
  // to any employee (phishing risk). The middleware skips /api routes, so the
  // route must protect itself.
  const authHeader = req.headers.get("authorization") ?? ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabaseAuth = createClient(supabaseUrl, anonKey)
  const { data: { user: caller }, error: authErr } = await supabaseAuth.auth.getUser(token)

  if (authErr || !caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── AUTHZ: only HR / admin / manager may notify other users ───────────────
  const supabaseAdmin = createClient(supabaseUrl, serviceKey)

  const { data: callerProfile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .single()

  if (!callerProfile || !ALLOWED_ROLES.includes(callerProfile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  webpush.setVapidDetails(vapidEmail, vapidPub, vapidPriv)

  try {
    const { user_id, user_ids, title, body, url } = await req.json() as {
      user_id?:  string
      user_ids?: string[]
      title:     string
      body:      string
      url?:      string
    }

    // Accept a single user_id or a batch of user_ids
    const targets = (user_ids && user_ids.length > 0)
      ? user_ids
      : user_id ? [user_id] : []

    if (targets.length === 0 || !title) {
      return NextResponse.json({ error: "Missing user_id(s) or title" }, { status: 400 })
    }

    const { data: subs, error: dbErr } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .in("user_id", targets)

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
    if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 })

    const payload = JSON.stringify({ title, body, url: url ?? "/m" })

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      )
    )

    // Remove expired subscriptions (410 Gone)
    const expired = subs
      .filter((_, i) => {
        const r = results[i]
        return r.status === "rejected" && (r.reason as { statusCode?: number })?.statusCode === 410
      })
      .map((s) => s.endpoint)

    if (expired.length > 0) {
      await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", expired)
    }

    const sent = results.filter((r) => r.status === "fulfilled").length
    return NextResponse.json({ sent, failed: results.length - sent })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
