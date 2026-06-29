import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { config } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MealPlanView from '@/views/MealPlanView.vue'
import { mealPlanApi } from '@/shared/api/mealPlanApi'
import { recipeApi } from '@/shared/api/recipeApi'
import { profileApi } from '@/shared/api/profileApi'
import { ApiClientError } from '@/shared/api/apiClient'
import { i18n, setLocale } from '@/i18n'
import { useToastStore } from '@/stores/toastStore'
import type { MealPlanWeekResponse } from '@/types/mealPlan'
import type { RecipeResponse } from '@/types/recipe'

vi.mock('@/shared/api/mealPlanApi', () => ({
  mealPlanApi: {
    getWeek: vi.fn(),
    setDay: vi.fn(),
    deleteDay: vi.fn(),
    setSlot: vi.fn(),
    deleteSlot: vi.fn(),
    moveEntry: vi.fn(),
    createShoppingListFromWeek: vi.fn(),
  },
}))

vi.mock('@/shared/api/recipeApi', () => ({
  recipeApi: {
    getMyRecipes: vi.fn(),
    getPublishedRecipes: vi.fn(),
    getExternalRecipes: vi.fn(),
  },
}))

vi.mock('@/shared/api/profileApi', () => ({
  profileApi: {
    getPreferences: vi.fn(),
  },
}))

enableAutoUnmount(afterEach)

config.global.stubs = {
  RouterLink: {
    props: ['to'],
    template: '<a :href="typeof to === \'string\' ? to : to.path"><slot /></a>',
  },
}

