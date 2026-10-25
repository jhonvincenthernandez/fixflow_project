<script setup lang="ts">
import { Wrench } from '@lucide/vue'
import AppLink from '@/components/AppLink.vue'

withDefaults(defineProps<{ link?: boolean }>(), { link: true })
</script>

<template>
  <component
    :is="link ? AppLink : 'span'"
    class="logo"
    v-bind="link ? { to: '/', 'aria-label': 'FixFlow home' } : {}"
  >
    <span class="logo__mark"><Wrench class="ff-icon" aria-hidden="true" /></span>
    <span class="logo__word">FixFlow</span>
  </component>
</template>

<style scoped>
.logo {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: inherit;
  text-decoration: none;
}

.logo__mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-min);
  height: var(--touch-min);
  background: var(--color-brand);
  color: var(--color-text-on-brand);
  border-radius: var(--radius-md);
}

.logo__word {
  font-size: var(--text-lg);
  font-weight: var(--weight-extrabold);
  letter-spacing: -0.02em;
  color: var(--color-text-primary);
}
</style>
