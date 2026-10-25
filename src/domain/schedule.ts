import {
  MINUTE_MS,
  dayHours,
  durationText,
  hoursSentence,
  isDayOff,
  slotStartMinutes,
} from './availability'
import type { Availability } from './availability'
import { ConflictError, ValidationError } from './errors'

/**
 * Booking rules, driven entirely by the owner's Availability. Nothing here is hardcoded to
 * a particular shop: hours, slot length, capacity, notice and the booking window all come in
 * as data. Times use the device's local time zone.
 */

/** A time range that is taken by an appointment. */
export interface Booking {
  readonly startAt: number
  readonly endAt: number
}

export interface Slot {
  readonly startAt: number
  readonly endAt: number
  readonly remaining: number
  readonly available: boolean
}

export function startOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** Calendar arithmetic, so a day is a day even when the clocks change. */
export function addDays(dayStart: number, days: number): number {
  const date = new Date(dayStart)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days).getTime()
}

export function toBooking(appointment: { readonly startAt: number; readonly durationMinutes: number }): Booking {
  return { startAt: appointment.startAt, endAt: appointment.startAt + appointment.durationMinutes * MINUTE_MS }
}

/** Every slot the shop offers on one day, before bookings, notice or the booking window apply. */
function windowsForDay(dayStart: number, availability: Availability): { startAt: number; endAt: number }[] {
  if (isDayOff(availability, dayStart)) return []
  const date = new Date(dayStart)
  const hours = dayHours(availability, date.getDay())
  if (hours === undefined || !hours.open) return []
  return slotStartMinutes(hours, availability.slotMinutes, availability.lunch).map((minute) => {
    const startAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, minute).getTime()
    return { startAt, endAt: startAt + availability.slotMinutes * MINUTE_MS }
  })
}

/**
 * The most appointments running at the same moment inside [startAt, endAt). Concurrency only
 * rises when an appointment starts, so checking those instants is enough. This stays correct if
 * the owner changes the slot length after some visits are already booked.
 */
export function peakLoad(startAt: number, endAt: number, bookings: readonly Booking[]): number {
  const overlapping = bookings.filter((booking) => booking.startAt < endAt && booking.endAt > startAt)
  let peak = 0
  for (const instant of [startAt, ...overlapping.map((booking) => booking.startAt)]) {
    if (instant < startAt || instant >= endAt) continue
    const running = overlapping.filter((booking) => booking.startAt <= instant && instant < booking.endAt).length
    peak = Math.max(peak, running)
  }
  return peak
}

/**
 * Slots for one day. `bookings` lists every other active appointment (callers exclude the
 * request being rescheduled).
 */
export function slotsForDay(
  dayStart: number,
  now: number,
  bookings: readonly Booking[],
  availability: Availability,
): Slot[] {
  const earliest = now + availability.noticeMinutes * MINUTE_MS
  return windowsForDay(dayStart, availability).map(({ startAt, endAt }) => {
    const remaining = Math.max(0, availability.capacity - peakLoad(startAt, endAt, bookings))
    return { startAt, endAt, remaining, available: startAt >= earliest && remaining > 0 }
  })
}

/** Days inside the booking window that still have at least one free slot. */
export function availableDays(now: number, bookings: readonly Booking[], availability: Availability): number[] {
  const today = startOfDay(now)
  const days: number[] = []
  for (let offset = 0; offset < availability.windowDays; offset += 1) {
    const dayStart = addDays(today, offset)
    if (slotsForDay(dayStart, now, bookings, availability).some((slot) => slot.available)) days.push(dayStart)
  }
  return days
}

/** Throws if `startAt` is not a bookable slot. Called again by the data layer at write time. */
export function validateSlot(
  startAt: number,
  now: number,
  bookings: readonly Booking[],
  availability: Availability,
): void {
  const dayStart = startOfDay(startAt)
  if (isDayOff(availability, dayStart)) {
    throw new ValidationError({ startAt: ['The shop is closed on that day. Pick another day.'] })
  }
  const slot = windowsForDay(dayStart, availability).find((candidate) => candidate.startAt === startAt)
  if (slot === undefined) {
    throw new ValidationError({ startAt: [`Pick a time during opening hours: ${hoursSentence(availability)}.`] })
  }
  if (startAt < now + availability.noticeMinutes * MINUTE_MS) {
    const message =
      availability.noticeMinutes === 0
        ? 'Pick a time that has not started yet.'
        : `Pick a time at least ${durationText(availability.noticeMinutes)} from now.`
    throw new ValidationError({ startAt: [message] })
  }
  if (startAt >= addDays(startOfDay(now), availability.windowDays)) {
    throw new ValidationError({ startAt: [`Appointments open up to ${availability.windowDays} days ahead.`] })
  }
  if (peakLoad(slot.startAt, slot.endAt, bookings) >= availability.capacity) {
    throw new ConflictError('That time slot was just taken. Pick another time.')
  }
}

/**
 * Whether an existing appointment still sits inside the shop's hours. Used to warn the owner
 * when a schedule change would leave booked visits outside it. It does not require the visit to
 * line up with the current slot grid, only to fall inside open time, outside the lunch break
 * and not on a day off.
 */
export function fitsAvailability(
  appointment: { readonly startAt: number; readonly durationMinutes: number },
  availability: Availability,
): boolean {
  if (isDayOff(availability, appointment.startAt)) return false
  const date = new Date(appointment.startAt)
  const hours = dayHours(availability, date.getDay())
  if (hours === undefined || !hours.open) return false
  const start = date.getHours() * 60 + date.getMinutes()
  const end = start + appointment.durationMinutes
  if (start < hours.from || end > hours.to) return false
  const { lunch } = availability
  return !(lunch.enabled && start < lunch.to && end > lunch.from)
}
