<script setup lang="ts">
import { useNavigate } from '@/composables/useNavigate'

const props = defineProps<{ to: string }>()
const { push } = useNavigate()

/** A real anchor for semantics and long-press menus; plain clicks go through Ionic's router. */
function onClick(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  push(props.to)
}
</script>

<template>
  <a :href="to" @click="onClick"><slot /></a>
</template>
