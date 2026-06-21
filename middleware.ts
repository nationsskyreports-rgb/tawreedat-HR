import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

function isMobileDevice(request: NextRequest): boolean {
  const ua = request.headers.get("user-agent") ?? ""
  return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static files completely
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
        setAll: (cookiesToSet) => {
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
    const mobile = isMobileDevice(request)
    return NextResponse.redirect(
      new URL(mobile ? "/m" : "/", request.url)
    )
  }

  const mobile = isMobileDevice(request)
  const isMobilePath = pathname.startsWith("/m")
  const isDesktopPath = pathname === "/" || (!isMobilePath && pathname !== "/login")

  // Mobile device on desktop → go to /m
  if (mobile && isDesktopPath) {
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
