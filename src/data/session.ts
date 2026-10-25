import { logger } from '@/domain/logger'

const SESSION_KEY = 'fixflow.session'

/**
 * The session is only the signed-in user's id. localStorage can throw (blocked storage,
 * private mode), so every access is guarded and a failure just means "signed out".
 */
export function readStoredSession(): string | null {
  try {
    const value = localStorage.getItem(SESSION_KEY)
    return value !== null && value.length > 0 ? value : null
  } catch (error) {
    logger.warn('Could not read the stored session', { error: String(error) })
    return null
  }
}

export function storeSession(userId: string): void {
  try {
    localStorage.setItem(SESSION_KEY, userId)
  } catch (error) {
    logger.warn('Could not persist the session; you will need to sign in again next launch', { error: String(error) })
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch (error) {
    logger.warn('Could not clear the stored session', { error: String(error) })
  }
}
