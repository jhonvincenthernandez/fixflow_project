import { readonly, ref } from 'vue'

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  readonly id: number
  readonly kind: ToastKind
  readonly message: string
}

const DEFAULT_DURATION_MS = 4500

const toasts = ref<Toast[]>([])
const timers = new Map<number, ReturnType<typeof setTimeout>>()
let nextId = 1

export function dismissToast(id: number): void {
  const timer = timers.get(id)
  if (timer !== undefined) {
    clearTimeout(timer)
    timers.delete(id)
  }
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

export function showToast(kind: ToastKind, message: string, durationMs: number = DEFAULT_DURATION_MS): void {
  const id = nextId
  nextId += 1
  toasts.value = [...toasts.value, { id, kind, message }]
  timers.set(id, setTimeout(() => dismissToast(id), durationMs))
}

export function useToasts() {
  return { toasts: readonly(toasts), dismissToast }
}
