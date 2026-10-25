<script setup lang="ts" generic="T extends string">
import { useId } from 'vue'

defineProps<{
  options: readonly { value: T; label: string }[]
  /** Spoken label for the group. Not shown. */
  legend: string
}>()

const model = defineModel<T>({ required: true })
const name = useId()
</script>

<template>
  <fieldset class="segmented">
    <legend class="ff-sr-only">{{ legend }}</legend>
    <label
      v-for="option in options"
      :key="option.value"
      class="segmented__option"
      :class="{ 'is-active': model === option.value }"
    >
      <input
        v-model="model"
        type="radio"
        class="ff-sr-only"
        :name="name"
        :value="option.value"
      />
      <span>{{ option.label }}</span>
    </label>
  </fieldset>
</template>

<style scoped>
.segmented {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: var(--space-1);
  min-width: 0;
  margin: 0;
  padding: var(--space-1);
  background: var(--color-track);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.segmented__option {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--touch-min);
  padding: 0 var(--space-3);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  text-align: center;
  cursor: pointer;
  transition:
    color var(--transition-base),
    background-color var(--transition-base),
    border-color var(--transition-base),
    box-shadow var(--transition-base),
    outline-color var(--transition-base);
  outline: var(--focus-ring-width) solid transparent;
  outline-offset: var(--focus-ring-offset);
}

@media (hover: hover) {
  .segmented__option:hover:not(.is-active) {
    background: var(--color-overlay);
  }
}

.segmented__option.is-active {
  background: var(--color-surface);
  border-color: var(--color-control-border);
  box-shadow: var(--shadow-xs);
  color: var(--color-brand-dark);
}

.segmented__option:has(input:focus-visible) {
  outline-color: var(--color-brand);
}
</style>
