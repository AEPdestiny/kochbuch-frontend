import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  type: ToastType
  message: string
}

const DEFAULT_DURATION_MS = 3500

/**
 * Queue of transient notification toasts shown app-wide (e.g. "Rezept gespeichert").
 * Each toast removes itself after `duration` ms; there is no manual dismiss besides that.
 */
export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])
  let nextId = 0

  function addToast(message: string, type: ToastType = 'info', duration = DEFAULT_DURATION_MS) {
    const id = ++nextId
    toasts.value = [...toasts.value, { id, type, message }]
    setTimeout(() => removeToast(id), duration)
  }

  function removeToast(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return { toasts, addToast, removeToast }
})
