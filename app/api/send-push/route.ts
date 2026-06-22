import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  // ── Lazy init (prevents build-time crash if env vars not yet set) ─────────
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY
  const vapidPub     = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPriv    = process.env.VAPID_PRIVATE_KEY
  const vapidEmail   = process.env.VAPID_EMAIL ?? "mailto:admin@tawreedat.com"

  if (!supabaseUrl || !serviceKey || !vapidPub || !vapidPriv) {
    return NextResponse.json({ error: "Push notifications not configured" }, { status: 503 })
  }

  webpush.setVapidDetails(vapidEmail, vapidPub, vapidPriv)

  const supabaseAdmin = createClient(supabaseUrl, serviceKey)

  try {
    const { user_id, title, body, url } = await req.json() as {
      user_id: string
      title:   string
      body:    string
      url?:    string
    }

    if (!user_id || !title) {
      return NextResponse.json({ error: "Missing user_id or title" }, { status: 400 })
    }

    const { data: subs, error: dbErr } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", user_id)

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
      .filter((_, i) => (results[i] as any)?.reason?.statusCode === 410)
      .map((s) => s.endpoint)

    if (expired.length > 0) {
      await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", expired)
    }

    const sent = results.filter((r) => r.status === "fulfilled").length
    return NextResponse.json({ sent, failed: results.length - sent })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
