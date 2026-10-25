<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { durationText, hoursSentence, lunchText, upcomingDaysOff } from '@/domain/availability'
import type { Availability } from '@/domain/availability'
import { formatDayNumber, formatLongDay, formatMonth, formatTime, formatWeekday } from '@/domain/format'
import { availableDays, slotsForDay } from '@/domain/schedule'
import type { Booking } from '@/domain/schedule'

const props = defineProps<{
  /** The owner's current schedule. Only times it opens can be chosen. */
  availability: Availability
  /** Every other active appointment. */
  bookings: readonly Booking[]
  now: number
}>()

/** Chosen appointment start time, or null. */
const model = defineModel<number | null>({ required: true })

const uid = useId()
const dayName = `${uid}-day`
const timeName = `${uid}-time`

const days = computed(() => availableDays(props.now, props.bookings, props.availability))
const pickedDay = ref<number | null>(null)

const activeDay = computed<number | null>(() => {
  const picked = pickedDay.value
  if (picked !== null && days.value.includes(picked)) return picked
  return days.value[0] ?? null
})

const slots = computed(() =>
  activeDay.value === null ? [] : slotsForDay(activeDay.value, props.now, props.bookings, props.availability),
)

const closedDays = computed(() =>
  upcomingDaysOff(props.availability, props.now, props.availability.windowDays)
    .slice(0, 3)
    .map((entry) => (entry.label === '' ? formatLongDay(entry.timestamp) : `${formatLongDay(entry.timestamp)} (${entry.label})`)),
)
const hint = computed(() => {
  const parts = [`Open ${hoursSentence(props.availability)}.`]
  const lunch = lunchText(props.availability)
  if (lunch !== null) parts.push(`${lunch}.`)
  parts.push(`Each visit is booked for ${durationText(props.availability.slotMinutes)}.`)
  if (closedDays.value.length > 0) parts.push(`Closed on ${closedDays.value.join(', ')}.`)
  return parts.join(' ')
})

function chooseDay(day: number): void {
  pickedDay.value = day
  // A time belongs to one day, so switching days clears it.
  model.value = null
}
</script>

<template>
  <div v-if="days.length === 0" class="slots__empty">
    <p class="ff-h3">No open times right now</p>
    <p class="ff-meta">
      No time is free in the next {{ availability.windowDays }} days. Please check back soon.
    </p>
    <p class="ff-hint">{{ hint }}</p>
  </div>

  <div v-else class="slots">
    <fieldset class="slots__group">
      <legend class="ff-label">Choose a day</legend>
      <div class="slots__days">
        <label
          v-for="day in days"
          :key="day"
          class="slot day"
          :class="{ 'is-active': activeDay === day }"
        >
          <input
            type="radio"
            class="ff-sr-only"
            :name="dayName"
            :checked="activeDay === day"
            @change="chooseDay(day)"
          />
          <span class="ff-sr-only">{{ formatLongDay(day) }}</span>
          <span class="day__weekday" aria-hidden="true">{{ formatWeekday(day) }}</span>
          <span class="day__number" aria-hidden="true">{{ formatDayNumber(day) }}</span>
          <span class="day__month" aria-hidden="true">{{ formatMonth(day) }}</span>
        </label>
      </div>
    </fieldset>

    <fieldset class="slots__group">
      <legend class="ff-label">Choose a time</legend>
      <div class="slots__times">
        <label
          v-for="slot in slots"
          :key="slot.startAt"
          class="slot time"
          :class="{ 'is-active': model === slot.startAt, 'is-disabled': !slot.available }"
        >
          <input
            v-model="model"
            type="radio"
            class="ff-sr-only"
            :name="timeName"
            :value="slot.startAt"
            :disabled="!slot.available"
          />
          <span>{{ formatTime(slot.startAt) }}</span>
          <span v-if="!slot.available" class="time__note">Unavailable</span>
          <span v-else-if="availability.capacity > 1 && slot.remaining === 1" class="time__note">1 left</span>
        </label>
      </div>
    </fieldset>

    <p class="ff-hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.slots {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.slots__empty {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  text-align: center;
}

.slots__group {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.slots__days {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding-bottom: var(--space-1);
  overflow-x: auto;
}

.slots__times {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: var(--touch-min);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  text-align: center;
  cursor: pointer;
  outline: var(--focus-ring-width) solid transparent;
  outline-offset: var(--focus-ring-offset);
  transition:
    color var(--transition-base),
    background-color var(--transition-base),
    border-color var(--transition-base),
    outline-color var(--transition-base);
}

@media (hover: hover) {
  .slot:hover:not(.is-active):not(.is-disabled) {
    background: var(--color-overlay);
  }
}

.slot.is-active {
  background: var(--color-brand-light);
  border-color: var(--color-brand);
  color: var(--color-brand-dark);
}

.slot.is-disabled {
  background: var(--color-overlay);
  border-color: var(--color-border);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.slot:has(input:focus-visible) {
  outline-color: var(--color-brand);
}

.day {
  flex: none;
  min-width: calc(var(--touch-min) + var(--space-3));
  gap: 0;
}

.day__weekday,
.day__month {
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  color: var(--color-text-secondary);
}

.day__number {
  font-size: var(--text-lg);
  font-weight: var(--weight-extrabold);
}

.time__note {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-text-secondary);
}

.slot.is-disabled .time__note {
  color: var(--color-text-muted);
}
</style>
