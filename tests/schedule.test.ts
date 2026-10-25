import { describe, expect, it } from 'vitest'
import { ConflictError, ValidationError } from '../src/domain/errors'
import type { Booking } from '../src/domain/schedule'
import {
  addDays,
  availableDays,
  fitsAvailability,
  peakLoad,
  slotsForDay,
  startOfDay,
  validateSlot,
} from '../src/domain/schedule'
import { NOW, at, atMinute, booking, makeAvailability, withDay } from './helpers'

/** The message shown beside the time field when `work` throws a ValidationError. */
function startAtMessage(work: () => void): string | undefined {
  try {
    work()
  } catch (error) {
    if (error instanceof ValidationError) return error.fields['startAt']?.[0]
    throw error
  }
  return undefined
}

const MONDAY_NOON = startOfDay(at(5, 0))
const TUESDAY = startOfDay(at(6, 0))
const SUNDAY = startOfDay(at(11, 0))
const MINUTE = 60_000

function starts(day: number, availability = makeAvailability(), bookings: readonly Booking[] = []): number[] {
  return slotsForDay(day, NOW, bookings, availability).map((slot) => slot.startAt)
}

describe('slotsForDay with the default week', () => {
  it('offers eight one-hour slots from 9 AM to 4 PM', () => {
    const slots = slotsForDay(TUESDAY, NOW, [], makeAvailability())
    expect(slots).toHaveLength(8)
    expect(slots[0]?.startAt).toBe(at(6, 9))
    expect(slots[7]?.startAt).toBe(at(6, 16))
    expect(slots[7]?.endAt).toBe(at(6, 17))
    expect(slots.every((slot) => slot.available)).toBe(true)
  })

  it('closes Sundays', () => {
    expect(slotsForDay(SUNDAY, NOW, [], makeAvailability())).toEqual([])
  })

  it('hides slots that start sooner than the minimum notice', () => {
    const slots = slotsForDay(MONDAY_NOON, NOW, [], makeAvailability())
    expect(slots.find((slot) => slot.startAt === at(5, 10))?.available).toBe(false)
    expect(slots.find((slot) => slot.startAt === at(5, 11))?.available).toBe(true)
  })

  it('marks a slot unavailable once capacity is reached', () => {
    const full = [booking(6, 10), booking(6, 10)]
    const slot = slotsForDay(TUESDAY, NOW, full, makeAvailability()).find((entry) => entry.startAt === at(6, 10))
    expect(slot).toMatchObject({ available: false, remaining: 0 })
  })

  it('keeps a half-booked slot open', () => {
    const slot = slotsForDay(TUESDAY, NOW, [booking(6, 10)], makeAvailability()).find((entry) => entry.startAt === at(6, 10))
    expect(slot).toMatchObject({ available: true, remaining: 1 })
  })
})

