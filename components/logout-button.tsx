"use client"

import { signOutKeepingBiometric } from "@/lib/webauthn"
import { LogOut } from "lucide-react"

export function LogoutButton() {
  const handleLogout = async () => {
    // Biometric enabled → local lock (keeps refresh token valid for biometric re-login)
    // No biometric → full server logout
    await signOutKeepingBiometric()
    window.location.href = "/login"
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors w-full text-left"
    >
      <LogOut className="size-4 shrink-0" />
      <span>Sign out</span>
    </button>
  )
}
