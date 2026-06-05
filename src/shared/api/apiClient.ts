import axios, { AxiosError } from 'axios'

export const AUTH_TOKEN_STORAGE_KEY = 'dishly.auth.token'
export const AUTH_USER_STORAGE_KEY = 'dishly.auth.user'

type BackendErrorResponse = {
  message?: string
  status?: number
  error?: string
  path?: string
}

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
    const message =
      error.response?.data?.message ??
      error.message ??
      'Request failed'
    return Promise.reject(
      new ApiClientError(message, error.response?.status, error.response?.data),
    )
  },
)
