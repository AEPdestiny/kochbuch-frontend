import { mount, flushPromises, config } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProfileView from '@/views/ProfileView.vue'
import { profileApi } from '@/shared/api/profileApi'
import { ApiClientError, AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { i18n, setLocale } from '@/i18n'
import type { UserPreferencesResponse } from '@/types/profile'

vi.mock('@/shared/api/profileApi', () => ({
  profileApi: {
    getPreferences: vi.fn(),
    updatePreferences: vi.fn(),
  },
}))

describe('ProfileView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    setLocale('de')
    config.global.plugins = [i18n]
    vi.mocked(profileApi.getPreferences).mockResolvedValue(preferences())
  })

  it('shows login message and skips API call without token', async () => {
    const wrapper = mount(ProfileView)

    await flushPromises()

    expect(profileApi.getPreferences).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Bitte melde dich an, um dein Profil zu bearbeiten.')
  })

  it('loads and displays preferences with token', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')

    const wrapper = mount(ProfileView)
    await flushPromises()

    expect(profileApi.getPreferences).toHaveBeenCalledTimes(1)
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('pasta, curry')
    expect(wrapper.text()).toContain('Proteinreich')
  })

  it('saves preferences and shows success message', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(profileApi.updatePreferences).mockResolvedValue({
      ...preferences(),
      likes: ['sushi'],
    })

    const wrapper = mount(ProfileView)
    await flushPromises()

    await wrapper.find('textarea').setValue('sushi')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(profileApi.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        likes: ['sushi'],
        vegan: true,
        vegetarian: false,
        highProtein: true,
        goal: 'MAINTAIN',
        budgetFriendly: false,
        maxPrepTimeMinutes: null,
      }),
    )
    expect(wrapper.text()).toContain('Präferenzen wurden gespeichert.')
  })

  it('shows validation error from backend', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(profileApi.updatePreferences).mockRejectedValue(
      new ApiClientError('Validation failed', 400),
    )

    const wrapper = mount(ProfileView)
    await flushPromises()

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Validation failed')
  })
  it('keeps removed optional number fields hidden and stores neutral backend values', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(profileApi.updatePreferences).mockResolvedValue({
      ...preferences(),
      maxPrepTimeMinutes: null,
      calorieGoal: null,
      dailyCalorieTarget: null,
    })

    const wrapper = mount(ProfileView)
    await flushPromises()

    expect(wrapper.findAll('input[type="number"]')).toHaveLength(0)
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(profileApi.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        maxPrepTimeMinutes: null,
        budgetFriendly: false,
      }),
    )
  })
})

function preferences(): UserPreferencesResponse {
  return {
    likes: ['pasta', 'curry'],
    dislikes: ['mushrooms'],
    allergies: ['nuts'],
    vegan: true,
    vegetarian: false,
    glutenFree: true,
    lactoseFree: false,
    highProtein: true,
    calorieConscious: false,
    budgetFriendly: true,
    maxPrepTimeMinutes: 30,
    calorieGoal: 2200,
    goal: 'MAINTAIN',
    dailyCalorieTarget: 2200,
  }
}