describe('slotsForDay follows the owner schedule', () => {
  it('uses different hours on different days', () => {
    // Saturday 10 October closes at noon.
    const availability = withDay(makeAvailability(), 6, { to: 12 * 60 })
    expect(starts(startOfDay(at(10, 0)), availability)).toEqual([at(10, 9), at(10, 10), at(10, 11)])
  })

  it('closes a weekday the owner switched off', () => {
    const availability = withDay(makeAvailability(), 2, { open: false })
    expect(starts(TUESDAY, availability)).toEqual([])
    expect(starts(startOfDay(at(7, 0)), availability)).toHaveLength(8)
  })

  it('opens a day that was closed', () => {
    const availability = withDay(makeAvailability(), 0, { open: true, from: 10 * 60, to: 14 * 60 })
    expect(starts(SUNDAY, availability)).toEqual([at(11, 10), at(11, 11), at(11, 12), at(11, 13)])
  })

  it('follows the slot length', () => {
    const thirty = starts(TUESDAY, makeAvailability({ slotMinutes: 30 }))
    expect(thirty).toHaveLength(16)
    expect(thirty[1]).toBe(atMinute(6, 9, 30))
    expect(thirty[15]).toBe(atMinute(6, 16, 30))

    // 90 minute visits: 9:00, 10:30, 12:00, 1:30 and 3:00. A 4:30 start would run past 5 PM.
    const ninety = starts(TUESDAY, makeAvailability({ slotMinutes: 90 }))
    expect(ninety).toEqual([atMinute(6, 9, 0), atMinute(6, 10, 30), atMinute(6, 12, 0), atMinute(6, 13, 30), atMinute(6, 15, 0)])
  })

  it('removes slots that touch the lunch break', () => {
    const lunch = { enabled: true, from: 12 * 60, to: 13 * 60 }
    expect(starts(TUESDAY, makeAvailability({ lunch }))).toEqual(
      [9, 10, 11, 13, 14, 15, 16].map((hour) => at(6, hour)),
    )
    // A 90 minute slot starting at 12:00 would run into the break, and so would the 10:30 one ending at 12:00 only if the break began earlier.
    expect(starts(TUESDAY, makeAvailability({ lunch, slotMinutes: 90 }))).toEqual([
      atMinute(6, 9, 0),
      atMinute(6, 10, 30),
      atMinute(6, 13, 30),
      atMinute(6, 15, 0),
    ])
  })

  it('ignores a lunch break that is switched off', () => {
    const lunch = { enabled: false, from: 12 * 60, to: 13 * 60 }
    expect(starts(TUESDAY, makeAvailability({ lunch }))).toHaveLength(8)
  })

  it('offers nothing on a day off', () => {
    const availability = makeAvailability({ daysOff: [{ date: '2026-10-06', label: 'Holiday' }] })
    expect(starts(TUESDAY, availability)).toEqual([])
    expect(starts(startOfDay(at(7, 0)), availability)).toHaveLength(8)
  })

  it('applies a longer minimum notice', () => {
    const slots = slotsForDay(TUESDAY, NOW, [], makeAvailability({ noticeMinutes: 1440 }))
    // Now is Monday 10:00, so a 24 hour notice opens Tuesday from 10:00.
    expect(slots.find((slot) => slot.startAt === at(6, 9))?.available).toBe(false)
    expect(slots.find((slot) => slot.startAt === at(6, 10))?.available).toBe(true)
  })

  it('allows booking right up to the start when there is no notice rule', () => {
    const slots = slotsForDay(MONDAY_NOON, NOW, [], makeAvailability({ noticeMinutes: 0 }))
    expect(slots.find((slot) => slot.startAt === at(5, 10))?.available).toBe(true)
    expect(slots.find((slot) => slot.startAt === at(5, 9))?.available).toBe(false)
  })

  it('uses the configured capacity', () => {
    const availability = makeAvailability({ capacity: 3 })
    const two = [booking(6, 10), booking(6, 10)]
    expect(slotsForDay(TUESDAY, NOW, two, availability).find((slot) => slot.startAt === at(6, 10))).toMatchObject({
      available: true,
      remaining: 1,
    })
    const one = makeAvailability({ capacity: 1 })
    expect(slotsForDay(TUESDAY, NOW, [booking(6, 10)], one).find((slot) => slot.startAt === at(6, 10))).toMatchObject({
      available: false,
      remaining: 0,
    })
  })
})

