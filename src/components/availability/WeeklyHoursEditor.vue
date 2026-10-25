<script setup lang="ts">
import { useId } from 'vue'
import { Copy } from '@lucide/vue'
import AppButton from '@/components/AppButton.vue'
import TimeSelect from '@/components/TimeSelect.vue'
import ToggleField from '@/components/ToggleField.vue'
import { DISPLAY_ORDER, WEEKDAY_NAMES } from '@/domain/availability'
import type { DayHours } from '@/domain/availability'
import type { FieldErrors } from '@/domain/errors'

const props = defineProps<{
  /** Field errors from validation, keyed by path such as "week.1.to". */
  errors: FieldErrors
}>()

/** Seven entries indexed like Date#getDay (0 is Sunday). */
const week = defineModel<DayHours[]>({ required: true })

const uid = useId()

function patch(weekday: number, change: Partial<DayHours>): void {
  week.value = week.value.map((day, index) => (index === weekday ? { ...day, ...change } : day))
}

/** The message for a day. `from` and `to` errors share one line under the row. */
function errorFor(weekday: number): string | undefined {
  return props.errors[`week.${weekday}.to`]?.[0] ?? props.errors[`week.${weekday}.from`]?.[0]
}

function hasError(weekday: number, field: 'from' | 'to'): boolean {
  return props.errors[`week.${weekday}.${field}`] !== undefined
}

/** The first open day in display order is the one whose hours get copied. */
const source = (): DayHours | undefined =>
  DISPLAY_ORDER.map((weekday) => week.value[weekday]).find((day) => day !== undefined && day.open)

function copyToOpenDays(): void {
  const first = source()
  if (first === undefined) return
  week.value = week.value.map((day) => (day.open ? { ...day, from: first.from, to: first.to } : day))
}
</script>

<template>
  <div class="ff-stack">
    <ul class="week">
      <li v-for="weekday in DISPLAY_ORDER" :key="weekday" class="week__day">
        <template v-if="week[weekday]">
          <ToggleField
            :model-value="week[weekday].open"
            :label="WEEKDAY_NAMES[weekday] ?? ''"
            @update:model-value="patch(weekday, { open: $event })"
          />
          <div v-if="week[weekday].open" class="week__times">
            <TimeSelect
              :model-value="week[weekday].from"
              :label="`${WEEKDAY_NAMES[weekday]} opens at`"
              :invalid="hasError(weekday, 'from')"
              :described-by="hasError(weekday, 'from') ? `${uid}-err-${weekday}` : undefined"
              @update:model-value="patch(weekday, { from: $event })"
            />
            <span class="week__to" aria-hidden="true">to</span>
            <TimeSelect
              :model-value="week[weekday].to"
              :label="`${WEEKDAY_NAMES[weekday]} closes at`"
              :invalid="hasError(weekday, 'to')"
              :described-by="hasError(weekday, 'to') ? `${uid}-err-${weekday}` : undefined"
              @update:model-value="patch(weekday, { to: $event })"
            />
          </div>
          <p v-if="errorFor(weekday) !== undefined" :id="`${uid}-err-${weekday}`" class="ff-error-text" role="alert">
            {{ errorFor(weekday) }}
          </p>
        </template>
      </li>
    </ul>
    <p v-if="errors['week']?.[0]" class="ff-error-text" role="alert">{{ errors['week'][0] }}</p>
    <AppButton variant="secondary" block @click="copyToOpenDays">
      <Copy class="ff-icon ff-icon--sm" aria-hidden="true" />
      Use the first open day's hours for every open day
    </AppButton>
  </div>
</template>

<style scoped>
.week {
  display: flex;
  flex-direction: column;
}

.week__day {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-top: 1px solid var(--color-border);
}

.week__day:first-child {
  padding-top: 0;
  border-top: 0;
}

.week__times {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.week__to {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}
</style>