describe('MealPlanView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setLocale('de')
    const pinia = createPinia()
    setActivePinia(pinia)
    config.global.plugins = [i18n, pinia]
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue(weekResponse())
    vi.mocked(mealPlanApi.createShoppingListFromWeek).mockResolvedValue({
      added: [],
      skippedBecauseInPantry: [],
      needsReview: [],
      alreadyOnShoppingList: [],
    })
    vi.mocked(mealPlanApi.moveEntry).mockResolvedValue(weekResponse())
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([
      recipe(1, 'Pasta'),
      recipe(2, 'Soup'),
    ])
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([])
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(99, 'Sushi Bowl', { calories: 450, imageUrl: 'https://example.com/sushi.jpg', externalId: 'ext-99', source: 'spoonacular' }),
    ])
    vi.mocked(profileApi.getPreferences).mockResolvedValue({
      likes: [],
      dislikes: [],
      allergies: [],
      vegan: false,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: false,
      highProtein: false,
      calorieConscious: false,
      budgetFriendly: false,
      maxPrepTimeMinutes: 30,
      calorieGoal: null,
      dailyCalorieTarget: 2000,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders seven week cards and search fields', async () => {
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Wochenplan')
    expect(wrapper.findAll('.day-card')).toHaveLength(7)
    expect(wrapper.text()).toContain('Montag')
    expect(wrapper.text()).toContain('Sonntag')
    expect(wrapper.text()).toContain('Frühstück')
    expect(wrapper.text()).toContain('Mittagessen')
    expect(wrapper.text()).toContain('Abendessen')
    expect(wrapper.text()).toContain('Snack')
    expect(wrapper.text()).toContain('Rezept suchen oder Freitext eingeben')
    expect(wrapper.text()).toContain('Manuell planen')
    expect(wrapper.text()).toContain('Swipe planen')
    expect(wrapper.text()).not.toContain('Gesamt-Kalorien')
    expect(wrapper.text()).toContain('Pasta')
    expect(wrapper.text()).toContain('600 / 2000 kcal')
  })

  it('switches between manual and swipe planning', async () => {
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })

    await flushPromises()

    expect(wrapper.findAll('.day-card')).toHaveLength(7)
    expect(wrapper.find('.swipe-planner').exists()).toBe(false)

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')

    expect(wrapper.findAll('.day-card')).toHaveLength(0)
    expect(wrapper.find('.swipe-planner').exists()).toBe(true)

    await wrapper.findAll('.mode-switch button').at(0)!.trigger('click')

    expect(wrapper.findAll('.day-card')).toHaveLength(7)
    expect(wrapper.find('.swipe-planner').exists()).toBe(false)
  })

  it('shows planned recipe and empty day state', async () => {
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Geplantes Rezept')
    expect(wrapper.text()).toContain('Pasta')
    expect(wrapper.text()).toContain('Noch kein Rezept geplant.')
  })

  it('keeps planned slots compact until edit is clicked', async () => {
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })

    await flushPromises()

    const mondayCard = wrapper.findAll('.day-card')
      .find(card => card.text().includes('Montag'))!
    const dinnerSlot = mondayCard.findAll('.slot-block')
      .find(slot => slot.text().includes('Abendessen'))!

    expect(dinnerSlot.text()).toContain('Pasta')
    expect(dinnerSlot.text()).toContain('Rezept ansehen')
    expect(dinnerSlot.text()).toContain('Bearbeiten')
    expect(dinnerSlot.find('input').exists()).toBe(false)
    expect(dinnerSlot.text()).not.toContain('Verschiebung speichern')

    await dinnerSlot.findAll('button')
      .find(button => button.text().includes('Bearbeiten'))!
      .trigger('click')

    expect(dinnerSlot.find('input').exists()).toBe(true)
    expect(dinnerSlot.text()).toContain('Speichern')
    expect(dinnerSlot.text()).toContain('Abbrechen')
    expect(dinnerSlot.text()).toContain('Verschieben')
  })

  it('links planned own recipe to the recipe detail page', async () => {
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })

    await flushPromises()

    const recipeLink = wrapper.findAll('.planned-link')
      .find(link => link.text().includes('Rezept ansehen'))!
    expect(recipeLink.exists()).toBe(true)
    expect(recipeLink.attributes('href')).toBe('/recipe/1')
  })

  it('moves a planned recipe to another day and slot', async () => {
    vi.mocked(mealPlanApi.moveEntry).mockResolvedValue({
      weekStart: '2026-06-01',
      weekEnd: '2026-06-07',
      entries: [entry('2026-06-02', recipe(1, 'Pasta'), 'breakfast')],
    })
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })

    await flushPromises()

    const mondayCard = wrapper.findAll('.day-card')
      .find(card => card.text().includes('Montag'))!
    const editButton = mondayCard.findAll('button')
      .find(button => button.text().includes('Bearbeiten'))!
    await editButton.trigger('click')

    const moveButton = mondayCard.findAll('button')
      .find(button => button.text().includes('Verschieben'))!
    await moveButton.trigger('click')

    const selects = mondayCard.findAll('.move-form select')
    await selects[0]!.setValue('2026-06-02')
    await selects[1]!.setValue('breakfast')
    await mondayCard.find('.move-form').trigger('submit')
    await flushPromises()

    expect(mealPlanApi.moveEntry).toHaveBeenCalledWith('2026-06-01', {
      targetDate: '2026-06-02',
      targetSlot: 'breakfast',
      swapIfOccupied: true,
    })
    expect(mealPlanApi.setSlot).not.toHaveBeenCalled()
    expect(mealPlanApi.deleteSlot).not.toHaveBeenCalled()
    expect(useToastStore().toasts.some(t => t.type === 'success')).toBe(true)
    expect(wrapper.text()).toContain('Pasta')
  })

  it('sets an own recipe suggestion for a day', async () => {
    vi.useFakeTimers()
    vi.mocked(mealPlanApi.setSlot).mockResolvedValue(entry('2026-06-02', recipe(2, 'Soup', { calories: 380, protein: 18 }), 'breakfast'))
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const tuesdayCard = wrapper.findAll('.day-card')
      .find(card => card.text().includes('Dienstag'))!
    await tuesdayCard.find('input').setValue('sou')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    await tuesdayCard.find('.suggestion-list button').trigger('click')
    await tuesdayCard.find('.primary-button').trigger('click')
    await flushPromises()

    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-02', 'breakfast', 2)
    expect(wrapper.text()).toContain('Soup')
    expect(wrapper.text()).toContain('380 / 2000 kcal')
    vi.useRealTimers()
  })

  it('sets custom title when no own recipe is selected', async () => {
    vi.mocked(mealPlanApi.setSlot).mockResolvedValue({
      id: 3,
      plannedDate: '2026-06-02',
      mealSlot: 'breakfast',
      recipe: null,
      customTitle: 'Sushi frei',
    })
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const tuesdayCard = wrapper.findAll('.day-card')
      .find(card => card.text().includes('Dienstag'))!
    await tuesdayCard.find('input').setValue('Sushi frei')
    await tuesdayCard.find('.primary-button').trigger('click')
    await flushPromises()

    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-02', 'breakfast', {
      customTitle: 'Sushi frei',
      caloriesSnapshot: null,
      proteinSnapshot: null,
      imageUrlSnapshot: null,
      externalRecipeId: null,
      externalSource: null,
    })
    expect(wrapper.text()).toContain('Sushi frei')
  })

  it('sets custom titles for breakfast, lunch, dinner and snack', async () => {
    vi.mocked(mealPlanApi.setSlot).mockImplementation(async (date, slot, payload) => ({
      id: `${date}-${slot}`,
      plannedDate: date,
      mealSlot: slot,
      recipe: null,
      customTitle: typeof payload === 'number' ? null : payload.customTitle,
    }))
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    let mondayCard = wrapper.findAll('.day-card')
      .find(card => card.text().includes('Montag'))!
    let slotBlocks = mondayCard.findAll('.slot-block')
    await slotBlocks[0]!.find('input').setValue('Fruehstueck frei')
    await slotBlocks[0]!.find('.primary-button').trigger('click')
    await flushPromises()

    mondayCard = wrapper.findAll('.day-card')
      .find(card => card.text().includes('Montag'))!
    slotBlocks = mondayCard.findAll('.slot-block')
    await slotBlocks[1]!.find('input').setValue('Lunch frei')
    await slotBlocks[1]!.find('.primary-button').trigger('click')
    await flushPromises()

    mondayCard = wrapper.findAll('.day-card')
      .find(card => card.text().includes('Montag'))!
    slotBlocks = mondayCard.findAll('.slot-block')
    await slotBlocks[2]!.findAll('button')
      .find(button => button.text().includes('Bearbeiten'))!
      .trigger('click')
    await slotBlocks[2]!.find('input').setValue('Dinner frei')
    await slotBlocks[2]!.find('.primary-button').trigger('click')
    await flushPromises()

    mondayCard = wrapper.findAll('.day-card')
      .find(card => card.text().includes('Montag'))!
    slotBlocks = mondayCard.findAll('.slot-block')
    await slotBlocks[3]!.find('input').setValue('Snack frei')
    await slotBlocks[3]!.find('.primary-button').trigger('click')
    await flushPromises()

    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-01', 'breakfast', {
      customTitle: 'Fruehstueck frei',
      caloriesSnapshot: null,
      proteinSnapshot: null,
      imageUrlSnapshot: null,
      externalRecipeId: null,
      externalSource: null,
    })
    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-01', 'lunch', {
      customTitle: 'Lunch frei',
      caloriesSnapshot: null,
      proteinSnapshot: null,
      imageUrlSnapshot: null,
      externalRecipeId: null,
      externalSource: null,
    })
    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-01', 'dinner', {
      customTitle: 'Dinner frei',
      caloriesSnapshot: null,
      proteinSnapshot: null,
      imageUrlSnapshot: null,
      externalRecipeId: null,
      externalSource: null,
    })
    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-01', 'snack', {
      customTitle: 'Snack frei',
      caloriesSnapshot: null,
      proteinSnapshot: null,
      imageUrlSnapshot: null,
      externalRecipeId: null,
      externalSource: null,
    })
  })

  it('uses public database suggestions as real recipe links with nutrition', async () => {
    vi.useFakeTimers()
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(99, 'Sushi Bowl', {
        calories: 450,
        protein: 24,
        imageUrl: 'https://example.com/sushi.jpg',
        externalId: 'seed-99',
        source: 'dishly',
        userCreated: false,
      }),
    ])
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const tuesdayCard = wrapper.findAll('.day-card')
      .find(card => card.text().includes('Dienstag'))!
    await tuesdayCard.find('input').setValue('sushi')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    const localButton = tuesdayCard.findAll('.suggestion-list button')
      .find(button => button.text().includes('Dishly-Rezept'))!
    expect(localButton.text()).toContain('450 kcal')
    expect(localButton.text()).toContain('24 g Protein')
    await localButton.trigger('click')

    expect(wrapper.text()).not.toContain('Dieser Vorschlag wird mit Kalorien/Protein als Freitext gespeichert.')
    expect((tuesdayCard.find('input').element as HTMLInputElement).value).toBe('Sushi Bowl')
    vi.mocked(mealPlanApi.setSlot).mockResolvedValue({
      id: 9,
      plannedDate: '2026-06-02',
      mealSlot: 'breakfast',
      recipe: recipe(99, 'Sushi Bowl', { calories: 450, protein: 24 }),
      customTitle: null,
      calories: 450,
    })
    await tuesdayCard.find('.primary-button').trigger('click')
    await flushPromises()
    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-02', 'breakfast', 99)
    expect(wrapper.text()).toContain('450 / 2000 kcal')
    expect(wrapper.findAll('.planned-link').some(link => link.attributes('href') === '/recipe/99')).toBe(true)
    vi.useRealTimers()
  })

  it('loads and limits randomized German autocomplete suggestions to five', async () => {
    vi.useFakeTimers()
    const matches = Array.from({ length: 6 }, (_, index) => (
      recipe(100 + index, `Sushi ${index + 1}`, { userCreated: false, language: 'de' })
    ))
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue(matches)
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    vi.mocked(recipeApi.getPublishedRecipes).mockClear()

    const input = wrapper.findAll('.day-card').at(1)!.find('input')
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99)
    await input.setValue('sush')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    const firstSuggestions = wrapper.findAll('.day-card').at(1)!.findAll('.suggestion-list button')
    expect(recipeApi.getPublishedRecipes).toHaveBeenCalledWith('de', 'sush')
    expect(firstSuggestions).toHaveLength(5)
    expect(firstSuggestions.map(button => button.text())).toEqual(expect.arrayContaining([
      expect.stringContaining('Sushi 1'),
      expect.stringContaining('Sushi 5'),
    ]))
    expect(firstSuggestions.map(button => button.text()).join(' ')).not.toContain('Sushi 6')

    randomSpy.mockReturnValue(0)
    await input.setValue('')
    await input.setValue('sush')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    const secondSuggestions = wrapper.findAll('.day-card').at(1)!.findAll('.suggestion-list button')
    expect(secondSuggestions).toHaveLength(5)
    expect(secondSuggestions.map(button => button.text()).join(' ')).toContain('Sushi 6')
    expect(secondSuggestions.map(button => button.text())).not.toEqual(firstSuggestions.map(button => button.text()))
    randomSpy.mockRestore()
  })

  it('uses the English locale for autocomplete searches', async () => {
    vi.useFakeTimers()
    setLocale('en')
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(110, 'Pasta Primavera', { userCreated: false, language: 'en' }),
    ])
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    vi.mocked(recipeApi.getPublishedRecipes).mockClear()

    const input = wrapper.findAll('.day-card').at(1)!.find('input')
    await input.setValue('pasta')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(recipeApi.getPublishedRecipes).toHaveBeenCalledWith('en', 'pasta')
    expect(wrapper.text()).toContain('Pasta Primavera')
  })

  it('does not search when the autocomplete query is cleared', async () => {
    vi.useFakeTimers()
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    vi.mocked(recipeApi.getPublishedRecipes).mockClear()

    const input = wrapper.findAll('.day-card').at(1)!.find('input')
    await input.setValue('sush')
    await input.setValue('')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(recipeApi.getPublishedRecipes).not.toHaveBeenCalled()
    expect(wrapper.findAll('.day-card').at(1)!.find('.suggestion-list').exists()).toBe(false)
  })

  it('keeps free-text planning available when autocomplete loading fails', async () => {
    vi.useFakeTimers()
    vi.mocked(recipeApi.getPublishedRecipes).mockImplementation(async (_language, search) => {
      if (search) throw new Error('search unavailable')
      return []
    })
    vi.mocked(mealPlanApi.setSlot).mockResolvedValue({
      id: 11,
      plannedDate: '2026-06-02',
      mealSlot: 'breakfast',
      recipe: null,
      customTitle: 'Sushi frei',
    })
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const tuesdayCard = wrapper.findAll('.day-card').at(1)!
    await tuesdayCard.find('input').setValue('Sushi frei')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(tuesdayCard.text()).toContain('Vorschläge konnten nicht geladen werden. Freitext bleibt möglich.')
    await tuesdayCard.find('.primary-button').trigger('click')
    await flushPromises()
    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-02', 'breakfast', {
      customTitle: 'Sushi frei',
      caloriesSnapshot: null,
      proteinSnapshot: null,
      imageUrlSnapshot: null,
      externalRecipeId: null,
      externalSource: null,
    })
  })

  it('loads swipe suggestions with profile filters and bucket counters', async () => {
    setLocale('en')
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(99, 'Dinner Pasta', { imageUrl: 'https://example.com/pasta.jpg', calories: 520 }),
    ])
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    await wrapper.find('.swipe-planner .primary-button').trigger('click')
    await flushPromises()

    expect(recipeApi.getExternalRecipes).toHaveBeenCalledWith(undefined, {
      vegan: undefined,
      vegetarian: true,
      glutenFree: true,
      maxPrepTime: 30,
    }, 'en')
    expect(wrapper.text()).toContain('Dinner Pasta')
    expect(wrapper.text()).toContain('1/1')
  })

  it('shows swipe suggestions even without ingredients', async () => {
    setLocale('en')
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(98, 'Invalid Local Suggestion', { ingredients: '' }),
    ])
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(99, 'Invalid External Suggestion', { ingredients: '' }),
    ])
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    await wrapper.find('.swipe-planner .primary-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Invalid Local Suggestion')
    expect(wrapper.text()).not.toContain('Keine Vorschläge gefunden.')
  })

  it('opens and closes bucket panels from real week state', async () => {
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    const dinnerBucket = wrapper.findAll('.bucket-card')
      .find(button => button.text().includes('Abendessen'))!
    await dinnerBucket.trigger('click')

    expect(wrapper.find('.bucket-panel').text()).toContain('Pasta')
    expect(wrapper.find('.bucket-panel').text()).toContain('Montag')
    expect(wrapper.find('.bucket-panel').text()).toContain('2026-06-01')
    expect(wrapper.find('.bucket-panel').text()).toContain('600 kcal')
    expect(wrapper.find('.bucket-panel').text()).toContain('24 g Protein')

    await dinnerBucket.trigger('click')
    expect(wrapper.find('.bucket-panel').exists()).toBe(false)

    const breakfastBucket = wrapper.findAll('.bucket-card')
      .find(button => button.text().includes('Frühstück'))!
    await breakfastBucket.trigger('click')
    expect(wrapper.find('.bucket-panel').text()).toContain('Noch keine Rezepte in diesem Bucket.')
  })

  it('removes an entry from an opened bucket panel and updates the counter', async () => {
    vi.mocked(mealPlanApi.deleteSlot).mockResolvedValue()
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    const dinnerBucket = wrapper.findAll('.bucket-card')
      .find(button => button.text().includes('Abendessen'))!
    expect(dinnerBucket.text()).toContain('1/7')
    await dinnerBucket.trigger('click')

    const removeButton = wrapper.findAll('.bucket-panel .secondary-button')
      .find(button => button.text().includes('Entfernen'))!
    await removeButton.trigger('click')
    await flushPromises()

    expect(mealPlanApi.deleteSlot).toHaveBeenCalledWith('2026-06-01', 'dinner')
    expect(useToastStore().toasts.some(t => t.type === 'info')).toBe(true)
    expect(wrapper.find('.bucket-panel').text()).toContain('Noch keine Rezepte in diesem Bucket.')
    const updatedDinnerBucket = wrapper.findAll('.bucket-card')
      .find(button => button.text().includes('Abendessen'))!
    expect(updatedDinnerBucket.text()).toContain('0/7')
  })

  it('skips to the next swipe suggestion', async () => {
    setLocale('en')
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99)
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(99, 'Pizza'),
      recipe(100, 'Burger'),
    ])
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    await wrapper.find('.swipe-planner .primary-button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Pizza')

    await wrapper.findAll('.swipe-card .secondary-button').at(0)!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Burger')
    expect(wrapper.text()).toContain('2/2')
    randomSpy.mockRestore()
  })

  it('accepts swipe suggestion as customTitle', async () => {
    setLocale('en')
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(99, 'Pizza', { calories: 700, protein: 32.4, imageUrl: 'https://example.com/pizza.jpg', externalId: 'ext-pizza', source: 'spoonacular' }),
    ])
    vi.mocked(mealPlanApi.setSlot).mockResolvedValue({
      id: 4,
      plannedDate: '2026-06-01',
      mealSlot: 'dinner',
      recipe: null,
      customTitle: 'Pizza',
      calories: 700,
      caloriesSnapshot: 700,
      proteinSnapshot: 32.4,
    })
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    await wrapper.find('.swipe-planner .primary-button').trigger('click')
    await flushPromises()
    await wrapper.findAll('.swipe-card .primary-button').at(0)!.trigger('click')
    await flushPromises()

    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-02', 'dinner', {
      customTitle: 'Pizza',
      caloriesSnapshot: 700,
      proteinSnapshot: 32.4,
      imageUrlSnapshot: 'https://example.com/pizza.jpg',
      externalRecipeId: 'ext-pizza',
      externalSource: 'spoonacular',
    })
    expect(wrapper.text()).toContain('32 g Protein')
    expect(useToastStore().toasts.some(t => t.type === 'success')).toBe(true)
  })

  it('keeps bucket panel closed after accepting a suggestion into a full bucket', async () => {
    setLocale('en')
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
      weekStart: '2026-06-01',
      weekEnd: '2026-06-07',
      entries: [
        entry('2026-06-01', recipe(1, 'Dinner 1'), 'dinner'),
        entry('2026-06-02', recipe(2, 'Dinner 2'), 'dinner'),
        entry('2026-06-03', recipe(3, 'Dinner 3'), 'dinner'),
        entry('2026-06-04', recipe(4, 'Dinner 4'), 'dinner'),
      ],
    })
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(99, 'Pizza', { calories: 700 }),
    ])
    vi.mocked(mealPlanApi.setSlot).mockResolvedValue({
      id: 4,
      plannedDate: '2026-06-05',
      mealSlot: 'dinner',
      recipe: null,
      customTitle: 'Pizza',
      calories: 700,
      caloriesSnapshot: 700,
    })
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    await wrapper.find('.swipe-planner .primary-button').trigger('click')
    await flushPromises()
    await wrapper.findAll('.swipe-card .primary-button').at(0)!.trigger('click')
    await flushPromises()

    expect(wrapper.find('.bucket-panel').exists()).toBe(false)
  })

  it('uses published database recipes before calling external swipe suggestions', async () => {
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(88, 'DB Lunch Bowl', { category: 'lunch', calories: 530 }),
    ])
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    await wrapper.find('.swipe-planner .primary-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('DB Lunch Bowl')
    expect(recipeApi.getExternalRecipes).not.toHaveBeenCalledWith(undefined, {
      vegan: undefined,
      vegetarian: true,
      glutenFree: true,
      maxPrepTime: 30,
    })
  })

  it('shows empty state when swipe suggestions are empty', async () => {
    setLocale('en')
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([])
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    await wrapper.find('.swipe-planner .primary-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Keine Vorschläge gefunden.')
  })

  it('shows error when swipe suggestions fail', async () => {
    setLocale('en')
    vi.mocked(recipeApi.getExternalRecipes).mockRejectedValue(new Error('Spoonacular unavailable'))
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    await wrapper.find('.swipe-planner .primary-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Vorschläge konnten nicht geladen werden.')
  })

  it('does not load external swipe suggestions for German locale', async () => {
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([])
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    await wrapper.find('.swipe-planner .primary-button').trigger('click')
    await flushPromises()

    expect(recipeApi.getPublishedRecipes).toHaveBeenCalledWith('de')
    expect(recipeApi.getExternalRecipes).not.toHaveBeenCalledWith(undefined, {
      vegan: undefined,
      vegetarian: true,
      glutenFree: true,
      maxPrepTime: 30,
    }, 'en')
    expect(wrapper.text()).toContain('Für diese Sprache sind noch keine lokalen Rezepte verfügbar.')
  })

  it('hides full bucket suggestions when one swipe bucket has no free date', async () => {
    setLocale('en')
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue(fullSlotWeekResponse('dinner'))
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(99, 'Dinner Pasta'),
    ])
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    await wrapper.find('.swipe-planner .primary-button').trigger('click')
    await flushPromises()
    expect(mealPlanApi.setSlot).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Keine Vorschläge gefunden.')
  })

  it('shows completion message when all swipe buckets are full', async () => {
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue(fullWeekResponse())
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(99, 'Dinner Pasta'),
    ])
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')

    expect(mealPlanApi.setSlot).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Glückwunsch! Deine Woche ist vollständig geplant.')
    expect(wrapper.find('.swipe-card').exists()).toBe(false)
    expect(wrapper.text()).toContain('Rezepte verwalten')
  })

  it('clears all 28 week slots and reloads the week', async () => {
    vi.mocked(mealPlanApi.getWeek)
      .mockResolvedValueOnce(weekResponse())
      .mockResolvedValueOnce(emptyWeekResponse())
    vi.mocked(mealPlanApi.deleteSlot).mockResolvedValue()
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    await wrapper.find('.clear-week-button').trigger('click')
    await flushPromises()

    expect(mealPlanApi.deleteSlot).toHaveBeenCalledTimes(28)
    expect(mealPlanApi.deleteSlot).toHaveBeenCalledWith('2026-06-01', 'breakfast')
    expect(mealPlanApi.deleteSlot).toHaveBeenCalledWith('2026-06-01', 'lunch')
    expect(mealPlanApi.deleteSlot).toHaveBeenCalledWith('2026-06-01', 'dinner')
    expect(mealPlanApi.deleteSlot).toHaveBeenCalledWith('2026-06-07', 'snack')
    expect(mealPlanApi.getWeek).toHaveBeenLastCalledWith('2026-06-01')
    expect(useToastStore().toasts.some(t => t.message.includes('geleert') || t.type === 'info')).toBe(true)
    expect(wrapper.text()).not.toContain('Pasta')
  })

  it('creates a shopping list from the current week and shows the transparent result', async () => {
    vi.mocked(mealPlanApi.createShoppingListFromWeek).mockResolvedValue({
      added: [{ name: 'Tomaten', quantity: 200, unit: 'g', recipeTitle: 'Pasta' }],
      skippedBecauseInPantry: [{ name: 'Eier', quantity: 2, unit: 'Stück', recipeTitle: 'Omelett' }],
      needsReview: [{ name: 'Butter', quantity: 1, unit: 'EL', recipeTitle: 'Pasta', reason: 'Einheiten sind nicht sicher vergleichbar.' }],
      alreadyOnShoppingList: [{ name: 'Reis', quantity: 200, unit: 'g', recipeTitle: 'Bowl' }],
    })
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const createButton = wrapper.findAll('button')
      .find(button => button.text().includes('Einkaufsliste aus Wochenplan erstellen'))!
    await createButton.trigger('click')
    await flushPromises()

    expect(mealPlanApi.createShoppingListFromWeek).toHaveBeenCalledWith('2026-06-01')
    expect(useToastStore().toasts.some(t => t.type === 'success')).toBe(true)
    expect(wrapper.find('.shopping-summary-chips').exists()).toBe(true)
    expect(wrapper.findAll('.shopping-result-section')).toHaveLength(4)
    expect(wrapper.text()).toContain('Hinzugefügt (1)')
    expect(wrapper.text()).toContain('Schon im Vorrat (1)')
    expect(wrapper.text()).toContain('Bereits auf Einkaufsliste (1)')
    expect(wrapper.text()).toContain('Menge prüfen (1)')
    expect(wrapper.find('.shopping-list-result-header a').attributes('href')).toBe('/shopping-list')
    expect(wrapper.text()).toContain('200 g Tomaten')
    expect(wrapper.text()).toContain('2 Stück Eier')
    expect(wrapper.text()).toContain('1 EL Butter')
    expect(wrapper.text()).toContain('200 g Reis')
    expect(wrapper.text()).toContain('Einheiten sind nicht sicher vergleichbar.')
  })

  it('keeps empty shopping list result categories compact', async () => {
    vi.mocked(mealPlanApi.createShoppingListFromWeek).mockResolvedValue({
      added: [{ name: 'Tomaten', quantity: 200, unit: 'g', recipeTitle: 'Pasta' }],
      skippedBecauseInPantry: [],
      needsReview: [],
      alreadyOnShoppingList: [],
    })
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const createButton = wrapper.findAll('button')
      .find(button => button.text().includes('Einkaufsliste aus Wochenplan erstellen'))!
    await createButton.trigger('click')
    await flushPromises()

    const sections = wrapper.findAll('.shopping-result-section')
    expect(sections).toHaveLength(4)
    expect(sections[0]!.attributes('open')).toBeDefined()
    expect(sections[1]!.attributes('open')).toBeUndefined()
    expect(wrapper.text()).toContain('Hinzugefügt (1)')
    expect(wrapper.text()).toContain('Schon im Vorrat (0)')
    expect(wrapper.text()).toContain('Bereits auf Einkaufsliste (0)')
    expect(wrapper.text()).toContain('Menge prüfen (0)')
    expect(wrapper.text()).toContain('Keine Einträge.')
    expect(wrapper.text()).toContain('200 g Tomaten')
  })

  it('treats 404 while clearing already empty slots as success when the reloaded week is empty', async () => {
    vi.mocked(mealPlanApi.getWeek)
      .mockResolvedValueOnce(weekResponse())
      .mockResolvedValueOnce(emptyWeekResponse())
    vi.mocked(mealPlanApi.deleteSlot).mockImplementation(async (_date, slot) => {
      if (slot === 'breakfast' || slot === 'lunch' || slot === 'snack') {
        throw new ApiClientError('Not Found', 404)
      }
    })
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    await wrapper.find('.clear-week-button').trigger('click')
    await flushPromises()

    expect(mealPlanApi.deleteSlot).toHaveBeenCalledTimes(28)
    expect(useToastStore().toasts.some(t => t.type === 'info')).toBe(true)
    expect(wrapper.text()).not.toContain('Einige Slots konnten nicht gelöscht werden.')
    expect(wrapper.text()).not.toContain('Pasta')
  })

  it('shows a visible error when clearing the week fails', async () => {
    vi.mocked(mealPlanApi.deleteSlot).mockRejectedValue(new Error('delete failed'))
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue(weekResponse())
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    await wrapper.find('.clear-week-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Einige Slots konnten nicht gelöscht werden.')
  })

  it('removes a planned recipe', async () => {
    vi.mocked(mealPlanApi.deleteSlot).mockResolvedValue()
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const removeButton = wrapper.findAll('button')
      .find(button => button.text().includes('Entfernen'))!
    await removeButton.trigger('click')
    await flushPromises()

    expect(mealPlanApi.deleteSlot).toHaveBeenCalledWith('2026-06-01', 'dinner')
    expect(wrapper.findAll('button').some(button => button.text().includes('Entfernen'))).toBe(false)
  })

  it('shows empty state when no own recipes exist', async () => {
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([])
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Du hast noch keine eigenen Rezepte zum Planen.')
  })

  it('renders English labels', async () => {
    setLocale('en')
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Meal Plan')
    expect(wrapper.text()).toContain('Monday')
    expect(wrapper.text()).toContain('Rezept suchen oder Freitext eingeben')
  })
})

