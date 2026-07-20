// Tawreedat HRIS — Service Worker
// ⚠️ Bump CACHE_VERSION on every deployment
const CACHE_VERSION = "v5"
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
  "/m/attendance",
  "/m/leave",
  "/m/payslip",
  "/m/profile",
  "/login",
]

const ALL_CACHED = [...STATIC_ASSETS, ...MOBILE_ROUTES]

// ── Install ─────────────────────────────────────────────────────────────────
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

// ── Activate ─────────────────────────────────────────────────────────────────
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

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== "GET") return
  if (url.origin !== self.location.origin) return
  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/api/")
  ) return

  const isStatic = STATIC_ASSETS.some(
    (a) => url.pathname === a || url.pathname.startsWith("/_next/static/")
  )

  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached || fetch(request).then((res) => {
          if (res.status === 200) {
            // Clone BEFORE returning — the body can only be read once
            const copy = res.clone()
            caches.open(CACHE_NAME).then((c) => c.put(request, copy))
          }
          return res
        })
      )
    )
    return
  }

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.status === 200) {
          // Clone BEFORE returning — the body can only be read once
          const copy = res.clone()
          caches.open(CACHE_NAME).then((c) => c.put(request, copy))
        }
        return res
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached
          if (request.mode === "navigate") {
            return caches.match("/m").then((m) =>
              m || caches.match("/login").then((l) => l || new Response("Offline", { status: 503 }))
            )
          }
          return new Response("Offline", { status: 503 })
        })
      })
  )
})

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return

  let data = {}
  try {
    data = event.data.json()
  } catch {
    data = { title: "Tawreedat", body: event.data.text() }
  }

  const {
    title = "Tawreedat HRIS",
    body  = "You have a new notification",
    url   = "/m",
    icon  = "/icon-192.png",
  } = data

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge:   "/favicon.ico",
      data:    { url },
      vibrate: [100, 50, 100],
      requireInteraction: false,
    })
  )
})

// ── Notification Click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url ?? "/m"

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If app already open, focus it and navigate
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus()
            client.navigate(targetUrl)
            return
          }
        }
        // Otherwise open a new window
        return clients.openWindow(targetUrl)
      })
  )
})
