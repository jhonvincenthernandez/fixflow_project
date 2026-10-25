<script setup lang="ts">
import type { Component } from 'vue'
import { Monitor, Moon, Sun } from '@lucide/vue'
import { useAppearance } from '@/composables/useAppearance'
import type { AppearancePreference } from '@/data/appearance'

interface AppearanceOption {
  readonly value: AppearancePreference
  readonly label: string
  readonly icon: Component
}

const OPTIONS: readonly AppearanceOption[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

const { preference, setAppearance } = useAppearance()
</script>

<template>
  <div class="appearance" role="group" aria-label="Appearance options">
    <button
      v-for="option in OPTIONS"
      :key="option.value"
      type="button"
      class="appearance__option"
      :data-appearance-opt="option.value"
      :aria-pressed="preference === option.value"
      :title="option.label"
      @click="setAppearance(option.value)"
    >
      <component :is="option.icon" class="ff-icon ff-icon--sm" aria-hidden="true" />
      <span>{{ option.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.appearance {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-1);
  padding: var(--space-1);
  background: var(--color-track);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.appearance__option {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  min-height: var(--touch-min);
  padding: var(--space-2) var(--space-1);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  cursor: pointer;
}

.appearance__option[aria-pressed='true'] {
  background: var(--color-surface);
  border-color: var(--color-control-border);
  box-shadow: var(--shadow-xs);
  color: var(--color-brand-dark);
}

@media (hover: hover) {
  .appearance__option:hover:not([aria-pressed='true']) {
    background: var(--color-overlay);
    color: var(--color-text-primary);
  }
}
</style>
