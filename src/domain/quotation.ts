import { newId } from './ids'
import { QuotationDraftSchema, parseOrThrow } from './types'
import type { LineItem, Quotation } from './types'
import { ValidationError } from './errors'

const DAY_MS = 24 * 60 * 60 * 1000

/** All money is integer centavos. Floating point never touches a price. */
export function lineTotal(item: Pick<LineItem, 'quantity' | 'unitPriceCentavos'>): number {
  return item.quantity * item.unitPriceCentavos
}

export function computeTotal(items: readonly Pick<LineItem, 'quantity' | 'unitPriceCentavos'>[]): number {
  return items.reduce((sum, item) => sum + lineTotal(item), 0)
}

const PESOS_PATTERN = /^\d{1,7}(?:\.\d{1,2})?$/

/**
 * Parses text such as "1,250.50" into centavos without floating point math.
 * Returns null for anything that is not a plain peso amount.
 */
export function parsePesos(input: string): number | null {
  const cleaned = input.replace(/[,\s₱]/g, '')
  if (!PESOS_PATTERN.test(cleaned)) return null
  const [whole = '0', fraction = ''] = cleaned.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

/** Inverse of parsePesos for editing: 125050 becomes "1250.50", 125000 becomes "1250". */
export function centavosToPesosText(centavos: number): string {
  const whole = Math.floor(centavos / 100)
  const fraction = centavos % 100
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, '0')}`
}

/** Validates a draft and freezes it into a sendable quotation. */
export function buildQuotation(draft: unknown, now: number): Quotation {
  const parsed = parseOrThrow(QuotationDraftSchema, draft)
  const totalCentavos = computeTotal(parsed.items)
  if (totalCentavos <= 0) {
    throw new ValidationError({ items: ['The total must be greater than zero'] })
  }
  return {
    items: parsed.items.map((item) => ({ ...item, id: newId() })),
    notes: parsed.notes,
    estimatedDays: parsed.estimatedDays,
    validUntil: now + parsed.validDays * DAY_MS,
    totalCentavos,
    sentAt: now,
    response: null,
    respondedAt: null,
  }
}
