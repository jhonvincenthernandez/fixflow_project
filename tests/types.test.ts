import { describe, expect, it } from 'vitest'
import { AppError, StorageError, ValidationError, toAppError, userMessage, NotFoundError } from '../src/domain/errors'
import { initials, formatRelative } from '../src/domain/format'
import {
  LoginInputSchema,
  NewRequestInputSchema,
  RegisterInputSchema,
  parseOrThrow,
} from '../src/domain/types'
import { NOW } from './helpers'

function fieldsOf(action: () => unknown): Record<string, string[]> {
  try {
    action()
  } catch (error) {
    if (error instanceof ValidationError) return error.fields
    throw error
  }
  throw new Error('Expected a ValidationError')
}

describe('RegisterInputSchema', () => {
  const valid = { name: 'Ana Reyes', email: ' Ana@Example.com ', phone: '0917 123 4567', password: 'longenough1' }

  it('normalizes email and phone', () => {
    const parsed = parseOrThrow(RegisterInputSchema, valid)
    expect(parsed.email).toBe('ana@example.com')
    expect(parsed.phone).toBe('09171234567')
  })

  it('accepts +63 numbers', () => {
    expect(parseOrThrow(RegisterInputSchema, { ...valid, phone: '+63 917 123 4567' }).phone).toBe('+639171234567')
  })

  it('reports each failing field', () => {
    const fields = fieldsOf(() => parseOrThrow(RegisterInputSchema, { name: '', email: 'nope', phone: '123', password: 'short' }))
    expect(Object.keys(fields).sort()).toEqual(['email', 'name', 'password', 'phone'])
    expect(fields['email']?.[0]).toBe('Enter a valid email address')
  })
})

describe('LoginInputSchema', () => {
  it('asks for the email first when it is empty', () => {
    const fields = fieldsOf(() => parseOrThrow(LoginInputSchema, { email: '', password: '' }))
    expect(fields['email']?.[0]).toBe('Enter your email address')
    expect(fields['password']?.[0]).toBe('Enter your password')
  })
})

describe('NewRequestInputSchema', () => {
  const base = {
    serviceId: 'phone',
    itemName: 'iPhone 12',
    description: 'The screen is cracked and will not respond.',
    mode: 'drop_off',
    address: '',
  }

  it('accepts a drop-off without an address', () => {
    expect(() => parseOrThrow(NewRequestInputSchema, base)).not.toThrow()
  })

  it('requires an address for a home visit', () => {
    const fields = fieldsOf(() => parseOrThrow(NewRequestInputSchema, { ...base, mode: 'home_visit' }))
    expect(fields['address']).toEqual(['Enter the address for the home visit'])
  })

  it('rejects an unknown service', () => {
    expect(() => parseOrThrow(NewRequestInputSchema, { ...base, serviceId: 'boat' })).toThrow(ValidationError)
  })
})

describe('errors', () => {
  it('hides raw storage details from users', () => {
    const error = new StorageError('QuotaExceededError: disk full at /data/db')
    expect(userMessage(error)).not.toContain('QuotaExceededError')
  })

  it('shows authored domain messages', () => {
    expect(userMessage(new NotFoundError('We could not find that request.'))).toBe('We could not find that request.')
  })

  it('normalizes unknown throwables and keeps the cause', () => {
    const original = new TypeError('boom')
    const wrapped = toAppError(original)
    expect(wrapped).toBeInstanceOf(AppError)
    expect(wrapped.cause).toBe(original)
    expect(userMessage(wrapped)).toBe('Something went wrong. Try again in a moment.')
    expect(toAppError('string failure').code).toBe('UNKNOWN')
  })
})

describe('format helpers', () => {
  it('builds initials', () => {
    expect(initials('Ana Marie Reyes')).toBe('AR')
    expect(initials('  marco ')).toBe('M')
    expect(initials('')).toBe('')
  })

  it('describes relative time', () => {
    expect(formatRelative(NOW - 5_000, NOW)).toBe('just now')
    expect(formatRelative(NOW - 2 * 60 * 60 * 1000, NOW)).toBe('2 hours ago')
    expect(formatRelative(NOW - 24 * 60 * 60 * 1000, NOW)).toBe('yesterday')
  })
})
