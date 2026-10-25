<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { IonContent, IonPage } from '@ionic/vue'
import { ArrowLeft, ArrowRight, Check, ShieldAlert, Stethoscope } from '@lucide/vue'
import { useRoute } from 'vue-router'
import AppLink from '@/components/AppLink.vue'
import PageHeader from '@/components/PageHeader.vue'
import ServiceIcon from '@/components/ServiceIcon.vue'
import { useSession } from '@/composables/useSession'
import {
  URGENCY_OPTIONS,
  diagnose,
  getSymptoms,
  requestHref,
} from '@/domain/diagnostics'
import type { DiagnosisUrgency } from '@/domain/diagnostics'
import { SERVICES, getService } from '@/domain/services'
import { ServiceIdSchema } from '@/domain/types'
import type { ServiceId } from '@/domain/types'

type Step = 'service' | 'symptom' | 'urgency' | 'result'

const PROGRESS = ['Service', 'Symptom', 'Urgency'] as const
const STEP_INDEX: Record<Step, number> = { service: 0, symptom: 1, urgency: 2, result: 3 }

const route = useRoute()
const { state } = useSession()

const step = ref<Step>('service')
const serviceId = ref<ServiceId | null>(null)
const symptomId = ref<string | null>(null)
const urgency = ref<DiagnosisUrgency | null>(null)
const heading = ref<HTMLElement | null>(null)

const symptoms = computed(() => (serviceId.value === null ? [] : getSymptoms(serviceId.value)))
const selectedService = computed(() => (serviceId.value === null ? null : getService(serviceId.value)))
const progressIndex = computed(() => STEP_INDEX[step.value])
const signedIn = computed(() => state.value.status === 'signedIn')

const result = computed(() => {
  if (serviceId.value === null) return null
  return diagnose(serviceId.value, symptomId.value, urgency.value)
})

const requestLink = computed(() => {
  if (result.value === null) return '/request/new'
  return requestHref(result.value.serviceId, result.value.symptom.id, result.value.urgency)
})

onMounted(() => {
  // The landing page can deep-link a service, for example /diagnose?service=electrical.
  const parsed = ServiceIdSchema.safeParse(route.query['service'])
  if (parsed.success) {
    serviceId.value = parsed.data
    step.value = 'symptom'
  }
})

watch(step, async () => {
  await nextTick()
  const target = heading.value
  if (target === null) return
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.focus({ preventScroll: true })
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
})

function selectService(id: ServiceId): void {
  serviceId.value = id
  symptomId.value = null
  urgency.value = null
  step.value = 'symptom'
}

function selectSymptom(id: string): void {
  symptomId.value = id
  urgency.value = null
  step.value = 'urgency'
}

function selectUrgency(value: DiagnosisUrgency): void {
  urgency.value = value
  step.value = 'result'
}

function restart(): void {
  serviceId.value = null
  symptomId.value = null
  urgency.value = null
  step.value = 'service'
}
</script>

