import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const defaultProps = {
  open: true,
  title: 'Liste leeren',
  message: 'Alle Eintraege werden entfernt.',
  confirmLabel: 'Loeschen',
  cancelLabel: 'Abbrechen',
}

describe('ConfirmDialog.vue', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders the dialog content in a teleport target when open', () => {
    mount(ConfirmDialog, {
      props: defaultProps,
      attachTo: document.body,
    })

    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    expect(dialog?.textContent).toContain('Liste leeren')
    expect(dialog?.textContent).toContain('Alle Eintraege werden entfernt.')
  })

  it('renders nothing when closed', () => {
    mount(ConfirmDialog, {
      props: { ...defaultProps, open: false },
      attachTo: document.body,
    })

    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('emits confirm and cancel from the action buttons', async () => {
    const wrapper = mount(ConfirmDialog, {
      props: defaultProps,
      attachTo: document.body,
    })

    document.body.querySelector<HTMLButtonElement>('.confirm-button')?.click()
    document.body.querySelector<HTMLButtonElement>('.cancel-button')?.click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('emits cancel on Escape and overlay click', async () => {
    const wrapper = mount(ConfirmDialog, {
      props: defaultProps,
      attachTo: document.body,
    })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    document.body.querySelector<HTMLElement>('.confirm-overlay')?.click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('cancel')).toHaveLength(2)
  })

  it('marks the confirm button as danger when requested', () => {
    mount(ConfirmDialog, {
      props: { ...defaultProps, danger: true },
      attachTo: document.body,
    })

    expect(document.body.querySelector('.confirm-button')?.classList.contains('danger')).toBe(true)
  })
})
