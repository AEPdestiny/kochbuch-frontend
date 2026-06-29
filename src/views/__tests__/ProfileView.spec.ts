import { mount, flushPromises, config } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import ProfileView from '@/views/ProfileView.vue'
import { profileApi } from '@/shared/api/profileApi'
import { ApiClientError, AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { i18n, setLocale } from '@/i18n'
import { useToastStore } from '@/stores/toastStore'
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
    const pinia = createPinia()
    setActivePinia(pinia)
    config.global.plugins = [i18n, pinia]
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
    expect(wrapper.text()).toContain('Geschmack')
    expect(wrapper.text()).toContain('Sicherheit')
    expect(wrapper.text()).toContain('Ernährungsweise')
    expect(wrapper.text()).toContain('Ziele')
    expect(wrapper.text()).toContain('Allergien werden immer berücksichtigt.')
  })

  it('renders the professional profile structure in English without German labels', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    setLocale('en')

    const wrapper = mount(ProfileView)
    await flushPromises()

    expect(wrapper.text()).toContain('Your food profile')
    expect(wrapper.text()).toContain('Taste')
    expect(wrapper.text()).toContain('Safety')
    expect(wrapper.text()).toContain('Dietary style')
    expect(wrapper.text()).toContain('Optional daily calorie target')
    expect(wrapper.text()).toContain('Allergies are always taken into account.')
    expect(wrapper.text()).not.toContain('Dein Ernährungsprofil')
    expect(wrapper.text()).not.toContain('kalorienarm')
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
        budgetFriendly: false,
        maxPrepTimeMinutes: null,
        dailyCalorieTarget: 2200,
      }),
    )
    // Success message is now a toast, not inline text
    const toastStore = useToastStore()
    expect(toastStore.toasts.some(t => t.type === 'success')).toBe(true)
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
  it('keeps removed prep time field hidden and stores manual daily target', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(profileApi.updatePreferences).mockResolvedValue({
      ...preferences(),
      maxPrepTimeMinutes: null,
      calorieGoal: null,
      dailyCalorieTarget: null,
    })

    const wrapper = mount(ProfileView)
    await flushPromises()

    const numberInputs = wrapper.findAll('input[type="number"]')
    expect(numberInputs).toHaveLength(1)
    await numberInputs.at(0)!.setValue(2100)
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(profileApi.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        maxPrepTimeMinutes: null,
        budgetFriendly: false,
        calorieGoal: 2100,
        dailyCalorieTarget: 2100,
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
    dailyCalorieTarget: 2200,
  }
}
