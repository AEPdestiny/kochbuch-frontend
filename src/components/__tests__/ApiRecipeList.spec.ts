import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ApiRecipeList from '@/components/ApiRecipeList.vue'
import { recipeApi } from '@/shared/api/recipeApi'
import { profileApi } from '@/shared/api/profileApi'
import { pantryApi } from '@/shared/api/pantryApi'
import { favoriteApi } from '@/shared/api/favoriteApi'
import { mealPlanApi } from '@/shared/api/mealPlanApi'
import { useAuthStore } from '@/stores/authStore'
import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from '@/shared/api/apiClient'
import { i18n, setLocale } from '@/i18n'
import type { Recipe } from '@/types/recipe'

vi.mock('@/shared/api/recipeApi', () => ({
  recipeApi: {
    getPublishedRecipes: vi.fn(),
    getExternalRecipes: vi.fn(),
  },
}))

vi.mock('@/shared/api/profileApi', () => ({
  profileApi: {
    getPreferences: vi.fn(),
  },
}))

vi.mock('@/shared/api/pantryApi', () => ({
  pantryApi: {
    getPantryItems: vi.fn(),
  },
}))

vi.mock('@/shared/api/favoriteApi', () => ({
  favoriteApi: {
    getExternalFavorites: vi.fn(),
  },
}))

vi.mock('@/shared/api/mealPlanApi', () => ({
  mealPlanApi: {
    getWeek: vi.fn(),
  },
}))

function recipe(overrides: Partial<Recipe>): Recipe {
  return {
    id: overrides.id ?? Math.random(),
    title: 'Recipe',
    imageUrl: '',
    prepTimeMinutes: 10,
    cookTimeMinutes: 10,
    servings: 2,
    difficulty: 'easy',
    category: 'dinner',
    rating: 0,
    ingredients: '',
    instructions: '',
    favorite: false,
    published: true,
    calories: null,
    protein: null,
    ...overrides,
  }
}

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
}

