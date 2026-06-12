import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MealPlanView from '@/views/MealPlanView.vue'
import { mealPlanApi } from '@/shared/api/mealPlanApi'
import { recipeApi } from '@/shared/api/recipeApi'
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
    getExternalRecipes: vi.fn(),
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
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(99, 'Sushi Bowl'),
    ])
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
    expect(wrapper.text()).toContain('Pasta')
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

function entry(plannedDate: string, recipeResponse: RecipeResponse, mealSlot = 'dinner') {
  return {
    id: plannedDate,
    plannedDate,
    mealSlot,
    recipe: recipeResponse,
  }
}

function recipe(id: number, title: string): RecipeResponse {
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
  }
}
