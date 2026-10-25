import { computed, readonly, shallowRef } from 'vue'
import { authenticate, getUser, registerCustomer } from '@/data/repo'
import { seedIfEmpty } from '@/data/seed'
import { clearSession, readStoredSession, storeSession } from '@/data/session'
import { AuthError, toAppError } from '@/domain/errors'
import type { AppError } from '@/domain/errors'
import { logger } from '@/domain/logger'
import type { PublicUser } from '@/domain/types'
import type { Actor } from '@/domain/workflow'

/** One state at a time; impossible combinations such as "signed in and loading" cannot be represented. */
export type SessionState =
  | { readonly status: 'loading' }
  | { readonly status: 'signedOut' }
  | { readonly status: 'signedIn'; readonly user: PublicUser }
  | { readonly status: 'error'; readonly error: AppError }

const state = shallowRef<SessionState>({ status: 'loading' })
let bootstrapping: Promise<void> | null = null
let started = false

async function bootstrap(): Promise<void> {
  state.value = { status: 'loading' }
  try {
    await seedIfEmpty()
    const storedId = readStoredSession()
    if (storedId === null) {
      state.value = { status: 'signedOut' }
      return
    }
    try {
      state.value = { status: 'signedIn', user: await getUser(storedId) }
    } catch (error) {
      if (!(error instanceof AuthError)) throw error
      // The stored user no longer exists (for example after a data reset): start signed out.
      clearSession()
      state.value = { status: 'signedOut' }
    }
  } catch (error) {
    logger.error('Starting the app failed', error)
    state.value = { status: 'error', error: toAppError(error) }
  }
}

function startBootstrap(): Promise<void> {
  started = true
  const run = bootstrap().finally(() => {
    bootstrapping = null
  })
  bootstrapping = run
  return run
}

/** Snapshot for router guards, which run outside any component. */
export function getSessionState(): SessionState {
  return state.value
}

/** Safe to call from every route change: it only starts work the first time. */
export function ensureSession(): Promise<void> {
  if (bootstrapping !== null) return bootstrapping
  if (!started) return startBootstrap()
  return Promise.resolve()
}

export function retryBootstrap(): Promise<void> {
  return bootstrapping ?? startBootstrap()
}

export async function signIn(input: unknown): Promise<PublicUser> {
  const user = await authenticate(input)
  storeSession(user.id)
  state.value = { status: 'signedIn', user }
  return user
}

export async function register(input: unknown): Promise<PublicUser> {
  const user = await registerCustomer(input)
  storeSession(user.id)
  state.value = { status: 'signedIn', user }
  return user
}

export function signOut(): void {
  clearSession()
  state.value = { status: 'signedOut' }
}

/** Signed-in user's id and role, or an AuthError when there is no session. */
export function requireActor(): Actor {
  const current = state.value
  if (current.status !== 'signedIn') throw new AuthError()
  return { id: current.user.id, role: current.user.role }
}

export function useSession() {
  const user = computed(() => (state.value.status === 'signedIn' ? state.value.user : null))
  const role = computed(() => user.value?.role ?? null)
  return { state: readonly(state), user, role }
}
