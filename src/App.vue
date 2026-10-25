<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue'
import { useRouter } from 'vue-router'
import AppLogo from '@/components/AppLogo.vue'
import ErrorState from '@/components/ErrorState.vue'
import ToastHost from '@/components/ToastHost.vue'
import { retryBootstrap, useSession } from '@/composables/useSession'

const { state } = useSession()
const router = useRouter()

async function retry(): Promise<void> {
  await retryBootstrap()
  // The route that was open before the failure may not match the new session, so re-enter through the guard.
  await router.replace('/')
}

/** Moves focus into the visible page's <main>. Runs on click only, never during render. */
function skipToMain(): void {
  const main = document.querySelector('ion-router-outlet .ion-page:not(.ion-page-hidden) main')
  if (main instanceof HTMLElement) main.focus()
}
</script>

<template>
  <ion-app>
    <a href="#main-content" class="ff-skip-link" @click.prevent="skipToMain">Skip to main content/page</a>

    <main v-if="state.status === 'loading'" class="boot" aria-busy="true">
      <AppLogo :link="false" />
      <div class="boot__status" role="status">
        <span class="ff-spinner" aria-hidden="true" />
        <span class="ff-meta">Getting FixFlow ready</span>
      </div>
    </main>

    <main v-else-if="state.status === 'error'" class="boot">
      <ErrorState :error="state.error" title="FixFlow could not start" @retry="retry" />
    </main>

    <ion-router-outlet v-else />

    <ToastHost />
  </ion-app>
</template>

<style scoped>
.boot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-6);
  height: 100%;
  padding: var(--page-pad);
  background: var(--color-canvas);
}

.boot__status {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--color-brand);
}
</style>
