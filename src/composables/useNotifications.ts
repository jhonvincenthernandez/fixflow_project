import { computed, shallowRef, watch } from 'vue'
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '@/data/repo'
import type { AsyncState } from '@/domain/async'
import { toAppError, userMessage } from '@/domain/errors'
import { logger } from '@/domain/logger'
import type { AppNotification } from '@/domain/types'
import { requireActor, useSession } from './useSession'
import { showToast } from './useToast'

const notificationsState = shallowRef<AsyncState<AppNotification[]>>({ status: 'idle' })
let inflight: Promise<void> | null = null

export function loadNotifications(options: { silent?: boolean } = {}): Promise<void> {
  if (inflight !== null) return inflight

  const run = async (): Promise<void> => {
    const hadData = notificationsState.value.status === 'success'
    if (!(options.silent === true && hadData)) notificationsState.value = { status: 'loading' }
    try {
      const actor = requireActor()
      notificationsState.value = { status: 'success', data: await listNotifications(actor.id) }
    } catch (error) {
      const appError = toAppError(error)
      logger.error('Loading notifications failed', appError)
      if (hadData && options.silent === true) {
        showToast('error', `Could not refresh alerts. ${userMessage(appError)}`)
        return
      }
      notificationsState.value = { status: 'error', error: appError }
    }
  }

  inflight = run().finally(() => {
    inflight = null
  })
  return inflight
}

function replaceAll(update: (items: readonly AppNotification[]) => AppNotification[]): void {
  const current = notificationsState.value
  if (current.status !== 'success') return
  notificationsState.value = { status: 'success', data: update(current.data) }
}

export async function markRead(id: string): Promise<void> {
  const actor = requireActor()
  await markNotificationRead(actor.id, id)
  const readAt = Date.now()
  replaceAll((items) => items.map((item) => (item.id === id && item.readAt === null ? { ...item, readAt } : item)))
}

export async function markAllRead(): Promise<void> {
  const actor = requireActor()
  await markAllNotificationsRead(actor.id)
  const readAt = Date.now()
  replaceAll((items) => items.map((item) => (item.readAt === null ? { ...item, readAt } : item)))
}

// `immediate` matters: this module loads lazily with the tabs page, after sign-in has already happened.
const { user } = useSession()
watch(
  () => user.value?.id,
  (id) => {
    notificationsState.value = { status: 'idle' }
    // Load right away so the tab badge is correct before the Alerts tab is ever opened.
    if (id !== undefined) void loadNotifications({ silent: true })
  },
  { immediate: true },
)

export function useNotifications() {
  const list = computed(() => (notificationsState.value.status === 'success' ? notificationsState.value.data : []))
  const unreadCount = computed(() => list.value.filter((item) => item.readAt === null).length)
  return { state: notificationsState, list, unreadCount }
}
