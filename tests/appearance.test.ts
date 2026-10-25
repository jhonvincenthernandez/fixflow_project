import { describe, expect, it } from 'vitest'
import { APPEARANCE_KEY, isAppearancePreference } from '@/data/appearance'

describe('appearance preference', () => {
  it('uses the appearance storage key', () => {
    expect(APPEARANCE_KEY).toBe('fixflow.appearance')
  })

  it('accepts only the three appearance modes', () => {
    expect(isAppearancePreference('system')).toBe(true)
    expect(isAppearancePreference('light')).toBe(true)
    expect(isAppearancePreference('dark')).toBe(true)
  })

  it('rejects theme wording and invalid values', () => {
    expect(isAppearancePreference('theme')).toBe(false)
    expect(isAppearancePreference('auto')).toBe(false)
    expect(isAppearancePreference('')).toBe(false)
    expect(isAppearancePreference(null)).toBe(false)
    expect(isAppearancePreference(1)).toBe(false)
  })
})
