import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const MOBILE_PATHS = ["/m", "/m/checkin", "/m/leave", "/m/payslip", "/m/profile"]
const PUBLIC_PATHS = ["/login"]
const STATIC_PATHS = ["/_next", "/favicon", "/icon-", "/apple-", "/manifest", "/sw.js"]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static assets and public files
  if (STATIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Not logged in → redirect to login (except if already on login)
  if (!user) {
    if (pathname === "/login") return response
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Logged in → get role from profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = profile?.role ?? "employee"
  const isMobilePath = pathname.startsWith("/m")
  const isDesktopRoot = pathname === "/"

  // Employee on desktop root → redirect to mobile
  if (role === "employee" && isDesktopRoot) {
    return NextResponse.redirect(new URL("/m", request.url))
  }

  // Admin/HR/Manager on mobile paths → redirect to desktop
  if (["admin", "hr", "manager"].includes(role) && isMobilePath) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  // Already on login page but logged in
  if (pathname === "/login") {
    if (role === "employee") {
      return NextResponse.redirect(new URL("/m", request.url))
    }
    return NextResponse.redirect(new URL("/", request.url))
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.png$|.*\\.ico$|.*\\.js$|.*\\.json$).*)"],
}
