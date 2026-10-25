<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import { Laptop, Smartphone, Tv, WashingMachine, Wrench, Zap } from '@lucide/vue'
import type { ServiceId } from '@/domain/types'

const props = defineProps<{ serviceId: ServiceId }>()

const ICONS: Record<ServiceId, Component> = {
  phone: Smartphone,
  computer: Laptop,
  appliance: WashingMachine,
  tv_audio: Tv,
  electrical: Zap,
  other: Wrench,
}

const icon = computed(() => ICONS[props.serviceId])
</script>

<template>
  <span class="service-icon">
    <component :is="icon" class="ff-icon" aria-hidden="true" />
  </span>
</template>

<style scoped>
/* A small inner block: tinted, bordered, radius-sm so it nests inside a radius-xl card. */
.service-icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--avatar-size);
  height: var(--avatar-size);
  background: var(--color-brand-light);
  border: 1px solid var(--color-brand-border);
  border-radius: var(--radius-sm);
  color: var(--color-brand-dark);
}
</style>
