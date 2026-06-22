"use client"

import { useEffect, useState, useCallback } from "react"
import { CheckCircle2, XCircle, AlertCircle, Info, X } from "lucide-react"

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export type ToastType = "success" | "error" | "info" | "warning"

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

// ─────────────────────────────────────────────
// Helper — call from anywhere, no imports needed
// Usage: toast("Request submitted", "success")
// ─────────────────────────────────────────────
export function toast(message: string, type: ToastType = "info") {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent("tawreedat:toast", { detail: { message, type } })
  )
}

// ─────────────────────────────────────────────
// Container — mount once in layout
// ─────────────────────────────────────────────
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    function handleToast(e: Event) {
      const { message, type = "info" } = (e as CustomEvent<{ message: string; type: ToastType }>).detail
      const id = Math.random().toString(36).slice(2, 9)
      setToasts(prev => [...prev.slice(-3), { id, message, type }]) // max 4
      setTimeout(() => dismiss(id), 3800)
    }

    window.addEventListener("tawreedat:toast", handleToast)
    return () => window.removeEventListener("tawreedat:toast", handleToast)
  }, [dismiss])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-3 left-3 right-3 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <ToastBubble key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// Individual bubble
// ─────────────────────────────────────────────
const config: Record<ToastType, { icon: typeof CheckCircle2; bg: string; iconColor: string }> = {
  success: { icon: CheckCircle2, bg: "bg-chart-3",    iconColor: "text-white" },
  error:   { icon: XCircle,      bg: "bg-destructive", iconColor: "text-white" },
  warning: { icon: AlertCircle,  bg: "bg-chart-4",    iconColor: "text-white" },
  info:    { icon: Info,         bg: "bg-card border border-border shadow-lg", iconColor: "text-primary" },
}

function ToastBubble({
  toast: t,
  onDismiss,
}: {
  toast: ToastItem
  onDismiss: (id: string) => void
}) {
  const { icon: Icon, bg, iconColor } = config[t.type]
  const isColored = t.type !== "info"

  return (
    <div
      className={`
        ${bg} rounded-2xl px-4 py-3
        flex items-center gap-3
        pointer-events-auto
        animate-in slide-in-from-top-2 duration-200
        ${isColored ? "text-white" : "text-foreground"}
      `}
    >
      <Icon className={`size-4 shrink-0 ${iconColor}`} />
      <span className="text-sm font-medium flex-1 leading-snug">{t.message}</span>
      <button
        onClick={() => onDismiss(t.id)}
        className={`shrink-0 ${isColored ? "opacity-70 hover:opacity-100" : "text-muted-foreground hover:text-foreground"}`}
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