describe('peakLoad', () => {
  it('counts only visits that overlap the window', () => {
    const window = { start: at(6, 10), end: at(6, 11) }
    expect(peakLoad(window.start, window.end, [booking(6, 9), booking(6, 11)])).toBe(0)
    expect(peakLoad(window.start, window.end, [booking(6, 10)])).toBe(1)
  })

  it('counts the most that run at once, not everything that touches the window', () => {
    // 9:00-10:00 and 10:00-11:00 never run together, so a 9:30-10:30 slot sees one at a time.
    const bookings = [booking(6, 9), booking(6, 10)]
    expect(peakLoad(atMinute(6, 9, 30), atMinute(6, 10, 30), bookings)).toBe(1)
  })

  it('sees visits that run together', () => {
    const bookings = [booking(6, 9, 120), booking(6, 10)]
    expect(peakLoad(at(6, 10), at(6, 11), bookings)).toBe(2)
  })

  it('keeps a long visit blocking the shorter slots it overlaps', () => {
    // A 60 minute visit booked before the owner switched to 30 minute slots still holds both halves of its hour.
    const availability = makeAvailability({ slotMinutes: 30, capacity: 1 })
    const slots = slotsForDay(TUESDAY, NOW, [booking(6, 10, 60)], availability)
    const byStart = (startAt: number) => slots.find((slot) => slot.startAt === startAt)
    expect(byStart(atMinute(6, 9, 30))?.available).toBe(true)
    expect(byStart(atMinute(6, 10, 0))?.available).toBe(false)
    expect(byStart(atMinute(6, 10, 30))?.available).toBe(false)
    expect(byStart(atMinute(6, 11, 0))?.available).toBe(true)
  })
})

describe('availableDays', () => {
  it('skips closed days and stays inside the booking window', () => {
    const days = availableDays(NOW, [], makeAvailability())
    expect(days.length).toBeGreaterThan(0)
    expect(days.length).toBeLessThanOrEqual(14)
    expect(days.every((day) => new Date(day).getDay() !== 0)).toBe(true)
  })

  it('follows the booking window the owner sets', () => {
    const week = availableDays(NOW, [], makeAvailability({ windowDays: 7 }))
    const month = availableDays(NOW, [], makeAvailability({ windowDays: 30 }))
    expect(week).toHaveLength(6)
    expect(month).toHaveLength(26)
    expect(Math.max(...week)).toBeLessThan(addDays(startOfDay(NOW), 7))
  })

  it('drops a day whose slots are all full', () => {
    const availability = makeAvailability()
    const full = slotsForDay(TUESDAY, NOW, [], availability).flatMap((slot) => [
      { startAt: slot.startAt, endAt: slot.endAt },
      { startAt: slot.startAt, endAt: slot.endAt },
    ])
    expect(availableDays(NOW, full, availability)).not.toContain(TUESDAY)
  })

  it('drops days off', () => {
    const availability = makeAvailability({ daysOff: [{ date: '2026-10-06', label: '' }] })
    expect(availableDays(NOW, [], availability)).not.toContain(TUESDAY)
  })

  it('returns nothing when every day is closed', () => {
    const closed = makeAvailability({
      week: makeAvailability().week.map((day) => ({ ...day, open: false })),
    })
    expect(availableDays(NOW, [], closed)).toEqual([])
  })
})

