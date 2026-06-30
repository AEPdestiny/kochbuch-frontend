import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi } from '@/shared/api/authApi'
import { i18n } from '@/i18n'
import {
  ApiClientError,
  AUTH_TOKEN_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
  clearAuthStorage,
  clearSessionExpiredFlag,
  hasSessionExpiredFlag,
  markSessionExpired,
  resetUnauthorizedHandling,
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
  const sessionExpired = ref(false)

  const isAuthenticated = computed(() => Boolean(token.value))

  function initFromStorage() {
    token.value = sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
    if (hasSessionExpiredFlag()) {
      sessionExpired.value = true
      error.value = translateAuthError('auth.errors.sessionExpired')
    }

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
      handleSessionExpired()
      error.value = toFriendlyAuthError(e, 'auth.errors.sessionExpired')
      return null
    } finally {
      loading.value = false
    }
  }

  function logout() {
    token.value = null
    user.value = null
    error.value = null
    sessionExpired.value = false
    clearAuthStorage()
    clearSessionExpiredFlag()
    resetUnauthorizedHandling()
  }

  function handleSessionExpired() {
    token.value = null
    user.value = null
    sessionExpired.value = true
    error.value = translateAuthError('auth.errors.sessionExpired')
    clearAuthStorage()
    markSessionExpired()
  }

  async function authenticate(action: () => Promise<AuthResponse>) {
    loading.value = true
    clearSessionExpired()
    error.value = null
    try {
      const response = await action()
      token.value = response.accessToken
      sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, response.accessToken)
      // Populate user from response; if backend omits it, fetch from /me so the
      // router guard never needs to call loadCurrentUser() right after login.
      user.value = response.user ?? null
      if (user.value) {
        sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user.value))
      } else {
        try {
          user.value = await authApi.me()
          sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user.value))
        } catch {
          // /me failed — router guard will retry and handle session expiry if needed
        }
      }
      clearSessionExpired()
      resetUnauthorizedHandling()
      return response
    } catch (e) {
      error.value = toFriendlyAuthError(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  function toFriendlyAuthError(e: unknown, unauthorizedKey = 'auth.errors.invalidCredentials') {
    if (e instanceof ApiClientError) {
      if (e.status === 401) {
        return translateAuthError(unauthorizedKey)
      }
      if (e.status === 409) {
        return translateAuthError('auth.errors.userExists')
      }
      if (!e.status) {
        return translateAuthError('auth.errors.network')
      }
      return translateAuthError('auth.errors.unknown')
    }

    return translateAuthError('auth.errors.unknown')
  }

  function translateAuthError(key: string) {
    return i18n.global.t(key)
  }

  function clearSessionExpired() {
    sessionExpired.value = false
    clearSessionExpiredFlag()
  }

  return {
    token,
    user,
    loading,
    error,
    sessionExpired,
    isAuthenticated,
    initFromStorage,
    register,
    login,
    loadCurrentUser,
    logout,
    handleSessionExpired,
    clearSessionExpired,
  }
})
