<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { IonContent, IonPage, onIonViewWillEnter } from '@ionic/vue'
import { Send } from '@lucide/vue'
import { useRoute } from 'vue-router'
import AppButton from '@/components/AppButton.vue'
import FormField from '@/components/FormField.vue'
import ImagePicker from '@/components/ImagePicker.vue'
import PageHeader from '@/components/PageHeader.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import ServiceIcon from '@/components/ServiceIcon.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useNavigate } from '@/composables/useNavigate'
import { submitRequest } from '@/composables/useRequests'
import { showToast } from '@/composables/useToast'
import type { ImageUpload } from '@/data/repo'
import { buildRequestDraft, parseUrgency } from '@/domain/diagnostics'
import { ValidationError, userMessage } from '@/domain/errors'
import { SERVICES, getService } from '@/domain/services'
import { ServiceIdSchema } from '@/domain/types'
import type { FulfilmentMode, ServiceId } from '@/domain/types'

const DESCRIPTION_LIMIT = 1000

const MODE_OPTIONS = [
  { value: 'drop_off', label: 'Drop off at shop' },
  { value: 'home_visit', label: 'Home visit' },
] as const satisfies readonly { value: FulfilmentMode; label: string }[]

const route = useRoute()
const { replace } = useNavigate()

const serviceId = ref<ServiceId>('phone')
const itemName = ref('')
const description = ref('')
const mode = ref<FulfilmentMode>('drop_off')
const address = ref('')
// shallowRef: the picker replaces the array, and Blob contents never need to be reactive.
const uploads = shallowRef<ImageUpload[]>([])

/** Tracks the last quick check that filled the form, so returning to this page does not overwrite edits. */
let appliedDraftKey: string | null = null

onIonViewWillEnter(() => {
  // The home screen links here with ?service=appliance and similar.
  const parsed = ServiceIdSchema.safeParse(route.query['service'])
  if (!parsed.success) return
  serviceId.value = parsed.data

  // The quick check links here with a symptom and urgency so the description is ready.
  const issue = typeof route.query['issue'] === 'string' ? route.query['issue'] : null
  const urgency = parseUrgency(route.query['urgency'])
  const draft = buildRequestDraft(parsed.data, issue, urgency)
  if (draft === null) return

  const draftKey = `${parsed.data}:${issue ?? ''}:${urgency ?? ''}`
  if (appliedDraftKey === draftKey) return
  description.value = draft.description
  appliedDraftKey = draftKey
})

const examples = computed(() => getService(serviceId.value).examples)

const submit = useAsyncAction(async () => {
  const created = await submitRequest(
    {
      serviceId: serviceId.value,
      itemName: itemName.value,
      description: description.value,
      mode: mode.value,
      address: address.value,
    },
    uploads.value,
  )
  showToast('success', `Request ${created.ref} sent. The shop will review it soon.`)
  replace(`/request/${created.id}`)
})

function fieldError(field: string): string | undefined {
  return submit.fieldErrors.value[field]?.[0]
}

const formError = computed(() => {
  const error = submit.error.value
  return error === null || error instanceof ValidationError ? null : userMessage(error)
})
</script>

<template>
  <ion-page>
    <PageHeader title="New request" back-href="/tabs/home" />
    <ion-content>
      <main class="ff-container" tabindex="-1">
        <form class="ff-stack ff-stack--loose" novalidate @submit.prevent="submit.run()">
          <fieldset class="picker">
            <legend class="ff-label">What needs fixing?</legend>
            <div class="picker__grid">
              <label
                v-for="service in SERVICES"
                :key="service.id"
                class="tile"
                :class="{ 'is-active': serviceId === service.id }"
              >
                <input v-model="serviceId" type="radio" class="ff-sr-only" name="service" :value="service.id" />
                <ServiceIcon :service-id="service.id" />
                <span class="tile__name">{{ service.name }}</span>
              </label>
            </div>
            <p class="ff-hint" aria-live="polite">For example: {{ examples }}</p>
          </fieldset>

          <FormField v-slot="field" label="What is the item?" :error="fieldError('itemName')">
            <input
              :id="field.id"
              v-model="itemName"
              class="ff-input"
              type="text"
              maxlength="60"
              autocomplete="off"
              placeholder="iPhone 12, Samsung aircon, Dell Inspiron"
              :aria-invalid="field.invalid"
              :aria-describedby="field.describedBy"
            />
          </FormField>

          <FormField
            v-slot="field"
            label="What is wrong with it?"
            :hint="`${description.length} of ${DESCRIPTION_LIMIT} characters`"
            :error="fieldError('description')"
          >
            <textarea
              :id="field.id"
              v-model="description"
              class="ff-textarea"
              :maxlength="DESCRIPTION_LIMIT"
              placeholder="When did it start? What happens? Anything you already tried?"
              :aria-invalid="field.invalid"
              :aria-describedby="field.describedBy"
            />
          </FormField>

          <ImagePicker v-model="uploads" :error="fieldError('images')" />

          <div class="ff-stack ff-stack--tight">
            <p class="ff-label" id="mode-label">How would you like it done?</p>
            <SegmentedControl v-model="mode" :options="MODE_OPTIONS" legend="Drop off or home visit" />
          </div>

          <FormField
            v-if="mode === 'home_visit'"
            v-slot="field"
            label="Address for the visit"
            :error="fieldError('address')"
          >
            <textarea
              :id="field.id"
              v-model="address"
              class="ff-textarea"
              maxlength="200"
              autocomplete="street-address"
              placeholder="House number, street, barangay"
              :aria-invalid="field.invalid"
              :aria-describedby="field.describedBy"
            />
          </FormField>

          <div class="ff-stack ff-stack--tight">
            <p v-if="formError" class="ff-error-text" role="alert">{{ formError }} Try again.</p>
            <AppButton type="submit" block :loading="submit.loading.value">
              <Send class="ff-icon ff-icon--sm" aria-hidden="true" />
              Submit request
            </AppButton>
          </div>
        </form>
      </main>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.picker {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.picker__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
  margin: var(--space-2) 0;
}

.tile {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--touch-min);
  padding: var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  outline: var(--focus-ring-width) solid transparent;
  outline-offset: var(--focus-ring-offset);
  transition:
    background-color var(--transition-base),
    border-color var(--transition-base),
    box-shadow var(--transition-base),
    outline-color var(--transition-base);
}

@media (hover: hover) {
  .tile:hover:not(.is-active) {
    background: var(--color-overlay);
    border-color: var(--color-text-secondary);
  }
}

.tile.is-active {
  background: var(--color-brand-light);
  border-color: var(--color-brand);
}

.tile:has(input:focus-visible) {
  outline-color: var(--color-brand);
}

.tile__name {
  font-size: var(--text-sm);
  font-weight: var(--weight-bold);
  line-height: var(--leading-tight);
}
</style>
