import { computed, shallowRef, watch } from 'vue'
import { createRequest, listCustomers, listRequests, performAction } from '@/data/repo'
import type { ImageUpload } from '@/data/repo'
import type { AsyncState } from '@/domain/async'
import { toAppError, userMessage } from '@/domain/errors'
import { logger } from '@/domain/logger'
import type { PublicUser, ServiceRequest } from '@/domain/types'
import type { ActionInput } from '@/domain/workflow'
import { requireActor, useSession } from './useSession'
import { showToast } from './useToast'

const requestsState = shallowRef<AsyncState<ServiceRequest[]>>({ status: 'idle' })
const customersById = shallowRef<ReadonlyMap<string, PublicUser>>(new Map())
let inflight: Promise<void> | null = null

function sortNewestFirst(requests: readonly ServiceRequest[]): ServiceRequest[] {
  return [...requests].sort((a, b) => b.updatedAt - a.updatedAt)
}

/**
 * Loads requests (and, for the owner, customer names) in parallel.
 * `silent` keeps the current list on screen while refreshing, and reports a failure as a toast.
 */
export function loadRequests(options: { silent?: boolean } = {}): Promise<void> {
  if (inflight !== null) return inflight

  const run = async (): Promise<void> => {
    const hadData = requestsState.value.status === 'success'
    if (!(options.silent === true && hadData)) requestsState.value = { status: 'loading' }
    try {
      const actor = requireActor()
      const [requests, customers] = await Promise.all([
        listRequests(actor),
        actor.role === 'owner' ? listCustomers(actor) : Promise.resolve<PublicUser[]>([]),
      ])
      customersById.value = new Map(customers.map((customer) => [customer.id, customer]))
      requestsState.value = { status: 'success', data: requests }
    } catch (error) {
      const appError = toAppError(error)
      logger.error('Loading requests failed', appError)
      if (hadData && options.silent === true) {
        showToast('error', `Could not refresh. ${userMessage(appError)}`)
        return
      }
      requestsState.value = { status: 'error', error: appError }
    }
  }

  inflight = run().finally(() => {
    inflight = null
  })
  return inflight
}

/** Puts a changed request into the cached list without another round trip. */
export function upsertRequest(next: ServiceRequest): void {
  const current = requestsState.value
  if (current.status !== 'success') return
  const without = current.data.filter((request) => request.id !== next.id)
  requestsState.value = { status: 'success', data: sortNewestFirst([...without, next]) }
}

export async function submitRequest(input: unknown, uploads: readonly ImageUpload[]): Promise<ServiceRequest> {
  const created = await createRequest(requireActor(), input, uploads)
  upsertRequest(created)
  return created
}

export async function runAction(requestId: string, input: ActionInput): Promise<ServiceRequest> {
  const next = await performAction(requireActor(), requestId, input)
  upsertRequest(next)
  return next
}

// The cache belongs to one user. Drop it whenever the signed-in user changes.
const { user } = useSession()
watch(
  () => user.value?.id,
  () => {
    requestsState.value = { status: 'idle' }
    customersById.value = new Map()
  },
)

export function useRequests() {
  const list = computed(() => (requestsState.value.status === 'success' ? requestsState.value.data : []))
  return {
    state: requestsState,
    list,
    customersById,
    customerOf: (id: string): PublicUser | undefined => customersById.value.get(id),
    customerName: (id: string): string => customersById.value.get(id)?.name ?? 'Customer',
  }
}
