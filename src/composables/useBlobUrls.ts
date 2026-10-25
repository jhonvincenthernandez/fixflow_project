import { onBeforeUnmount, shallowRef } from 'vue'

export interface BlobItem {
  readonly id: string
  readonly name: string
  readonly blob: Blob
}

export interface BlobUrl {
  readonly id: string
  readonly name: string
  readonly url: string
}

/**
 * Turns blobs into object URLs for <img> tags and revokes them when replaced or when the
 * component unmounts, so photos never leak memory.
 */
export function useBlobUrls() {
  const items = shallowRef<readonly BlobUrl[]>([])

  function revoke(list: readonly BlobUrl[]): void {
    for (const item of list) URL.revokeObjectURL(item.url)
  }

  function replace(blobs: readonly BlobItem[]): void {
    revoke(items.value)
    items.value = blobs.map((item) => ({ id: item.id, name: item.name, url: URL.createObjectURL(item.blob) }))
  }

  onBeforeUnmount(() => revoke(items.value))

  return { items, replace }
}
