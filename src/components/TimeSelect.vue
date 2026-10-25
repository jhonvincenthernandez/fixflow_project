<script setup lang="ts">
import { computed } from 'vue'
import { EARLIEST_OPEN, LATEST_CLOSE, TIME_STEP_MINUTES } from '@/domain/availability'
import { formatClock } from '@/domain/format'

const props = withDefaults(
  defineProps<{
    /** Accessible name, for example "Monday opens at". */
    label: string
    min?: number
    max?: number
    invalid?: boolean
    describedBy?: string | undefined
  }>(),
  { min: EARLIEST_OPEN, max: LATEST_CLOSE, invalid: false, describedBy: undefined },
)

/** Minutes after midnight. */
const model = defineModel<number>({ required: true })

const options = computed(() => {
  const times: { value: number; text: string }[] = []
  for (let minute = props.min; minute <= props.max; minute += TIME_STEP_MINUTES) {
    times.push({ value: minute, text: formatClock(minute) })
  }
  return times
})

function onChange(event: Event): void {
  if (event.target instanceof HTMLSelectElement) model.value = Number(event.target.value)
}
</script>

<template>
  <select
    class="ff-select"
    :aria-label="label"
    :aria-invalid="invalid ? 'true' : undefined"
    :aria-describedby="describedBy"
    @change="onChange"
  >
    <option v-for="option in options" :key="option.value" :value="option.value" :selected="option.value === model">
      {{ option.text }}
    </option>
  </select>
</template>
