<script setup lang="ts">
import { computed } from 'vue'
import { CalendarCheck, CalendarClock, ChevronRight, CircleCheck } from '@lucide/vue'
import AppLink from '@/components/AppLink.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import RatingStars from '@/components/RatingStars.vue'
import RequestCard from '@/components/RequestCard.vue'
import SkeletonList from '@/components/SkeletonList.vue'
import { loadAvailability, useAvailability } from '@/composables/useAvailability'
import { loadRequests, useRequests } from '@/composables/useRequests'
import { BUSINESS } from '@/domain/business'
import { formatDateTime, formatRelative } from '@/domain/format'
import { hoursSentence, lunchText } from '@/domain/availability'
import type { RequestStatus, ServiceRequest } from '@/domain/types'
import { actionOwner } from '@/domain/workflow'

const props = defineProps<{ now: number }>()

const MAX_ACTION = 4
const MAX_UPCOMING = 4
const MAX_FEEDBACK = 3

type TileStatus = Extract<RequestStatus, 'requested' | 'quotation_sent' | 'scheduled' | 'in_progress'>

const TILES: readonly { status: TileStatus; label: string }[] = [
  { status: 'requested', label: 'New requests' },
  { status: 'quotation_sent', label: 'Awaiting customer' },
  { status: 'scheduled', label: 'Booked' },
  { status: 'in_progress', label: 'In progress' },
]

function isTileStatus(status: RequestStatus): status is TileStatus {
  return TILES.some((tile) => tile.status === status)
}

const { state, list, customerName } = useRequests()
const { availability } = useAvailability()
void loadAvailability({ silent: true })

/** One pass over the list for all four counters. */
const counts = computed<Record<TileStatus, number>>(() => {
  const tally: Record<TileStatus, number> = { requested: 0, quotation_sent: 0, scheduled: 0, in_progress: 0 }
  for (const request of list.value) {
    if (isTileStatus(request.status)) tally[request.status] += 1
  }
  return tally
})

const needsAction = computed(() =>
  list.value.filter((request) => actionOwner(request.status) === 'owner').slice(0, MAX_ACTION),
)

const upcoming = computed(() =>
  list.value
    .filter((request): request is ServiceRequest & { appointment: NonNullable<ServiceRequest['appointment']> } =>
      request.status === 'scheduled' && request.appointment !== null,
    )
    .sort((a, b) => a.appointment.startAt - b.appointment.startAt)
    .slice(0, MAX_UPCOMING),
)

const feedback = computed(() =>
  list.value
    .filter((request): request is ServiceRequest & { feedback: NonNullable<ServiceRequest['feedback']> } =>
      request.feedback !== null,
    )
    .sort((a, b) => b.feedback.createdAt - a.feedback.createdAt),
)

const averageRating = computed(() => {
  if (feedback.value.length === 0) return 0
  const sum = feedback.value.reduce((total, request) => total + request.feedback.rating, 0)
  return Math.round((sum / feedback.value.length) * 10) / 10
})
</script>

