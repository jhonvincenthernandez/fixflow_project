<script setup lang="ts">
import { useId } from 'vue'
import { Star } from '@lucide/vue'

defineProps<{ error?: string | undefined }>()

/** 0 means "not chosen yet". */
const model = defineModel<number>({ required: true })
const name = useId()
const STAR_COUNT = 5
</script>

<template>
  <fieldset class="rating">
    <legend class="ff-label">How was the service?</legend>
    <div class="rating__row">
      <label v-for="n in STAR_COUNT" :key="n" class="rating__star" :class="{ 'is-on': n <= model }">
        <input v-model="model" type="radio" class="ff-sr-only" :name="name" :value="n" />
        <Star class="ff-icon ff-icon--lg rating__icon" aria-hidden="true" />
        <span class="ff-sr-only">{{ n }} {{ n === 1 ? 'star' : 'stars' }}</span>
      </label>
    </div>
    <p v-if="error" class="ff-error-text" role="alert">{{ error }}</p>
  </fieldset>
</template>

<style scoped>
.rating {
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}

.rating__row {
  display: flex;
  gap: var(--space-1);
  margin-top: var(--space-2);
}

.rating__star {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-min);
  height: var(--touch-min);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  outline: var(--focus-ring-width) solid transparent;
  outline-offset: var(--focus-ring-offset);
  transition:
    color var(--transition-base),
    background-color var(--transition-base),
    outline-color var(--transition-base);
}

.rating__icon {
  fill: none;
  transition: fill var(--transition-base);
}

.rating__star.is-on {
  color: var(--color-brand);
}

.rating__star.is-on .rating__icon {
  fill: currentColor;
}

@media (hover: hover) {
  .rating__star:hover {
    background: var(--color-overlay);
  }
}

.rating__star:has(input:focus-visible) {
  outline-color: var(--color-brand);
}
</style>
