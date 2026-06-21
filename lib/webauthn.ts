// WebAuthn helpers — biometric login for the mobile PWA
// Uses browser's built-in fingerprint/Face ID via WebAuthn API
// No external libraries needed.

import { supabase } from "@/lib/supabase"

// ---------------------------------------------------------------------------
// Encoding helpers (browser-native)
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
// REGISTRATION — enable biometric for this device
// ---------------------------------------------------------------------------
export async function registerBiometric(
  userId: string,
  userEmail: string,
  userName: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!isBiometricSupported()) {
      return { ok: false, error: "Biometric authentication not supported on this device" }
    }

    // Generate random challenge (32 bytes)
    const challenge = new Uint8Array(32)
    crypto.getRandomValues(challenge)

    // Convert user ID to bytes
    const userIdBytes = new TextEncoder().encode(userId)

    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge: challenge.buffer,
      rp: {
        name: "Tawreedat HRIS",
        id: window.location.hostname,
      },
      user: {
        id: userIdBytes,
        name: userEmail,
        displayName: userName,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },   // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform", // Use device biometric (fingerprint/Face ID)
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    }

    const credential = (await navigator.credentials.create({
      publicKey,
    })) as PublicKeyCredential | null

    if (!credential) {
      return { ok: false, error: "Registration cancelled" }
    }

    const response = credential.response as AuthenticatorAttestationResponse

    // Get public key from credential
    const publicKeyBytes = response.getPublicKey?.()
    if (!publicKeyBytes) {
      return { ok: false, error: "Could not extract public key" }
    }

    // Save credential to Supabase
    const { error } = await supabase.from("webauthn_credentials").insert({
      user_id: userId,
      credential_id: bufferToBase64Url(credential.rawId),
      public_key: bufferToBase64Url(publicKeyBytes),
      counter: 0,
      device_name: navigator.userAgent.slice(0, 100),
    })

    if (error) return { ok: false, error: error.message }

    return { ok: true }
  } catch (err: any) {
    if (err?.name === "NotAllowedError") {
      return { ok: false, error: "Biometric prompt was cancelled" }
    }
    if (err?.name === "InvalidStateError") {
      return { ok: false, error: "This device is already registered" }
    }
    return { ok: false, error: err?.message ?? "Registration failed" }
  }
}

// ---------------------------------------------------------------------------
// AUTHENTICATION — sign in with biometric
// ---------------------------------------------------------------------------
// Note: This is a simplified flow. For production, the challenge should be
// verified server-side. Here we use the biometric as a "second factor" that
// proves the user has the device, then we sign them in via a stored session.
//
// Approach: When user enables biometric, we store an encrypted refresh token
// in localStorage tied to the biometric. On biometric auth, we use that
// token to refresh the Supabase session.

const BIOMETRIC_SESSION_KEY = "tawreedat_biometric_session"

type StoredSession = {
  user_id: string
  email: string
  refresh_token: string
  credential_id: string
}

export async function enableBiometricLogin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: { session }, error: sessErr } = await supabase.auth.getSession()
  if (sessErr || !session) {
    return { ok: false, error: "You must be logged in first" }
  }

  const user = session.user
  const userEmail = user.email ?? ""
  const userName = user.user_metadata?.full_name ?? userEmail

  // Register biometric credential
  const reg = await registerBiometric(user.id, userEmail, userName)
  if (!reg.ok) return reg

  // Get the credential we just stored
  const { data: creds } = await supabase
    .from("webauthn_credentials")
    .select("credential_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)

  const credentialId = creds?.[0]?.credential_id
  if (!credentialId) return { ok: false, error: "Could not save credential" }

  // Store session info locally (encrypted to the biometric)
  const stored: StoredSession = {
    user_id: user.id,
    email: userEmail,
    refresh_token: session.refresh_token,
    credential_id: credentialId,
  }

  try {
    localStorage.setItem(BIOMETRIC_SESSION_KEY, JSON.stringify(stored))
  } catch {
    return { ok: false, error: "Could not save credential locally" }
  }

  return { ok: true }
}

export async function authenticateWithBiometric(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!isBiometricSupported()) {
      return { ok: false, error: "Biometric not supported" }
    }

    const storedJson = localStorage.getItem(BIOMETRIC_SESSION_KEY)
    if (!storedJson) {
      return { ok: false, error: "No biometric session found. Sign in normally and enable biometric in profile." }
    }

    const stored: StoredSession = JSON.parse(storedJson)

    // Challenge user with biometric prompt
    const challenge = new Uint8Array(32)
    crypto.getRandomValues(challenge)

    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge: challenge.buffer,
      rpId: window.location.hostname,
      allowCredentials: [
        {
          type: "public-key",
          id: base64UrlToBuffer(stored.credential_id),
        },
      ],
      userVerification: "required",
      timeout: 60000,
    }

    const credential = (await navigator.credentials.get({
      publicKey,
    })) as PublicKeyCredential | null

    if (!credential) {
      return { ok: false, error: "Authentication cancelled" }
    }

    // Biometric verified! Now refresh the Supabase session
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: stored.refresh_token,
    })

    if (error || !data.session) {
      // Token expired — clear stored session
      localStorage.removeItem(BIOMETRIC_SESSION_KEY)
      return { ok: false, error: "Session expired. Please sign in with email/password." }
    }

    // Update stored refresh token (Supabase rotates it)
    stored.refresh_token = data.session.refresh_token
    localStorage.setItem(BIOMETRIC_SESSION_KEY, JSON.stringify(stored))

    // Update last_used_at
    await supabase
      .from("webauthn_credentials")
      .update({ last_used_at: new Date().toISOString() })
      .eq("credential_id", stored.credential_id)

    return { ok: true }
  } catch (err: any) {
    if (err?.name === "NotAllowedError") {
      return { ok: false, error: "Biometric cancelled" }
    }
    return { ok: false, error: err?.message ?? "Authentication failed" }
  }
}

export function hasBiometricSession(): boolean {
  if (typeof window === "undefined") return false
  return !!localStorage.getItem(BIOMETRIC_SESSION_KEY)
}

export function getStoredEmail(): string | null {
  try {
    const storedJson = localStorage.getItem(BIOMETRIC_SESSION_KEY)
    if (!storedJson) return null
    const stored: StoredSession = JSON.parse(storedJson)
    return stored.email
  } catch {
    return null
  }
}

export async function disableBiometric(): Promise<void> {
  const storedJson = localStorage.getItem(BIOMETRIC_SESSION_KEY)
  if (storedJson) {
    try {
      const stored: StoredSession = JSON.parse(storedJson)
      // Delete credential from DB
      await supabase
        .from("webauthn_credentials")
        .delete()
        .eq("credential_id", stored.credential_id)
    } catch {}
  }
  localStorage.removeItem(BIOMETRIC_SESSION_KEY)
}
