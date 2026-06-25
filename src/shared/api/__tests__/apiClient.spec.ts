import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUTH_TOKEN_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
  SESSION_EXPIRED_STORAGE_KEY,
  configureUnauthorizedHandler,
  handleUnauthorizedSession,
  resetUnauthorizedHandling,
} from '@/shared/api/apiClient'

describe('apiClient session handling', () => {
  beforeEach(() => {
    sessionStorage.clear()
    configureUnauthorizedHandler(null)
    resetUnauthorizedHandling()
    vi.clearAllMocks()
  })

  it('clears auth storage and redirects when a session expires', () => {
    const redirect = vi.fn()
    configureUnauthorizedHandler(redirect)
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'expired-token')
    sessionStorage.setItem(AUTH_USER_STORAGE_KEY, '{"id":1}')

    handleUnauthorizedSession('/meal-plan')

    expect(sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull()
    expect(sessionStorage.getItem(AUTH_USER_STORAGE_KEY)).toBeNull()
    expect(sessionStorage.getItem(SESSION_EXPIRED_STORAGE_KEY)).toBe('true')
    expect(redirect).toHaveBeenCalledWith('/meal-plan')
  })

  it('handles multiple parallel unauthorized responses only once', () => {
    const redirect = vi.fn()
    configureUnauthorizedHandler(redirect)

    handleUnauthorizedSession('/pantry')
    handleUnauthorizedSession('/shopping-list')

    expect(redirect).toHaveBeenCalledTimes(1)
    expect(redirect).toHaveBeenCalledWith('/pantry')
  })
})
