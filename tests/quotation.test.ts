import { describe, expect, it } from 'vitest'
import { buildQuotation, centavosToPesosText, computeTotal, lineTotal, parsePesos } from '../src/domain/quotation'
import { ValidationError } from '../src/domain/errors'
import { formatMoney } from '../src/domain/format'
import { DRAFT, NOW } from './helpers'

describe('parsePesos', () => {
  it.each([
    ['1250', 125_000],
    ['1,250.50', 125_050],
    ['0.5', 50],
    ['0.05', 5],
    ['  300 ', 30_000],
    ['₱999.99', 99_999],
  ])('parses %s', (input, expected) => {
    expect(parsePesos(input)).toBe(expected)
  })

  it.each(['', 'abc', '-5', '1.234', '1..2', '12345678', '1e3'])('rejects %j', (input) => {
    expect(parsePesos(input)).toBeNull()
  })

  it('avoids floating point drift', () => {
    // 19.99 * 100 is 1998.9999999999998 in floating point.
    expect(parsePesos('19.99')).toBe(1999)
  })
})

describe('centavosToPesosText', () => {
  it('round-trips with parsePesos', () => {
    for (const centavos of [0, 5, 50, 100, 125_000, 125_050, 99_999]) {
      expect(parsePesos(centavosToPesosText(centavos))).toBe(centavos)
    }
  })
})

describe('totals', () => {
  it('multiplies quantity by unit price', () => {
    expect(lineTotal({ quantity: 3, unitPriceCentavos: 25_000 })).toBe(75_000)
  })

  it('sums line items', () => {
    expect(computeTotal(DRAFT.items)).toBe(230_000)
  })

  it('formats as Philippine pesos', () => {
    expect(formatMoney(230_000)).toContain('2,300.00')
  })
})

describe('buildQuotation', () => {
  it('assigns ids and freezes the total', () => {
    const quotation = buildQuotation(DRAFT, NOW)
    expect(quotation.items).toHaveLength(2)
    expect(new Set(quotation.items.map((item) => item.id)).size).toBe(2)
    expect(quotation.totalCentavos).toBe(230_000)
    expect(quotation.response).toBeNull()
  })

  it('reports field paths for invalid items', () => {
    const bad = { ...DRAFT, items: [{ description: '', quantity: 0, unitPriceCentavos: 100 }] }
    try {
      buildQuotation(bad, NOW)
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      if (error instanceof ValidationError) {
        expect(Object.keys(error.fields)).toEqual(
          expect.arrayContaining(['items.0.description', 'items.0.quantity']),
        )
      }
    }
  })
})
