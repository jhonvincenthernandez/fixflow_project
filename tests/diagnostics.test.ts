import { describe, expect, it } from 'vitest'
import {
  URGENCY_OPTIONS,
  buildRequestDraft,
  diagnose,
  getSymptoms,
  parseUrgency,
  requestHref,
} from '../src/domain/diagnostics'
import { SERVICE_IDS } from '../src/domain/types'

describe('diagnosis catalog', () => {
  it('covers every service with at least two symptoms', () => {
    for (const serviceId of SERVICE_IDS) {
      expect(getSymptoms(serviceId).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('uses unique symptom ids within each service', () => {
    for (const serviceId of SERVICE_IDS) {
      const ids = getSymptoms(serviceId).map((symptom) => symptom.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('gives every symptom guidance, a request summary, and a safety note when needed', () => {
    for (const serviceId of SERVICE_IDS) {
      for (const symptom of getSymptoms(serviceId)) {
        expect(symptom.likelyCause.length).toBeGreaterThan(0)
        expect(symptom.safeStep.length).toBeGreaterThan(0)
        expect(symptom.requestSummary.length).toBeGreaterThanOrEqual(10)
        if (symptom.safety === 'standard') expect(symptom.safetyNote).toBe('')
        else expect(symptom.safetyNote.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('diagnose', () => {
  it('returns null until all three answers are present', () => {
    expect(diagnose('phone', null, null)).toBeNull()
    expect(diagnose('phone', 'screen_cracked', null)).toBeNull()
    expect(diagnose('phone', 'missing', 'can_wait')).toBeNull()
  })

  it('returns the guidance for a complete answer', () => {
    const result = diagnose('phone', 'screen_cracked', 'daily_use')
    expect(result?.symptom.id).toBe('screen_cracked')
    expect(result?.nextStep).toContain('earliest')
  })

  it('escalates a safety concern even when the symptom is standard', () => {
    const result = diagnose('phone', 'screen_cracked', 'safety')
    expect(result?.safety).toBe('urgent')
    expect(result?.safetyNote.length).toBeGreaterThan(0)
  })

  it('keeps an urgent symptom urgent when the customer can wait', () => {
    const result = diagnose('phone', 'swollen_battery', 'can_wait')
    expect(result?.safety).toBe('urgent')
    expect(result?.nextStep).toContain('priority')
  })
})

describe('parseUrgency', () => {
  it('accepts only known urgency values', () => {
    expect(parseUrgency('safety')).toBe('safety')
    expect(parseUrgency('later')).toBeNull()
    expect(parseUrgency(['safety'])).toBeNull()
    expect(parseUrgency(undefined)).toBeNull()
  })
})

describe('requestHref', () => {
  it('builds a prefilled request link', () => {
    expect(requestHref('phone', 'swollen_battery', 'safety')).toBe(
      '/request/new?service=phone&issue=swollen_battery&urgency=safety',
    )
  })
})

describe('buildRequestDraft', () => {
  it('builds a description from the symptom and urgency', () => {
    const draft = buildRequestDraft('phone', 'swollen_battery', 'safety')
    expect(draft?.description).toContain('battery looks swollen')
    expect(draft?.description).toContain('priority check')
  })

  it('returns null for an unknown symptom', () => {
    expect(buildRequestDraft('phone', 'missing', 'safety')).toBeNull()
  })
})

describe('URGENCY_OPTIONS', () => {
  it('offers the three urgency choices in order', () => {
    expect(URGENCY_OPTIONS.map((option) => option.value)).toEqual([
      'can_wait',
      'daily_use',
      'safety',
    ])
  })
})
