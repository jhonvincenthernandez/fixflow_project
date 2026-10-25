/**
 * Formatters are created once at module load (Policy: no Intl construction in render paths).
 */
const moneyFormat = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })
const dateFormat = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' })
const weekdayFormat = new Intl.DateTimeFormat('en-PH', { weekday: 'short' })
const dayNumberFormat = new Intl.DateTimeFormat('en-PH', { day: 'numeric' })
const monthFormat = new Intl.DateTimeFormat('en-PH', { month: 'short' })
const longDayFormat = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })
const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function formatMoney(centavos: number): string {
  return moneyFormat.format(centavos / 100)
}

export function formatDate(timestamp: number): string {
  return dateFormat.format(timestamp)
}

export function formatTime(timestamp: number): string {
  return timeFormat.format(timestamp)
}

/** A time of day given as minutes after midnight, for example 540 becomes "9:00 am". */
export function formatClock(minutes: number): string {
  return timeFormat.format(new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60))
}

export function formatDateTime(timestamp: number): string {
  return `${dateFormat.format(timestamp)}, ${timeFormat.format(timestamp)}`
}

export function formatWeekday(timestamp: number): string {
  return weekdayFormat.format(timestamp)
}

export function formatDayNumber(timestamp: number): string {
  return dayNumberFormat.format(timestamp)
}

export function formatMonth(timestamp: number): string {
  return monthFormat.format(timestamp)
}

export function formatLongDay(timestamp: number): string {
  return longDayFormat.format(timestamp)
}

/** "2 hours ago", "yesterday", "in 3 days". */
export function formatRelative(timestamp: number, now: number): string {
  const diff = timestamp - now
  const abs = Math.abs(diff)
  if (abs < MINUTE) return 'just now'
  if (abs < HOUR) return relativeFormat.format(Math.round(diff / MINUTE), 'minute')
  if (abs < DAY) return relativeFormat.format(Math.round(diff / HOUR), 'hour')
  if (abs < 7 * DAY) return relativeFormat.format(Math.round(diff / DAY), 'day')
  return dateFormat.format(timestamp)
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((part) => part.length > 0)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}