describe('ApiRecipeList', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    vi.clearAllMocks()
    setLocale('de')
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([])
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([])
    vi.mocked(profileApi.getPreferences).mockRejectedValue(new Error('no profile'))
    vi.mocked(pantryApi.getPantryItems).mockRejectedValue(new Error('no pantry'))
    vi.mocked(favoriteApi.getExternalFavorites).mockResolvedValue([])
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({ weekStart: '', weekEnd: '', entries: [] })
  })

  it('clears the search input when the auth store logs out, even though the component stays mounted', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify({ id: 1, username: 'salma', email: 'a@b.de', role: 'USER', createdAt: '2026-01-01T00:00:00Z' }))
    const authStore = useAuthStore()
    authStore.initFromStorage()

    const wrapper = mount(ApiRecipeList, { global: { plugins: [i18n, testRouter()] } })
    await flushPromises()

    const searchInput = wrapper.find('.search-input')
    await searchInput.setValue('Pasta Carbonara')
    expect((searchInput.element as HTMLInputElement).value).toBe('Pasta Carbonara')

    authStore.logout()
    await flushPromises()

    expect((wrapper.find('.search-input').element as HTMLInputElement).value).toBe('')
  })

  it('remains reactive after search moved to the store: typing still filters as before', async () => {
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe({ id: 1, title: 'Spaghetti Carbonara' }),
      recipe({ id: 2, title: 'Chicken Curry' }),
    ])

    const wrapper = mount(ApiRecipeList, { global: { plugins: [i18n, testRouter()] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Spaghetti Carbonara')
    expect(wrapper.text()).toContain('Chicken Curry')
  })

  it('sorts ascending by calories when "kalorienarm" is checked alone (via the automatic caloriesAsc sort)', async () => {
    // calorieConscious also hard-filters out recipes > 650 kcal, so all three stay under that limit here —
    // this test is only about the *ordering* of the remaining recipes, not the filter itself.
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe({ id: 1, title: 'High Cal Dish', calories: 600 }),
      recipe({ id: 2, title: 'Low Cal Dish', calories: 200 }),
      recipe({ id: 3, title: 'Mid Cal Dish', calories: 400 }),
    ])

    const wrapper = mount(ApiRecipeList, { global: { plugins: [i18n, testRouter()] } })
    await flushPromises()

    // Filters live in a drawer now — open it before interacting with the checkboxes.
    await wrapper.find('.filter-trigger').trigger('click')
    await flushPromises()

    // Order in the template: vegan, vegetarian, glutenFree, lactoseFree, calorieConscious, highProtein.
    const calorieCheckbox = wrapper.findAll('.filter-panel input[type="checkbox"]')[4]!
    await calorieCheckbox.setValue(true)
    await flushPromises()

    const titles = wrapper.findAll('.card-title').map(el => el.text())
    expect(titles).toEqual(['Low Cal Dish', 'Mid Cal Dish', 'High Cal Dish'])
  })

  describe('category-aware search', () => {
    it('category alias search queries the backend once per real match term and merges results', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      try {
        vi.mocked(recipeApi.getPublishedRecipes).mockImplementation(async (_lang, search) => {
          if (search === 'pasta') return [recipe({ id: 1, title: 'Pasta Salat' })]
          if (search === 'nudel') return [recipe({ id: 2, title: 'Nudelauflauf' })]
          return []
        })

        const wrapper = mount(ApiRecipeList, { global: { plugins: [i18n, testRouter()] } })
        await flushPromises()

        await wrapper.find('.search-input').setValue('Pasta')
        await vi.advanceTimersByTimeAsync(500)
        await flushPromises()

        expect(recipeApi.getPublishedRecipes).toHaveBeenCalledWith('de', 'pasta')
        expect(recipeApi.getPublishedRecipes).toHaveBeenCalledWith('de', 'nudel')
        expect(wrapper.text()).toContain('Pasta Salat')
        expect(wrapper.text()).toContain('Nudelauflauf')
      } finally {
        vi.useRealTimers()
      }
    })

    it('non-category free text search is sent literally to the backend unchanged', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      try {
        vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
          recipe({ id: 1, title: 'Tomatensuppe' }),
        ])

        const wrapper = mount(ApiRecipeList, { global: { plugins: [i18n, testRouter()] } })
        await flushPromises()
        vi.mocked(recipeApi.getPublishedRecipes).mockClear()

        await wrapper.find('.search-input').setValue('Tomaten')
        await vi.advanceTimersByTimeAsync(500)
        await flushPromises()

        // Exactly one call for the literal query — no category fan-out for a non-category term.
        expect(recipeApi.getPublishedRecipes).toHaveBeenCalledWith('de', 'tomaten')
        expect(recipeApi.getPublishedRecipes).toHaveBeenCalledTimes(1)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('pagination scroll behavior', () => {
    function manyRecipes(count: number) {
      return Array.from({ length: count }, (_, i) => recipe({ id: i + 1, title: `Recipe ${i + 1}` }))
    }

    it('does not scroll on initial load', async () => {
      vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue(manyRecipes(35))
      const scrollSpy = vi.fn()
      vi.stubGlobal('scrollTo', scrollSpy)

      try {
        mount(ApiRecipeList, { global: { plugins: [i18n, testRouter()] } })
        await flushPromises()

        // scrollTo is stubbed for the whole mount, so this proves no scroll happens
        // on initial render — combined with the "smooth scroll" test below (which
        // proves the spy DOES fire on an actual page click), this shows scrolling
        // is tied to goToPage(), not to the initial render.
        expect(scrollSpy).not.toHaveBeenCalled()
      } finally {
        vi.unstubAllGlobals()
      }
    })

    it('smooth-scrolls all the way to the top of the page (not just this component) when the page changes', async () => {
      vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue(manyRecipes(35))
      const scrollSpy = vi.fn()
      vi.stubGlobal('scrollTo', scrollSpy)

      try {
        const wrapper = mount(ApiRecipeList, { global: { plugins: [i18n, testRouter()] } })
        await flushPromises()

        const nextBtn = wrapper.findAll('.pagination-btn').find(b => b.text() === 'Weiter')!
        await nextBtn.trigger('click')
        await flushPromises()

        expect(scrollSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
      } finally {
        vi.unstubAllGlobals()
      }
    })

    it('uses instant scroll (behavior: auto) when the user prefers reduced motion', async () => {
      const matchMediaMock = vi.fn().mockReturnValue({ matches: true })
      vi.stubGlobal('matchMedia', matchMediaMock)
      const scrollSpy = vi.fn()
      vi.stubGlobal('scrollTo', scrollSpy)
      vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue(manyRecipes(35))

      try {
        const wrapper = mount(ApiRecipeList, { global: { plugins: [i18n, testRouter()] } })
        await flushPromises()

        const nextBtn = wrapper.findAll('.pagination-btn').find(b => b.text() === 'Weiter')!
        await nextBtn.trigger('click')
        await flushPromises()

        expect(matchMediaMock).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
        expect(scrollSpy).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
      } finally {
        vi.unstubAllGlobals()
      }
    })
  })
})