describe('validateSlot', () => {
  const availability = makeAvailability()

  it('accepts a good slot', () => {
    expect(() => validateSlot(at(6, 14), NOW, [], availability)).not.toThrow()
  })

  it.each([
    ['off the hour', atMinute(6, 14, 30)],
    ['before opening', at(6, 8)],
    ['after the last slot', at(6, 17)],
    ['on a Sunday', at(11, 10)],
    ['in the past', at(5, 9)],
    ['inside the minimum notice', atMinute(5, 10, 30)],
    ['beyond the booking window', at(5 + 14 + 1, 10)],
  ])('rejects a slot %s', (_label, startAt) => {
    expect(() => validateSlot(startAt, NOW, [], availability)).toThrow(ValidationError)
  })

  it('throws a conflict when the slot is full', () => {
    expect(() => validateSlot(at(6, 14), NOW, [booking(6, 14), booking(6, 14)], availability)).toThrow(ConflictError)
  })

  it('names the owner hours when a time is outside them', () => {
    try {
      validateSlot(at(6, 20), NOW, [], availability)
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect(error instanceof ValidationError && error.fields['startAt']?.[0]).toMatch(/opening hours: Mon to Sat/)
    }
  })

  it('says the shop is closed on a day off', () => {
    const closed = makeAvailability({ daysOff: [{ date: '2026-10-06', label: 'Holiday' }] })
    try {
      validateSlot(at(6, 14), NOW, [], closed)
      expect.unreachable()
    } catch (error) {
      expect(error instanceof ValidationError && error.fields['startAt']?.[0]).toMatch(/closed on that day/)
    }
  })

  it('rejects a time that is not on the owner slot grid', () => {
    const ninety = makeAvailability({ slotMinutes: 90 })
    expect(() => validateSlot(at(6, 10), NOW, [], ninety)).toThrow(ValidationError)
    expect(() => validateSlot(atMinute(6, 10, 30), NOW, [], ninety)).not.toThrow()
  })

  it('rejects the lunch break', () => {
    const lunch = makeAvailability({ lunch: { enabled: true, from: 12 * 60, to: 13 * 60 } })
    expect(() => validateSlot(at(6, 12), NOW, [], lunch)).toThrow(ValidationError)
    expect(() => validateSlot(at(6, 13), NOW, [], lunch)).not.toThrow()
  })

  it('uses the owner booking window and notice in its messages', () => {
    const week = makeAvailability({ windowDays: 7, noticeMinutes: 240 })
    expect(startAtMessage(() => validateSlot(at(13, 10), NOW, [], week))).toMatch(/7 days ahead/)
    expect(startAtMessage(() => validateSlot(at(5, 11), NOW, [], week))).toMatch(/at least 4 hours/)
  })

  it('respects a capacity of one', () => {
    const solo = makeAvailability({ capacity: 1 })
    expect(() => validateSlot(at(6, 14), NOW, [booking(6, 14)], solo)).toThrow(ConflictError)
    expect(() => validateSlot(at(6, 15), NOW, [booking(6, 14)], solo)).not.toThrow()
  })
})

describe('fitsAvailability', () => {
  const availability = makeAvailability({ lunch: { enabled: true, from: 12 * 60, to: 13 * 60 } })
  const visit = (startAt: number, durationMinutes = 60) => ({ startAt, durationMinutes })

  it('accepts a visit inside open time', () => {
    expect(fitsAvailability(visit(at(6, 10)), availability)).toBe(true)
    expect(fitsAvailability(visit(at(6, 16)), availability)).toBe(true)
  })

  it('rejects a visit before opening or running past closing', () => {
    expect(fitsAvailability(visit(at(6, 8)), availability)).toBe(false)
    expect(fitsAvailability(visit(atMinute(6, 16, 30)), availability)).toBe(false)
  })

  it('rejects a visit that overlaps lunch, but not one that ends as lunch starts', () => {
    expect(fitsAvailability(visit(atMinute(6, 11, 30)), availability)).toBe(false)
    expect(fitsAvailability(visit(at(6, 11)), availability)).toBe(true)
    expect(fitsAvailability(visit(at(6, 13)), availability)).toBe(true)
  })

  it('rejects closed weekdays and days off', () => {
    expect(fitsAvailability(visit(at(11, 10)), availability)).toBe(false)
    expect(fitsAvailability(visit(at(6, 10)), { ...availability, daysOff: [{ date: '2026-10-06', label: '' }] })).toBe(false)
  })

  it('judges a visit by its own length, not the current slot length', () => {
    expect(fitsAvailability(visit(at(6, 15), 120), availability)).toBe(true)
    expect(fitsAvailability(visit(at(6, 16), 120), availability)).toBe(false)
    expect(fitsAvailability(visit(at(6, 15), 30), makeAvailability({ slotMinutes: 120 }))).toBe(true)
  })
})

describe('time helpers', () => {
  it('adds calendar days', () => {
    expect(addDays(TUESDAY, 1)).toBe(startOfDay(at(7, 0)))
    expect(addDays(TUESDAY, 30)).toBe(new Date(2026, 10, 5).getTime())
    expect(addDays(TUESDAY, 0) + MINUTE).toBeGreaterThan(TUESDAY)
  })
})
