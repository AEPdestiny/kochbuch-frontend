import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginView from '@/views/LoginView.vue'
import { authApi } from '@/shared/api/authApi'
import type { AuthResponse } from '@/types/auth'

vi.mock('@/shared/api/authApi', () => ({
  authApi: {
    register: vi.fn(),
    login: vi.fn(),
    me: vi.fn(),
  },
}))

const authResponse: AuthResponse = {
  accessToken: 'jwt-token',
  tokenType: 'Bearer',
  expiresIn: 3600,
  user: {
    id: 1,
    username: 'salma',
    email: 'salma@example.com',
    role: 'USER',
    createdAt: '2026-06-05T12:00:00Z',
  },
}

describe('LoginView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('redirects to the return URL after successful login', async () => {
    vi.mocked(authApi.login).mockResolvedValue(authResponse)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', component: LoginView },
        { path: '/pantry', component: { template: '<div>Pantry</div>' } },
      ],
    })

    await router.push('/login?redirect=/pantry')
    await router.isReady()

    const wrapper = mount(LoginView, {
      global: {
        plugins: [router],
      },
    })

    await wrapper.find('input[type="email"]').setValue('salma@example.com')
    await wrapper.find('input[type="password"]').setValue('secret123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(authApi.login).toHaveBeenCalledWith({
      email: 'salma@example.com',
      password: 'secret123',
    })
    expect(router.currentRoute.value.path).toBe('/pantry')
  })
})
