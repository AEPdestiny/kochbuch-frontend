import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RegisterView from '@/views/RegisterView.vue'
import { authApi } from '@/shared/api/authApi'
import { ApiClientError } from '@/shared/api/apiClient'
import { i18n, setLocale } from '@/i18n'
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

describe('RegisterView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    vi.clearAllMocks()
    setLocale('de')
  })

  it('redirects to the return URL after successful registration', async () => {
    vi.mocked(authApi.register).mockResolvedValue(authResponse)
    const router = createRegisterRouter()

    await router.push('/register?redirect=/dashboard')
    await router.isReady()

    const wrapper = mount(RegisterView, {
      global: {
        plugins: [router, i18n],
      },
    })

    await wrapper.find('input[autocomplete="username"]').setValue('salma')
    await wrapper.find('input[type="email"]').setValue('salma@example.com')
    await wrapper.find('input[type="password"]').setValue('secret123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(authApi.register).toHaveBeenCalledWith({
      username: 'salma',
      email: 'salma@example.com',
      password: 'secret123',
    })
    expect(router.currentRoute.value.path).toBe('/dashboard')
  })

  it('redirects to /dashboard after successful registration when no redirect query is present', async () => {
    vi.mocked(authApi.register).mockResolvedValue(authResponse)
    const router = createRegisterRouter()

    await router.push('/register')
    await router.isReady()

    const wrapper = mount(RegisterView, {
      global: {
        plugins: [router, i18n],
      },
    })

    await wrapper.find('input[autocomplete="username"]').setValue('salma')
    await wrapper.find('input[type="email"]').setValue('salma@example.com')
    await wrapper.find('input[type="password"]').setValue('secret123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/dashboard')
  })

  it('shows German register texts by default', async () => {
    const router = createRegisterRouter()

    await router.push('/register')
    await router.isReady()

    const wrapper = mount(RegisterView, {
      global: {
        plugins: [router, i18n],
      },
    })

    expect(wrapper.text()).toContain('Registrieren')
    expect(wrapper.text()).toContain('Benutzername')
    expect(wrapper.find('input[type="password"]').attributes('placeholder')).toBe('Mindestens 8 Zeichen')
    expect(wrapper.find('button[type="submit"]').text()).toBe('Konto erstellen')
  })

  it('shows English register texts and translated duplicate-user errors', async () => {
    setLocale('en')
    vi.mocked(authApi.register).mockRejectedValue(new ApiClientError('Conflict', 409))
    const router = createRegisterRouter()

    await router.push('/register')
    await router.isReady()

    const wrapper = mount(RegisterView, {
      global: {
        plugins: [router, i18n],
      },
    })

    expect(wrapper.text()).toContain('Register')
    expect(wrapper.find('button[type="submit"]').text()).toBe('Create account')

    await wrapper.find('input[autocomplete="username"]').setValue('salma')
    await wrapper.find('input[type="email"]').setValue('salma@example.com')
    await wrapper.find('input[type="password"]').setValue('secret123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Email or username is already taken.')
  })

  it('renders Arabic register texts without errors', async () => {
    setLocale('ar')
    const router = createRegisterRouter()

    await router.push('/register')
    await router.isReady()

    const wrapper = mount(RegisterView, {
      global: {
        plugins: [router, i18n],
      },
    })

    expect(wrapper.text()).toContain('إنشاء حساب')
    expect(wrapper.text()).toContain('اسم المستخدم')
  })
})

function createRegisterRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/register', component: RegisterView },
      { path: '/dashboard', component: { template: '<div>Dashboard</div>' } },
    ],
  })
}
