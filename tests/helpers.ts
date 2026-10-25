import { defaultAvailability } from '../src/domain/availability'
import type { Availability, DayHours } from '../src/domain/availability'
import type { Booking } from '../src/domain/schedule'
import type { QuotationDraft, ServiceRequest } from '../src/domain/types'
import type { ActionContext, Actor } from '../src/domain/workflow'

/** Monday 5 October 2026, 10:00 local time. Tests build dates with the local constructor so they pass in any time zone. */
export const NOW = new Date(2026, 9, 5, 10, 0).getTime()

export function at(day: number, hour: number): number {
  return new Date(2026, 9, day, hour, 0).getTime()
}

const MINUTE = 60_000

/** An hour:minute on a day of October 2026. */
export function atMinute(day: number, hour: number, minute: number): number {
  return new Date(2026, 9, day, hour, minute).getTime()
}

/** The shop's default week (Monday to Saturday, 9 to 5, one-hour slots, two at a time) with changes applied. */
export function makeAvailability(overrides: Partial<Availability> = {}): Availability {
  return { ...defaultAvailability(NOW), ...overrides }
}

/** A copy of `availability` with one weekday's hours changed. 0 is Sunday. */
export function withDay(availability: Availability, weekday: number, change: Partial<DayHours>): Availability {
  return { ...availability, week: availability.week.map((day, index) => (index === weekday ? { ...day, ...change } : day)) }
}

export function booking(day: number, hour: number, minutes = 60, minute = 0): Booking {
  const startAt = atMinute(day, hour, minute)
  return { startAt, endAt: startAt + minutes * MINUTE }
}

export function makeContext(overrides: Partial<ActionContext> = {}): ActionContext {
  return { now: NOW, bookings: [], availability: makeAvailability(), ...overrides }
}

export const CUSTOMER: Actor = { id: 'cust-1', role: 'customer' }
export const OTHER_CUSTOMER: Actor = { id: 'cust-2', role: 'customer' }
export const OWNER: Actor = { id: 'owner-1', role: 'owner' }

export const DRAFT: QuotationDraft = {
  items: [
    { description: 'Replacement battery', quantity: 1, unitPriceCentavos: 180_000 },
    { description: 'Labor', quantity: 2, unitPriceCentavos: 25_000 },
  ],
  notes: 'Includes a 30-day warranty.',
  estimatedDays: 2,
  validDays: 7,
}

export function makeRequest(overrides: Partial<ServiceRequest> = {}): ServiceRequest {
  return {
    id: 'req-1',
    ref: 'FF-0001',
    customerId: CUSTOMER.id,
    serviceId: 'phone',
    itemName: 'Phone',
    description: 'The screen is cracked and the touch is unresponsive.',
    mode: 'drop_off',
    address: '',
    imageIds: [],
    status: 'requested',
    quotation: null,
    appointment: null,
    feedback: null,
    closure: null,
    history: [{ status: 'requested', at: NOW, by: 'customer', note: '' }],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}