<template>
  <ion-page>
    <PageHeader title="Quick check" back-href="/" />
    <ion-content>
      <main class="ff-container diagnose" tabindex="-1">
        <div class="ff-stack ff-stack--loose">
          <ol v-if="step !== 'result'" class="progress" aria-label="Quick check progress">
            <li
              v-for="(label, index) in PROGRESS"
              :key="label"
              class="progress__item"
              :class="{ 'is-current': progressIndex === index, 'is-done': progressIndex > index }"
              :aria-current="progressIndex === index ? 'step' : undefined"
            >
              <span class="progress__dot" aria-hidden="true">
                <Check v-if="progressIndex > index" class="ff-icon ff-icon--sm" />
                <span v-else>{{ index + 1 }}</span>
              </span>
              <span class="progress__label">{{ label }}</span>
            </li>
          </ol>
          <p v-else class="ff-badge ff-badge--success">Check complete</p>

          <section v-if="step === 'service'" class="ff-stack" aria-labelledby="service-step-title">
            <div class="ff-stack ff-stack--tight">
              <p class="ff-overline">Step 1 of 3</p>
              <h2 id="service-step-title" ref="heading" class="ff-h2" tabindex="-1">What needs fixing?</h2>
              <p class="ff-meta">Choose the closest category. You can change it on the next step.</p>
            </div>
            <div class="options options--grid">
              <button
                v-for="service in SERVICES"
                :key="service.id"
                type="button"
                class="option option--tile"
                :class="{ 'is-selected': serviceId === service.id }"
                :aria-pressed="serviceId === service.id"
                @click="selectService(service.id)"
              >
                <ServiceIcon :service-id="service.id" />
                <span class="option__text">
                  <span class="option__label">{{ service.name }}</span>
                  <span class="option__hint">{{ service.blurb }}</span>
                </span>
              </button>
            </div>
          </section>

          <section v-else-if="step === 'symptom'" class="ff-stack" aria-labelledby="symptom-step-title">
            <div class="ff-stack ff-stack--tight">
              <button type="button" class="back" @click="step = 'service'">
                <ArrowLeft class="ff-icon ff-icon--sm" aria-hidden="true" />
                Back to services
              </button>
              <p class="ff-overline">Step 2 of 3</p>
              <h2 id="symptom-step-title" ref="heading" class="ff-h2" tabindex="-1">
                {{ selectedService?.name ?? 'Choose a symptom' }}
              </h2>
              <p class="ff-meta">Which of these is closest to what you see?</p>
            </div>
            <div class="options">
              <button
                v-for="symptom in symptoms"
                :key="symptom.id"
                type="button"
                class="option option--row"
                :class="{ 'is-selected': symptomId === symptom.id }"
                :aria-pressed="symptomId === symptom.id"
                @click="selectSymptom(symptom.id)"
              >
                <span class="option__text">
                  <span class="option__label">{{ symptom.label }}</span>
                  <span class="option__hint">{{ symptom.hint }}</span>
                </span>
                <ArrowRight class="ff-icon ff-icon--sm option__arrow" aria-hidden="true" />
              </button>
            </div>
          </section>

          <section v-else-if="step === 'urgency'" class="ff-stack" aria-labelledby="urgency-step-title">
            <div class="ff-stack ff-stack--tight">
              <button type="button" class="back" @click="step = 'symptom'">
                <ArrowLeft class="ff-icon ff-icon--sm" aria-hidden="true" />
                Back to symptoms
              </button>
              <p class="ff-overline">Step 3 of 3</p>
              <h2 id="urgency-step-title" ref="heading" class="ff-h2" tabindex="-1">
                How soon do you need help?
              </h2>
              <p class="ff-meta">
                This helps the shop prioritize the request. It does not confirm urgency.
              </p>
            </div>
            <div class="options">
              <button
                v-for="option in URGENCY_OPTIONS"
                :key="option.value"
                type="button"
                class="option option--row"
                :class="{ 'is-selected': urgency === option.value }"
                :aria-pressed="urgency === option.value"
                @click="selectUrgency(option.value)"
              >
                <span class="option__text">
                  <span class="option__label">{{ option.label }}</span>
                  <span class="option__hint">{{ option.hint }}</span>
                </span>
                <ArrowRight class="ff-icon ff-icon--sm option__arrow" aria-hidden="true" />
              </button>
            </div>
          </section>

          <section v-else-if="result !== null" class="ff-stack" aria-labelledby="result-title">
            <div class="ff-stack ff-stack--tight">
              <p
                class="ff-badge"
                :class="result.safety === 'urgent' ? 'ff-badge--danger' : 'ff-badge--brand'"
              >
                {{ result.safety === 'urgent' ? 'Safety check recommended' : 'Likely issue' }}
              </p>
              <h2 id="result-title" ref="heading" class="ff-h2" tabindex="-1">
                {{ result.symptom.label }}
              </h2>
              <p class="ff-lead">{{ result.symptom.likelyCause }}</p>
            </div>

            <aside
              v-if="result.safetyNote.length > 0"
              class="result__safety"
              :class="{ 'is-urgent': result.safety === 'urgent' }"
              aria-labelledby="safety-title"
            >
              <ShieldAlert class="ff-icon ff-icon--lg" aria-hidden="true" />
              <div class="ff-stack ff-stack--tight">
                <h3 id="safety-title" class="ff-h3">
                  {{ result.safety === 'urgent' ? 'Stop and get this checked' : 'Use it with care' }}
                </h3>
                <p class="ff-meta">{{ result.safetyNote }}</p>
              </div>
            </aside>

            <div class="ff-inset ff-stack ff-stack--tight">
              <h3 class="ff-h3">What you can do now</h3>
              <p class="ff-meta">{{ result.symptom.safeStep }}</p>
            </div>

            <div class="ff-inset ff-stack ff-stack--tight">
              <h3 class="ff-h3">What happens next</h3>
              <p class="ff-meta">
                {{ result.nextStep }} You will review an itemized quotation before any work starts.
              </p>
              <p class="ff-meta result__disclaimer">
                This is general guidance, not a final diagnosis. The shop confirms the fault after
                inspection.
              </p>
            </div>

            <div class="result__actions">
              <AppLink :to="requestLink" class="ff-btn ff-btn--primary ff-btn--block">
                {{ signedIn ? 'Send this as a request' : 'Sign in and send this request' }}
                <ArrowRight class="ff-icon ff-icon--sm" aria-hidden="true" />
              </AppLink>
              <button type="button" class="ff-btn ff-btn--secondary ff-btn--block" @click="restart">
                Check another problem
              </button>
              <p class="ff-meta result__hint">You can review and edit the request before sending it.</p>
            </div>
          </section>

          <p v-if="step !== 'result'" class="ff-meta diagnose__note">
            <Stethoscope class="ff-icon ff-icon--sm" aria-hidden="true" />
            This check is general guidance. It does not replace an inspection by the shop.
          </p>
        </div>
      </main>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.diagnose {
  padding-block: var(--space-4) var(--space-10);
}

