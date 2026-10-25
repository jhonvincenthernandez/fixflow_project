<script setup lang="ts">
import { computed } from 'vue'
import { CircleCheck, Plus } from '@lucide/vue'
import AppLink from '@/components/AppLink.vue'
import ErrorState from '@/components/ErrorState.vue'
import RequestCard from '@/components/RequestCard.vue'
import ServiceIcon from '@/components/ServiceIcon.vue'
import SkeletonList from '@/components/SkeletonList.vue'
import { loadRequests, useRequests } from '@/composables/useRequests'
import { SERVICES } from '@/domain/services'
import { actionOwner } from '@/domain/workflow'

const props = defineProps<{ name: string; now: number }>()

const WHITESPACE = /\s+/
const MAX_ATTENTION = 3

const { state, list } = useRequests()

const firstName = computed(() => props.name.trim().split(WHITESPACE)[0] ?? props.name)
const needsAttention = computed(() =>
  list.value.filter((request) => actionOwner(request.status) === 'customer').slice(0, MAX_ATTENTION),
)
</script>

<template>
  <div class="ff-stack ff-stack--loose">
    <section class="ff-stack" aria-labelledby="home-greeting">
      <h1 id="home-greeting" class="ff-h1">Hello, {{ firstName }}</h1>
      <p class="ff-lead">What needs fixing today?</p>
      <AppLink to="/request/new" class="ff-btn ff-btn--primary ff-btn--block">
        <Plus class="ff-icon ff-icon--sm" aria-hidden="true" />
        New repair request
      </AppLink>
    </section>

    <section class="ff-stack" aria-labelledby="home-attention">
      <h2 id="home-attention" class="ff-h2">Needs your attention</h2>

      <SkeletonList v-if="state.status === 'loading' || state.status === 'idle'" :count="2" />
      <ErrorState
        v-else-if="state.status === 'error'"
        :error="state.error"
        title="Your requests could not load"
        @retry="loadRequests()"
      />
      <template v-else>
        <ul v-if="needsAttention.length > 0" class="ff-stack">
          <li v-for="request in needsAttention" :key="request.id">
            <RequestCard :request="request" role="customer" :now="now" />
          </li>
        </ul>
        <p v-else class="caught-up ff-meta">
          <CircleCheck class="ff-icon ff-icon--sm" aria-hidden="true" />
          You are all caught up. Nothing is waiting on you.
        </p>
        <AppLink to="/tabs/requests" class="ff-btn ff-btn--ghost">See all requests</AppLink>
      </template>
    </section>

    <section class="ff-stack" aria-labelledby="home-services">
      <h2 id="home-services" class="ff-h2">Browse services</h2>
      <ul class="services">
        <li v-for="service in SERVICES" :key="service.id">
          <AppLink :to="`/request/new?service=${service.id}`" class="ff-card ff-card--interactive service">
            <ServiceIcon :service-id="service.id" />
            <span class="service__name">{{ service.name }}</span>
            <span class="ff-meta">{{ service.blurb }}</span>
          </AppLink>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.caught-up {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-success);
  font-weight: var(--weight-semibold);
}

.services {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
}

.services li {
  display: flex;
}

.service {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
}

.service__name {
  font-size: var(--text-base);
  font-weight: var(--weight-bold);
}
</style>
