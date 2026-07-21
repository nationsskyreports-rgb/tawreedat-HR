/**
 * POST /api/notify-hr
 *
 * Allows any authenticated user (typically employees) to notify HR staff
 * of an event that needs their attention (new leave request, missing punch, etc.).
 *
 * Auth: any authenticated user. No role restriction — but the API always
 * broadcasts only to admin+hr profiles, never to arbitrary users, so it
 * cannot be abused for phishing.
 */
import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const vapidPub    = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPriv   = process.env.VAPID_PRIVATE_KEY
  const vapidEmail  = process.env.VAPID_EMAIL ?? "mailto:admin@tawreedat.com"

  if (!supabaseUrl || !anonKey || !serviceKey || !vapidPub || !vapidPriv) {
    return NextResponse.json({ error: "Push not configured" }, { status: 503 })
  }

  // ── Auth: any authenticated user is allowed ─────────────────────────────
  const authHeader = req.headers.get("authorization") ?? ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabaseAuth = createClient(supabaseUrl, anonKey)
  const { data: { user: caller }, error: authErr } = await supabaseAuth.auth.getUser(token)
  if (authErr || !caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabaseAdmin = createClient(supabaseUrl, serviceKey)

  try {
    const { title, body, url } = await req.json() as { title: string; body: string; url?: string }
    if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 })

    // ── Resolve HR + admin recipients ────────────────────────────────────
    const { data: hrProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .in("role", ["admin", "hr"])

    const hrIds = (hrProfiles ?? []).map(p => p.id)
    if (hrIds.length === 0) return NextResponse.json({ sent: 0 })

    // ── 1) Insert bell notifications ─────────────────────────────────────
    await supabaseAdmin.from("notifications").insert(
      hrIds.map(user_id => ({
        user_id,
        notification_type: "general",
        title,
        message: body,
        is_read: false,
      }))
    )

    // ── 2) Send push to their devices (best-effort) ──────────────────────
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .in("user_id", hrIds)

    if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 })

    webpush.setVapidDetails(vapidEmail, vapidPub, vapidPriv)
    const payload = JSON.stringify({ title, body, url: url ?? "/" })

    const results = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      )
    )

    const dead = subs
      .filter((_, i) => {
        const r = results[i]
        return r.status === "rejected" && (r.reason as { statusCode?: number })?.statusCode === 410
      })
      .map(s => s.endpoint)
    if (dead.length > 0) {
      await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", dead)
    }

    const sent = results.filter(r => r.status === "fulfilled").length
    return NextResponse.json({ sent, failed: results.length - sent })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
