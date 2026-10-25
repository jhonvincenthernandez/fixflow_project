<script setup lang="ts">
import { computed, ref } from 'vue'
import { IonContent, IonPage } from '@ionic/vue'
import { Eye, EyeOff, LogIn, UserPlus } from '@lucide/vue'
import { useRoute } from 'vue-router'
import AppButton from '@/components/AppButton.vue'
import AppLogo from '@/components/AppLogo.vue'
import FormField from '@/components/FormField.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useNavigate } from '@/composables/useNavigate'
import { register, signIn } from '@/composables/useSession'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/data/demo'
import { ValidationError, userMessage } from '@/domain/errors'

type Mode = 'signin' | 'register'

const MODE_OPTIONS = [
  { value: 'signin', label: 'Sign in' },
  { value: 'register', label: 'Create account' },
] as const satisfies readonly { value: Mode; label: string }[]

const route = useRoute()
const { replace } = useNavigate()

const mode = ref<Mode>('signin')
const name = ref('')
const email = ref('')
const phone = ref('')
const password = ref('')
const showPassword = ref(false)

/** Only follow redirects that stay inside the app. */
function afterSignIn(): string {
  const target = route.query['redirect']
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') ? target : '/tabs/home'
}

const submit = useAsyncAction(async () => {
  if (mode.value === 'signin') {
    await signIn({ email: email.value, password: password.value })
  } else {
    await register({ name: name.value, email: email.value, phone: phone.value, password: password.value })
  }
  replace(afterSignIn())
})

const demo = useAsyncAction(async (accountEmail: string) => {
  await signIn({ email: accountEmail, password: DEMO_PASSWORD })
  replace(afterSignIn())
})

/** Field-level messages come from validation; anything else shows once, above the button. */
const formError = computed(() => {
  const error = submit.error.value ?? demo.error.value
  if (error === null || error instanceof ValidationError) return null
  return userMessage(error)
})

function fieldError(field: string): string | undefined {
  return submit.fieldErrors.value[field]?.[0]
}

function switchMode(): void {
  submit.reset()
}
</script>

<template>
  <ion-page>
    <ion-content>
      <main class="ff-container auth ff-stack ff-stack--loose" tabindex="-1">
        <header class="ff-stack">
          <AppLogo />
          <h1 class="ff-h1">Repairs, quoted and booked in one place</h1>
          <p class="ff-lead">Send a request, review the quotation, pick a time, and follow the repair to the end.</p>
        </header>

        <SegmentedControl v-model="mode" :options="MODE_OPTIONS" legend="Sign in or create an account" @update:model-value="switchMode" />

        <form class="ff-stack" novalidate @submit.prevent="submit.run()">
          <FormField v-if="mode === 'register'" v-slot="field" label="Full name" :error="fieldError('name')">
            <input
              :id="field.id"
              v-model="name"
              class="ff-input"
              type="text"
              autocomplete="name"
              :aria-invalid="field.invalid"
              :aria-describedby="field.describedBy"
            />
          </FormField>

          <FormField v-slot="field" label="Email" :error="fieldError('email')">
            <input
              :id="field.id"
              v-model="email"
              class="ff-input"
              type="email"
              inputmode="email"
              autocomplete="email"
              autocapitalize="none"
              :aria-invalid="field.invalid"
              :aria-describedby="field.describedBy"
            />
          </FormField>

          <FormField
            v-if="mode === 'register'"
            v-slot="field"
            label="Mobile number"
            hint="Used by the shop to reach you about your repair."
            :error="fieldError('phone')"
          >
            <input
              :id="field.id"
              v-model="phone"
              class="ff-input"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              placeholder="0917 123 4567"
              :aria-invalid="field.invalid"
              :aria-describedby="field.describedBy"
            />
          </FormField>

          <FormField
            v-slot="field"
            label="Password"
            :hint="mode === 'register' ? 'At least 8 characters.' : undefined"
            :error="fieldError('password')"
          >
            <div class="auth__password">
              <input
                :id="field.id"
                v-model="password"
                class="ff-input"
                :type="showPassword ? 'text' : 'password'"
                :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
                :aria-invalid="field.invalid"
                :aria-describedby="field.describedBy"
              />
              <button
                type="button"
                class="ff-icon-btn auth__toggle"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                :aria-pressed="showPassword"
                @click="showPassword = !showPassword"
              >
                <EyeOff v-if="showPassword" class="ff-icon" aria-hidden="true" />
                <Eye v-else class="ff-icon" aria-hidden="true" />
              </button>
            </div>
          </FormField>

          <p v-if="formError" class="ff-error-text" role="alert">{{ formError }}</p>

          <AppButton type="submit" block :loading="submit.loading.value">
            <component :is="mode === 'signin' ? LogIn : UserPlus" class="ff-icon ff-icon--sm" aria-hidden="true" />
            {{ mode === 'signin' ? 'Sign in' : 'Create account' }}
          </AppButton>
        </form>

        <section class="ff-inset ff-stack ff-stack--tight" aria-labelledby="demo-heading">
          <h2 id="demo-heading" class="ff-h3">Try a demo account</h2>
          <p class="ff-meta">
            Sample data is stored on this device only. Sign in as the customer to send requests, or as the shop owner to
            quote and schedule them.
          </p>
          <div class="auth__demo">
            <AppButton variant="secondary" :loading="demo.loading.value" @click="demo.run(DEMO_ACCOUNTS.customer.email)">
              {{ DEMO_ACCOUNTS.customer.label }}
            </AppButton>
            <AppButton variant="secondary" :loading="demo.loading.value" @click="demo.run(DEMO_ACCOUNTS.owner.email)">
              {{ DEMO_ACCOUNTS.owner.label }}
            </AppButton>
          </div>
        </section>
      </main>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.auth {
  padding-block: var(--space-8);
}

.auth__password {
  position: relative;
}

.auth__password .ff-input {
  padding-inline-end: var(--control-height);
}

.auth__toggle {
  position: absolute;
  top: 0;
  right: 0;
  height: var(--control-height);
}

.auth__demo {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-2);
}

@media (min-width: 28rem) {
  .auth__demo {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
