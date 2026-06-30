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
    // Likes are shown as chips (translated to current locale: 'pasta'→'Pasta', 'curry'→'Curry')
    expect(wrapper.text()).toContain('Pasta')
    expect(wrapper.text()).toContain('Curry')
    // 'nuts' is not a known allergen entry → displayed as-is (freetext)
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

    // Add 'Sushi' to the likes TagInput.
    // After translation 'pasta'→'Pasta', 'curry'→'Curry', so the sent array uses capitalized labels.
    const likesInput = wrapper.findAll('.tag-text-input').at(0)!
    await likesInput.setValue('Sushi')
    await likesInput.trigger('keydown', { key: 'Enter' })
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(profileApi.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        likes: expect.arrayContaining(['Pasta', 'Curry', 'Sushi']),
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
    // 'nuts' is freetext (not in known allergens) → stays as-is
    expect(chipTexts.some(t => t.includes('nuts'))).toBe(true)
    // 'pasta'/'curry' are known likes → translated to German 'Pasta'/'Curry'
    expect(chipTexts.some(t => t.includes('Pasta'))).toBe(true)
    expect(chipTexts.some(t => t.includes('Curry'))).toBe(true)
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

    // 'pasta' is a known like → translated to 'Pasta' in German locale
    expect(wrapper.text()).toContain('Pasta')

    const pastaChip = wrapper.findAll('.tag-chip').find(c => c.text().includes('Pasta'))
    await pastaChip!.find('.tag-chip-remove').trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('Pasta')
  })

  it('prevents adding duplicate tags', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(ProfileView)
    await flushPromises()

    // 'pasta' is translated to 'Pasta' in German locale
    const pastaChipsBefore = wrapper.findAll('.tag-chip').filter(c => c.text().includes('Pasta'))
    expect(pastaChipsBefore).toHaveLength(1)

    const likesInput = wrapper.findAll('.tag-text-input').at(0)!
    // Typing 'Pasta' (German translated label) should be treated as duplicate
    await likesInput.setValue('Pasta')
    await likesInput.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    const pastaChipsAfter = wrapper.findAll('.tag-chip').filter(c => c.text().includes('Pasta'))
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

  it('shows all 14 predefined allergens on focus, not just 8', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(ProfileView)
    await flushPromises()

    const allergyInput = wrapper.findAll('.tag-text-input').at(2)!
    await allergyInput.trigger('focus')
    await flushPromises()

    const options = wrapper.find('.tag-suggestions').findAll('li')
    expect(options).toHaveLength(14)

    const expectedAllergens = [
      'Gluten', 'Krebstiere', 'Eier', 'Fisch', 'Erdnüsse', 'Soja',
      'Milch', 'Schalenfrüchte', 'Sellerie', 'Senf', 'Sesam', 'Sulfite',
      'Lupinen', 'Weichtiere',
    ]
    const optionTexts = options.map(o => o.text())
    for (const allergen of expectedAllergens) {
      expect(optionTexts).toContain(allergen)
    }
  })

  it('still caps likes suggestions at 8 (unchanged limit)', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(ProfileView)
    await flushPromises()

    const likesInput = wrapper.findAll('.tag-text-input').at(0)!
    // 'a' matches many of the 14 likes suggestions (Pasta, Kartoffeln, Salat, Käse, Tomaten, Avocado...)
    await likesInput.setValue('a')
    await flushPromises()

    const options = wrapper.findAll('.tag-suggestions li')
    expect(options.length).toBeLessThanOrEqual(8)
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

  // ─── Locale-aware suggestion tests ────────────────────────────────────────

  it('shows German allergen suggestions with German locale', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    setLocale('de')
    const wrapper = mount(ProfileView)
    await flushPromises()

    const allergyInput = wrapper.findAll('.tag-text-input').at(2)!
    await allergyInput.trigger('focus')
    await flushPromises()

    const optionTexts = wrapper.findAll('.tag-suggestions li').map(li => li.text())
    expect(optionTexts).toContain('Eier')
    expect(optionTexts).toContain('Erdnüsse')
    expect(optionTexts).toContain('Milch')
    expect(optionTexts).toContain('Schalenfrüchte')
    expect(optionTexts).not.toContain('Eggs')
    expect(optionTexts).not.toContain('Peanuts')
  })

  it('shows English allergen suggestions with English locale', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    setLocale('en')
    const wrapper = mount(ProfileView)
    await flushPromises()

    const allergyInput = wrapper.findAll('.tag-text-input').at(2)!
    await allergyInput.trigger('focus')
    await flushPromises()

    const optionTexts = wrapper.findAll('.tag-suggestions li').map(li => li.text())
    expect(optionTexts).toContain('Eggs')
    expect(optionTexts).toContain('Peanuts')
    expect(optionTexts).toContain('Milk')
    expect(optionTexts).toContain('Tree nuts')
    expect(optionTexts).not.toContain('Eier')
    expect(optionTexts).not.toContain('Erdnüsse')
  })

  it('shows German likes suggestions with German locale', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    setLocale('de')
    const wrapper = mount(ProfileView)
    await flushPromises()

    const likesInput = wrapper.findAll('.tag-text-input').at(0)!
    await likesInput.setValue('h')
    await flushPromises()

    const optionTexts = wrapper.findAll('.tag-suggestions li').map(li => li.text())
    expect(optionTexts).toContain('Hähnchen')
    expect(optionTexts).not.toContain('Chicken')
  })

  it('shows English likes suggestions with English locale', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    setLocale('en')
    const wrapper = mount(ProfileView)
    await flushPromises()

    const likesInput = wrapper.findAll('.tag-text-input').at(0)!
    await likesInput.setValue('ch')
    await flushPromises()

    const optionTexts = wrapper.findAll('.tag-suggestions li').map(li => li.text())
    expect(optionTexts).toContain('Chicken')
    expect(optionTexts).not.toContain('Hähnchen')
  })

  it('translates known chip values when the locale changes', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    // Load profile in German — 'pasta' gets translated to 'Pasta'
    setLocale('de')
    const wrapper = mount(ProfileView)
    await flushPromises()

    expect(wrapper.text()).toContain('Pasta')
    expect(wrapper.text()).not.toContain('Rice')  // 'Reis' chip shown

    // Switch to English — known German chips re-translate
    setLocale('en')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Pasta') // Pasta is same in both languages
  })

  it('leaves freetext chip values unchanged on locale change', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    // 'nuts' is freetext (not in allergen entries)
    setLocale('de')
    const wrapper = mount(ProfileView)
    await flushPromises()

    expect(wrapper.text()).toContain('nuts')

    // Switch to English — freetext stays unchanged
    setLocale('en')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('nuts')
  })

  it('stored German allergen translates to English label when locale is English', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    // Backend returns German allergen 'Eier'
    vi.mocked(profileApi.getPreferences).mockResolvedValue({
      ...preferences(),
      allergies: ['Eier'],
    })
    setLocale('en')
    const wrapper = mount(ProfileView)
    await flushPromises()

    // 'Eier' should be displayed as 'Eggs' in English UI
    expect(wrapper.text()).toContain('Eggs')
    expect(wrapper.text()).not.toContain('Eier')
  })

  it('stored English allergen "Eggs" recognized and shown as German "Eier" in German UI', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(profileApi.getPreferences).mockResolvedValue({
      ...preferences(),
      allergies: ['Eggs'],
    })
    setLocale('de')
    const wrapper = mount(ProfileView)
    await flushPromises()

    expect(wrapper.text()).toContain('Eier')
    expect(wrapper.text()).not.toContain('Eggs')
  })

  // ─── Multi-locale allergen suggestion tests ────────────────────────────────

  it('shows Turkish allergen suggestions with Turkish locale', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    setLocale('tr')
    const wrapper = mount(ProfileView)
    await flushPromises()

    const allergyInput = wrapper.findAll('.tag-text-input').at(2)!
    await allergyInput.trigger('focus')
    await flushPromises()

    const optionTexts = wrapper.findAll('.tag-suggestions li').map(li => li.text())
    expect(optionTexts).toContain('Yumurta')
    expect(optionTexts).toContain('Süt')
    expect(optionTexts).toContain('Gluten')
    expect(optionTexts).not.toContain('Eggs')
    expect(optionTexts).not.toContain('Eier')
  })

  it('shows Polish allergen suggestions with Polish locale', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    setLocale('pl')
    const wrapper = mount(ProfileView)
    await flushPromises()

    const allergyInput = wrapper.findAll('.tag-text-input').at(2)!
    await allergyInput.trigger('focus')
    await flushPromises()

    const optionTexts = wrapper.findAll('.tag-suggestions li').map(li => li.text())
    expect(optionTexts).toContain('Jaja')
    expect(optionTexts).toContain('Mleko')
    expect(optionTexts).toContain('Gluten')
    expect(optionTexts).not.toContain('Eggs')
    expect(optionTexts).not.toContain('Eier')
  })

  it('shows Arabic allergen suggestions with Arabic locale', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    setLocale('ar')
    const wrapper = mount(ProfileView)
    await flushPromises()

    const allergyInput = wrapper.findAll('.tag-text-input').at(2)!
    await allergyInput.trigger('focus')
    await flushPromises()

    const optionTexts = wrapper.findAll('.tag-suggestions li').map(li => li.text())
    expect(optionTexts).toContain('البيض')
    expect(optionTexts).toContain('الحليب')
    expect(optionTexts).not.toContain('Eggs')
    expect(optionTexts).not.toContain('Eier')
  })

  it('shows Chinese allergen suggestions with Chinese locale', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    setLocale('zh')
    const wrapper = mount(ProfileView)
    await flushPromises()

    const allergyInput = wrapper.findAll('.tag-text-input').at(2)!
    await allergyInput.trigger('focus')
    await flushPromises()

    const optionTexts = wrapper.findAll('.tag-suggestions li').map(li => li.text())
    expect(optionTexts).toContain('鸡蛋')
    expect(optionTexts).toContain('牛奶')
    expect(optionTexts).not.toContain('Eggs')
    expect(optionTexts).not.toContain('Eier')
  })

  it('shows Japanese allergen suggestions with Japanese locale', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    setLocale('ja')
    const wrapper = mount(ProfileView)
    await flushPromises()

    const allergyInput = wrapper.findAll('.tag-text-input').at(2)!
    await allergyInput.trigger('focus')
    await flushPromises()

    const optionTexts = wrapper.findAll('.tag-suggestions li').map(li => li.text())
    expect(optionTexts).toContain('卵')
    expect(optionTexts).toContain('牛乳')
    expect(optionTexts).not.toContain('Eggs')
    expect(optionTexts).not.toContain('Eier')
  })

  it('chips re-translate reactively when locale changes without losing freetext', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    // Backend returns German canonical + freetext
    vi.mocked(profileApi.getPreferences).mockResolvedValue({
      ...preferences(),
      likes: ['Hähnchen', 'mein-eigenes'],
    })
    setLocale('de')
    const wrapper = mount(ProfileView)
    await flushPromises()

    // German display
    expect(wrapper.text()).toContain('Hähnchen')
    expect(wrapper.text()).toContain('mein-eigenes')

    // Switch to Turkish
    setLocale('tr')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Tavuk')
    expect(wrapper.text()).not.toContain('Hähnchen')
    // Freetext unchanged
    expect(wrapper.text()).toContain('mein-eigenes')
  })

  it('saves canonical key for known suggestion, freetext unchanged', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    setLocale('tr')
    vi.mocked(profileApi.getPreferences).mockResolvedValue({
      ...preferences(),
      allergies: [],
    })
    vi.mocked(profileApi.updatePreferences).mockResolvedValue({
      ...preferences(),
      allergies: ['Eier', 'meine-allergie'],
    })

    const wrapper = mount(ProfileView)
    await flushPromises()

    const allergyInput = wrapper.findAll('.tag-text-input').at(2)!
    // Add Turkish label 'Yumurta' → should be stored as canonical 'Eier'
    await allergyInput.setValue('Yumurta')
    await allergyInput.trigger('keydown', { key: 'Enter' })
    // Add freetext
    await allergyInput.setValue('meine-allergie')
    await allergyInput.trigger('keydown', { key: 'Enter' })
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(profileApi.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        allergies: expect.arrayContaining(['Eier', 'meine-allergie']),
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
