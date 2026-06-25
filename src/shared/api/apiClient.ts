import axios, { AxiosError } from 'axios'

export const AUTH_TOKEN_STORAGE_KEY = 'dishly.auth.token'
export const AUTH_USER_STORAGE_KEY = 'dishly.auth.user'
export const SESSION_EXPIRED_STORAGE_KEY = 'dishly.auth.sessionExpired'

type UnauthorizedHandler = (redirectPath: string) => void | Promise<void>

type BackendErrorResponse = {
  message?: string
  status?: number
  error?: string
  path?: string
}

let unauthorizedHandler: UnauthorizedHandler | null = null
let isHandlingUnauthorized = false

export class ApiClientError extends Error {
  status?: number
  data?: unknown

  constructor(message: string, status?: number, data?: unknown) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.data = data
  }
}

const baseURL =
  import.meta.env.VITE_API_URL ??
  import.meta.env.VITE_BACKEND_BASE_URL ??
  'http://localhost:8080'

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export function configureUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler
  isHandlingUnauthorized = false
}

export function resetUnauthorizedHandling() {
  isHandlingUnauthorized = false
}

export function clearAuthStorage() {
  sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
  sessionStorage.removeItem(AUTH_USER_STORAGE_KEY)
}

export function markSessionExpired() {
  sessionStorage.setItem(SESSION_EXPIRED_STORAGE_KEY, 'true')
}

export function clearSessionExpiredFlag() {
  sessionStorage.removeItem(SESSION_EXPIRED_STORAGE_KEY)
}

export function hasSessionExpiredFlag() {
  return sessionStorage.getItem(SESSION_EXPIRED_STORAGE_KEY) === 'true'
}

export function handleUnauthorizedSession(redirectPath = getCurrentPath()) {
  if (isHandlingUnauthorized) {
    return
  }

  isHandlingUnauthorized = true
  markSessionExpired()
  clearAuthStorage()

  if (unauthorizedHandler) {
    void unauthorizedHandler(redirectPath)
    return
  }

  if (typeof window !== 'undefined') {
    const safeRedirect =
      redirectPath && redirectPath !== '/login' && redirectPath !== '/register'
        ? redirectPath
        : '/'
    window.location.assign(`/login?redirect=${encodeURIComponent(safeRedirect)}`)
  }
}

apiClient.interceptors.request.use(config => {
  const token = sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  } else {
    config.headers.delete('Authorization')
  }
  return config
})

apiClient.interceptors.response.use(
  response => response,
  (error: AxiosError<BackendErrorResponse>) => {
    if (shouldHandleUnauthorized(error)) {
      handleUnauthorizedSession()
    }

    const message =
      error.response?.data?.message ??
      error.message ??
      'Request failed'
    return Promise.reject(
      new ApiClientError(message, error.response?.status, error.response?.data),
    )
  },
)

function shouldHandleUnauthorized(error: AxiosError<BackendErrorResponse>) {
  if (error.response?.status !== 401) {
    return false
  }

  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    return false
  }

  const url = error.config?.url ?? ''
  return !url.includes('/auth/login') && !url.includes('/auth/register')
}

function getCurrentPath() {
  if (typeof window === 'undefined') {
    return '/'
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}