.progress {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.progress__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
}

.progress__dot {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--space-6);
  height: var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
}

.progress__label {
  white-space: nowrap;
}

.progress__item.is-current {
  color: var(--color-text-primary);
}

.progress__item.is-current .progress__dot {
  background: var(--color-brand);
  border-color: var(--color-brand);
  color: var(--color-text-on-brand);
}

.progress__item.is-done .progress__dot {
  background: var(--color-brand-light);
  border-color: var(--color-brand-border);
  color: var(--color-brand-dark);
}

.options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.options--grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-2);
}

.option {
  display: flex;
  width: 100%;
  align-items: flex-start;
  gap: var(--space-3);
  min-height: var(--touch-min);
  padding: var(--space-3);
  appearance: none;
  background: var(--color-surface);
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-md);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background-color var(--transition-base),
    border-color var(--transition-base);
}

.option:focus-visible {
  outline: var(--focus-ring-width) solid var(--color-brand);
  outline-offset: var(--focus-ring-offset);
}

.option.is-selected {
  background: var(--color-brand-light);
  border-color: var(--color-brand);
}

.option--tile {
  flex-direction: column;
  align-items: flex-start;
}

.option--row {
  align-items: center;
}

.option__text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.option__label {
  font-size: var(--text-base);
  font-weight: var(--weight-bold);
  line-height: var(--leading-tight);
}

.option__hint {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  line-height: var(--leading-base);
}

.option__arrow {
  color: var(--color-text-muted);
}

.back {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: var(--space-1);
  min-height: var(--touch-min);
  padding: 0;
  background: transparent;
  border: 0;
  color: var(--color-brand);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  cursor: pointer;
}

.result__safety {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-overlay);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
}

.result__safety.is-urgent {
  background: var(--color-danger-light);
  border-color: var(--color-danger-border);
  color: var(--color-danger);
}

.result__safety .ff-h3 {
  color: inherit;
}

.result__safety.is-urgent .ff-meta {
  color: var(--color-danger);
}

.result__disclaimer {
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
  font-size: var(--text-xs);
}

.result__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.result__hint {
  text-align: center;
}

.diagnose__note {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

@media (hover: hover) {
  .option:hover:not(.is-selected) {
    background: var(--color-overlay);
    border-color: var(--color-text-secondary);
  }
}

@media (min-width: 30rem) {
  .options--grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
