<script setup lang="ts">
import { IonBackButton, IonButtons, IonHeader, IonToolbar } from '@ionic/vue'

defineProps<{
  title: string
  /** When set, shows a back button that falls back to this path if there is no history. */
  backHref?: string
}>()
</script>

<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons v-if="backHref" slot="start">
        <ion-back-button :default-href="backHref" text="" />
      </ion-buttons>
      <h1 class="page-title ff-h3">{{ title }}</h1>
      <ion-buttons slot="end">
        <slot name="actions" />
      </ion-buttons>
    </ion-toolbar>
  </ion-header>
</template>

<style scoped>
.page-title {
  padding-inline: var(--space-4);
}

ion-buttons + .page-title {
  padding-inline-start: 0;
}
</style>
