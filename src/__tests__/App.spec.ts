import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/App.vue'
import { useAuthStore } from '@/stores/authStore'
import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from '@/shared/api/apiClient'

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
  })

  it('does not show Dashboard navigation for guests', () => {
    const wrapper = mount(App, {
      global: {
        stubs: ['RouterLink', 'RouterView'],
      },
    })

    expect(wrapper.text()).not.toContain('Dashboard')
  })

  it('shows Dashboard navigation for authenticated users', () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user))
    const authStore = useAuthStore()
    authStore.initFromStorage()

    const wrapper = mount(App, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
          RouterView: true,
        },
      },
    })

    expect(wrapper.text()).toContain('Dashboard')
  })
})
