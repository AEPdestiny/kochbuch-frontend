import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi } from '@/shared/api/authApi'
import {
  ApiClientError,
  AUTH_TOKEN_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
} from '@/shared/api/apiClient'
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  UserResponse,
} from '@/types/auth'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const user = ref<UserResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => Boolean(token.value))

  function initFromStorage() {
    token.value = sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
    const storedUser = sessionStorage.getItem(AUTH_USER_STORAGE_KEY)
    if (!storedUser) {
      user.value = null
      return
    }

    try {
      user.value = JSON.parse(storedUser) as UserResponse
    } catch {
      user.value = null
      sessionStorage.removeItem(AUTH_USER_STORAGE_KEY)
    }
  }

  async function register(request: RegisterRequest) {
    return authenticate(() => authApi.register(request))
  }

  async function login(request: LoginRequest) {
    return authenticate(() => authApi.login(request))
  }

  async function loadCurrentUser() {
    if (!token.value) {
      user.value = null
      return null
    }

    loading.value = true
    error.value = null
    try {
      user.value = await authApi.me()
      sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user.value))
      return user.value
    } catch (e) {
      logout()
      error.value = toFriendlyAuthError(e)
      return null
    } finally {
      loading.value = false
    }
  }

  function logout() {
    token.value = null
    user.value = null
    error.value = null
    sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    sessionStorage.removeItem(AUTH_USER_STORAGE_KEY)
  }

  async function authenticate(action: () => Promise<AuthResponse>) {
    loading.value = true
    error.value = null
    try {
      const response = await action()
      token.value = response.accessToken
      user.value = response.user
      sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, response.accessToken)
      sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(response.user))
      return response
    } catch (e) {
      error.value = toFriendlyAuthError(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  function toFriendlyAuthError(e: unknown) {
    if (e instanceof ApiClientError) {
      if (e.status === 401) {
        return 'E-Mail oder Passwort ist falsch.'
      }
      if (e.status === 409) {
        return 'E-Mail oder Benutzername ist bereits vergeben.'
      }
      if (!e.status) {
        return 'Das Backend ist aktuell nicht erreichbar. Bitte versuche es erneut.'
      }
      return e.message
    }

    return e instanceof Error
      ? e.message
      : 'Authentifizierung fehlgeschlagen.'
  }

  return {
    token,
    user,
    loading,
    error,
    isAuthenticated,
    initFromStorage,
    register,
    login,
    loadCurrentUser,
    logout,
  }
})
