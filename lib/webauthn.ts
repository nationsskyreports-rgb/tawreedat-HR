// Tawreedat HRIS — Biometric Login
// Strategy: Biometric acts as a GATE to a stored SESSION SNAPSHOT (tokens).
// ⚠️ We NEVER store the user's password. Tokens are revocable & rotate;
// a password is permanent — storing it (even base64) was a security hole.
//
// Flow:
//   enable  → verify identity (caller does it) → register platform credential
//             → snapshot current session tokens behind the gate
//   sync    → while logged in, keep the snapshot fresh (tokens rotate)
//   login   → WebAuthn assertion → supabase.auth.setSession(snapshot)
//             → re-snapshot the rotated tokens
//   expired → fall back to password login (one-time), snapshot refreshes after

import { supabase } from "@/lib/supabase"

const BIOMETRIC_KEY = "tawreedat_bio"

type SessionSnapshot = {
  access_token: string
  refresh_token: string
}

type StoredCreds = {
  email: string
  credential_id: string
  session?: SessionSnapshot
  // legacy field from the old (insecure) format — stripped on read
  pwd?: string
}

// ---------------------------------------------------------------------------
// Feature detection
// ---------------------------------------------------------------------------
export function isBiometricSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials !== "undefined"
  )
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isBiometricSupported()) return false
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Storage helpers (with automatic migration off the legacy password format)
// ---------------------------------------------------------------------------
function readStore(): StoredCreds | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(BIOMETRIC_KEY)
    if (!raw) return null
    const creds: StoredCreds = JSON.parse(raw)

    // MIGRATION: purge any legacy stored password immediately
    if (creds.pwd) {
      delete creds.pwd
      localStorage.setItem(BIOMETRIC_KEY, JSON.stringify(creds))
    }

    return creds
  } catch {
    return null
  }
}

function writeStore(creds: StoredCreds): void {
  if (typeof window === "undefined") return
  localStorage.setItem(BIOMETRIC_KEY, JSON.stringify(creds))
}

export function hasBiometricSession(): boolean {
  return readStore() !== null
}

export function getStoredEmail(): string | null {
  return readStore()?.email ?? null
}

// ---------------------------------------------------------------------------
// SYNC — keep the token snapshot fresh while the user is logged in.
// Call on app load and whenever Supabase refreshes the session.
// ---------------------------------------------------------------------------
export async function syncBiometricSession(): Promise<void> {
  try {
    const creds = readStore()
    if (!creds) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.refresh_token) return

    creds.session = {
      access_token:  session.access_token,
      refresh_token: session.refresh_token,
    }
    writeStore(creds)
  } catch {
    // best-effort — never block the UI
  }
}

// ---------------------------------------------------------------------------
// Buffer helpers
// ---------------------------------------------------------------------------
function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let str = ""
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i])
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/")
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const buffer = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return buffer
}

// ---------------------------------------------------------------------------
// ENABLE — register platform credential + snapshot the current session.
// `password` is accepted for backwards-compatible callers (the profile page
// verifies it for identity confirmation) but is NEVER stored.
// ---------------------------------------------------------------------------
export async function enableBiometricLogin(
  email: string,
  _password?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!isBiometricSupported()) {
      return { ok: false, error: "Biometric not supported on this device" }
    }

    const challenge = new Uint8Array(32)
    crypto.getRandomValues(challenge)

    const userIdBytes = new TextEncoder().encode(email)

    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge: challenge.buffer,
      rp: {
        name: "Tawreedat HRIS",
        id: window.location.hostname,
      },
      user: {
        id: userIdBytes,
        name: email,
        displayName: email,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    }

    const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null

    if (!credential) {
      return { ok: false, error: "Biometric setup was cancelled" }
    }

    writeStore({
      email,
      credential_id: bufferToBase64Url(credential.rawId),
    })

    // Snapshot the live session tokens behind the gate
    await syncBiometricSession()

    return { ok: true }
  } catch (err) {
    const e = err as { name?: string; message?: string }
    if (e?.name === "NotAllowedError") {
      return { ok: false, error: "Biometric setup was cancelled" }
    }
    if (e?.name === "InvalidStateError") {
      return { ok: false, error: "Biometric already registered on this device" }
    }
    return { ok: false, error: e?.message ?? "Setup failed" }
  }
}

// ---------------------------------------------------------------------------
// LOGIN — verify biometric, then restore the session from the snapshot.
// ---------------------------------------------------------------------------
export async function loginWithBiometric(): Promise<
  | { ok: true }
  | { ok: false; error: string; needPassword?: boolean }
> {
  try {
    if (!isBiometricSupported()) {
      return { ok: false, error: "Biometric not supported" }
    }

    const creds = readStore()
    if (!creds) {
      return {
        ok: false,
        needPassword: true,
        error: "No biometric setup found. Please sign in with email/password first.",
      }
    }

    if (!creds.session?.refresh_token) {
      // Old-format record (password was purged) or snapshot never captured
      return {
        ok: false,
        needPassword: true,
        error: "Please sign in with your password once to re-link biometric login.",
      }
    }

    const challenge = new Uint8Array(32)
    crypto.getRandomValues(challenge)

    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge: challenge.buffer,
      rpId: window.location.hostname,
      allowCredentials: [
        {
          type: "public-key",
          id: base64UrlToBuffer(creds.credential_id),
        },
      ],
      userVerification: "required",
      timeout: 60000,
    }

    const result = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null

    if (!result) {
      return { ok: false, error: "Biometric verification cancelled" }
    }

    // Biometric verified — restore the session (refreshes/rotates tokens)
    const { data, error } = await supabase.auth.setSession({
      access_token:  creds.session.access_token,
      refresh_token: creds.session.refresh_token,
    })

    if (error || !data.session) {
      // Snapshot expired or was revoked — one-time password fallback
      return {
        ok: false,
        needPassword: true,
        error: "Your session expired. Please sign in with your password once.",
      }
    }

    // Store the ROTATED tokens (old refresh token is now consumed)
    creds.session = {
      access_token:  data.session.access_token,
      refresh_token: data.session.refresh_token,
    }
    writeStore(creds)

    return { ok: true }
  } catch (err) {
    const e = err as { name?: string; message?: string }
    if (e?.name === "NotAllowedError") {
      return { ok: false, error: "Biometric cancelled" }
    }
    return { ok: false, error: e?.message ?? "Biometric verification failed" }
  }
}

// ---------------------------------------------------------------------------
// DISABLE
// ---------------------------------------------------------------------------
export function disableBiometric(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(BIOMETRIC_KEY)
  }
}
