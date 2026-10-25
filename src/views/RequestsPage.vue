<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IonContent,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  onIonViewWillEnter,
} from '@ionic/vue'
import type { RefresherCustomEvent } from '@ionic/vue'
import { ClipboardList, Plus, RefreshCw, SearchX } from '@lucide/vue'
import { useRoute } from 'vue-router'
import AppButton from '@/components/AppButton.vue'
import AppLink from '@/components/AppLink.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import ErrorState from '@/components/ErrorState.vue'
import PageHeader from '@/components/PageHeader.vue'
import RequestCard from '@/components/RequestCard.vue'
import SkeletonList from '@/components/SkeletonList.vue'
import { loadRequests, useRequests } from '@/composables/useRequests'
import { useSession } from '@/composables/useSession'
import { getService } from '@/domain/services'
import { StatusSchema } from '@/domain/types'
import type { RequestStatus, ServiceRequest } from '@/domain/types'
import { STATUS_LABEL, actionOwner, isTerminal } from '@/domain/workflow'

type Filter = 'all' | 'action' | 'active' | 'closed'

const route = useRoute()
const { role } = useSession()
const { state, list, customerName } = useRequests()

const filter = ref<Filter>('all')
const statusFilter = ref<RequestStatus | null>(null)
const search = ref('')
const refreshing = ref(false)
const now = ref(Date.now())

const filters = computed<{ value: Filter; label: string }[]>(() => [
  { value: 'all', label: 'All' },
  { value: 'action', label: role.value === 'owner' ? 'Needs action' : 'Your turn' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
])

onIonViewWillEnter(() => {
  now.value = Date.now()
  // The dashboard links here with ?status=requested and similar.
  const parsed = StatusSchema.safeParse(route.query['status'])
  statusFilter.value = parsed.success ? parsed.data : null
  if (parsed.success) filter.value = 'all'
  void loadRequests({ silent: true })
})

function matchesFilter(request: ServiceRequest): boolean {
  if (statusFilter.value !== null) return request.status === statusFilter.value
  switch (filter.value) {
    case 'all':
      return true
    case 'action':
      return actionOwner(request.status) === role.value
    case 'active':
      return !isTerminal(request.status)
    case 'closed':
      return isTerminal(request.status)
    default: {
      const unreachable: never = filter.value
      return unreachable
    }
  }
}

function matchesSearch(request: ServiceRequest, term: string): boolean {
  if (term.length === 0) return true
  const haystack = [
    request.ref,
    request.itemName,
    getService(request.serviceId).name,
    role.value === 'owner' ? customerName(request.customerId) : '',
  ]
  return haystack.some((text) => text.toLowerCase().includes(term))
}

const visible = computed(() => {
  const term = search.value.trim().toLowerCase()
  return list.value.filter((request) => matchesFilter(request) && matchesSearch(request, term))
})

function chooseFilter(value: Filter): void {
  filter.value = value
  statusFilter.value = null
}

function clearFilters(): void {
  filter.value = 'all'
  statusFilter.value = null
  search.value = ''
}

async function refresh(): Promise<void> {
  refreshing.value = true
  try {
    now.value = Date.now()
    await loadRequests({ silent: true })
  } finally {
    refreshing.value = false
  }
}

async function onPullRefresh(event: RefresherCustomEvent): Promise<void> {
  await refresh()
  await event.target.complete()
}
</script>

<template>
  <ion-page>
    <PageHeader title="Requests">
      <template #actions>
        <button type="button" class="ff-icon-btn" aria-label="Refresh requests" :aria-busy="refreshing" @click="refresh">
          <RefreshCw class="ff-icon" :class="{ spinning: refreshing }" aria-hidden="true" />
        </button>
        <AppLink v-if="role === 'customer'" to="/request/new" class="ff-icon-btn" aria-label="New repair request">
          <Plus class="ff-icon" aria-hidden="true" />
        </AppLink>
      </template>
    </PageHeader>

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="onPullRefresh">
        <ion-refresher-content />
      </ion-refresher>

      <main class="ff-container ff-stack" tabindex="-1">
        <ErrorBoundary title="Requests could not load">
          <div class="ff-stack ff-stack--tight">
            <label class="ff-sr-only" for="request-search">Search requests</label>
            <input
              id="request-search"
              v-model="search"
              class="ff-input"
              type="search"
              inputmode="search"
              autocomplete="off"
              :placeholder="role === 'owner' ? 'Search by item, reference or customer' : 'Search by item or reference'"
            />
            <div class="chips" role="group" aria-label="Filter requests">
              <button
                v-for="option in filters"
                :key="option.value"
                type="button"
                class="ff-chip"
                :aria-pressed="statusFilter === null && filter === option.value"
                @click="chooseFilter(option.value)"
              >
                {{ option.label }}
              </button>
              <button
                v-if="statusFilter !== null"
                type="button"
                class="ff-chip"
                aria-pressed="true"
                @click="chooseFilter('all')"
              >
                {{ STATUS_LABEL[statusFilter] }}: clear
              </button>
            </div>
          </div>

          <SkeletonList v-if="state.status === 'loading' || state.status === 'idle'" :count="4" />

          <ErrorState
            v-else-if="state.status === 'error'"
            :error="state.error"
            title="Requests could not load"
            @retry="loadRequests()"
          />

          <template v-else>
            <p class="ff-meta" aria-live="polite">Showing {{ visible.length }} of {{ list.length }} requests</p>

            <EmptyState
              v-if="list.length === 0"
              :icon="ClipboardList"
              title="No requests yet"
              :body="
                role === 'customer'
                  ? 'Send your first repair request and the shop will reply with a quotation.'
                  : 'New requests from customers will appear here.'
              "
            >
              <AppLink v-if="role === 'customer'" to="/request/new" class="ff-btn ff-btn--primary">
                <Plus class="ff-icon ff-icon--sm" aria-hidden="true" />
                New repair request
              </AppLink>
            </EmptyState>

            <EmptyState
              v-else-if="visible.length === 0"
              :icon="SearchX"
              title="Nothing matches"
              body="Try a different search or show all requests."
            >
              <AppButton variant="secondary" @click="clearFilters">Show all requests</AppButton>
            </EmptyState>

            <ul v-else class="ff-stack">
              <li v-for="request in visible" :key="request.id">
                <RequestCard
                  :request="request"
                  :role="role ?? 'customer'"
                  :customer-name="role === 'owner' ? customerName(request.customerId) : undefined"
                  :now="now"
                />
              </li>
            </ul>
          </template>
        </ErrorBoundary>
      </main>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.chips {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  padding-bottom: var(--space-1);
}

.spinning {
  animation: ff-spin var(--spin-duration) linear infinite;
}
</style>
