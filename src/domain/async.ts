import type { AppError } from './errors'

/**
 * Policy: every async operation exposed in UI has four explicit states, and the
 * error state always carries a way to recover (a retry button in the view).
 * Only valid combinations are representable.
 */
export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: AppError }
