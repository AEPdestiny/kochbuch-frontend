import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import router from '@/router'
import { authApi } from '@/shared/api/authApi'
import {
  ApiClientError,
  AUTH_TOKEN_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
  SESSION_EXPIRED_STORAGE_KEY,
} from '@/shared/api/apiClient'
import type { UserResponse } from '@/types/auth'

vi.mock('@/shared/api/authApi', () => ({
  authApi: {
    register: vi.fn(),
    login: vi.fn(),
    me: vi.fn(),
  },
}))

const user: UserResponse = {
  id: 1,
  username: 'salma',
  email: 'salma@example.com',
  role: 'USER',
  createdAt: '2026-06-05T12:00:00Z',
}

describe('route guards', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    vi.clearAllMocks()
    await router.replace('/')
  })

  it('redirects guests from /pantry to login with redirect query', async () => {
    await router.push('/pantry')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/pantry')
  })

  it('redirects guests from /shopping-list to login with redirect query', async () => {
    await router.push('/shopping-list')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/shopping-list')
  })

  it('redirects guests from /my-recipes to login with redirect query', async () => {
    await router.push('/my-recipes')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/my-recipes')
  })

  it('redirects guests from /recipes/new to login with redirect query', async () => {
    await router.push('/recipes/new')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/recipes/new')
  })

  it('redirects guests from /dashboard to login with redirect query', async () => {
    await router.push('/dashboard')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/dashboard')
  })

  it('redirects guests from /profile to login with redirect query', async () => {
    await router.push('/profile')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/profile')
  })

  it('redirects guests from /meal-plan to login with redirect query', async () => {
    await router.push('/meal-plan')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/meal-plan')
  })

  it('allows authenticated users to open protected routes', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user))

    await router.push('/pantry')

    expect(router.currentRoute.value.path).toBe('/pantry')
    expect(authApi.me).not.toHaveBeenCalled()
  })

  it('loads the current user when a token exists but no user is loaded', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(authApi.me).mockResolvedValue(user)

    await router.push('/shopping-list')

    expect(authApi.me).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.path).toBe('/shopping-list')
  })

  it('redirects to login and keeps the session-expired message when a stored token is invalid', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'expired-token')
    vi.mocked(authApi.me).mockRejectedValue(new ApiClientError('Unauthorized', 401))

    await router.push('/meal-plan')

    expect(authApi.me).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/meal-plan')
    expect(sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull()
    expect(sessionStorage.getItem(SESSION_EXPIRED_STORAGE_KEY)).toBe('true')
  })

  it('keeps public routes usable without login', async () => {
    await router.push('/')

    expect(router.currentRoute.value.path).toBe('/')
    expect(authApi.me).not.toHaveBeenCalled()
  })
})
