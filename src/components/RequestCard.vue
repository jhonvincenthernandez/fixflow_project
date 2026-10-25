<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight } from '@lucide/vue'
import { formatRelative } from '@/domain/format'
import { getService } from '@/domain/services'
import type { Role, ServiceRequest } from '@/domain/types'
import { STAGES, actionOwner, nextStepText, stageIndex } from '@/domain/workflow'
import AppLink from './AppLink.vue'
import ServiceIcon from './ServiceIcon.vue'
import StatusBadge from './StatusBadge.vue'

const props = defineProps<{
  request: ServiceRequest
  role: Role
  /** Owner view only: who the request belongs to. */
  customerName?: string | undefined
  /** Passed in once by the list so every card formats against the same clock. */
  now: number
}>()

const service = computed(() => getService(props.request.serviceId))
/** 1 to 8 inside the main flow, 0 for declined and cancelled. */
const step = computed(() => stageIndex(props.request.status) + 1)
const yourTurn = computed(() => actionOwner(props.request.status) === props.role)
</script>

<template>
  <AppLink :to="`/request/${request.id}`" class="ff-card ff-card--interactive card">
    <div class="card__top">
      <ServiceIcon :service-id="request.serviceId" />
      <div class="ff-grow">
        <h3 class="ff-h3 card__title">{{ request.itemName }}</h3>
        <p class="ff-meta card__meta">
          <span>{{ request.ref }}</span>
          <span class="card__dot" aria-hidden="true" />
          <span>{{ service.name }}</span>
        </p>
        <p v-if="customerName" class="ff-meta">{{ customerName }}</p>
      </div>
      <ChevronRight class="ff-icon card__chevron" aria-hidden="true" />
    </div>

    <div class="card__status">
      <StatusBadge :status="request.status" />
      <span v-if="step > 0" class="ff-meta">Step {{ step }} of {{ STAGES.length }}</span>
    </div>

    <div v-if="step > 0" class="card__progress" aria-hidden="true">
      <span v-for="n in STAGES.length" :key="n" class="card__segment" :class="{ 'is-done': n <= step }" />
    </div>

    <p class="card__hint" :class="{ 'is-turn': yourTurn }">
      <span v-if="yourTurn" class="card__turn">Your turn</span>
      {{ nextStepText(request.status, role) }}
    </p>
    <p class="ff-meta ff-muted">Updated {{ formatRelative(request.updatedAt, now) }}</p>
  </AppLink>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.card__top {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.card__title {
  overflow-wrap: anywhere;
}

.card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.card__dot {
  width: var(--space-1);
  height: var(--space-1);
  background: var(--color-text-muted);
  border-radius: var(--radius-full);
}

.card__chevron {
  align-self: center;
  color: var(--color-text-muted);
}

.card__status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.card__progress {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: var(--space-1);
}

.card__segment {
  height: var(--space-1);
  background: var(--color-border);
  border-radius: var(--radius-full);
  transition: background-color var(--transition-slow);
}

.card__segment.is-done {
  background: var(--color-brand);
}

.card__hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.card__hint.is-turn {
  color: var(--color-text-primary);
  font-weight: var(--weight-semibold);
}

.card__turn {
  padding: 0 var(--space-2);
  background: var(--color-brand-light);
  border: 1px solid var(--color-brand-border);
  border-radius: var(--radius-xs);
  color: var(--color-brand-dark);
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
}
</style>
