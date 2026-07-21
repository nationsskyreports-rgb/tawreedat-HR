/**
 * Client-side notification helpers.
 *
 * Every path uses ONE of these two functions so we never have to hand-roll
 * "insert into notifications + fetch send-push" again:
 *
 *   notifyUsers(userIds, title, body, url?)  — HR → employees (also admins/managers)
 *   notifyHR(title, body, url?)              — anyone → HR + admins
 */
import { supabase } from "@/lib/supabase"

/**
 * Send a notification (bell + push) to one or more specific users.
 * Requires the caller to be admin/hr/manager (enforced by /api/send-push).
 * Best-effort — never throws.
 */
export async function notifyUsers(
  userIds: string[],
  title: string,
  body: string,
  url = "/m/notifications"
): Promise<void> {
  if (userIds.length === 0) return
  try {
    // 1) Bell notifications
    await supabase.from("notifications").insert(
      userIds.map(user_id => ({
        user_id,
        notification_type: "general",
        title,
        message: body,
        is_read: false,
      }))
    )

    // 2) Push
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    await fetch("/api/send-push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ user_ids: userIds, title, body, url }),
    })
  } catch {
    // Best-effort — never block the calling flow
  }
}

/**
 * Send a notification (bell + push) to ALL HR + admin users.
 * Any authenticated user can call this (typically employees submitting
 * a request that needs review). Best-effort.
 */
export async function notifyHR(
  title: string,
  body: string,
  url = "/"
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    await fetch("/api/notify-hr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ title, body, url }),
    })
  } catch {
    // Best-effort
  }
}

/**
 * Notify a single employee by their EMPLOYEE ID (looks up their profile).
 * Falls back silently if the employee has no linked profile.
 */
export async function notifyEmployeeByEmployeeId(
  employeeId: string,
  title: string,
  body: string,
  url = "/m/notifications"
): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("employee_id", employeeId)
    .single()

  if (!profile?.id) return
  await notifyUsers([profile.id], title, body, url)
}
