import { describe, expect, it } from 'vitest'
import {
  AvailabilityInputSchema,
  AvailabilitySchema,
  MAX_DAYS_OFF,
  dateKey,
  defaultAvailability,
  durationText,
  hoursLines,
  hoursSentence,
  lunchText,
  parseDateKey,
  slotStartMinutes,
  tidyDaysOff,
  upcomingDaysOff,
} from '../src/domain/availability'
import type { AvailabilityInput } from '../src/domain/availability'
import { formatClock } from '../src/domain/format'
import { ServiceRequestSchema, validationFields } from '../src/domain/types'
import { NOW, at, makeAvailability, makeRequest, withDay } from './helpers'

/** The editable shape the owner screen submits: an Availability without `updatedAt`. */
function input(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  const { updatedAt: _ignored, ...rest } = makeAvailability()
  return { ...rest, ...overrides }
}

function fieldsFor(value: unknown): Record<string, string[]> {
  return validationFields(AvailabilityInputSchema, value)
}

describe('defaultAvailability', () => {
  it('is valid for both the input and the stored schema', () => {
    expect(AvailabilitySchema.safeParse(defaultAvailability(NOW)).success).toBe(true)
    expect(AvailabilityInputSchema.safeParse(input()).success).toBe(true)
  })

  it('opens Monday to Saturday, 9 AM to 5 PM, with one-hour slots for two jobs', () => {
    const shop = defaultAvailability()
    expect(shop.week.map((day) => day.open)).toEqual([false, true, true, true, true, true, true])
    expect(shop).toMatchObject({ slotMinutes: 60, capacity: 2, noticeMinutes: 60, windowDays: 14 })
    expect(shop.lunch.enabled).toBe(false)
    expect(shop.daysOff).toEqual([])
  })
})

