<script setup lang="ts">
import { RefreshCw, TriangleAlert } from '@lucide/vue'
import { userMessage } from '@/domain/errors'
import type { AppError } from '@/domain/errors'
import AppButton from './AppButton.vue'

defineProps<{
  error: AppError
  title?: string
  retryLabel?: string
}>()

defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="error-state" role="alert">
    <span class="error-state__icon"><TriangleAlert class="ff-icon ff-icon--lg" aria-hidden="true" /></span>
    <h2 class="ff-h3">{{ title ?? 'Something went wrong' }}</h2>
    <p class="ff-meta error-state__body">{{ userMessage(error) }}</p>
    <AppButton variant="secondary" @click="$emit('retry')">
      <RefreshCw class="ff-icon ff-icon--sm" aria-hidden="true" />
      {{ retryLabel ?? 'Try again' }}
    </AppButton>
  </div>
</template>

<style scoped>
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-8) var(--space-4);
  text-align: center;
}

.error-state__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: calc(var(--avatar-size) + var(--space-4));
  height: calc(var(--avatar-size) + var(--space-4));
  background: var(--color-danger-light);
  border: 1px solid var(--color-danger-border);
  border-radius: var(--radius-full);
  color: var(--color-danger);
}

.error-state__body {
  max-width: 36ch;
  margin-bottom: var(--space-3);
}
</style>
