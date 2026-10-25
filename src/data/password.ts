import { dataConfig } from './config'

export interface PasswordRecord {
  readonly passwordHash: string
  readonly salt: string
  readonly iterations: number
}

const encoder = new TextEncoder()

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, 256)
  return toHex(new Uint8Array(bits))
}

/** PBKDF2-SHA256 with a random 16-byte salt. Slow by design, so call it outside any transaction. */
export async function hashPassword(password: string): Promise<PasswordRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iterations = dataConfig.passwordIterations
  return { passwordHash: await derive(password, salt, iterations), salt: toHex(salt), iterations }
}

/** Compares in constant time so response timing does not reveal how many characters matched. */
export async function verifyPassword(password: string, record: PasswordRecord): Promise<boolean> {
  const candidate = await derive(password, fromHex(record.salt), record.iterations)
  if (candidate.length !== record.passwordHash.length) return false
  let difference = 0
  for (let index = 0; index < candidate.length; index += 1) {
    difference |= candidate.charCodeAt(index) ^ record.passwordHash.charCodeAt(index)
  }
  return difference === 0
}
