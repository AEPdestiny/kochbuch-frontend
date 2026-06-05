import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/authStore'
import { authApi } from '@/shared/api/authApi'
import {
  AUTH_TOKEN_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
} from '@/shared/api/apiClient'
import type { AuthResponse, UserResponse } from '@/types/auth'

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

const authResponse: AuthResponse = {
  accessToken: 'jwt-token',
  tokenType: 'Bearer',
  expiresIn: 3600,
  user,
}

describe('authStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('stores the token after login', async () => {
    vi.mocked(authApi.login).mockResolvedValue(authResponse)

    const store = useAuthStore()

    await store.login({
      email: 'salma@example.com',
      password: 'secret123',
    })

    expect(store.token).toBe('jwt-token')
    expect(store.user).toEqual(user)
    expect(store.isAuthenticated).toBe(true)
    expect(sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe('jwt-token')
    expect(sessionStorage.getItem(AUTH_USER_STORAGE_KEY)).toBe(JSON.stringify(user))
  })

  it('clears token and user on logout', () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user))
    const store = useAuthStore()
    store.initFromStorage()

    store.logout()

    expect(store.token).toBeNull()
    expect(store.user).toBeNull()
    expect(store.isAuthenticated).toBe(false)
    expect(sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull()
    expect(sessionStorage.getItem(AUTH_USER_STORAGE_KEY)).toBeNull()
  })

  it('initializes token and user from sessionStorage', () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'stored-token')
    sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user))

    const store = useAuthStore()
    store.initFromStorage()

    expect(store.token).toBe('stored-token')
    expect(store.user).toEqual(user)
    expect(store.isAuthenticated).toBe(true)
  })
})
