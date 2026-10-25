<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Name announced with the switch, which is also its visible label. */
    label: string
    describedBy?: string | undefined
    /** Short visible words for each state. */
    onText?: string
    offText?: string
  }>(),
  { describedBy: undefined, onText: 'Open', offText: 'Closed' },
)

const model = defineModel<boolean>({ required: true })

function onChange(event: Event): void {
  if (event.target instanceof HTMLInputElement) model.value = event.target.checked
}
</script>

<template>
  <!-- A native checkbox with role="switch": keyboard, focus and screen reader support come for free. -->
  <label class="toggle">
    <input
      type="checkbox"
      role="switch"
      class="toggle__input ff-sr-only"
      :checked="model"
      :aria-describedby="describedBy"
      @change="onChange"
    />
    <span class="toggle__label">{{ label }}</span>
    <span class="toggle__state" aria-hidden="true">{{ model ? onText : offText }}</span>
    <span class="toggle__track" aria-hidden="true"><span class="toggle__thumb" /></span>
  </label>
</template>

<style scoped>
.toggle {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--touch-min);
  cursor: pointer;
}

.toggle__label {
  flex: 1 1 auto;
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
}

.toggle__state {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-secondary);
}

.toggle__track {
  position: relative;
  flex: none;
  width: var(--switch-width);
  height: var(--switch-height);
  box-sizing: border-box;
  background: var(--color-overlay);
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-full);
  outline: var(--focus-ring-width) solid transparent;
  outline-offset: var(--focus-ring-offset);
  transition:
    background-color var(--transition-base),
    border-color var(--transition-base),
    outline-color var(--transition-base);
}

.toggle__thumb {
  position: absolute;
  top: 50%;
  left: var(--space-1);
  width: var(--switch-thumb);
  height: var(--switch-thumb);
  background: var(--color-text-secondary);
  border-radius: var(--radius-full);
  transform: translateY(-50%);
  transition:
    transform var(--transition-base),
    background-color var(--transition-base);
}

.toggle__input:checked ~ .toggle__track {
  background: var(--color-brand);
  border-color: var(--color-brand-dark);
}

.toggle__input:checked ~ .toggle__track .toggle__thumb {
  background: var(--color-text-on-brand);
  transform: translate(calc(var(--switch-width) - var(--switch-thumb) - 2 * var(--space-1) - 2px), -50%);
}

.toggle__input:checked ~ .toggle__state {
  color: var(--color-brand-dark);
}

.toggle__input:focus-visible ~ .toggle__track {
  outline-color: var(--color-brand);
}
</style>
