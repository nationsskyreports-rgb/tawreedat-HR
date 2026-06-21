"use client"

import { supabase } from "@/lib/supabase"
import { hasBiometricSession } from "@/lib/webauthn"
import { LogOut } from "lucide-react"

export function LogoutButton() {
  const handleLogout = async () => {
    // If biometric is enabled → local logout only (keeps refresh token valid for biometric re-login)
    // If no biometric → full server logout
    const scope = hasBiometricSession() ? "local" : "global"
    await supabase.auth.signOut({ scope })
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