<template>
  <div class="ff-stack ff-stack--loose">
    <section class="ff-stack ff-stack--tight" aria-labelledby="dash-title">
      <p class="ff-overline">{{ BUSINESS.name }}</p>
      <h1 id="dash-title" class="ff-h1">Shop dashboard</h1>
    </section>

    <AppLink to="/availability" class="ff-card ff-card--interactive schedule">
      <CalendarClock class="ff-icon ff-icon--lg schedule__icon" aria-hidden="true" />
      <span class="ff-grow">
        <span class="schedule__title">Shop schedule</span>
        <span v-if="availability" class="ff-meta schedule__meta">
          {{ hoursSentence(availability) }}<template v-if="lunchText(availability)">. {{ lunchText(availability) }}</template>
        </span>
        <span v-else class="ff-meta schedule__meta">Set your hours, slots and days off</span>
      </span>
      <ChevronRight class="ff-icon" aria-hidden="true" />
    </AppLink>

    <SkeletonList v-if="state.status === 'loading' || state.status === 'idle'" :count="3" />
    <ErrorState
      v-else-if="state.status === 'error'"
      :error="state.error"
      title="The dashboard could not load"
      @retry="loadRequests()"
    />

    <template v-else>
      <section aria-labelledby="dash-overview">
        <h2 id="dash-overview" class="ff-sr-only">Overview</h2>
        <ul class="tiles">
          <li v-for="tile in TILES" :key="tile.status">
            <AppLink :to="`/tabs/requests?status=${tile.status}`" class="ff-card ff-card--interactive tile">
              <span class="tile__count">{{ counts[tile.status] }}</span>
              <span class="tile__label">{{ tile.label }}</span>
            </AppLink>
          </li>
        </ul>
      </section>

      <section class="ff-stack" aria-labelledby="dash-action">
        <h2 id="dash-action" class="ff-h2">Needs your action</h2>
        <ul v-if="needsAction.length > 0" class="ff-stack">
          <li v-for="request in needsAction" :key="request.id">
            <RequestCard :request="request" role="owner" :customer-name="customerName(request.customerId)" :now="now" />
          </li>
        </ul>
        <p v-else class="caught-up ff-meta">
          <CircleCheck class="ff-icon ff-icon--sm" aria-hidden="true" />
          Nothing is waiting on you right now.
        </p>
      </section>

      <section class="ff-stack" aria-labelledby="dash-upcoming">
        <h2 id="dash-upcoming" class="ff-h2">Upcoming appointments</h2>
        <EmptyState
          v-if="upcoming.length === 0"
          :icon="CalendarCheck"
          title="No appointments booked"
          body="Booked visits appear here once customers pick a time."
        />
        <div v-else class="ff-card">
          <ul>
            <li v-for="request in upcoming" :key="request.id" class="row-item">
              <AppLink :to="`/request/${request.id}`" class="row">
                <span class="ff-grow">
                  <span class="row__title">{{ formatDateTime(request.appointment.startAt) }}</span>
                  <span class="ff-meta row__meta">{{ request.itemName }} for {{ customerName(request.customerId) }}</span>
                </span>
                <ChevronRight class="ff-icon row__chevron" aria-hidden="true" />
              </AppLink>
            </li>
          </ul>
        </div>
      </section>

      <section class="ff-stack" aria-labelledby="dash-feedback">
        <h2 id="dash-feedback" class="ff-h2">Customer feedback</h2>
        <p v-if="feedback.length === 0" class="ff-meta">Feedback appears here after customers rate completed repairs.</p>
        <div v-else class="ff-card ff-stack">
          <div class="summary">
            <span class="summary__score">{{ averageRating.toFixed(1) }}</span>
            <div>
              <RatingStars :rating="Math.round(averageRating)" />
              <p class="ff-meta">{{ feedback.length }} {{ feedback.length === 1 ? 'review' : 'reviews' }}</p>
            </div>
          </div>
          <ul>
            <li v-for="request in feedback.slice(0, MAX_FEEDBACK)" :key="request.id" class="row-item">
              <AppLink :to="`/request/${request.id}`" class="row">
                <span class="ff-grow">
                  <RatingStars :rating="request.feedback.rating" />
                  <span class="row__title">{{ request.itemName }}</span>
                  <span v-if="request.feedback.comment.length > 0" class="ff-meta row__meta">{{ request.feedback.comment }}</span>
                  <span class="ff-meta ff-muted row__meta">{{ formatRelative(request.feedback.createdAt, props.now) }}</span>
                </span>
                <ChevronRight class="ff-icon row__chevron" aria-hidden="true" />
              </AppLink>
            </li>
          </ul>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.schedule {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.schedule__icon {
  flex: none;
  color: var(--color-brand);
}

.schedule__title {
  display: block;
  font-weight: var(--weight-bold);
}

.schedule__meta {
  display: block;
}

.caught-up {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-success);
  font-weight: var(--weight-semibold);
}

.tiles {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
}

.tiles li {
  display: flex;
}

.tile {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.tile__count {
  font-size: var(--text-2xl);
  font-weight: var(--weight-extrabold);
  line-height: var(--leading-tight);
  color: var(--color-brand);
}

.tile__label {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-secondary);
}

.row-item + .row-item {
  border-top: 1px solid var(--color-border);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--touch-min);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  color: inherit;
  text-decoration: none;
}

@media (hover: hover) {
  .row:hover {
    background: var(--color-overlay);
  }
}

.row__title {
  display: block;
  font-weight: var(--weight-semibold);
}

.row__meta {
  display: block;
}

.row__chevron {
  color: var(--color-text-muted);
}

.summary {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.summary__score {
  font-size: var(--text-3xl);
  font-weight: var(--weight-extrabold);
  line-height: var(--leading-tight);
  color: var(--color-brand);
}
</style>
