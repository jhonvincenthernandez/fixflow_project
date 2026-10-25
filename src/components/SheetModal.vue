<script setup lang="ts">
import { useId } from 'vue'
import { IonModal } from '@ionic/vue'
import { X } from '@lucide/vue'

defineProps<{
  open: boolean
  title: string
}>()

defineEmits<{ close: [] }>()

const titleId = useId()
</script>

<template>
  <!-- Ionic's modal traps focus, sets aria-modal, and returns focus to the trigger on close. -->
  <ion-modal class="ff-sheet" :is-open="open" :aria-labelledby="titleId" @didDismiss="$emit('close')">
    <div class="ff-sheet__panel">
      <header class="ff-sheet__header">
        <h2 :id="titleId" class="ff-h2">{{ title }}</h2>
        <button type="button" class="ff-icon-btn" aria-label="Close dialog" @click="$emit('close')">
          <X class="ff-icon" aria-hidden="true" />
        </button>
      </header>
      <div class="ff-sheet__body"><slot /></div>
      <footer v-if="$slots['footer']" class="ff-sheet__footer"><slot name="footer" /></footer>
    </div>
  </ion-modal>
</template>
