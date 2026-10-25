<script setup lang="ts">
import { computed, ref } from 'vue'
import { IonContent, IonPage, onIonViewWillEnter } from '@ionic/vue'
import { CalendarClock, LogOut, RotateCcw } from '@lucide/vue'
import AppearanceControl from '@/components/AppearanceControl.vue'
import AppButton from '@/components/AppButton.vue'
import AppLink from '@/components/AppLink.vue'
import DisclosureSection from '@/components/DisclosureSection.vue'
import PageHeader from '@/components/PageHeader.vue'
import SheetModal from '@/components/SheetModal.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { loadAvailability, useAvailability } from '@/composables/useAvailability'
import { useNavigate } from '@/composables/useNavigate'
import { signOut, useSession } from '@/composables/useSession'
import { showToast } from '@/composables/useToast'
import { DEMO_PASSWORD } from '@/data/demo'
import { resetDemoData } from '@/data/seed'
import { BUSINESS } from '@/domain/business'
import { userMessage } from '@/domain/errors'
import { initials } from '@/domain/format'
import { hoursLines, lunchText, upcomingDaysOff } from '@/domain/availability'
import { formatLongDay } from '@/domain/format'

const { user } = useSession()
const { replace } = useNavigate()
const { state: hoursState, availability } = useAvailability()

onIonViewWillEnter(() => {
  void loadAvailability({ silent: true })
})

/** Days off still ahead, for customers who are choosing a date. The owner edits them on their own screen. */
const daysOffAhead = computed(() =>
  availability.value === null
    ? []
    : upcomingDaysOff(availability.value, Date.now(), availability.value.windowDays)
        .slice(0, 5)
        .map((entry) => (entry.label === '' ? formatLongDay(entry.timestamp) : `${formatLongDay(entry.timestamp)} (${entry.label})`)),
)

const confirmingReset = ref(false)

const reset = useAsyncAction(async () => {
  await resetDemoData()
  confirmingReset.value = false
  signOut()
  replace('/auth')
  showToast('success', 'Demo data restored. Sign in again to continue.')
})

function onSignOut(): void {
  signOut()
  replace('/auth')
}

function closeReset(): void {
  confirmingReset.value = false
  reset.reset()
}
</script>

<template>
  <ion-page>
    <PageHeader title="Profile" />
    <ion-content>
      <main class="ff-container ff-stack" tabindex="-1">
        <section v-if="user" class="ff-card profile" aria-labelledby="profile-name">
          <span class="profile__avatar" aria-hidden="true">{{ initials(user.name) }}</span>
          <div class="ff-grow">
            <h2 id="profile-name" class="ff-h2">{{ user.name }}</h2>
            <span class="ff-badge ff-badge--brand">{{ user.role === 'owner' ? 'Business owner' : 'Customer' }}</span>
          </div>
        </section>

        <section v-if="user" class="ff-card" aria-labelledby="profile-contact">
          <h2 id="profile-contact" class="ff-h3">Contact</h2>
          <dl class="facts">
            <div>
              <dt class="ff-meta">Email</dt>
              <dd>{{ user.email }}</dd>
            </div>
            <div>
              <dt class="ff-meta">Mobile</dt>
              <dd>{{ user.phone }}</dd>
            </div>
          </dl>
        </section>

        <section v-if="user?.role === 'owner'" class="ff-card" aria-labelledby="profile-shop">
          <h2 id="profile-shop" class="ff-h3">Shop</h2>
          <dl class="facts">
            <div>
              <dt class="ff-meta">Name</dt>
              <dd>{{ BUSINESS.name }}</dd>
            </div>
          </dl>
        </section>

        <section v-if="user" class="ff-card ff-stack" aria-labelledby="profile-hours">
          <h2 id="profile-hours" class="ff-h3">{{ user.role === 'owner' ? 'Opening hours' : 'Shop hours' }}</h2>
          <template v-if="availability">
            <dl class="hours">
              <div v-for="line in hoursLines(availability)" :key="line.days" class="hours__row">
                <dt>{{ line.days }}</dt>
                <dd :class="{ 'ff-muted': line.closed }">{{ line.hours }}</dd>
              </div>
            </dl>
            <p v-if="lunchText(availability)" class="ff-meta">{{ lunchText(availability) }}.</p>
            <p v-if="user.role === 'customer' && daysOffAhead.length > 0" class="ff-meta">
              Closed on {{ daysOffAhead.join(', ') }}.
            </p>
          </template>
          <template v-else-if="hoursState.status === 'error'">
            <p class="ff-error-text" role="alert">{{ userMessage(hoursState.error) }}</p>
            <AppButton variant="secondary" @click="loadAvailability()">Try again</AppButton>
          </template>
          <p v-else class="ff-meta" role="status">Loading the hours</p>
          <AppLink v-if="user.role === 'owner'" to="/availability" class="ff-btn ff-btn--secondary ff-btn--block">
            <CalendarClock class="ff-icon ff-icon--sm" aria-hidden="true" />
            Manage schedule
          </AppLink>
        </section>

        <section class="ff-card ff-stack" aria-labelledby="profile-appearance">
          <div class="ff-stack ff-stack--tight">
            <h2 id="profile-appearance" class="ff-h3">Appearance</h2>
            <p class="ff-meta">Follow this device or choose a fixed light or dark look.</p>
          </div>
          <AppearanceControl />
        </section>

        <DisclosureSection title="About this prototype">
          <div class="ff-stack ff-stack--tight">
            <p>
              FixFlow keeps every account, request and photo on this device. There is no server, so the customer and the
              shop owner share this one phone to try the whole flow.
            </p>
            <p>
              Demo accounts use the password <strong>{{ DEMO_PASSWORD }}</strong>. Passwords are stored as salted hashes,
              but anyone with full access to the device can still read its storage.
            </p>
          </div>
        </DisclosureSection>

        <div class="ff-stack ff-stack--tight">
          <AppButton variant="secondary" block @click="onSignOut">
            <LogOut class="ff-icon ff-icon--sm" aria-hidden="true" />
            Sign out
          </AppButton>
          <AppButton variant="danger" block @click="confirmingReset = true">
            <RotateCcw class="ff-icon ff-icon--sm" aria-hidden="true" />
            Reset demo data
          </AppButton>
        </div>
      </main>
    </ion-content>

    <SheetModal :open="confirmingReset" title="Reset demo data?" @close="closeReset">
      <div class="ff-stack ff-stack--tight">
        <p>
          This erases every account, request and photo on this device and restores the sample data. You will be signed
          out.
        </p>
        <p v-if="reset.error.value" class="ff-error-text" role="alert">
          {{ userMessage(reset.error.value) }} Try again.
        </p>
      </div>
      <template #footer>
        <AppButton variant="danger" block :loading="reset.loading.value" @click="reset.run()">Erase and reset</AppButton>
        <AppButton variant="secondary" block @click="closeReset">Keep my data</AppButton>
      </template>
    </SheetModal>
  </ion-page>
</template>

<style scoped>
.profile {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.profile__avatar {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--avatar-size);
  height: var(--avatar-size);
  background: var(--color-brand);
  border-radius: var(--radius-full);
  color: var(--color-text-on-brand);
  font-weight: var(--weight-extrabold);
}

.facts {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: var(--space-3) 0 0;
}

.facts dd {
  margin: 0;
  font-weight: var(--weight-semibold);
  overflow-wrap: anywhere;
}

.hours {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
}

.hours__row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
}

.hours dt {
  font-weight: var(--weight-semibold);
}

.hours dd {
  margin: 0;
  text-align: right;
}
</style>
