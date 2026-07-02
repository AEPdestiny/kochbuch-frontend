import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginView from '@/views/LoginView.vue'
import { authApi } from '@/shared/api/authApi'
import { i18n, setLocale } from '@/i18n'
import { ApiClientError, SESSION_EXPIRED_STORAGE_KEY } from '@/shared/api/apiClient'
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
    setLocale('de')
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
        plugins: [router, i18n],
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

  it('redirects to /dashboard after successful login when no redirect query is present', async () => {
    vi.mocked(authApi.login).mockResolvedValue(authResponse)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', component: LoginView },
        { path: '/dashboard', component: { template: '<div>Dashboard</div>' } },
      ],
    })

    await router.push('/login')
    await router.isReady()

    const wrapper = mount(LoginView, {
      global: {
        plugins: [router, i18n],
      },
    })

    await wrapper.find('input[type="email"]').setValue('salma@example.com')
    await wrapper.find('input[type="password"]').setValue('secret123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/dashboard')
  })

  it('stays on /login and shows an error when login fails', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new ApiClientError('Unauthorized', 401))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', component: LoginView },
        { path: '/dashboard', component: { template: '<div>Dashboard</div>' } },
      ],
    })

    await router.push('/login')
    await router.isReady()

    const wrapper = mount(LoginView, {
      global: {
        plugins: [router, i18n],
      },
    })

    await wrapper.find('input[type="email"]').setValue('salma@example.com')
    await wrapper.find('input[type="password"]').setValue('wrong-password')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/login')
    expect(wrapper.text()).toContain('E-Mail oder Passwort ist falsch.')
  })

  it('shows German login texts by default', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/login', component: LoginView }],
    })

    await router.push('/login')
    await router.isReady()

    const wrapper = mount(LoginView, {
      global: {
        plugins: [router, i18n],
      },
    })

    expect(wrapper.text()).toContain('Anmelden')
    expect(wrapper.text()).toContain('Passwort')
    expect(wrapper.find('input[type="password"]').attributes('placeholder')).toBe('Dein Passwort')
    expect(wrapper.find('button[type="submit"]').text()).toBe('Einloggen')
  })

  it('shows English login texts and translated auth errors', async () => {
    setLocale('en')
    vi.mocked(authApi.login).mockRejectedValue(new ApiClientError('Unauthorized', 401))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/login', component: LoginView }],
    })

    await router.push('/login')
    await router.isReady()

    const wrapper = mount(LoginView, {
      global: {
        plugins: [router, i18n],
      },
    })

    expect(wrapper.text()).toContain('Login')
    expect(wrapper.find('button[type="submit"]').text()).toBe('Log in')

    await wrapper.find('input[type="email"]').setValue('salma@example.com')
    await wrapper.find('input[type="password"]').setValue('wrong-password')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Email or password is incorrect.')
  })

  it('shows the session-expired message from storage on the login page', async () => {
    sessionStorage.setItem(SESSION_EXPIRED_STORAGE_KEY, 'true')

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/login', component: LoginView }],
    })

    await router.push('/login')
    await router.isReady()

    const wrapper = mount(LoginView, {
      global: {
        plugins: [router, i18n],
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.')
  })

  it('uses the English session-expired message when English is active', async () => {
    setLocale('en')
    sessionStorage.setItem(SESSION_EXPIRED_STORAGE_KEY, 'true')

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/login', component: LoginView }],
    })

    await router.push('/login')
    await router.isReady()

    const wrapper = mount(LoginView, {
      global: {
        plugins: [router, i18n],
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Your session has expired. Please sign in again.')
  })

  it('renders Arabic login texts without errors', async () => {
    setLocale('ar')

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/login', component: LoginView }],
    })

    await router.push('/login')
    await router.isReady()

    const wrapper = mount(LoginView, {
      global: {
        plugins: [router, i18n],
      },
    })

    expect(wrapper.text()).toContain('تسجيل الدخول')
    expect(wrapper.text()).toContain('كلمة المرور')
  })
})
