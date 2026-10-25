<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useBlobUrls } from '@/composables/useBlobUrls'
import type { StoredImage } from '@/data/repo'
import SheetModal from './SheetModal.vue'

const props = defineProps<{ images: readonly StoredImage[] }>()

const { items, replace } = useBlobUrls()
watch(
  () => props.images,
  (images) => replace(images),
  { immediate: true },
)

const viewing = ref<number | null>(null)
const viewed = computed(() => (viewing.value === null ? undefined : items.value[viewing.value]))
</script>

<template>
  <ul class="gallery">
    <li v-for="(item, index) in items" :key="item.id">
      <button
        type="button"
        class="gallery__thumb"
        :aria-label="`View photo ${index + 1} of ${items.length}`"
        @click="viewing = index"
      >
        <img class="gallery__image" :src="item.url" :alt="`Problem photo ${index + 1}`" width="72" height="72" loading="lazy" />
      </button>
    </li>
  </ul>

  <SheetModal :open="viewing !== null" title="Problem photo" @close="viewing = null">
    <img v-if="viewed" class="gallery__large" :src="viewed.url" :alt="`Problem photo ${(viewing ?? 0) + 1}, enlarged`" />
  </SheetModal>
</template>

<style scoped>
.gallery {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.gallery__thumb {
  display: block;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.gallery__image {
  display: block;
  width: var(--thumb-size);
  height: var(--thumb-size);
  object-fit: cover;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  transition:
    box-shadow var(--transition-base),
    transform var(--transition-base);
}

@media (hover: hover) {
  .gallery__thumb:hover .gallery__image {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }
}

.gallery__large {
  display: block;
  width: 100%;
  height: auto;
  border-radius: var(--radius-sm);
}
</style>
