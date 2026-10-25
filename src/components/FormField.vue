<script setup lang="ts">
import { computed, useId } from 'vue'
import { TriangleAlert } from '@lucide/vue'

const props = defineProps<{
  label: string
  hint?: string
  error?: string | undefined
  optional?: boolean
}>()

defineSlots<{
  default(props: { id: string; describedBy: string | undefined; invalid: boolean }): unknown
}>()

const uid = useId()
const controlId = `${uid}-control`
const hintId = `${uid}-hint`
const errorId = `${uid}-error`

const describedBy = computed(() => {
  const ids = [props.hint ? hintId : null, props.error ? errorId : null].filter((id) => id !== null)
  return ids.length > 0 ? ids.join(' ') : undefined
})
const invalid = computed(() => props.error !== undefined && props.error.length > 0)
</script>

<template>
  <div class="ff-field">
    <label :for="controlId" class="ff-label">
      {{ label }}<span v-if="optional" class="ff-muted"> (optional)</span>
    </label>
    <slot :id="controlId" :described-by="describedBy" :invalid="invalid" />
    <p v-if="hint" :id="hintId" class="ff-hint">{{ hint }}</p>
    <p v-if="invalid" :id="errorId" class="ff-error-text" role="alert">
      <TriangleAlert class="ff-icon ff-icon--sm" aria-hidden="true" />
      <span>{{ error }}</span>
    </p>
  </div>
</template>
