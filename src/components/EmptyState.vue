<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  icon: Component
  title: string
  body: string
}>()
</script>

<template>
  <section class="empty">
    <span class="empty__icon"><component :is="icon" class="ff-icon ff-icon--lg" aria-hidden="true" /></span>
    <h2 class="ff-h3">{{ title }}</h2>
    <p class="ff-meta empty__body">{{ body }}</p>
    <div v-if="$slots['default']" class="empty__action"><slot /></div>
  </section>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-8) var(--space-4);
  text-align: center;
}

.empty__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: calc(var(--avatar-size) + var(--space-4));
  height: calc(var(--avatar-size) + var(--space-4));
  background: var(--color-brand-light);
  border: 1px solid var(--color-brand-border);
  border-radius: var(--radius-full);
  color: var(--color-brand-dark);
}

.empty__body {
  max-width: 32ch;
}

.empty__action {
  margin-top: var(--space-3);
}
</style>
