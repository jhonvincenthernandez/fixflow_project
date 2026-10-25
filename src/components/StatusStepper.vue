<script setup lang="ts">
import { computed } from 'vue'
import { Ban, Check, CircleX } from '@lucide/vue'
import { formatDateTime } from '@/domain/format'
import type { ServiceRequest } from '@/domain/types'
import { STAGES, STATUS_LABEL, isClosedEarly, stageIndex } from '@/domain/workflow'

const props = defineProps<{ request: ServiceRequest }>()

type StepState = 'done' | 'current' | 'upcoming' | 'closed'

interface Step {
  readonly key: string
  readonly label: string
  readonly description: string
  readonly state: StepState
  readonly at: number | null
  readonly note: string
}

const STATE_PREFIX: Record<StepState, string> = {
  done: 'Completed: ',
  current: 'Current step: ',
  upcoming: 'Upcoming: ',
  closed: 'Closed: ',
}

const steps = computed<Step[]>(() => {
  const { request } = props
  // Later history entries win, so a rescheduled appointment shows its latest time.
  const reached = new Map(request.history.map((entry) => [entry.status, entry]))
  const closedEarly = isClosedEarly(request.status)
  const current = stageIndex(request.status)

  const stages: Step[] = STAGES.map((stage, index) => {
    const entry = reached.get(stage.status)
    let state: StepState = 'upcoming'
    if (closedEarly) {
      state = entry === undefined ? 'upcoming' : 'done'
    } else if (request.status === 'feedback' || index < current) {
      state = 'done'
    } else if (index === current) {
      state = 'current'
    }
    return {
      key: stage.status,
      label: stage.label,
      description: stage.description,
      state,
      at: entry?.at ?? null,
      note: entry?.note ?? '',
    }
  })

  if (!closedEarly) return stages

  // A closed request shows the steps it reached, then how it ended.
  const closure = reached.get(request.status)
  return [
    ...stages.filter((step) => step.state === 'done'),
    {
      key: request.status,
      label: STATUS_LABEL[request.status],
      description: request.closure === null ? '' : `By the ${request.closure.by === 'owner' ? 'shop' : 'customer'}`,
      state: 'closed',
      at: closure?.at ?? null,
      note: request.closure?.reason ?? '',
    },
  ]
})
</script>

<template>
  <ol class="stepper" aria-label="Request progress">
    <li
      v-for="step in steps"
      :key="step.key"
      class="step"
      :class="`step--${step.state}`"
      :aria-current="step.state === 'current' ? 'step' : undefined"
    >
      <span class="step__marker" aria-hidden="true">
        <Check v-if="step.state === 'done'" class="ff-icon ff-icon--sm" />
        <Ban v-else-if="step.state === 'closed' && request.status === 'cancelled'" class="ff-icon ff-icon--sm" />
        <CircleX v-else-if="step.state === 'closed'" class="ff-icon ff-icon--sm" />
        <span v-else-if="step.state === 'current'" class="step__dot" />
      </span>
      <div class="step__body">
        <p class="step__label">
          <span class="ff-sr-only">{{ STATE_PREFIX[step.state] }}</span>{{ step.label }}
        </p>
        <p v-if="step.at !== null" class="ff-meta">{{ formatDateTime(step.at) }}</p>
        <p v-if="step.state === 'current' || step.state === 'closed'" class="ff-meta">{{ step.description }}</p>
        <p v-if="step.note.length > 0" class="ff-meta step__note">{{ step.note }}</p>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.stepper {
  display: flex;
  flex-direction: column;
}

.step {
  position: relative;
  display: flex;
  gap: var(--space-3);
  padding-bottom: var(--space-4);
}

.step:last-child {
  padding-bottom: 0;
}

/* Connector line between markers. */
.step:not(:last-child)::before {
  content: '';
  position: absolute;
  top: var(--stepper-marker);
  bottom: 0;
  left: calc(var(--stepper-marker) / 2);
  width: 2px;
  background: var(--color-border);
  transform: translateX(-50%);
}

.step--done:not(:last-child)::before {
  background: var(--color-brand);
}

.step__marker {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--stepper-marker);
  height: var(--stepper-marker);
  background: var(--color-surface);
  border: 2px solid var(--color-border-strong);
  border-radius: var(--radius-full);
  color: var(--color-text-on-brand);
  transition:
    background-color var(--transition-base),
    border-color var(--transition-base);
}

.step--done .step__marker {
  background: var(--color-brand);
  border-color: var(--color-brand);
}

.step--current .step__marker {
  background: var(--color-brand-light);
  border-color: var(--color-brand);
}

.step--closed .step__marker {
  background: var(--color-danger);
  border-color: var(--color-danger);
}

.step__dot {
  width: var(--space-2);
  height: var(--space-2);
  background: var(--color-brand);
  border-radius: var(--radius-full);
}

.step__body {
  min-width: 0;
  padding-top: var(--space-1);
}

.step__label {
  font-weight: var(--weight-bold);
  color: var(--color-text-secondary);
}

.step--done .step__label,
.step--current .step__label {
  color: var(--color-text-primary);
}

.step--closed .step__label {
  color: var(--color-danger);
}

.step__note {
  color: var(--color-text-primary);
}
</style>
