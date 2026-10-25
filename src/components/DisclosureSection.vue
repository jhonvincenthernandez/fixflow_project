<script setup lang="ts">
import { ref, useId } from 'vue'
import { ChevronDown } from '@lucide/vue'

const props = withDefaults(defineProps<{ title: string; defaultOpen?: boolean }>(), { defaultOpen: false })

const open = ref(props.defaultOpen)
const uid = useId()
const triggerId = `${uid}-trigger`
const regionId = `${uid}-region`
</script>

<template>
  <section class="ff-card disclosure">
    <h2 class="disclosure__heading">
      <button
        :id="triggerId"
        type="button"
        class="disclosure__trigger"
        :aria-expanded="open"
        :aria-controls="regionId"
        @click="open = !open"
      >
        <span class="ff-h3">{{ title }}</span>
        <ChevronDown class="ff-icon disclosure__chevron" :class="{ 'is-open': open }" aria-hidden="true" />
      </button>
    </h2>
    <!-- Collapsed content is inert so it leaves the tab order and the accessibility tree. -->
    <div
      :id="regionId"
      class="disclosure__region"
      :class="{ 'is-open': open }"
      role="region"
      :aria-labelledby="triggerId"
      :inert="!open"
    >
      <div class="disclosure__inner">
        <div class="disclosure__content"><slot /></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.disclosure__heading {
  margin: 0;
}

.disclosure__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  width: 100%;
  min-height: var(--touch-min);
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  text-align: left;
  cursor: pointer;
}

.disclosure__chevron {
  color: var(--color-text-secondary);
  transition: transform var(--transition-base);
}

.disclosure__chevron.is-open {
  transform: rotate(180deg);
}

/* Height animates through grid rows (0fr to 1fr) together with a fade and a small lift. */
.disclosure__region {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transform: translateY(calc(var(--space-1) * -1));
  transition:
    grid-template-rows var(--transition-slow),
    opacity var(--transition-base),
    transform var(--transition-base);
}

.disclosure__region.is-open {
  grid-template-rows: 1fr;
  opacity: 1;
  transform: translateY(0);
}

.disclosure__inner {
  min-height: 0;
  overflow: hidden;
}

.disclosure__content {
  padding-top: var(--space-3);
}
</style>
