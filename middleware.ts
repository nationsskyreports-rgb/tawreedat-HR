import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

function isMobileDevice(request: NextRequest): boolean {
  const ua = request.headers.get("user-agent") ?? ""
  return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.match(/\.(png|ico|jpg|svg|js|css|json|txt|woff|woff2)$/)
  ) {
    return NextResponse.next()
  }

  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Not logged in
  if (!user) {
    if (pathname === "/login") return response
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Logged in on login page → redirect based on device
  if (pathname === "/login") {
    const preferDesktop = request.cookies.get("prefer_desktop")?.value === "1"
    const mobile = isMobileDevice(request) && !preferDesktop
    return NextResponse.redirect(new URL(mobile ? "/m" : "/", request.url))
  }

  // Check if user chose to stay on desktop (cookie set by "Switch to Desktop" button)
  const preferDesktop = request.cookies.get("prefer_desktop")?.value === "1"
  const mobile = isMobileDevice(request) && !preferDesktop
  const isMobilePath = pathname.startsWith("/m")

  // Mobile device on desktop → go to /m (unless they prefer desktop)
  if (mobile && !isMobilePath) {
    return NextResponse.redirect(new URL("/m", request.url))
  }

  // Desktop browser on /m → go to desktop
  if (!mobile && isMobilePath) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
}
