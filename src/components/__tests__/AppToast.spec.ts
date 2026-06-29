import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AppToast from '@/components/AppToast.vue'
import { useToastStore } from '@/stores/toastStore'

enableAutoUnmount(afterEach)

// AppToast uses <Teleport to="body">, so rendered content lives in document.body.
// Helper to query toasts in the teleport target.
function bodyToasts() {
  return document.body.querySelectorAll('.toast')
}

describe('AppToast.vue', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    vi.useFakeTimers()
    pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    vi.useRealTimers()
    // Clean up any teleported toast nodes left in document.body
    document.body.querySelectorAll('.toast-container').forEach(el => el.remove())
  })

  it('renders nothing when there are no toasts', () => {
    mount(AppToast, { global: { plugins: [pinia] }, attachTo: document.body })
    expect(bodyToasts()).toHaveLength(0)
  })

  it('renders a success toast with the correct message', async () => {
    const wrapper = mount(AppToast, { global: { plugins: [pinia] }, attachTo: document.body })
    useToastStore().addToast('Rezept erstellt.', 'success')
    await wrapper.vm.$nextTick()

    const toasts = Array.from(bodyToasts())
    expect(toasts).toHaveLength(1)
    expect(toasts[0]?.classList.contains('toast--success')).toBe(true)
    expect(toasts[0]?.textContent).toContain('Rezept erstellt.')
  })

  it('renders an error toast with the correct message', async () => {
    const wrapper = mount(AppToast, { global: { plugins: [pinia] }, attachTo: document.body })
    useToastStore().addToast('Etwas ist schiefgelaufen.', 'error')
    await wrapper.vm.$nextTick()

    expect(document.body.querySelector('.toast--error')).not.toBeNull()
  })

  it('renders an info toast', async () => {
    const wrapper = mount(AppToast, { global: { plugins: [pinia] }, attachTo: document.body })
    useToastStore().addToast('Information.', 'info')
    await wrapper.vm.$nextTick()

    expect(document.body.querySelector('.toast--info')).not.toBeNull()
  })

  it('removes a toast when close button is clicked', async () => {
    const wrapper = mount(AppToast, { global: { plugins: [pinia] }, attachTo: document.body })
    useToastStore().addToast('Wird geschlossen.', 'success')
    await wrapper.vm.$nextTick()

    expect(bodyToasts()).toHaveLength(1)
    const closeBtn = document.body.querySelector<HTMLButtonElement>('.toast-close')
    closeBtn?.click()
    await wrapper.vm.$nextTick()

    expect(bodyToasts()).toHaveLength(0)
  })

  it('auto-removes a toast after the default duration', async () => {
    const wrapper = mount(AppToast, { global: { plugins: [pinia] }, attachTo: document.body })
    useToastStore().addToast('Kurz sichtbar.', 'success')
    await wrapper.vm.$nextTick()

    expect(bodyToasts()).toHaveLength(1)

    vi.advanceTimersByTime(3500)
    await wrapper.vm.$nextTick()

    expect(bodyToasts()).toHaveLength(0)
  })

  it('stacks multiple toasts', async () => {
    const wrapper = mount(AppToast, { global: { plugins: [pinia] }, attachTo: document.body })
    const store = useToastStore()
    store.addToast('Toast 1', 'success')
    store.addToast('Toast 2', 'error')
    store.addToast('Toast 3', 'info')
    await wrapper.vm.$nextTick()

    expect(bodyToasts()).toHaveLength(3)
  })
})
