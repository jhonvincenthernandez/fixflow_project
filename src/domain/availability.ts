import { z } from 'zod'
import { formatClock } from './format'

/**
 * The owner's availability: the single source of truth for when customers can book.
 * Everything here is pure data and pure functions, so the rules are easy to test.
 * Times use the device's local time zone.
 * ASSUMPTION: one shop in one time zone, so local device time is the shop's time.
 */

export const MINUTE_MS = 60_000
export const DAY_MS = 24 * 60 * MINUTE_MS

/** Opening times are chosen in 30 minute steps between these bounds. */
export const TIME_STEP_MINUTES = 30
export const EARLIEST_OPEN = 6 * 60
export const LATEST_CLOSE = 22 * 60

export const SLOT_LENGTHS = [30, 60, 90, 120] as const
/** Minimum notice before an appointment, in minutes. */
export const NOTICE_OPTIONS = [0, 60, 120, 240, 720, 1440, 2880] as const
export const WINDOW_OPTIONS = [7, 14, 30, 60, 90] as const
export const MAX_CAPACITY = 10
export const MAX_DAYS_OFF = 60

/** Indexed like Date#getDay: 0 is Sunday. */
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
/** The week is shown Monday first. */
export const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

/* ------------------------------------------------------------
   Schemas
   ------------------------------------------------------------ */
const Millis = z.number().int().nonnegative()

const MinuteOfDay = z
  .number()
  .int('Choose a time from the list')
  .min(EARLIEST_OPEN, `Choose a time from ${formatClock(EARLIEST_OPEN)}`)
  .max(LATEST_CLOSE, `Choose a time up to ${formatClock(LATEST_CLOSE)}`)
  .refine((value) => value % TIME_STEP_MINUTES === 0, 'Choose a time from the list')

export const DayHoursSchema = z.object({
  open: z.boolean(),
  /** Kept while the day is closed so re-opening it restores the old hours. */
  from: MinuteOfDay,
  to: MinuteOfDay,
})
export type DayHours = z.infer<typeof DayHoursSchema>

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

/** "2026-10-12" to local midnight, or null when the text is not a real calendar date. */
export function parseDateKey(key: string): number | null {
  if (!DATE_KEY.test(key)) return null
  const [year, month, day] = key.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined) return null
  const date = new Date(year, month - 1, day)
  const real = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  return real ? date.getTime() : null
}

/** Local calendar date as "YYYY-MM-DD". */
export function dateKey(timestamp: number): string {
  const date = new Date(timestamp)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export const DayOffSchema = z.object({
  date: z
    .string()
    .regex(DATE_KEY, 'Pick a date')
    .refine((value) => parseDateKey(value) !== null, 'Pick a real calendar date'),
  label: z.string().trim().max(40, 'Keep the label under 40 characters'),
})
export type DayOff = z.infer<typeof DayOffSchema>

const availabilityShape = {
  /** Seven entries indexed like Date#getDay (0 is Sunday). */
  week: z.array(DayHoursSchema).length(7, 'Set hours for all seven days'),
  slotMinutes: z.literal(SLOT_LENGTHS, { error: 'Choose a slot length from the list' }),
  /** How many jobs can run at the same time, for example the number of technicians. */
  capacity: z
    .number()
    .int('Use a whole number')
    .min(1, 'At least 1')
    .max(MAX_CAPACITY, `At most ${MAX_CAPACITY}`),
  noticeMinutes: z.literal(NOTICE_OPTIONS, { error: 'Choose a notice time from the list' }),
  windowDays: z.literal(WINDOW_OPTIONS, { error: 'Choose how far ahead from the list' }),
  lunch: z.object({ enabled: z.boolean(), from: MinuteOfDay, to: MinuteOfDay }),
  daysOff: z.array(DayOffSchema).max(MAX_DAYS_OFF, `Keep the list to ${MAX_DAYS_OFF} days off or fewer`),
}

export const AvailabilitySchema = z.object({ ...availabilityShape, updatedAt: Millis })
export type Availability = z.infer<typeof AvailabilitySchema>

/** What the owner submits. Cross-field rules live here so every entry point enforces them. */
export const AvailabilityInputSchema = z.object(availabilityShape).superRefine((value, ctx) => {
  const length = value.slotMinutes
  let anyOpen = false

  value.week.forEach((day, index) => {
    if (!day.open) return
    anyOpen = true
    if (day.to <= day.from) {
      ctx.addIssue({ code: 'custom', path: ['week', index, 'to'], message: 'Closing time must be after opening time' })
    } else if (day.to - day.from < length) {
      ctx.addIssue({
        code: 'custom',
        path: ['week', index, 'to'],
        message: `Stay open at least ${durationText(length)}, the length of one slot`,
      })
    } else if (slotStartMinutes(day, length, value.lunch).length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['week', index, 'to'],
        message: 'No slot fits around the lunch break. Widen these hours or shorten the break',
      })
    }
  })

  if (!anyOpen) {
    ctx.addIssue({ code: 'custom', path: ['week'], message: 'Open at least one day, or customers cannot book' })
  }
  if (value.lunch.enabled && value.lunch.to <= value.lunch.from) {
    ctx.addIssue({ code: 'custom', path: ['lunch', 'to'], message: 'The break must end after it starts' })
  }

  const seen = new Set<string>()
  value.daysOff.forEach((entry, index) => {
    if (seen.has(entry.date)) {
      ctx.addIssue({ code: 'custom', path: ['daysOff', index, 'date'], message: 'That date is already listed' })
    }
    seen.add(entry.date)
  })
})
export type AvailabilityInput = z.input<typeof AvailabilityInputSchema>

