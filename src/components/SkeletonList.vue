<script setup lang="ts">
withDefaults(defineProps<{ count?: number }>(), { count: 3 })
</script>

<template>
  <div role="status">
    <span class="ff-sr-only">Loading</span>
    <ul class="skeleton-list" aria-hidden="true">
      <li v-for="n in count" :key="n" class="ff-card skeleton-row">
        <span class="ff-skeleton skeleton-icon" />
        <span class="skeleton-lines">
          <span class="ff-skeleton skeleton-line skeleton-line--title" />
          <span class="ff-skeleton skeleton-line" />
          <span class="ff-skeleton skeleton-line skeleton-line--short" />
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.skeleton-row {
  display: flex;
  gap: var(--space-3);
}

.skeleton-icon {
  flex: none;
  width: var(--avatar-size);
  height: var(--avatar-size);
}

.skeleton-lines {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-2);
}

.skeleton-line {
  height: var(--space-3);
}

.skeleton-line--title {
  width: 60%;
  height: var(--space-4);
}

.skeleton-line--short {
  width: 40%;
}
</style>
