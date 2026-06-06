import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/App.vue'
import { useAuthStore } from '@/stores/authStore'
import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from '@/shared/api/apiClient'
import { i18n, LOCALE_STORAGE_KEY, setLocale } from '@/i18n'

const user = {
  id: 1,
  username: 'salma',
  email: 'salma@example.com',
  role: 'USER',
  createdAt: '2026-06-05T12:00:00Z',
}

vi.mock('@/shared/api/authApi', () => ({
  authApi: {
    me: vi.fn().mockResolvedValue({
      id: 1,
      username: 'salma',
      email: 'salma@example.com',
      role: 'USER',
      createdAt: '2026-06-05T12:00:00Z',
    }),
  },
}))

describe('App navigation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    localStorage.clear()
    setLocale('de')
    document.documentElement.dir = 'ltr'
  })

  it('does not show Dashboard navigation for guests', () => {
    const wrapper = mount(App, {
      global: {
        plugins: [i18n],
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
          RouterView: true,
        },
      },
    })

    expect(wrapper.text()).toContain('Startseite')
    expect(wrapper.text()).toContain('Anmelden')
    expect(wrapper.text()).not.toContain('Dashboard')
    expect(wrapper.text()).not.toContain('Wochenplan')
  })

  it('shows Dashboard navigation for authenticated users', () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user))
    const authStore = useAuthStore()
    authStore.initFromStorage()

    const wrapper = mount(App, {
      global: {
        plugins: [i18n],
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
          RouterView: true,
        },
      },
    })

    expect(wrapper.text()).toContain('Dashboard')
    expect(wrapper.text()).toContain('Wochenplan')
  })

  it('switches navigation to English and stores the locale', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [i18n],
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
          RouterView: true,
        },
      },
    })

    await wrapper.find('select').setValue('en')
    await nextTick()

    expect(wrapper.text()).toContain('Home')
    expect(wrapper.text()).toContain('Login')
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('sets RTL direction when Arabic is selected', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [i18n],
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
          RouterView: true,
        },
      },
    })

    await wrapper.find('select').setValue('ar')
    await nextTick()

    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ar')
    expect(document.documentElement.lang).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')
    expect(wrapper.text()).toContain('الرئيسية')
  })
})