/** What a new shop starts with: Monday to Saturday, 9 AM to 5 PM, one-hour slots, two at a time. */
export function defaultAvailability(updatedAt = 0): Availability {
  const open: DayHours = { open: true, from: 9 * 60, to: 17 * 60 }
  return {
    week: [{ ...open, open: false }, open, open, open, open, open, open],
    slotMinutes: 60,
    capacity: 2,
    noticeMinutes: 60,
    windowDays: 14,
    lunch: { enabled: false, from: 12 * 60, to: 13 * 60 },
    daysOff: [],
    updatedAt,
  }
}

/* ------------------------------------------------------------
   Pure helpers
   ------------------------------------------------------------ */
export function dayHours(availability: Availability, weekday: number): DayHours | undefined {
  return availability.week[weekday]
}

/** Slot start times, as minutes after midnight, for one open day. Slots never cross the lunch break. */
export function slotStartMinutes(day: DayHours, slotMinutes: number, lunch: Availability['lunch']): number[] {
  if (!day.open) return []
  const starts: number[] = []
  for (let start = day.from; start + slotMinutes <= day.to; start += slotMinutes) {
    const end = start + slotMinutes
    const touchesLunch = lunch.enabled && start < lunch.to && end > lunch.from
    if (!touchesLunch) starts.push(start)
  }
  return starts
}

export function isDayOff(availability: Availability, timestamp: number): boolean {
  const key = dateKey(timestamp)
  return availability.daysOff.some((entry) => entry.date === key)
}

/** "30 minutes", "1 hour", "2 hours", "1 hour 30 minutes", "2 days". */
export function durationText(minutes: number): string {
  if (minutes > 0 && minutes % 1440 === 0) {
    const days = minutes / 1440
    return days === 1 ? '1 day' : `${days} days`
  }
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const hourText = hours === 1 ? '1 hour' : `${hours} hours`
  const minuteText = rest === 1 ? '1 minute' : `${rest} minutes`
  if (hours === 0) return minuteText
  return rest === 0 ? hourText : `${hourText} ${minuteText}`
}

export interface HoursLine {
  readonly days: string
  readonly hours: string
  readonly closed: boolean
}

function joinDays(weekdays: readonly number[]): string {
  const names = weekdays.map((weekday) => WEEKDAY_SHORT[weekday] ?? '')
  const first = names[0] ?? ''
  const last = names[names.length - 1] ?? ''
  if (names.length === 1) return first
  if (names.length === 2) return `${first} and ${last}`
  return `${first} to ${last}`
}

/** The week as readable lines, Monday first, merging neighbouring days with the same hours. */
export function hoursLines(availability: Availability): HoursLine[] {
  const lines: { weekdays: number[]; hours: string; closed: boolean }[] = []
  for (const weekday of DISPLAY_ORDER) {
    const day = dayHours(availability, weekday)
    const closed = day === undefined || !day.open
    const hours = closed ? 'Closed' : `${formatClock(day.from)} to ${formatClock(day.to)}`
    const last = lines[lines.length - 1]
    if (last !== undefined && last.hours === hours) last.weekdays.push(weekday)
    else lines.push({ weekdays: [weekday], hours, closed })
  }
  return lines.map((line) => ({ days: joinDays(line.weekdays), hours: line.hours, closed: line.closed }))
}

/** One sentence, for error messages: "Mon to Sat 9:00 AM to 5:00 PM". */
export function hoursSentence(availability: Availability): string {
  const open = hoursLines(availability).filter((line) => !line.closed)
  if (open.length === 0) return 'the shop is not open for bookings'
  return open.map((line) => `${line.days} ${line.hours}`).join(', ')
}

export function lunchText(availability: Availability): string | null {
  const { lunch } = availability
  return lunch.enabled ? `Closed ${formatClock(lunch.from)} to ${formatClock(lunch.to)} for a break` : null
}

export interface UpcomingDayOff {
  readonly date: string
  readonly label: string
  readonly timestamp: number
}

/** Days off that are still ahead, soonest first. `withinDays` limits them to the booking window. */
export function upcomingDaysOff(availability: Availability, now: number, withinDays?: number): UpcomingDayOff[] {
  const today = new Date(now)
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const entries: UpcomingDayOff[] = []
  for (const entry of availability.daysOff) {
    const timestamp = parseDateKey(entry.date)
    if (timestamp === null || timestamp < todayStart) continue
    if (withinDays !== undefined && timestamp >= todayStart + withinDays * DAY_MS) continue
    entries.push({ date: entry.date, label: entry.label, timestamp })
  }
  return entries.sort((a, b) => a.timestamp - b.timestamp)
}

/** Sorts days off and drops the ones already in the past, so the list never grows without bound. */
export function tidyDaysOff(daysOff: readonly DayOff[], now: number): DayOff[] {
  const today = dateKey(now)
  return daysOff.filter((entry) => entry.date >= today).sort((a, b) => a.date.localeCompare(b.date))
}
