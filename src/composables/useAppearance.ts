import { computed, readonly, ref } from 'vue'
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'
import {
  APPEARANCE_KEY,
  readAppearancePreference,
  storeAppearancePreference,
} from '@/data/appearance'
import type { AppearancePreference, ResolvedAppearance } from '@/data/appearance'
import { logger } from '@/domain/logger'

const preference = ref<AppearancePreference>('system')
const systemPrefersDark = ref(false)

const resolved = computed<ResolvedAppearance>(() => {
  if (preference.value !== 'system') return preference.value
  return systemPrefersDark.value ? 'dark' : 'light'
})

let started = false

/** Keeps the browser theme-color metas on the scheme that is actually showing. */
function applyThemeColor(): void {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"][data-appearance]')) {
    meta.media = meta.dataset.appearance === resolved.value ? 'all' : 'not all'
  }
}

/** Matches the Android and iOS system bar icons to the resolved appearance. */
function syncSystemBars(): void {
  if (!Capacitor.isNativePlatform()) return
  const style = resolved.value === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light
  void SystemBars.setStyle({ style }).catch((error: unknown) => {
    logger.warn('Could not update the system bar style', { error: String(error) })
  })
}

function apply(): void {
  document.documentElement.dataset.appearance = preference.value
  applyThemeColor()
  syncSystemBars()
}

function onSystemChange(event: MediaQueryListEvent): void {
  systemPrefersDark.value = event.matches
  applyThemeColor()
  if (preference.value === 'system') syncSystemBars()
}

function onStorage(event: StorageEvent): void {
  if (event.key !== null && event.key !== APPEARANCE_KEY) return
  preference.value = readAppearancePreference()
  apply()
}

/**
 * Applies the stored preference before the app mounts. Safe to call more than once.
 * The inline script in index.html performs the same first paint before this runs.
 */
export function initAppearance(): void {
  if (started) return
  started = true

  preference.value = readAppearancePreference()
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  systemPrefersDark.value = mediaQuery.matches
  apply()

  mediaQuery.addEventListener('change', onSystemChange)
  window.addEventListener('storage', onStorage)
}

export function setAppearance(next: AppearancePreference): void {
  preference.value = next
  storeAppearancePreference(next)
  apply()
}

export function useAppearance() {
  return {
    preference: readonly(preference),
    setAppearance,
  }
}
