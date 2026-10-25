import { computed, shallowRef, watch } from 'vue'
import { getAvailability, saveAvailability } from '@/data/repo'
import type { AsyncState } from '@/domain/async'
import type { Availability } from '@/domain/availability'
import { toAppError, userMessage } from '@/domain/errors'
import { logger } from '@/domain/logger'
import { requireActor, useSession } from './useSession'
import { showToast } from './useToast'

/**
 * The shop's availability, shared by every screen that shows opening hours.
 * The owner edits it; customers only read it.
 */
const availabilityState = shallowRef<AsyncState<Availability>>({ status: 'idle' })
let inflight: Promise<void> | null = null

/** `silent` keeps what is on screen while refreshing, and reports a failed refresh as a toast. */
export function loadAvailability(options: { silent?: boolean } = {}): Promise<void> {
  if (inflight !== null) return inflight

  const run = async (): Promise<void> => {
    const hadData = availabilityState.value.status === 'success'
    if (!(options.silent === true && hadData)) availabilityState.value = { status: 'loading' }
    try {
      availabilityState.value = { status: 'success', data: await getAvailability(requireActor()) }
    } catch (error) {
      const appError = toAppError(error)
      logger.error('Loading the shop schedule failed', appError)
      if (hadData && options.silent === true) {
        showToast('error', `Could not refresh the schedule. ${userMessage(appError)}`)
        return
      }
      availabilityState.value = { status: 'error', error: appError }
    }
  }

  inflight = run().finally(() => {
    inflight = null
  })
  return inflight
}

/** Saves the owner's schedule and shares the saved copy with every screen. Throws on failure. */
export async function persistAvailability(input: unknown): Promise<Availability> {
  const saved = await saveAvailability(requireActor(), input)
  availabilityState.value = { status: 'success', data: saved }
  return saved
}

const { user } = useSession()
watch(
  () => user.value?.id,
  () => {
    availabilityState.value = { status: 'idle' }
  },
  { immediate: true },
)

export function useAvailability() {
  const availability = computed(() => (availabilityState.value.status === 'success' ? availabilityState.value.data : null))
  return { state: availabilityState, availability }
}
