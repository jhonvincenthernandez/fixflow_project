/**
 * Typed error hierarchy (Policy: Comprehensive Error Handling, section 2).
 *
 * ASSUMPTION: messages passed to ValidationError, NotFoundError, ForbiddenError,
 * ConflictError and AuthError are written for end users in domain code, so
 * `userMessage` may show them. StorageError and unknown errors never expose
 * their raw message; they map to a generic sentence instead.
 */
export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'UNAUTHENTICATED'
  | 'STORAGE_FAILED'
  | 'UNKNOWN'

export class AppError extends Error {
  readonly code: ErrorCode
  readonly statusHint: number | undefined

  constructor(message: string, code: ErrorCode, statusHint?: number, options?: ErrorOptions) {
    super(message, options)
    this.name = 'AppError'
    this.code = code
    this.statusHint = statusHint
  }
}

/** Field path to the list of messages shown beside that field. */
export type FieldErrors = Record<string, string[]>

export class ValidationError extends AppError {
  readonly fields: FieldErrors

  constructor(fields: FieldErrors, message = 'Check the highlighted fields and try again.') {
    super(message, 'VALIDATION_FAILED', 400)
    this.name = 'ValidationError'
    this.fields = fields
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'We could not find that. It may have been removed.') {
    super(message, 'NOT_FOUND', 404)
    this.name = 'NotFoundError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to do that.') {
    super(message, 'FORBIDDEN', 403)
    this.name = 'ForbiddenError'
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409)
    this.name = 'ConflictError'
  }
}

export class AuthError extends AppError {
  constructor(message = 'Your session has expired. Sign in again.') {
    super(message, 'UNAUTHENTICATED', 401)
    this.name = 'AuthError'
  }
}

export class StorageError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'STORAGE_FAILED', 500, options)
    this.name = 'StorageError'
  }
}

/** Normalizes anything thrown into an AppError, keeping the original as `cause`. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error
  if (error instanceof Error) return new AppError(error.message, 'UNKNOWN', 500, { cause: error })
  return new AppError('Unknown error', 'UNKNOWN', 500, { cause: error })
}

/** First message for one form field when `error` is a ValidationError, else undefined. */
export function fieldMessage(error: unknown, field: string): string | undefined {
  return error instanceof ValidationError ? error.fields[field]?.[0] : undefined
}

const GENERIC_STORAGE_MESSAGE =
  'We could not read or save your data on this device. Try again, and free up storage space if it keeps happening.'
const GENERIC_UNKNOWN_MESSAGE = 'Something went wrong. Try again in a moment.'

/** The only text the UI may show for an error. Never includes stack traces or internal codes. */
export function userMessage(error: AppError): string {
  switch (error.code) {
    case 'VALIDATION_FAILED':
    case 'NOT_FOUND':
    case 'FORBIDDEN':
    case 'CONFLICT':
    case 'UNAUTHENTICATED':
      return error.message
    case 'STORAGE_FAILED':
      return GENERIC_STORAGE_MESSAGE
    case 'UNKNOWN':
      return GENERIC_UNKNOWN_MESSAGE
    default: {
      const unreachable: never = error.code
      return unreachable
    }
  }
}