describe('AvailabilityInputSchema', () => {
  it('accepts a normal owner schedule with a lunch break and days off', () => {
    const ok = input({
      lunch: { enabled: true, from: 12 * 60, to: 13 * 60 },
      daysOff: [{ date: '2026-12-25', label: 'Christmas' }],
      slotMinutes: 30,
      capacity: 4,
      noticeMinutes: 1440,
      windowDays: 60,
    })
    expect(fieldsFor(ok)).toEqual({})
  })

  it('requires at least one open day', () => {
    const closed = input({ week: makeAvailability().week.map((day) => ({ ...day, open: false })) })
    expect(fieldsFor(closed)['week']?.[0]).toMatch(/Open at least one day/)
  })

  it('rejects closing at or before opening, on the right day', () => {
    const bad = withDay(makeAvailability(), 3, { from: 14 * 60, to: 10 * 60 })
    expect(fieldsFor(input({ week: bad.week }))['week.3.to']?.[0]).toMatch(/after opening/)
  })

  it('rejects hours shorter than one slot', () => {
    const bad = withDay(makeAvailability(), 1, { from: 9 * 60, to: 9 * 60 + 30 })
    expect(fieldsFor(input({ week: bad.week }))['week.1.to']?.[0]).toMatch(/at least 1 hour/)
    expect(fieldsFor(input({ week: bad.week, slotMinutes: 30 }))).toEqual({})
  })

  it('ignores the hours of a closed day', () => {
    const closed = withDay(makeAvailability(), 0, { open: false, from: 20 * 60, to: 8 * 60 })
    expect(fieldsFor(input({ week: closed.week }))).toEqual({})
  })

  it('rejects times off the 30 minute grid and outside 6 AM to 10 PM', () => {
    expect(fieldsFor(input({ week: withDay(makeAvailability(), 1, { from: 9 * 60 + 15 }).week }))['week.1.from']).toBeDefined()
    expect(fieldsFor(input({ week: withDay(makeAvailability(), 1, { from: 5 * 60 }).week }))['week.1.from']).toBeDefined()
    expect(fieldsFor(input({ week: withDay(makeAvailability(), 1, { to: 23 * 60 }).week }))['week.1.to']).toBeDefined()
  })

  it('needs exactly seven days', () => {
    expect(fieldsFor(input({ week: makeAvailability().week.slice(0, 6) }))['week']).toBeDefined()
  })

  it.each([
    ['slot length', { slotMinutes: 45 }, 'slotMinutes'],
    ['capacity of zero', { capacity: 0 }, 'capacity'],
    ['capacity above the limit', { capacity: 11 }, 'capacity'],
    ['fractional capacity', { capacity: 1.5 }, 'capacity'],
    ['notice', { noticeMinutes: 90 }, 'noticeMinutes'],
    ['booking window', { windowDays: 10 }, 'windowDays'],
  ])('rejects an unsupported %s', (_label, change, field) => {
    expect(fieldsFor({ ...input(), ...change })[field]).toBeDefined()
  })

  it('checks the lunch break only when it is switched on', () => {
    const backwards = { enabled: true, from: 13 * 60, to: 12 * 60 }
    expect(fieldsFor(input({ lunch: backwards }))['lunch.to']?.[0]).toMatch(/end after it starts/)
    expect(fieldsFor(input({ lunch: { ...backwards, enabled: false } }))).toEqual({})
  })

  it('rejects a lunch break that leaves a day with no slot', () => {
    const tiny = withDay(makeAvailability(), 2, { from: 12 * 60, to: 13 * 60 })
    const fields = fieldsFor(input({ week: tiny.week, lunch: { enabled: true, from: 12 * 60, to: 13 * 60 } }))
    expect(fields['week.2.to']?.[0]).toMatch(/lunch break/)
  })

  it('rejects duplicate, impossible and malformed days off', () => {
    const dup = fieldsFor(input({ daysOff: [{ date: '2026-12-25', label: '' }, { date: '2026-12-25', label: '' }] }))
    expect(dup['daysOff.1.date']?.[0]).toMatch(/already listed/)
    expect(fieldsFor(input({ daysOff: [{ date: '2026-02-30', label: '' }] }))['daysOff.0.date']).toBeDefined()
    expect(fieldsFor(input({ daysOff: [{ date: 'tomorrow', label: '' }] }))['daysOff.0.date']).toBeDefined()
    expect(fieldsFor(input({ daysOff: [{ date: '2026-12-25', label: 'x'.repeat(41) }] }))['daysOff.0.label']).toBeDefined()
  })

  it('caps the number of days off', () => {
    const many = Array.from({ length: MAX_DAYS_OFF + 1 }, (_, index) => ({
      date: dateKey(new Date(2027, 0, index + 1).getTime()),
      label: '',
    }))
    expect(fieldsFor(input({ daysOff: many }))['daysOff']).toBeDefined()
  })

  it('trims day-off labels', () => {
    const parsed = AvailabilityInputSchema.parse(input({ daysOff: [{ date: '2026-12-25', label: '  Christmas  ' }] }))
    expect(parsed.daysOff[0]?.label).toBe('Christmas')
  })
})

describe('slotStartMinutes', () => {
  const day = { open: true, from: 9 * 60, to: 12 * 60 }
  const noLunch = { enabled: false, from: 0, to: 0 }

  it('lists starts every slot length while a full slot still fits', () => {
    expect(slotStartMinutes(day, 60, noLunch)).toEqual([540, 600, 660])
    expect(slotStartMinutes(day, 90, noLunch)).toEqual([540, 630])
    expect(slotStartMinutes(day, 120, noLunch)).toEqual([540])
  })

  it('returns nothing for a closed day', () => {
    expect(slotStartMinutes({ ...day, open: false }, 60, noLunch)).toEqual([])
  })
})

