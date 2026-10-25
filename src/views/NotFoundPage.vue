<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue'
import { Compass } from '@lucide/vue'
import AppLink from '@/components/AppLink.vue'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
</script>

<template>
  <ion-page>
    <PageHeader title="Page not found" />
    <ion-content>
      <main class="ff-container" tabindex="-1">
        <EmptyState
          :icon="Compass"
          title="We could not find that page"
          body="The link may be old or mistyped. Head back to your requests."
        >
          <AppLink to="/tabs/home" class="ff-btn ff-btn--primary">Go to home</AppLink>
        </EmptyState>
      </main>
    </ion-content>
  </ion-page>
</template>
