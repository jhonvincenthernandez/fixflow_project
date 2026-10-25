<script setup lang="ts">
import type { Component } from 'vue'
import { CircleCheck, Info, TriangleAlert, X } from '@lucide/vue'
import { useToasts } from '@/composables/useToast'
import type { ToastKind } from '@/composables/useToast'

const { toasts, dismissToast } = useToasts()

const ICONS: Record<ToastKind, Component> = {
  success: CircleCheck,
  error: TriangleAlert,
  info: Info,
}
</script>

<template>
  <div class="toast-host" role="region" aria-label="Notifications">
    <TransitionGroup name="toast" tag="ul" class="toast-list" aria-live="polite">
      <li
        v-for="toast in toasts"
        :key="toast.id"
        class="toast"
        :class="`toast--${toast.kind}`"
      >
        <component :is="ICONS[toast.kind]" class="ff-icon" aria-hidden="true" />
        <p class="toast__message" :role="toast.kind === 'error' ? 'alert' : 'status'">{{ toast.message }}</p>
        <button type="button" class="ff-icon-btn toast__close" aria-label="Dismiss notification" @click="dismissToast(toast.id)">
          <X class="ff-icon" aria-hidden="true" />
        </button>
      </li>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  top: calc(var(--safe-top) + var(--space-3));
  right: var(--space-3);
  left: var(--space-3);
  z-index: var(--z-toast);
  pointer-events: none;
}

.toast-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-width: var(--content-max);
  margin-inline: auto;
}

/* radius-lg (14) = icon button radius-sm (6) + 8px gap. */
.toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
  border: 1px solid var(--color-brand-border);
  border-radius: var(--radius-lg);
  background: var(--color-brand-light);
  box-shadow: var(--shadow-md);
  color: var(--color-brand-dark);
  pointer-events: auto;
}

.toast--success {
  background: var(--color-success-light);
  border-color: var(--color-success-border);
  color: var(--color-success);
}

.toast--error {
  background: var(--color-danger-light);
  border-color: var(--color-danger-border);
  color: var(--color-danger);
}

.toast__message {
  flex: 1;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.toast__close {
  color: inherit;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity var(--transition-base),
    transform var(--transition-base);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(calc(var(--space-2) * -1));
}
</style>
