<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { IonContent, IonFooter, IonPage, onIonViewWillEnter } from '@ionic/vue'
import { SearchX } from '@lucide/vue'
import AppButton from '@/components/AppButton.vue'
import AppLink from '@/components/AppLink.vue'
import DisclosureSection from '@/components/DisclosureSection.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import ErrorState from '@/components/ErrorState.vue'
import ImageGallery from '@/components/ImageGallery.vue'
import PageHeader from '@/components/PageHeader.vue'
import QuotationSummary from '@/components/QuotationSummary.vue'
import RatingStars from '@/components/RatingStars.vue'
import SkeletonList from '@/components/SkeletonList.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import StatusStepper from '@/components/StatusStepper.vue'
import RequestActions from '@/components/request/RequestActions.vue'
import { loadRequests, upsertRequest, useRequests } from '@/composables/useRequests'
import { requireActor, useSession } from '@/composables/useSession'
import { showToast } from '@/composables/useToast'
import { getRequest, getRequestImages } from '@/data/repo'
import type { StoredImage } from '@/data/repo'
import type { AsyncState } from '@/domain/async'
import { toAppError, userMessage } from '@/domain/errors'
import { formatDate, formatLongDay, formatRelative, formatTime } from '@/domain/format'
import { logger } from '@/domain/logger'
import { getService } from '@/domain/services'
import type { ServiceRequest } from '@/domain/types'
import { actionOwner, availableActions, nextStepText } from '@/domain/workflow'

// Props instead of useRoute(): see the route definition.
const props = defineProps<{ id: string }>()

const { role } = useSession()
const { list, customerOf, customersById } = useRequests()

const detail = shallowRef<AsyncState<ServiceRequest>>({ status: 'loading' })
const images = shallowRef<AsyncState<StoredImage[]>>({ status: 'idle' })
const now = ref(Date.now())

const request = computed(() => (detail.value.status === 'success' ? detail.value.data : null))
const service = computed(() => (request.value === null ? null : getService(request.value.serviceId)))
const customer = computed(() => (request.value === null ? undefined : customerOf(request.value.customerId)))
const hasActions = computed(
  () => request.value !== null && role.value !== null && availableActions(request.value.status, role.value).length > 0,
)
const yourTurn = computed(() => request.value !== null && actionOwner(request.value.status) === role.value)

/** Shows the cached copy at once, then refreshes it. A failed refresh keeps what is on screen. */
async function loadRequest(): Promise<void> {
  if (detail.value.status !== 'success') {
    const cached = list.value.find((item) => item.id === props.id)
    detail.value = cached === undefined ? { status: 'loading' } : { status: 'success', data: cached }
  }
  try {
    const fresh = await getRequest(requireActor(), props.id)
    upsertRequest(fresh)
    detail.value = { status: 'success', data: fresh }
  } catch (error) {
    const appError = toAppError(error)
    logger.error('Loading a request failed', appError, { requestId: props.id })
    if (detail.value.status === 'success') showToast('error', `Could not refresh. ${userMessage(appError)}`)
    else detail.value = { status: 'error', error: appError }
  }
}

async function loadImages(): Promise<void> {
  images.value = { status: 'loading' }
  try {
    images.value = { status: 'success', data: await getRequestImages(requireActor(), props.id) }
  } catch (error) {
    const appError = toAppError(error)
    logger.error('Loading request photos failed', appError, { requestId: props.id })
    images.value = { status: 'error', error: appError }
  }
}

onIonViewWillEnter(() => {
  now.value = Date.now()
  // Independent requests start together, so none waits on another.
  // Each function handles its own errors and never rejects.
  const jobs: Promise<void>[] = [loadRequest(), loadImages()]
  if (role.value === 'owner' && customersById.value.size === 0) jobs.push(loadRequests({ silent: true }))
  void Promise.all(jobs)
})

function onUpdated(next: ServiceRequest): void {
  detail.value = { status: 'success', data: next }
  now.value = Date.now()
}
</script>

