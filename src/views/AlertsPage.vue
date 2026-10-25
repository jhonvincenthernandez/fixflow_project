<script setup lang="ts">
import { ref } from 'vue'
import { IonContent, IonPage, onIonViewWillEnter } from '@ionic/vue'
import { BellOff, CheckCheck } from '@lucide/vue'
import AppButton from '@/components/AppButton.vue'
import AppLink from '@/components/AppLink.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import ErrorState from '@/components/ErrorState.vue'
import PageHeader from '@/components/PageHeader.vue'
import SkeletonList from '@/components/SkeletonList.vue'
import { loadNotifications, markAllRead, markRead, useNotifications } from '@/composables/useNotifications'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { showToast } from '@/composables/useToast'
import { toAppError, userMessage } from '@/domain/errors'
import { formatRelative } from '@/domain/format'
import { logger } from '@/domain/logger'

const { state, list, unreadCount } = useNotifications()
const now = ref(Date.now())

onIonViewWillEnter(() => {
  now.value = Date.now()
  void loadNotifications({ silent: true })
})

const markAll = useAsyncAction(async () => {
  await markAllRead()
})

async function onOpen(id: string, alreadyRead: boolean): Promise<void> {
  if (alreadyRead) return
  try {
    await markRead(id)
  } catch (error) {
    // Opening the request still works; only the read marker failed.
    const appError = toAppError(error)
    logger.error('Marking an alert as read failed', appError, { id })
    showToast('error', userMessage(appError))
  }
}
</script>

<template>
  <ion-page>
    <PageHeader title="Alerts" />
    <ion-content>
      <main class="ff-container ff-stack" tabindex="-1">
        <ErrorBoundary title="Alerts could not load">
          <SkeletonList v-if="state.status === 'loading' || state.status === 'idle'" :count="3" />

          <ErrorState
            v-else-if="state.status === 'error'"
            :error="state.error"
            title="Alerts could not load"
            @retry="loadNotifications()"
          />

          <template v-else>
            <EmptyState
              v-if="list.length === 0"
              :icon="BellOff"
              title="No alerts yet"
              body="You will see updates here when a request changes."
            />

            <template v-else>
              <div class="toolbar">
                <p class="ff-meta" aria-live="polite">
                  {{ unreadCount === 0 ? 'All caught up' : `${unreadCount} unread` }}
                </p>
                <AppButton
                  v-if="unreadCount > 0"
                  variant="ghost"
                  :loading="markAll.loading.value"
                  @click="markAll.run()"
                >
                  <CheckCheck class="ff-icon ff-icon--sm" aria-hidden="true" />
                  Mark all as read
                </AppButton>
              </div>
              <p v-if="markAll.error.value" class="ff-error-text" role="alert">
                {{ userMessage(markAll.error.value) }} Try again.
              </p>

              <ul class="ff-stack ff-stack--tight">
                <li v-for="item in list" :key="item.id">
                  <AppLink
                    :to="`/request/${item.requestId}`"
                    class="ff-card ff-card--interactive alert"
                    :class="{ 'is-unread': item.readAt === null }"
                    @click="onOpen(item.id, item.readAt !== null)"
                  >
                    <span v-if="item.readAt === null" class="alert__dot" aria-hidden="true" />
                    <span class="ff-grow">
                      <span class="alert__title">
                        <span v-if="item.readAt === null" class="ff-sr-only">Unread: </span>{{ item.title }}
                      </span>
                      <span class="ff-meta alert__body">{{ item.body }}</span>
                      <span class="ff-meta ff-muted alert__body">{{ formatRelative(item.createdAt, now) }}</span>
                    </span>
                  </AppLink>
                </li>
              </ul>
            </template>
          </template>
        </ErrorBoundary>
      </main>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.alert {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.alert__dot {
  flex: none;
  width: var(--space-2);
  height: var(--space-2);
  margin-top: var(--space-2);
  background: var(--color-brand);
  border-radius: var(--radius-full);
}

.alert__title {
  display: block;
  font-weight: var(--weight-semibold);
}

.alert.is-unread .alert__title {
  font-weight: var(--weight-extrabold);
}

.alert__body {
  display: block;
}
</style>
