<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { IonContent, IonFooter, IonPage, onIonViewWillEnter } from '@ionic/vue'
import { ChevronRight, TriangleAlert, Undo2 } from '@lucide/vue'
import AppButton from '@/components/AppButton.vue'
import AppLink from '@/components/AppLink.vue'
import ChoiceSelect from '@/components/ChoiceSelect.vue'
import DaysOffEditor from '@/components/availability/DaysOffEditor.vue'
import WeeklyHoursEditor from '@/components/availability/WeeklyHoursEditor.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import ErrorState from '@/components/ErrorState.vue'
import FormField from '@/components/FormField.vue'
import PageHeader from '@/components/PageHeader.vue'
import SkeletonList from '@/components/SkeletonList.vue'
import TimeSelect from '@/components/TimeSelect.vue'
import ToggleField from '@/components/ToggleField.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { loadAvailability, persistAvailability, useAvailability } from '@/composables/useAvailability'
import { loadRequests, useRequests } from '@/composables/useRequests'
import { showToast } from '@/composables/useToast'
import {
  AvailabilityInputSchema,
  MAX_CAPACITY,
  NOTICE_OPTIONS,
  SLOT_LENGTHS,
  WINDOW_OPTIONS,
  dateKey,
  durationText,
  hoursLines,
  lunchText,
} from '@/domain/availability'
import type { Availability, AvailabilityInput } from '@/domain/availability'
import { userMessage } from '@/domain/errors'
import { formatDateTime } from '@/domain/format'
import { fitsAvailability } from '@/domain/schedule'
import { validationFields } from '@/domain/types'

const SLOT_CHOICES = SLOT_LENGTHS.map((value) => ({ value, text: durationText(value) }))
const NOTICE_CHOICES = NOTICE_OPTIONS.map((value) => ({ value, text: value === 0 ? 'No minimum' : durationText(value) }))
const WINDOW_CHOICES = WINDOW_OPTIONS.map((value) => ({ value, text: `${value} days` }))
const CAPACITY_CHOICES = Array.from({ length: MAX_CAPACITY }, (_, index) => ({
  value: index + 1,
  text: index === 0 ? '1 job' : `${index + 1} jobs`,
}))
const MAX_LISTED = 5

const { state, availability } = useAvailability()
const { list, customerName } = useRequests()

const main = useTemplateRef<HTMLElement>('main')
const now = ref(Date.now())

/** An editable copy of the saved schedule. Nothing is saved until the owner taps Save. */
const draft = ref<AvailabilityInput | null>(null)
const baseline = ref('')
const attempted = ref(false)

function toDraft(source: Availability): AvailabilityInput {
  return {
    week: source.week.map((day) => ({ ...day })),
    slotMinutes: source.slotMinutes,
    capacity: source.capacity,
    noticeMinutes: source.noticeMinutes,
    windowDays: source.windowDays,
    lunch: { ...source.lunch },
    daysOff: source.daysOff.map((entry) => ({ ...entry })),
  }
}

function resetDraft(source: Availability): void {
  const next = toDraft(source)
  draft.value = next
  baseline.value = JSON.stringify(next)
  attempted.value = false
}

const dirty = computed(() => draft.value !== null && JSON.stringify(draft.value) !== baseline.value)

// Follows the saved copy, but never overwrites edits that have not been saved yet.
watch(
  availability,
  (saved) => {
    if (saved !== null && (draft.value === null || !dirty.value)) resetDraft(saved)
  },
  { immediate: true },
)

onIonViewWillEnter(() => {
  now.value = Date.now()
  void Promise.all([loadAvailability({ silent: true }), loadRequests({ silent: true })])
})

const errors = computed(() => (attempted.value && draft.value !== null ? validationFields(AvailabilityInputSchema, draft.value) : {}))

/** The draft as a full Availability, or null while it has errors. */
const checked = computed<Availability | null>(() => {
  if (draft.value === null) return null
  const result = AvailabilityInputSchema.safeParse(draft.value)
  return result.success ? { ...result.data, updatedAt: 0 } : null
})

/** Booked visits that would sit outside the schedule being edited. They stay booked either way. */
const affected = computed(() => {
  const schedule = checked.value
  if (schedule === null) return []
  return list.value
    .flatMap((request) =>
      request.status === 'scheduled' &&
      request.appointment !== null &&
      request.appointment.startAt >= now.value &&
      !fitsAvailability(request.appointment, schedule)
        ? [{ request, startAt: request.appointment.startAt }]
        : [],
    )
    .sort((a, b) => a.startAt - b.startAt)
})

