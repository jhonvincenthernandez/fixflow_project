<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
    type?: 'button' | 'submit'
    loading?: boolean
    disabled?: boolean
    block?: boolean
  }>(),
  { variant: 'primary', type: 'button', loading: false, disabled: false, block: false },
)
</script>

<template>
  <button
    :type="type"
    class="ff-btn"
    :class="[`ff-btn--${variant}`, { 'ff-btn--block': block }]"
    :disabled="disabled || loading"
    :aria-busy="loading ? 'true' : undefined"
  >
    <span v-if="loading" class="ff-spinner" aria-hidden="true" />
    <slot />
    <span v-if="loading" class="ff-sr-only">Loading</span>
  </button>
</template>
