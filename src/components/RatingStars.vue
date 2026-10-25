<script setup lang="ts">
import { Star } from '@lucide/vue'

defineProps<{ rating: number }>()

const STAR_COUNT = 5
</script>

<template>
  <span class="stars" role="img" :aria-label="`${rating} out of ${STAR_COUNT} stars`">
    <Star
      v-for="n in STAR_COUNT"
      :key="n"
      class="ff-icon ff-icon--sm stars__icon"
      :class="{ 'is-on': n <= rating }"
      aria-hidden="true"
    />
  </span>
</template>

<style scoped>
.stars {
  display: inline-flex;
  gap: var(--space-1);
}

.stars__icon {
  color: var(--color-text-muted);
  fill: none;
}

.stars__icon.is-on {
  color: var(--color-brand);
  fill: currentColor;
}
</style>