<template>
  <ion-page>
    <PageHeader :title="request?.ref ?? 'Request'" back-href="/tabs/requests" />

    <ion-content>
      <main class="ff-container ff-stack" tabindex="-1">
        <ErrorBoundary title="This request could not be shown">
          <SkeletonList v-if="detail.status === 'loading' || detail.status === 'idle'" :count="2" />

          <EmptyState
            v-else-if="detail.status === 'error' && detail.error.code === 'NOT_FOUND'"
            :icon="SearchX"
            title="Request not found"
            body="It may have been removed, or it belongs to another account."
          >
            <AppLink to="/tabs/requests" class="ff-btn ff-btn--primary">Back to requests</AppLink>
          </EmptyState>

          <ErrorState
            v-else-if="detail.status === 'error'"
            :error="detail.error"
            title="This request could not load"
            @retry="loadRequest"
          />

          <template v-else-if="request && service && role">
            <section class="ff-stack ff-stack--tight" aria-labelledby="detail-title">
              <div class="ff-row ff-row--between ff-row--wrap">
                <StatusBadge :status="request.status" />
                <span class="ff-meta">Updated {{ formatRelative(request.updatedAt, now) }}</span>
              </div>
              <h2 id="detail-title" class="ff-h1">{{ request.itemName }}</h2>
              <p class="ff-meta">{{ service.name }}, submitted {{ formatDate(request.createdAt) }}</p>
              <p class="ff-inset next" :class="{ 'is-turn': yourTurn }">
                <strong v-if="yourTurn" class="next__turn">Your turn: </strong>{{ nextStepText(request.status, role) }}
              </p>
            </section>

            <section class="ff-card ff-stack" aria-labelledby="detail-problem">
              <h2 id="detail-problem" class="ff-h3">The problem</h2>
              <p class="problem">{{ request.description }}</p>
              <dl class="facts">
                <div>
                  <dt class="ff-meta">Service</dt>
                  <dd>{{ request.mode === 'home_visit' ? 'Home visit' : 'Drop off at the shop' }}</dd>
                </div>
                <div v-if="request.mode === 'home_visit'">
                  <dt class="ff-meta">Address</dt>
                  <dd>{{ request.address }}</dd>
                </div>
              </dl>

              <template v-if="request.imageIds.length > 0">
                <h3 class="ff-label">Photos</h3>
                <SkeletonList v-if="images.status === 'loading' || images.status === 'idle'" :count="1" />
                <template v-else-if="images.status === 'error'">
                  <p class="ff-error-text" role="alert">{{ userMessage(images.error) }}</p>
                  <AppButton variant="secondary" @click="loadImages">Try again</AppButton>
                </template>
                <ImageGallery v-else :images="images.data" />
              </template>
            </section>

            <section v-if="role === 'owner'" class="ff-card ff-stack" aria-labelledby="detail-customer">
              <h2 id="detail-customer" class="ff-h3">Customer</h2>
              <dl class="facts">
                <div>
                  <dt class="ff-meta">Name</dt>
                  <dd>{{ customer?.name ?? 'Customer' }}</dd>
                </div>
                <div v-if="customer">
                  <dt class="ff-meta">Mobile</dt>
                  <dd><a :href="`tel:${customer.phone}`">{{ customer.phone }}</a></dd>
                </div>
                <div v-if="customer">
                  <dt class="ff-meta">Email</dt>
                  <dd><a :href="`mailto:${customer.email}`">{{ customer.email }}</a></dd>
                </div>
              </dl>
            </section>

            <section v-if="request.quotation" class="ff-card ff-stack" aria-labelledby="detail-quote">
              <h2 id="detail-quote" class="ff-h3">Quotation</h2>
              <QuotationSummary :quotation="request.quotation" :now="now" />
            </section>

            <section v-if="request.appointment" class="ff-card ff-stack ff-stack--tight" aria-labelledby="detail-appointment">
              <h2 id="detail-appointment" class="ff-h3">Appointment</h2>
              <p class="appointment">{{ formatLongDay(request.appointment.startAt) }}</p>
              <p class="ff-meta">
                {{ formatTime(request.appointment.startAt) }},
                {{ request.mode === 'home_visit' ? 'the technician will visit the address above' : 'bring the item to the shop' }}.
              </p>
            </section>

            <section v-if="request.feedback" class="ff-card ff-stack ff-stack--tight" aria-labelledby="detail-feedback">
              <h2 id="detail-feedback" class="ff-h3">Feedback</h2>
              <RatingStars :rating="request.feedback.rating" />
              <p v-if="request.feedback.comment.length > 0">{{ request.feedback.comment }}</p>
              <p class="ff-meta">{{ formatDate(request.feedback.createdAt) }}</p>
            </section>

            <DisclosureSection title="Progress" default-open>
              <StatusStepper :request="request" />
            </DisclosureSection>
          </template>
        </ErrorBoundary>
      </main>
    </ion-content>

    <ion-footer v-if="request && role && hasActions">
      <RequestActions :request="request" :role="role" @updated="onUpdated" @stale="loadRequest" />
    </ion-footer>
  </ion-page>
</template>

<style scoped>
.next {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.next.is-turn {
  background: var(--color-brand-light);
  border-color: var(--color-brand-border);
  color: var(--color-text-primary);
}

.next__turn {
  color: var(--color-brand-dark);
}

.problem {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.facts {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: 0;
}

.facts dd {
  margin: 0;
  font-weight: var(--weight-semibold);
  overflow-wrap: anywhere;
}

.appointment {
  font-size: var(--text-lg);
  font-weight: var(--weight-extrabold);
}
</style>
