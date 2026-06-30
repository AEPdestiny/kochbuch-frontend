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
    // Likes are now shown as chips, not textarea text
    expect(wrapper.text()).toContain('pasta')
    expect(wrapper.text()).toContain('curry')
    // Allergy chip
    expect(wrapper.text()).toContain('nuts')
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
      likes: ['pasta', 'curry', 'sushi'],
    })

    const wrapper = mount(ProfileView)
    await flushPromises()

    // Add 'sushi' to the likes TagInput (first .tag-text-input in the form)
    const likesInput = wrapper.findAll('.tag-text-input').at(0)!
    await likesInput.setValue('sushi')
    await likesInput.trigger('keydown', { key: 'Enter' })
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(profileApi.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        likes: expect.arrayContaining(['pasta', 'curry', 'sushi']),
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

  it('loads existing allergies as chips in the TagInput', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(ProfileView)
    await flushPromises()

    const chips = wrapper.findAll('.tag-chip')
    const chipTexts = chips.map(c => c.text())
    expect(chipTexts.some(t => t.includes('nuts'))).toBe(true)
    expect(chipTexts.some(t => t.includes('pasta'))).toBe(true)
    expect(chipTexts.some(t => t.includes('curry'))).toBe(true)
  })

  it('adds a new allergy chip via Enter key', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(profileApi.updatePreferences).mockResolvedValue({
      ...preferences(),
      allergies: ['nuts', 'Eier'],
    })
    const wrapper = mount(ProfileView)
    await flushPromises()

    // The allergies TagInput is the third one (after likes, dislikes)
    const allergyInput = wrapper.findAll('.tag-text-input').at(2)!
    await allergyInput.setValue('Eier')
    await allergyInput.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.text()).toContain('Eier')
  })

  it('adds a new tag via Comma key', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(ProfileView)
    await flushPromises()

    const likesInput = wrapper.findAll('.tag-text-input').at(0)!
    await likesInput.setValue('Sushi')
    await likesInput.trigger('keydown', { key: ',' })
    await flushPromises()

    expect(wrapper.text()).toContain('Sushi')
  })

  it('removes a chip on click of the × button', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(ProfileView)
    await flushPromises()

    expect(wrapper.text()).toContain('pasta')

    const pastaChip = wrapper.findAll('.tag-chip').find(c => c.text().includes('pasta'))
    await pastaChip!.find('.tag-chip-remove').trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('pasta')
  })

  it('prevents adding duplicate tags', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(ProfileView)
    await flushPromises()

    const pastaChipsBefore = wrapper.findAll('.tag-chip').filter(c => c.text().includes('pasta'))
    expect(pastaChipsBefore).toHaveLength(1)

    const likesInput = wrapper.findAll('.tag-text-input').at(0)!
    await likesInput.setValue('pasta')
    await likesInput.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    const pastaChipsAfter = wrapper.findAll('.tag-chip').filter(c => c.text().includes('pasta'))
    expect(pastaChipsAfter).toHaveLength(1)
  })

  it('shows allergen suggestions from the predefined list on focus', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(ProfileView)
    await flushPromises()

    const allergyInput = wrapper.findAll('.tag-text-input').at(2)!
    await allergyInput.trigger('focus')
    await flushPromises()

    // With showSuggestionsOnFocus=true, suggestions should appear on focus
    const suggestions = wrapper.find('.tag-suggestions')
    expect(suggestions.exists()).toBe(true)
    expect(suggestions.text()).toContain('Gluten')
    expect(suggestions.text()).toContain('Milch')
    expect(suggestions.text()).toContain('Fisch')
  })

  it('selects a predefined allergen from the suggestion list', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(ProfileView)
    await flushPromises()

    const allergyInput = wrapper.findAll('.tag-text-input').at(2)!
    await allergyInput.trigger('focus')
    await flushPromises()

    const glutenOption = wrapper.findAll('.tag-suggestions li').find(li => li.text() === 'Gluten')
    expect(glutenOption).toBeTruthy()
    await glutenOption!.trigger('mousedown')
    await flushPromises()

    expect(wrapper.text()).toContain('Gluten')
  })

  it('sends allergies as a string array to the backend', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(profileApi.updatePreferences).mockResolvedValue({
      ...preferences(),
      allergies: ['nuts', 'Eier'],
    })
    const wrapper = mount(ProfileView)
    await flushPromises()

    const allergyInput = wrapper.findAll('.tag-text-input').at(2)!
    await allergyInput.setValue('Eier')
    await allergyInput.trigger('keydown', { key: 'Enter' })
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(profileApi.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        allergies: expect.arrayContaining(['nuts', 'Eier']),
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
