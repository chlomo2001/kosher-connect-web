// Authenticated encryption for secrets at rest (SIM carrier passwords).
//
// AES-256-GCM. The key comes from SIM_CRED_KEY (32 bytes, given as base64 or
// hex). Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
//
// Fail-closed: with no valid key, encryptSecret returns null — callers store
// null rather than plaintext, so a missing key can never leak a secret. Tokens
// are versioned ("v1:") so the scheme can rotate without ambiguity.
import crypto from 'crypto'

function loadKey() {
  const raw = (process.env.SIM_CRED_KEY || '').trim()
  if (!raw) return null
  let buf
  try {
    buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
  } catch {
    return null
  }
  return buf.length === 32 ? buf : null
}

const KEY = loadKey()
export const secretsEnabled = !!KEY

// encryptSecret(plain) → "v1:<base64(iv|tag|ciphertext)>" | null
export function encryptSecret(plain) {
  if (!KEY || plain == null || plain === '') return null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return 'v1:' + Buffer.concat([iv, tag, ct]).toString('base64')
}

// decryptSecret(token) → plaintext | null (null on missing key, bad format,
// or a failed auth tag — never throws).
export function decryptSecret(token) {
  if (!KEY || typeof token !== 'string' || !token.startsWith('v1:')) return null
  try {
    const raw = Buffer.from(token.slice(3), 'base64')
    const iv = raw.subarray(0, 12)
    const tag = raw.subarray(12, 28)
    const ct = raw.subarray(28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