describe('readable hours', () => {
  const clock = (minutes: number) => formatClock(minutes)

  it('groups days that share hours, Monday first', () => {
    expect(hoursLines(makeAvailability())).toEqual([
      { days: 'Mon to Sat', hours: `${clock(540)} to ${clock(1020)}`, closed: false },
      { days: 'Sun', hours: 'Closed', closed: true },
    ])
  })

  it('splits a day that differs and names pairs and ranges', () => {
    const custom = withDay(withDay(makeAvailability(), 6, { to: 12 * 60 }), 3, { open: false })
    const lines = hoursLines(custom)
    expect(lines.map((line) => line.days)).toEqual(['Mon and Tue', 'Wed', 'Thu and Fri', 'Sat', 'Sun'])
    expect(lines[3]).toMatchObject({ hours: `${clock(540)} to ${clock(720)}`, closed: false })
  })

  it('joins consecutive closed days', () => {
    const custom = withDay(withDay(makeAvailability(), 1, { open: false }), 2, { open: false })
    expect(hoursLines(custom)[0]).toMatchObject({ days: 'Mon and Tue', hours: 'Closed', closed: true })
  })

  it('summarises open days in one sentence', () => {
    expect(hoursSentence(makeAvailability())).toBe(`Mon to Sat ${clock(540)} to ${clock(1020)}`)
    const none = makeAvailability({ week: makeAvailability().week.map((day) => ({ ...day, open: false })) })
    expect(hoursSentence(none)).toMatch(/not open/)
  })

  it('describes the lunch break only when it is on', () => {
    expect(lunchText(makeAvailability())).toBeNull()
    expect(lunchText(makeAvailability({ lunch: { enabled: true, from: 720, to: 780 } }))).toBe(
      `Closed ${clock(720)} to ${clock(780)} for a break`,
    )
  })

  it.each([
    [30, '30 minutes'],
    [60, '1 hour'],
    [90, '1 hour 30 minutes'],
    [120, '2 hours'],
    [720, '12 hours'],
    [1440, '1 day'],
    [2880, '2 days'],
  ])('writes %i minutes as "%s"', (minutes, text) => {
    expect(durationText(minutes)).toBe(text)
  })
})

describe('dates', () => {
  it('turns a calendar date into local midnight and back', () => {
    expect(parseDateKey('2026-10-06')).toBe(new Date(2026, 9, 6).getTime())
    expect(dateKey(at(6, 15))).toBe('2026-10-06')
    expect(dateKey(parseDateKey('2027-01-02') ?? 0)).toBe('2027-01-02')
  })

  it.each(['2026-02-30', '2026-13-01', '2026-1-1', 'abc', ''])('rejects "%s"', (text) => {
    expect(parseDateKey(text)).toBeNull()
  })

  it('lists upcoming days off soonest first and can limit them to the booking window', () => {
    const shop = makeAvailability({
      daysOff: [
        { date: '2026-12-25', label: 'Christmas' },
        { date: '2026-10-01', label: 'Past' },
        { date: '2026-10-05', label: 'Today' },
        { date: '2026-10-12', label: 'Holiday' },
      ],
    })
    expect(upcomingDaysOff(shop, NOW).map((entry) => entry.label)).toEqual(['Today', 'Holiday', 'Christmas'])
    expect(upcomingDaysOff(shop, NOW, 14).map((entry) => entry.label)).toEqual(['Today', 'Holiday'])
  })

  it('drops past days off and sorts the rest', () => {
    const tidy = tidyDaysOff(
      [
        { date: '2026-10-20', label: 'b' },
        { date: '2026-10-01', label: 'past' },
        { date: '2026-10-05', label: 'today' },
      ],
      NOW,
    )
    expect(tidy.map((entry) => entry.label)).toEqual(['today', 'b'])
  })
})

describe('older stored appointments', () => {
  it('read as one-hour visits when they have no recorded length', () => {
    const legacy = { ...makeRequest(), appointment: { startAt: at(6, 10), createdBy: 'customer', updatedAt: NOW } }
    const parsed = ServiceRequestSchema.parse(legacy)
    expect(parsed.appointment?.durationMinutes).toBe(60)
  })
})
