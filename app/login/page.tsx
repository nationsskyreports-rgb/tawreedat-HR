"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Truck, Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async () => {
    setLoading(true)
    setError("")
    console.log("Attempting login with:", email)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    console.log("Login result:", { data, error })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      window.location.href = "/"
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="size-10 rounded-xl bg-primary flex items-center justify-center">
            <Truck className="size-5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Tawreedat</p>
            <p className="text-xs text-muted-foreground">HRIS Platform</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Sign in</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Enter your credentials to continue</p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@tawreedat.com"
                className="bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 flex flex-col gap-1">
              <p className="font-medium">Login failed</p>
              <p>{error}</p>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !email || !password}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  )
}
