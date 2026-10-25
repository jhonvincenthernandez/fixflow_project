<script setup lang="ts">
import { ref } from 'vue'
import { CalendarOff, Plus, X } from '@lucide/vue'
import AppButton from '@/components/AppButton.vue'
import FormField from '@/components/FormField.vue'
import { MAX_DAYS_OFF, parseDateKey } from '@/domain/availability'
import type { DayOff } from '@/domain/availability'
import type { FieldErrors } from '@/domain/errors'
import { formatLongDay } from '@/domain/format'

const props = defineProps<{
  /** Today as "YYYY-MM-DD". Passed in so the component never reads the clock itself. */
  today: string
  errors: FieldErrors
}>()

const daysOff = defineModel<DayOff[]>({ required: true })

const date = ref('')
const label = ref('')
const addError = ref<string | undefined>(undefined)

function add(): void {
  addError.value = undefined
  if (date.value === '') {
    addError.value = 'Pick the date the shop will be closed'
    return
  }
  if (parseDateKey(date.value) === null) {
    addError.value = 'Pick a real calendar date'
    return
  }
  if (date.value < props.today) {
    addError.value = 'Pick today or a later date'
    return
  }
  if (daysOff.value.some((entry) => entry.date === date.value)) {
    addError.value = 'That date is already listed'
    return
  }
  if (daysOff.value.length >= MAX_DAYS_OFF) {
    addError.value = `Keep the list to ${MAX_DAYS_OFF} days off or fewer`
    return
  }
  daysOff.value = [...daysOff.value, { date: date.value, label: label.value.trim() }].sort((a, b) =>
    a.date.localeCompare(b.date),
  )
  date.value = ''
  label.value = ''
}

function remove(target: string): void {
  daysOff.value = daysOff.value.filter((entry) => entry.date !== target)
}

function longDay(key: string): string {
  const timestamp = parseDateKey(key)
  return timestamp === null ? key : formatLongDay(timestamp)
}
</script>

<template>
  <div class="ff-stack">
    <ul v-if="daysOff.length > 0" class="off">
      <li v-for="entry in daysOff" :key="entry.date" class="off__row">
        <CalendarOff class="ff-icon off__icon" aria-hidden="true" />
        <span class="ff-grow">
          <span class="off__date">{{ longDay(entry.date) }}</span>
          <span v-if="entry.label" class="ff-meta off__label">{{ entry.label }}</span>
        </span>
        <button type="button" class="ff-icon-btn" :aria-label="`Remove day off ${longDay(entry.date)}`" @click="remove(entry.date)">
          <X class="ff-icon" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <p v-else class="ff-meta">No days off yet. Customers can book any open day.</p>

    <form class="ff-stack" novalidate @submit.prevent="add">
      <FormField label="Closed on" :error="addError" hint="For holidays, trainings or time away.">
        <template #default="{ id, describedBy, invalid }">
          <input
            :id="id"
            v-model="date"
            type="date"
            class="ff-input"
            :min="today"
            :aria-invalid="invalid ? 'true' : undefined"
            :aria-describedby="describedBy"
          />
        </template>
      </FormField>
      <FormField label="Reason" optional>
        <template #default="{ id }">
          <input :id="id" v-model="label" type="text" class="ff-input" maxlength="40" autocomplete="off" placeholder="Holiday" />
        </template>
      </FormField>
      <AppButton type="submit" variant="secondary" block>
        <Plus class="ff-icon ff-icon--sm" aria-hidden="true" />
        Add day off
      </AppButton>
    </form>
    <p v-if="errors['daysOff']?.[0]" class="ff-error-text" role="alert">{{ errors['daysOff'][0] }}</p>
  </div>
</template>

<style scoped>
.off {
  display: flex;
  flex-direction: column;
}

.off__row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-top: 1px solid var(--color-border);
}

.off__row:first-child {
  border-top: 0;
  padding-top: 0;
}

.off__icon {
  flex: none;
  color: var(--color-text-secondary);
}

.off__date {
  display: block;
  font-weight: var(--weight-semibold);
}

.off__label {
  display: block;
}
</style>
