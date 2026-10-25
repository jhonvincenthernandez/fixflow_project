<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import { Ban, BadgeCheck, CalendarCheck, CircleCheck, CircleX, ClipboardList, Receipt, Search, Star, Wrench } from '@lucide/vue'
import type { RequestStatus } from '@/domain/types'
import { STATUS_LABEL } from '@/domain/workflow'

const props = defineProps<{ status: RequestStatus }>()

type Tone = '' | 'brand' | 'solid' | 'success' | 'danger'

/**
 * Three semantic hues only (policy): neutral and brand tints for the open stages,
 * solid brand for active work, green for finished, red for closed early.
 * Every badge also carries an icon and a text label, so color is never the only signal.
 */
const META: Record<RequestStatus, { icon: Component; tone: Tone }> = {
  requested: { icon: ClipboardList, tone: '' },
  under_review: { icon: Search, tone: '' },
  quotation_sent: { icon: Receipt, tone: 'brand' },
  quotation_accepted: { icon: BadgeCheck, tone: 'brand' },
  scheduled: { icon: CalendarCheck, tone: 'brand' },
  in_progress: { icon: Wrench, tone: 'solid' },
  completed: { icon: CircleCheck, tone: 'success' },
  feedback: { icon: Star, tone: 'success' },
  declined: { icon: CircleX, tone: 'danger' },
  cancelled: { icon: Ban, tone: 'danger' },
}

const meta = computed(() => META[props.status])
</script>

<template>
  <span class="ff-badge" :class="meta.tone === '' ? undefined : `ff-badge--${meta.tone}`">
    <component :is="meta.icon" class="ff-icon ff-icon--sm" aria-hidden="true" />
    {{ STATUS_LABEL[status] }}
  </span>
</template>
