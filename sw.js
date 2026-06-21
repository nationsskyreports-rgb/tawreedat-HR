// Tawreedat HRIS — Service Worker
// ⚠️ Bump CACHE_VERSION on every deployment
const CACHE_VERSION = "v3"
const CACHE_NAME = `tawreedat-${CACHE_VERSION}`

const STATIC_ASSETS = [
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-icon.png",
  "/favicon.ico",
]

const MOBILE_ROUTES = [
  "/m",
  "/m/checkin",
  "/m/leave",
  "/m/payslip",
  "/m/profile",
  "/login",
]

const ALL_CACHED = [...STATIC_ASSETS, ...MOBILE_ROUTES]

// Install — cache everything
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ALL_CACHED).catch((err) => {
        console.warn("[SW] Some assets failed to cache:", err)
      })
    })
  )
  self.skipWaiting()
})

// Activate — remove old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("tawreedat-") && k !== CACHE_NAME)
          .map((k) => {
            console.log("[SW] Deleting old cache:", k)
            return caches.delete(k)
          })
      )
    )
  )
  self.clients.claim()
})

// Fetch strategy:
// - API routes / Supabase → Network only (never cache)
// - Static assets → Cache first
// - Pages → Network first, fallback to cache
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET
  if (request.method !== "GET") return

  // Skip external (Supabase, fonts, etc.)
  if (url.origin !== self.location.origin) return

  // Skip Next.js internals and API routes → always network
  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/api/")
  ) return

  // Static files (icons, manifest) → cache first
  const isStatic = STATIC_ASSETS.some(
    (a) => url.pathname === a || url.pathname.startsWith("/_next/static/")
  )

  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached || fetch(request).then((res) => {
          if (res.status === 200) {
            caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()))
          }
          return res
        })
      )
    )
    return
  }

  // Pages → Network first, fallback to cache, then offline page
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.status === 200) {
          caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()))
        }
        return res
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached
          // Offline fallback
          if (request.mode === "navigate") {
            return caches.match("/m") || caches.match("/login")
          }
          return new Response("Offline", { status: 503 })
        })
      })
  )
})
