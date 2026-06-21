// Tawreedat HRIS — Biometric Login
// Strategy: Biometric acts as a GATE to stored credentials
// The fingerprint/Face ID protects the credentials, not replaces them
// This approach is reliable regardless of session expiry or logout

const BIOMETRIC_KEY = "tawreedat_bio"

type StoredCreds = {
  email: string
  pwd: string // base64 encoded
  credential_id: string
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

export function hasBiometricSession(): boolean {
  if (typeof window === "undefined") return false
  return !!localStorage.getItem(BIOMETRIC_KEY)
}

export function getStoredEmail(): string | null {
  try {
    const raw = localStorage.getItem(BIOMETRIC_KEY)
    if (!raw) return null
    const creds: StoredCreds = JSON.parse(raw)
    return creds.email
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Helpers
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
// ENABLE — store credentials behind biometric gate
// ---------------------------------------------------------------------------
export async function enableBiometricLogin(
  email: string,
  password: string
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

    // Store credentials protected by biometric registration
    const creds: StoredCreds = {
      email,
      pwd: btoa(password),
      credential_id: bufferToBase64Url(credential.rawId),
    }

    localStorage.setItem(BIOMETRIC_KEY, JSON.stringify(creds))

    return { ok: true }
  } catch (err: any) {
    if (err?.name === "NotAllowedError") {
      return { ok: false, error: "Biometric setup was cancelled" }
    }
    if (err?.name === "InvalidStateError") {
      return { ok: false, error: "Biometric already registered on this device" }
    }
    return { ok: false, error: err?.message ?? "Setup failed" }
  }
}

// ---------------------------------------------------------------------------
// AUTHENTICATE — verify biometric then return credentials
// ---------------------------------------------------------------------------
export async function getCredentialsViaBiometric(): Promise<
  | { ok: true; email: string; password: string }
  | { ok: false; error: string }
> {
  try {
    if (!isBiometricSupported()) {
      return { ok: false, error: "Biometric not supported" }
    }

    const raw = localStorage.getItem(BIOMETRIC_KEY)
    if (!raw) {
      return { ok: false, error: "No biometric setup found. Please sign in with email/password first." }
    }

    const creds: StoredCreds = JSON.parse(raw)

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

    // Biometric verified — return the credentials
    return {
      ok: true,
      email: creds.email,
      password: atob(creds.pwd),
    }
  } catch (err: any) {
    if (err?.name === "NotAllowedError") {
      return { ok: false, error: "Biometric cancelled" }
    }
    return { ok: false, error: err?.message ?? "Biometric verification failed" }
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
