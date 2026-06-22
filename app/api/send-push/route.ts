import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { createClient } from "@supabase/supabase-js"

// ── Node.js runtime (web-push doesn't work on Edge) ─────────────────────────
export const runtime = "nodejs"

// ── Supabase Admin Client (bypasses RLS to read subscriptions) ───────────────
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Configure VAPID once ──────────────────────────────────────────────────────
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL ?? "admin@tawreedat.com"}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

// ── POST /api/send-push ───────────────────────────────────────────────────────
// Body: { user_id, title, body, url? }
// Reads all push subscriptions for user_id and sends the notification.
export async function POST(req: NextRequest) {
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

    // ── Fetch subscriptions for this user ─────────────────────────────────
    const { data: subs, error: dbErr } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", user_id)

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: 0, message: "No subscriptions found" })
    }

    // ── Send to all registered devices ───────────────────────────────────
    const payload = JSON.stringify({
      title,
      body,
      url: url ?? "/m",
    })

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth:   sub.auth,
            },
          },
          payload
        )
      )
    )

    // Clean up expired subscriptions (410 Gone)
    const expiredEndpoints: string[] = []
    results.forEach((result, i) => {
      if (
        result.status === "rejected" &&
        (result.reason as any)?.statusCode === 410
      ) {
        expiredEndpoints.push(subs[i].endpoint)
      }
    })

    if (expiredEndpoints.length > 0) {
      await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints)
    }

    const sent   = results.filter((r) => r.status === "fulfilled").length
    const failed = results.length - sent

    return NextResponse.json({ sent, failed })
  } catch (err: any) {
    console.error("[send-push]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
