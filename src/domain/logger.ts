import { toAppError } from './errors'

export type LogContext = Record<string, unknown>

/**
 * Structured logger. Every catch block in the app either re-throws, returns a typed
 * error, or calls this with enough context to diagnose the failure.
 */
export const logger = {
  error(message: string, error: unknown, context: LogContext = {}): void {
    const appError = toAppError(error)
    console.error(`[fixflow] ${message}`, {
      code: appError.code,
      name: appError.name,
      detail: appError.message,
      cause: appError.cause,
      ...context,
    })
  },
  warn(message: string, context: LogContext = {}): void {
    console.warn(`[fixflow] ${message}`, context)
  },
}
