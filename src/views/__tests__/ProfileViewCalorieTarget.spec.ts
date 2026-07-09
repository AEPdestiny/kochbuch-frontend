import { mount, flushPromises, config } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import ProfileView from '@/views/ProfileView.vue'
import { profileApi } from '@/shared/api/profileApi'
import { AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { i18n, setLocale } from '@/i18n'
import type { UserPreferencesResponse } from '@/types/profile'

vi.mock('@/shared/api/profileApi', () => ({
  profileApi: {
    getPreferences: vi.fn(),
    updatePreferences: vi.fn(),
  },
}))

describe('ProfileView optional calorie target', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    setLocale('de')
    const pinia = createPinia()
    setActivePinia(pinia)
    config.global.plugins = [i18n, pinia]
  })

  it('allows saving zero as optional daily calorie target', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(profileApi.getPreferences).mockResolvedValue(preferences({ dailyCalorieTarget: 2200, calorieGoal: 2200 }))
    vi.mocked(profileApi.updatePreferences).mockResolvedValue(preferences({ dailyCalorieTarget: 0, calorieGoal: 0 }))

    const wrapper = mount(ProfileView)
    await flushPromises()

    const calorieInput = wrapper.find('input[type="number"]')
    expect(calorieInput.attributes('min')).toBe('0')

    await calorieInput.setValue(0)
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(profileApi.updatePreferences).toHaveBeenCalledWith(expect.objectContaining({
      calorieGoal: 0,
      dailyCalorieTarget: 0,
    }))
    expect((calorieInput.element as HTMLInputElement).value).toBe('0')
  })

  it('allows saving an empty optional daily calorie target without restoring 2200', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(profileApi.getPreferences).mockResolvedValue(preferences({ dailyCalorieTarget: null, calorieGoal: null }))
    vi.mocked(profileApi.updatePreferences).mockResolvedValue(preferences({ dailyCalorieTarget: null, calorieGoal: null }))

    const wrapper = mount(ProfileView)
    await flushPromises()

    const calorieInput = wrapper.find('input[type="number"]')
    expect((calorieInput.element as HTMLInputElement).value).toBe('')

    await calorieInput.setValue('')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(profileApi.updatePreferences).toHaveBeenCalledWith(expect.objectContaining({
      calorieGoal: null,
      dailyCalorieTarget: null,
    }))
    expect((calorieInput.element as HTMLInputElement).value).toBe('')
    expect(wrapper.text()).not.toContain('2200')
  })
})

function preferences(overrides: Partial<UserPreferencesResponse> = {}): UserPreferencesResponse {
  return {
    likes: [],
    dislikes: [],
    allergies: [],
    vegan: false,
    vegetarian: false,
    glutenFree: false,
    lactoseFree: false,
    highProtein: false,
    calorieConscious: false,
    budgetFriendly: false,
    maxPrepTimeMinutes: null,
    calorieGoal: null,
    dailyCalorieTarget: null,
    ...overrides,
  }
}
