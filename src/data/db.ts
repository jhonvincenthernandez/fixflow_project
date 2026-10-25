import type { z } from 'zod'
import { AppError, StorageError } from '@/domain/errors'
import { logger } from '@/domain/logger'

const DB_NAME = 'fixflow'
const DB_VERSION = 1

export const STORE_NAMES = ['users', 'requests', 'images', 'notifications', 'meta'] as const
export type StoreName = (typeof STORE_NAMES)[number]

let dbPromise: Promise<IDBDatabase> | null = null

function upgrade(db: IDBDatabase): void {
  const users = db.createObjectStore('users', { keyPath: 'id' })
  users.createIndex('email', 'email', { unique: true })

  const requests = db.createObjectStore('requests', { keyPath: 'id' })
  requests.createIndex('customerId', 'customerId')

  const images = db.createObjectStore('images', { keyPath: 'id' })
  images.createIndex('requestId', 'requestId')

  const notifications = db.createObjectStore('notifications', { keyPath: 'id' })
  notifications.createIndex('userId', 'userId')

  db.createObjectStore('meta', { keyPath: 'key' })
}

/** Opens the database once and reuses the connection. A failed open can be retried. */
export function openDb(): Promise<IDBDatabase> {
  if (dbPromise !== null) return dbPromise

  const attempt = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new StorageError('IndexedDB is not available in this environment'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => upgrade(request.result)
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      resolve(db)
    }
    request.onerror = () => reject(new StorageError('Could not open the local database', { cause: request.error }))
    request.onblocked = () => reject(new StorageError('The local database is blocked by another tab'))
  })

  dbPromise = attempt
  attempt.catch((error: unknown) => {
    // Forget the failed attempt so the next call can retry, and keep the cause in the log.
    dbPromise = null
    logger.error('Opening the database failed', error)
  })
  return attempt
}

/** Wraps one IDBRequest in a promise. Only await these inside a runTx callback. */
export function idb<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new StorageError('A database request failed', { cause: request.error }))
  })
}

/**
 * Runs `work` inside one transaction. Resolves with the value `work` returns once the
 * transaction has committed. If `work` throws (including a domain ConflictError), the
 * transaction rolls back and the original error is rethrown unchanged.
 *
 * IMPORTANT: `work` may only await idb() promises. Awaiting anything else (fetch, hashing,
 * timers) lets the transaction auto-commit early. Do slow work before calling runTx.
 */
export async function runTx<T>(
  storeNames: readonly StoreName[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  const db = await openDb()
  let tx: IDBTransaction
  try {
    tx = db.transaction([...storeNames], mode)
  } catch (error) {
    throw new StorageError('Could not start a database transaction', { cause: error })
  }

  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new StorageError('The database transaction was aborted'))
    tx.onerror = () => reject(tx.error ?? new StorageError('The database transaction failed'))
  })
  // `done` is awaited on the success path. This extra handler only records a rollback so an
  // abort we trigger ourselves never surfaces as an unhandled rejection.
  done.catch((reason: unknown) => logger.warn('Database transaction rolled back', { reason: String(reason) }))

  try {
    const value = await work(tx)
    await done
    return value
  } catch (error) {
    try {
      tx.abort()
    } catch (abortError) {
      logger.warn('Transaction was already finished when abort was requested', { abortError: String(abortError) })
    }
    // Domain errors (conflicts, validation) pass through untouched; anything else is a storage failure.
    if (error instanceof AppError) throw error
    throw new StorageError('A database operation failed', { cause: error })
  }
}

/** Validates rows read from storage. Corrupted rows fail loudly instead of leaking into the UI. */
export function parseRows<S extends z.ZodType>(schema: S, rows: readonly unknown[], label: string): z.output<S>[] {
  const parsed: z.output<S>[] = []
  for (const row of rows) {
    const result = schema.safeParse(row)
    if (!result.success) {
      const error = new StorageError(`Stored ${label} data is not in the expected format`, { cause: result.error })
      logger.error('Stored row failed validation', error, { label, issues: result.error.issues.length })
      throw error
    }
    parsed.push(result.data)
  }
  return parsed
}

export function parseRow<S extends z.ZodType>(schema: S, row: unknown, label: string): z.output<S> {
  const [first] = parseRows(schema, [row], label)
  if (first === undefined) throw new StorageError(`Stored ${label} data is missing`)
  return first
}

export async function clearAllStores(): Promise<void> {
  await runTx(STORE_NAMES, 'readwrite', async (tx) => {
    await Promise.all(STORE_NAMES.map((name) => idb(tx.objectStore(name).clear())))
  })
}
