import { logger } from '@/domain/logger'

const PREFERENCES = ['system', 'light', 'dark'] as const

export type AppearancePreference = (typeof PREFERENCES)[number]
export type ResolvedAppearance = 'light' | 'dark'

export const APPEARANCE_KEY = 'fixflow.appearance'

export function isAppearancePreference(value: unknown): value is AppearancePreference {
  return typeof value === 'string' && PREFERENCES.some((preference) => preference === value)
}

/**
 * localStorage can throw (blocked storage, private mode), so every access is guarded.
 * A missing or invalid value means "follow the device".
 */
export function readAppearancePreference(): AppearancePreference {
  try {
    const value = localStorage.getItem(APPEARANCE_KEY)
    return isAppearancePreference(value) ? value : 'system'
  } catch (error) {
    logger.warn('Could not read the appearance preference', { error: String(error) })
    return 'system'
  }
}

export function storeAppearancePreference(preference: AppearancePreference): void {
  try {
    if (preference === 'system') localStorage.removeItem(APPEARANCE_KEY)
    else localStorage.setItem(APPEARANCE_KEY, preference)
  } catch (error) {
    logger.warn('Could not persist the appearance preference', { error: String(error) })
  }
}