const preview = computed(() => (checked.value === null ? null : { lines: hoursLines(checked.value), lunch: lunchText(checked.value) }))

const save = useAsyncAction(async () => {
  const saved = await persistAvailability(draft.value)
  // The saved copy is now the baseline, so the screen is clean again (past days off are dropped on save).
  resetDraft(saved)
  showToast('success', 'Schedule saved. Customers now see these times.')
  return saved
})

const formError = computed(() => {
  if (save.error.value === null) return null
  return save.error.value.code === 'VALIDATION_FAILED'
    ? 'Check the highlighted fields and try again.'
    : userMessage(save.error.value)
})

async function onSave(): Promise<void> {
  if (draft.value === null) return
  attempted.value = true
  if (Object.keys(validationFields(AvailabilityInputSchema, draft.value)).length > 0) {
    await nextTick()
    main.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    return
  }
  await save.run()
}

function onDiscard(): void {
  if (availability.value !== null) resetDraft(availability.value)
  save.reset()
}
</script>

<template>
  <ion-page>
    <PageHeader title="Shop schedule" back-href="/tabs/profile" />

    <ion-content>
      <main ref="main" class="ff-container ff-stack" tabindex="-1">
        <ErrorBoundary title="The schedule could not be shown">
          <SkeletonList v-if="state.status === 'idle' || (state.status === 'loading' && draft === null)" :count="3" />
          <ErrorState
            v-else-if="state.status === 'error' && draft === null"
            :error="state.error"
            title="The schedule could not load"
            @retry="loadAvailability()"
          />

          <template v-else-if="draft">
            <p class="ff-lead intro">
              Customers can only book times you open here. Changes apply as soon as you save, and visits that are already
              booked are never moved.
            </p>

            <section v-if="affected.length > 0" class="ff-inset warn" aria-labelledby="av-affected">
              <h2 id="av-affected" class="ff-h3 warn__title">
                <TriangleAlert class="ff-icon" aria-hidden="true" />
                {{ affected.length === 1 ? '1 booked visit is' : `${affected.length} booked visits are` }} outside this schedule
              </h2>
              <p class="ff-meta">They stay booked. Open one to reschedule it or tell the customer.</p>
              <ul class="warn__list">
                <li v-for="item in affected.slice(0, MAX_LISTED)" :key="item.request.id">
                  <AppLink :to="`/request/${item.request.id}`" class="warn__row">
                    <span class="ff-grow">
                      <span class="warn__date">{{ formatDateTime(item.startAt) }}</span>
                      <span class="ff-meta warn__meta">
                        {{ item.request.ref }}, {{ item.request.itemName }} for {{ customerName(item.request.customerId) }}
                      </span>
                    </span>
                    <ChevronRight class="ff-icon" aria-hidden="true" />
                  </AppLink>
                </li>
              </ul>
              <p v-if="affected.length > MAX_LISTED" class="ff-meta">And {{ affected.length - MAX_LISTED }} more.</p>
            </section>

            <section class="ff-card ff-stack" aria-labelledby="av-week">
              <div class="ff-stack ff-stack--tight">
                <h2 id="av-week" class="ff-h3">Weekly hours</h2>
                <p class="ff-meta">Switch a day to closed to keep the shop shut that day every week.</p>
              </div>
              <WeeklyHoursEditor v-model="draft.week" :errors="errors" />
            </section>

            <section class="ff-card ff-stack" aria-labelledby="av-slots">
              <h2 id="av-slots" class="ff-h3">Appointment slots</h2>
              <FormField label="Slot length" hint="How long one booking takes. Customers pick a start time.">
                <template #default="{ id, describedBy }">
                  <ChoiceSelect :id="id" v-model="draft.slotMinutes" :choices="SLOT_CHOICES" :described-by="describedBy" />
                </template>
              </FormField>
              <FormField
                label="Jobs at the same time"
                hint="For example, the number of technicians working at once. A slot closes when this many are booked."
                :error="errors['capacity']?.[0]"
              >
                <template #default="{ id, describedBy, invalid }">
                  <ChoiceSelect
                    :id="id"
                    v-model="draft.capacity"
                    :choices="CAPACITY_CHOICES"
                    :invalid="invalid"
                    :described-by="describedBy"
                  />
                </template>
              </FormField>

              <div class="ff-stack ff-stack--tight">
                <ToggleField v-model="draft.lunch.enabled" label="Lunch break" on-text="On" off-text="Off" />
                <div v-if="draft.lunch.enabled" class="lunch">
                  <TimeSelect v-model="draft.lunch.from" label="Break starts at" />
                  <span class="lunch__to" aria-hidden="true">to</span>
                  <TimeSelect
                    v-model="draft.lunch.to"
                    label="Break ends at"
                    :invalid="errors['lunch.to'] !== undefined"
                    :described-by="errors['lunch.to'] !== undefined ? 'av-lunch-error' : undefined"
                  />
                </div>
                <p v-if="errors['lunch.to']?.[0]" id="av-lunch-error" class="ff-error-text" role="alert">
                  {{ errors['lunch.to'][0] }}
                </p>
                <p class="ff-hint">No visit starts during the break or runs through it.</p>
              </div>
            </section>

            <section class="ff-card ff-stack" aria-labelledby="av-rules">
              <h2 id="av-rules" class="ff-h3">Booking rules</h2>
              <FormField label="Minimum notice" hint="Customers cannot book a time sooner than this from now.">
                <template #default="{ id, describedBy }">
                  <ChoiceSelect
                    :id="id"
                    v-model="draft.noticeMinutes"
                    :choices="NOTICE_CHOICES"
                    :described-by="describedBy"
                  />
                </template>
              </FormField>
              <FormField label="How far ahead customers can book">
                <template #default="{ id, describedBy }">
                  <ChoiceSelect :id="id" v-model="draft.windowDays" :choices="WINDOW_CHOICES" :described-by="describedBy" />
                </template>
              </FormField>
            </section>

            <section class="ff-card ff-stack" aria-labelledby="av-off">
              <h2 id="av-off" class="ff-h3">Days off</h2>
              <DaysOffEditor v-model="draft.daysOff" :today="dateKey(now)" :errors="errors" />
            </section>

            <section v-if="preview" class="ff-card ff-stack ff-stack--tight" aria-labelledby="av-preview">
              <h2 id="av-preview" class="ff-h3">What customers see</h2>
              <dl class="preview">
                <div v-for="line in preview.lines" :key="line.days" class="preview__row">
                  <dt>{{ line.days }}</dt>
                  <dd :class="{ 'ff-muted': line.closed }">{{ line.hours }}</dd>
                </div>
              </dl>
              <p v-if="preview.lunch" class="ff-meta">{{ preview.lunch }}.</p>
            </section>
          </template>
        </ErrorBoundary>
      </main>
    </ion-content>

    <ion-footer v-if="draft">
      <div class="savebar">
        <p v-if="formError" class="ff-error-text" role="alert">{{ formError }}</p>
        <p v-else-if="dirty" class="ff-meta" role="status">You have unsaved changes.</p>
        <div class="savebar__buttons">
          <AppButton v-if="dirty" variant="secondary" @click="onDiscard">
            <Undo2 class="ff-icon ff-icon--sm" aria-hidden="true" />
            Discard
          </AppButton>
          <AppButton block :loading="save.loading.value" :disabled="!dirty" @click="onSave">Save schedule</AppButton>
        </div>
      </div>
    </ion-footer>
  </ion-page>
</template>

<style scoped>
.intro {
  margin: 0;
}

.warn {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  background: var(--color-danger-light);
  border-color: var(--color-danger-border);
}

.warn__title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-danger-dark);
}

.warn__list {
  display: flex;
  flex-direction: column;
}

.warn__row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--touch-min);
  padding: var(--space-2) 0;
  border-top: 1px solid var(--color-danger-border);
  color: inherit;
  text-decoration: none;
}

.warn__date {
  display: block;
  font-weight: var(--weight-semibold);
}

.warn__meta {
  display: block;
}

.lunch {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.lunch__to {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
}

.preview__row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
}

.preview dt {
  font-weight: var(--weight-semibold);
}

.preview dd {
  margin: 0;
  text-align: right;
}

.savebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--surface-pad);
  padding-bottom: calc(var(--surface-pad) + var(--safe-bottom));
  background: var(--color-surface);
}

.savebar__buttons {
  display: flex;
  gap: var(--space-2);
}

.savebar__buttons > :last-child {
  flex: 1 1 auto;
}
</style>
