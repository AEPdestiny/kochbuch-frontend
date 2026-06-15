import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MealPlanView from '@/views/MealPlanView.vue'
import { mealPlanApi } from '@/shared/api/mealPlanApi'
import { recipeApi } from '@/shared/api/recipeApi'
import { profileApi } from '@/shared/api/profileApi'
import { i18n, setLocale } from '@/i18n'
import type { MealPlanWeekResponse } from '@/types/mealPlan'
import type { RecipeResponse } from '@/types/recipe'

vi.mock('@/shared/api/mealPlanApi', () => ({
  mealPlanApi: {
    getWeek: vi.fn(),
    setDay: vi.fn(),
    deleteDay: vi.fn(),
    setSlot: vi.fn(),
    deleteSlot: vi.fn(),
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

describe('MealPlanView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setLocale('de')
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue(weekResponse())
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([
      recipe(1, 'Pasta'),
      recipe(2, 'Soup'),
    ])
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([])
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(99, 'Sushi Bowl'),
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
    expect(wrapper.text()).toContain('600 kcal')
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

  it('sets an own recipe suggestion for a day', async () => {
    vi.useFakeTimers()
    vi.mocked(mealPlanApi.setSlot).mockResolvedValue(entry('2026-06-02', recipe(2, 'Soup'), 'breakfast'))
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

    const mondayCard = wrapper.findAll('.day-card')
      .find(card => card.text().includes('Montag'))!
    const inputs = mondayCard.findAll('input')
    const buttons = mondayCard.findAll('.slot-block .primary-button')
    await inputs[0]!.setValue('Fruehstueck frei')
    await buttons[0]!.trigger('click')
    await inputs[1]!.setValue('Lunch frei')
    await buttons[1]!.trigger('click')
    await inputs[2]!.setValue('Dinner frei')
    await buttons[2]!.trigger('click')
    await inputs[3]!.setValue('Snack frei')
    await buttons[3]!.trigger('click')
    await flushPromises()

    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-01', 'breakfast', {
      customTitle: 'Fruehstueck frei',
    })
    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-01', 'lunch', {
      customTitle: 'Lunch frei',
    })
    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-01', 'dinner', {
      customTitle: 'Dinner frei',
    })
    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-01', 'snack', {
      customTitle: 'Snack frei',
    })
  })

  it('uses external suggestions as custom text instead of fake recipe ids', async () => {
    vi.useFakeTimers()
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const tuesdayCard = wrapper.findAll('.day-card')
      .find(card => card.text().includes('Dienstag'))!
    await tuesdayCard.find('input').setValue('sushi')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    const externalButton = tuesdayCard.findAll('.suggestion-list button')
      .find(button => button.text().includes('Externer Vorschlag'))!
    await externalButton.trigger('click')

    expect(wrapper.text()).toContain('Externe Vorschläge werden aktuell als Freitext gespeichert.')
    expect((tuesdayCard.find('input').element as HTMLInputElement).value).toBe('Sushi Bowl')
    vi.useRealTimers()
  })

  it('loads swipe suggestions with profile filters and bucket counters', async () => {
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
    })
    expect(wrapper.text()).toContain('Dinner Pasta')
    expect(wrapper.text()).toContain('1/1')
  })

  it('skips to the next swipe suggestion', async () => {
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
  })

  it('accepts swipe suggestion as customTitle', async () => {
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(99, 'Pizza'),
    ])
    vi.mocked(mealPlanApi.setSlot).mockResolvedValue({
      id: 4,
      plannedDate: '2026-06-01',
      mealSlot: 'dinner',
      recipe: null,
      customTitle: 'Pizza',
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
    })
    expect(wrapper.text()).toContain('Pizza wurde für Abendessen am 2026-06-02 übernommen.')
  })

  it('shows empty state when swipe suggestions are empty', async () => {
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

  it('shows bucket full message when one swipe bucket has no free date', async () => {
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
    await wrapper.findAll('.swipe-card .primary-button').at(0)!.trigger('click')
    await flushPromises()

    expect(mealPlanApi.setSlot).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Dieser Bucket ist voll')
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
    await wrapper.find('.swipe-planner .primary-button').trigger('click')
    await flushPromises()
    await wrapper.findAll('.swipe-card .primary-button').at(0)!.trigger('click')
    await flushPromises()

    expect(mealPlanApi.setSlot).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Deine Woche ist vollständig geplant')
  })

  it('removes a planned recipe', async () => {
    vi.mocked(mealPlanApi.deleteSlot).mockResolvedValue()
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    await wrapper.find('.secondary-button').trigger('click')
    await flushPromises()

    expect(mealPlanApi.deleteSlot).toHaveBeenCalledWith('2026-06-01', 'dinner')
    expect(wrapper.find('.secondary-button').exists()).toBe(false)
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
    ...overrides,
  }
}