function weekResponse(): MealPlanWeekResponse {
  return {
    weekStart: '2026-06-01',
    weekEnd: '2026-06-07',
    entries: [entry('2026-06-01', recipe(1, 'Pasta'), 'dinner')],
  }
}

function emptyWeekResponse(): MealPlanWeekResponse {
  return {
    weekStart: '2026-06-01',
    weekEnd: '2026-06-07',
    entries: [],
  }
}

function fullSlotWeekResponse(mealSlot = 'dinner'): MealPlanWeekResponse {
  const dates = [
    '2026-06-01',
    '2026-06-02',
    '2026-06-03',
    '2026-06-04',
    '2026-06-05',
    '2026-06-06',
    '2026-06-07',
  ]
  return {
    weekStart: '2026-06-01',
    weekEnd: '2026-06-07',
    entries: dates.map((date, index) => entry(date, recipe(200 + index, `Dinner ${index}`), mealSlot)),
  }
}

function fullWeekResponse(): MealPlanWeekResponse {
  const dates = [
    '2026-06-01',
    '2026-06-02',
    '2026-06-03',
    '2026-06-04',
    '2026-06-05',
    '2026-06-06',
    '2026-06-07',
  ]
  const slots = ['breakfast', 'lunch', 'dinner', 'snack']
  return {
    weekStart: '2026-06-01',
    weekEnd: '2026-06-07',
    entries: slots.flatMap((slot, slotIndex) => (
      dates.map((date, index) => entry(date, recipe(300 + slotIndex * 10 + index, `${slot} ${index}`), slot))
    )),
  }
}

function entry(plannedDate: string, recipeResponse: RecipeResponse, mealSlot = 'dinner') {
  return {
    id: plannedDate,
    plannedDate,
    mealSlot,
    recipe: recipeResponse,
    calories: recipeResponse.calories,
  }
}

function recipe(id: number, title: string, overrides: Partial<RecipeResponse> = {}): RecipeResponse {
  return {
    id,
    title,
    imageUrl: '',
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    servings: 2,
    difficulty: 'easy',
    category: 'Italian',
    rating: 4.5,
    ingredients: 'noodles',
    instructions: 'cook',
    favorite: false,
    published: true,
    calories: 600,
    protein: 24,
    ...overrides,
  }
}
