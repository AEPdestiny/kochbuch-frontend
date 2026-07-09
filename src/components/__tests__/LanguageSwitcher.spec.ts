import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import { i18n, LOCALE_STORAGE_KEY, setLocale } from '@/i18n'
import { useToastStore } from '@/stores/toastStore'

describe('LanguageSwitcher.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    setActivePinia(createPinia())
    setLocale('de')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the supported language options and current locale', () => {
    const wrapper = mount(LanguageSwitcher, {
      global: { plugins: [i18n] },
    })

    const options = wrapper.findAll('option').map(option => option.text())
    expect(options).toEqual(['Deutsch', 'English'])
    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('de')
  })

  it('changes the app locale, persists it and shows a toast', async () => {
    const wrapper = mount(LanguageSwitcher, {
      global: { plugins: [i18n] },
    })
    const toastStore = useToastStore()
    const addToastSpy = vi.spyOn(toastStore, 'addToast')

    await wrapper.find('select').setValue('en')

    expect(i18n.global.locale.value).toBe('en')
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    expect(addToastSpy).toHaveBeenCalledWith('The interface is now in English.', 'info')
  })

  it('does not emit a toast when selecting the already active locale', async () => {
    const wrapper = mount(LanguageSwitcher, {
      global: { plugins: [i18n] },
    })
    const toastStore = useToastStore()
    const addToastSpy = vi.spyOn(toastStore, 'addToast')

    await wrapper.find('select').setValue('de')

    expect(addToastSpy).not.toHaveBeenCalled()
  })
})
