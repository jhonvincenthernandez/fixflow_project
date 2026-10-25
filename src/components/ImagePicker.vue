<script setup lang="ts">
import { ref, watch } from 'vue'
import { Camera, X } from '@lucide/vue'
import { useBlobUrls } from '@/composables/useBlobUrls'
import { prepareImage } from '@/data/images'
import type { ImageUpload } from '@/data/repo'
import { fieldMessage, toAppError } from '@/domain/errors'
import { logger } from '@/domain/logger'
import { MAX_IMAGES } from '@/domain/types'
import AppButton from './AppButton.vue'

defineProps<{ error?: string | undefined }>()

const model = defineModel<ImageUpload[]>({ required: true })

const fileInput = ref<HTMLInputElement | null>(null)
const processing = ref(false)
const pickError = ref<string | null>(null)
const { items, replace } = useBlobUrls()

watch(
  model,
  (uploads) => replace(uploads.map((upload, index) => ({ id: `${index}-${upload.name}`, name: upload.name, blob: upload.blob }))),
  { immediate: true },
)

function openPicker(): void {
  fileInput.value?.click()
}

async function onPick(event: Event): Promise<void> {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  const files = Array.from(target.files ?? [])
  // Reset so choosing the same photo again still fires a change event.
  target.value = ''
  if (files.length === 0) return

  const room = MAX_IMAGES - model.value.length
  pickError.value = files.length > room ? `You can attach up to ${MAX_IMAGES} photos.` : null

  processing.value = true
  try {
    const prepared = await Promise.all(files.slice(0, Math.max(room, 0)).map(prepareImage))
    model.value = [...model.value, ...prepared]
  } catch (error) {
    const appError = toAppError(error)
    pickError.value = fieldMessage(appError, 'images') ?? 'That photo could not be added. Try a different one.'
    if (appError.code !== 'VALIDATION_FAILED') logger.error('Adding a photo failed', appError)
  } finally {
    processing.value = false
  }
}

function remove(index: number): void {
  model.value = model.value.filter((_, position) => position !== index)
  pickError.value = null
}
</script>

<template>
  <div class="picker">
    <p class="ff-label">Photos of the problem <span class="ff-muted">(optional)</span></p>

    <ul v-if="items.length > 0" class="picker__grid">
      <li v-for="(item, index) in items" :key="item.id" class="picker__item">
        <img class="picker__image" :src="item.url" :alt="`Preview of ${item.name}`" width="72" height="72" />
        <button
          type="button"
          class="picker__remove"
          :aria-label="`Remove photo ${item.name}`"
          @click="remove(index)"
        >
          <X class="ff-icon ff-icon--sm" aria-hidden="true" />
        </button>
      </li>
    </ul>

    <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="onPick" />

    <AppButton
      variant="secondary"
      :loading="processing"
      :disabled="model.length >= MAX_IMAGES"
      @click="openPicker"
    >
      <Camera class="ff-icon ff-icon--sm" aria-hidden="true" />
      Add photos ({{ model.length }} of {{ MAX_IMAGES }})
    </AppButton>

    <p class="ff-hint">Clear photos help the shop quote faster.</p>
    <p v-if="pickError ?? error" class="ff-error-text" role="alert">{{ pickError ?? error }}</p>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.picker__grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.picker__item {
  position: relative;
}

.picker__image {
  display: block;
  width: var(--thumb-size);
  height: var(--thumb-size);
  object-fit: cover;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
}

.picker__remove {
  position: absolute;
  top: calc(var(--space-2) * -1);
  right: calc(var(--space-2) * -1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-min);
  height: var(--touch-min);
  padding: 0;
  background: transparent;
  border: 0;
  color: var(--color-text-on-brand);
  cursor: pointer;
}

/* The visible badge is smaller than the 44px touch target around it. */
.picker__remove::before {
  content: '';
  position: absolute;
  width: var(--icon-lg);
  height: var(--icon-lg);
  background: var(--color-text-primary);
  border: 2px solid var(--color-surface);
  border-radius: var(--radius-full);
  z-index: 0;
}

.picker__remove > * {
  position: relative;
  z-index: 1;
}
</style>
