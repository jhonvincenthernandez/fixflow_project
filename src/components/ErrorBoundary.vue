<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
import { toAppError } from '@/domain/errors'
import type { AppError } from '@/domain/errors'
import { logger } from '@/domain/logger'
import ErrorState from './ErrorState.vue'

defineProps<{ title?: string }>()

const failure = ref<AppError | null>(null)
/** Changing the key remounts the slot, which is what makes "Try again" re-run its setup. */
const attempt = ref(0)

onErrorCaptured((error, _instance, info) => {
  logger.error(`A section failed to render (${info})`, error)
  failure.value = toAppError(error)
  // Returning false stops the error from bubbling, so one broken widget cannot take the page down.
  return false
})

function retry(): void {
  failure.value = null
  attempt.value += 1
}
</script>

<template>
  <ErrorState v-if="failure" :error="failure" :title="title ?? 'This section could not load'" @retry="retry" />
  <div v-else :key="attempt" class="boundary"><slot /></div>
</template>

<style scoped>
.boundary {
  display: contents;
}
</style>
