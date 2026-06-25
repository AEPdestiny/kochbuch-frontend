import { mount, flushPromises, config } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RecipeDetailView from '@/views/RecipeDetailView.vue'
import { recipeApi } from '@/shared/api/recipeApi'
import { restaurantApi } from '@/shared/api/restaurantApi'
import { favoriteApi } from '@/shared/api/favoriteApi'
import { mealPlanApi } from '@/shared/api/mealPlanApi'
import { shoppingListApi } from '@/shared/api/shoppingListApi'
import { AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { i18n, setLocale } from '@/i18n'

const back = vi.fn()
const push = vi.fn()
let routeName = 'external-recipe-detail'

vi.mock('vue-router', () => ({
  RouterLink: {
    props: ['to'],
    template: '<a :href="to"><slot /></a>',
  },
  useRoute: () => ({
    name: routeName,
    params: { id: '716429' },
  }),
  useRouter: () => ({ back, push }),
}))

vi.mock('@/shared/api/recipeApi', () => ({
  recipeApi: {
    getExternalRecipeDetail: vi.fn(),
    getRecipe: vi.fn(),
    deleteRecipe: vi.fn(),
    searchInstructions: vi.fn(),
  },
}))

vi.mock('@/shared/api/restaurantApi', () => ({
  restaurantApi: {
    searchRestaurants: vi.fn(),
  },
}))

vi.mock('@/shared/api/favoriteApi', () => ({
  favoriteApi: {
    getExternalFavorites: vi.fn(),
    addExternalFavorite: vi.fn(),
    removeExternalFavorite: vi.fn(),
  },
}))

vi.mock('@/shared/api/mealPlanApi', () => ({
  mealPlanApi: {
    getWeek: vi.fn(),
    setSlot: vi.fn(),
  },
}))

vi.mock('@/shared/api/shoppingListApi', () => ({
  shoppingListApi: {
    createShoppingListItem: vi.fn(),
  },
}))

describe('RecipeDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeName = 'external-recipe-detail'
    sessionStorage.clear()
    setLocale('de')
    config.global.plugins = [i18n]
    vi.mocked(recipeApi.getExternalRecipeDetail).mockResolvedValue(externalDetail())
    vi.mocked(recipeApi.getRecipe).mockResolvedValue(localRecipe())
    vi.mocked(recipeApi.deleteRecipe).mockResolvedValue()
    vi.mocked(recipeApi.searchInstructions).mockResolvedValue({
      configured: true,
      results: [],
    })
    vi.mocked(restaurantApi.searchRestaurants).mockResolvedValue([])
    vi.mocked(favoriteApi.getExternalFavorites).mockResolvedValue([])
    vi.mocked(favoriteApi.addExternalFavorite).mockResolvedValue({
      id: 1,
      externalRecipeId: '716429',
      externalTitle: 'Pasta with Garlic',
      externalImageUrl: 'https://example.com/pasta.jpg',
      externalSource: 'SPOONACULAR',
    })
    vi.mocked(favoriteApi.removeExternalFavorite).mockResolvedValue()
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
      weekStart: '2026-06-08',
      weekEnd: '2026-06-14',
      entries: [{
        id: 1,
        plannedDate: '2026-06-08',
        mealSlot: 'dinner',
        recipe: localRecipe(),
      }],
    })
    vi.mocked(mealPlanApi.setSlot).mockResolvedValue({
      id: 2,
      plannedDate: '2026-06-08',
      mealSlot: 'breakfast',
      recipe: localRecipe(),
    })
    vi.mocked(shoppingListApi.createShoppingListItem).mockResolvedValue({
      id: 1,
      name: 'pasta',
      quantity: 2,
      unit: 'cups',
      category: 'Rezeptzutat',
      checked: false,
      recipeId: '716429',
      recipeTitle: 'Pasta with Garlic',
      createdAt: '2026-06-06T00:00:00Z',
      updatedAt: '2026-06-06T00:00:00Z',
    })
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn(),
      },
    })
  })

  it('loads external recipe details and shows ingredients and steps', async () => {
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    expect(recipeApi.getExternalRecipeDetail).toHaveBeenCalledWith('716429')
    expect(wrapper.text()).toContain('Pasta with Garlic')
    expect(wrapper.text()).toContain('510 kcal')
    expect(wrapper.text()).toContain('31 g Protein')
    expect(wrapper.text()).toContain('2 cups pasta')
    expect(wrapper.text()).toContain('Cook pasta.')
  })

  it('renders recipe detail controls in English without German UI labels', async () => {
    setLocale('en')

    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    expect(wrapper.text()).toContain('Add all ingredients to shopping list')
    expect(wrapper.text()).toContain('Add to meal plan')
    expect(wrapper.text()).toContain('Favorite')
    expect(wrapper.text()).toContain('Ingredients')
    expect(wrapper.text()).toContain('Instructions')
    expect(wrapper.text()).not.toContain('Zum Wochenplan hinzufügen')
  })

  it('adds all ingredients to the shopping list with recipe context', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.primary-button').trigger('click')
    await flushPromises()

    expect(shoppingListApi.createShoppingListItem).toHaveBeenCalledWith({
      name: 'pasta',
      quantity: 2,
      unit: 'cups',
      category: 'Rezeptzutat',
      checked: false,
      recipeId: '716429',
      recipeTitle: 'Pasta with Garlic',
    })
    expect(shoppingListApi.createShoppingListItem).toHaveBeenCalledTimes(2)
  })

  it('adds one ingredient to the shopping list', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.small-button').trigger('click')
    await flushPromises()

    expect(shoppingListApi.createShoppingListItem).toHaveBeenCalledTimes(1)
  })

  it('searches restaurants with recipe title and coordinates', async () => {
    vi.mocked(restaurantApi.searchRestaurants).mockResolvedValue([
      {
        name: 'Pasta Place',
        address: 'Pasta Street 1',
        distanceMeters: 850,
        googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=52.5201,13.4052',
        latitude: 52.5201,
        longitude: 13.4052,
      },
    ])
    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation((success: PositionCallback) => {
      success({ coords: { latitude: 52.52, longitude: 13.405 } } as GeolocationPosition)
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.findAll('.secondary-button').at(0)!.trigger('click')
    await flushPromises()

    expect(restaurantApi.searchRestaurants).toHaveBeenCalledWith({
      query: 'Pasta with Garlic',
      latitude: 52.52,
      longitude: 13.405,
    })
    expect(wrapper.text()).toContain('Pasta Place')
  })

  it('shows location denied errors', async () => {
    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation((_success: PositionCallback, error?: PositionErrorCallback | null) => {
      error?.({ code: 1 } as GeolocationPositionError)
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.findAll('.secondary-button').at(0)!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Standortzugriff wurde verweigert.')
  })

  it('loads local Dishly recipes from /recipes/{id}', async () => {
    routeName = 'recipe-detail'
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    expect(recipeApi.getRecipe).toHaveBeenCalledWith('716429')
    expect(wrapper.text()).toContain('Dishly Pasta')
    expect(wrapper.text()).toContain('19 g Protein')
    expect(wrapper.text()).toContain('2 Zutaten')
    expect(wrapper.text()).toContain('200 g Tomaten')
    expect(wrapper.find('.owner-edit-button').exists()).toBe(false)
    expect(wrapper.find('.owner-delete-button').exists()).toBe(false)
  })

  it('prefers ingredientsList for local Dishly recipe details', async () => {
    routeName = 'recipe-detail'
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(recipeApi.getRecipe).mockResolvedValue({
      ...localRecipe(),
      ingredients: '61 g geröstetes Kürbispüree 4 g Teffmehl 4 g Tapiokamehl 8 g Reismehl 0',
      ingredientsList: [
        '61 g geröstetes Kürbispüree',
        '4 g Teffmehl',
        '4 g Tapiokamehl',
        '8 g Reismehl',
      ],
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    expect(wrapper.text()).toContain('4 Zutaten')
    expect(wrapper.text()).toContain('61 g geröstetes Kürbispüree')
    expect(wrapper.text()).toContain('4 g Teffmehl')
    expect(wrapper.text()).toContain('4 g Tapiokamehl')
    expect(wrapper.text()).toContain('8 g Reismehl')

    await wrapper.find('.small-button').trigger('click')
    await flushPromises()

    expect(shoppingListApi.createShoppingListItem).toHaveBeenCalledWith({
      name: '61 g geröstetes Kürbispüree',
      quantity: null,
      unit: null,
      category: 'Rezeptzutat',
      checked: false,
      recipeId: '1',
      recipeTitle: 'Dishly Pasta',
    })
  })

  it('splits normalized local ingredients and ignores meaningless ingredient values', async () => {
    routeName = 'recipe-detail'
    vi.mocked(recipeApi.getRecipe).mockResolvedValue({
      ...localRecipe(),
      ingredients: '0\n200 g Tomaten\n1\n150 g Pasta\n200 g Tomaten',
    })

    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    expect(wrapper.text()).toContain('2 Zutaten')
    expect(wrapper.text()).toContain('200 g Tomaten')
    expect(wrapper.text()).toContain('150 g Pasta')
    expect(wrapper.text()).not.toContain('1 Zutaten')
  })

  it('shows edit and delete actions only for the recipe owner', async () => {
    routeName = 'recipe-detail'
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(recipeApi.getRecipe).mockResolvedValue({
      ...localRecipe(),
      ownedByCurrentUser: true,
    })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    expect(wrapper.find('.owner-edit-button').exists()).toBe(true)
    expect(wrapper.find('.owner-delete-button').exists()).toBe(true)

    await wrapper.find('.owner-edit-button').trigger('click')
    expect(push).toHaveBeenCalledWith({ path: '/my-recipes', query: { edit: '1' } })

    await wrapper.find('.owner-delete-button').trigger('click')
    await flushPromises()
    expect(recipeApi.deleteRecipe).toHaveBeenCalledWith(1)
    expect(push).toHaveBeenCalledWith('/my-recipes')
    confirmSpy.mockRestore()
  })

  it('shows source hint when instructions are missing', async () => {
    routeName = 'recipe-detail'
    vi.mocked(recipeApi.getRecipe).mockResolvedValue({
      ...localRecipe(),
      instructions: '',
      sourceUrl: 'https://example.com/source',
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    expect(wrapper.text()).toContain('Zubereitungsschritte sind für dieses Rezept nicht verfügbar.')
    expect(wrapper.text()).toContain('Zur Originalquelle')
    expect(wrapper.find('.google-search-link').attributes('href')).toBe('https://example.com/source')
    expect(recipeApi.searchInstructions).not.toHaveBeenCalled()
  })

  it('treats placeholder instructions as missing and shows source hint', async () => {
    routeName = 'recipe-detail'
    vi.mocked(recipeApi.getRecipe).mockResolvedValue({
      ...localRecipe(),
      instructions: 'Keine Anleitung angegeben.',
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    expect(wrapper.text()).toContain('Zubereitungsschritte sind für dieses Rezept nicht verfügbar.')
    expect(wrapper.text()).not.toContain('Keine Anleitung angegeben.')
  })

  it('treats placeholder steps as missing and shows source hint', async () => {
    vi.mocked(recipeApi.getExternalRecipeDetail).mockResolvedValue({
      ...externalDetail(),
      instructions: '',
      steps: ['Keine Anleitung angegeben.'],
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    expect(wrapper.text()).toContain('Zubereitungsschritte sind für dieses Rezept nicht verfügbar.')
    expect(wrapper.text()).toContain('Zur Originalquelle')
    expect(wrapper.text()).not.toContain('Keine Anleitung angegeben.')
  })

  it('does not render a source link when instructions and source url are missing', async () => {
    routeName = 'recipe-detail'
    vi.mocked(recipeApi.getRecipe).mockResolvedValue({
      ...localRecipe(),
      instructions: '',
      sourceUrl: null,
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    expect(wrapper.text()).toContain('Zubereitungsschritte sind für dieses Rezept nicht verfügbar.')
    expect(wrapper.find('.google-search-link').exists()).toBe(false)
  })

  it('opens meal plan modal and adds local recipe to selected slot', async () => {
    routeName = 'recipe-detail'
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const weekStart = currentWeekStart()
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.findAll('.secondary-button').at(1)!.trigger('click')
    await flushPromises()

    expect(mealPlanApi.getWeek).toHaveBeenCalledWith(weekStart)
    expect(wrapper.findAll('.day-button-group')).toHaveLength(7)
    expect(wrapper.findAll('.day-button')).toHaveLength(28)
    expect(wrapper.text()).toContain('Abendessen')
    expect(wrapper.text()).toContain('Dishly Pasta')

    await wrapper.find('.day-button').trigger('click')
    await flushPromises()

    expect(mealPlanApi.setSlot).toHaveBeenCalledWith(weekStart, 'breakfast', 1)
    expect(wrapper.text()).toContain('Rezept wurde zum Wochenplan hinzugefügt.')
    expect(wrapper.find('.meal-plan-modal').exists()).toBe(false)
  })

  it('adds external recipes to meal plan as customTitle', async () => {
    const weekStart = currentWeekStart()
    vi.mocked(mealPlanApi.setSlot).mockResolvedValue({
      id: 3,
      plannedDate: weekStart,
      mealSlot: 'breakfast',
      recipe: null,
      customTitle: 'Pasta with Garlic',
    })
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.findAll('.secondary-button').at(1)!.trigger('click')
    await flushPromises()
    await wrapper.find('.day-button').trigger('click')
    await flushPromises()

    expect(mealPlanApi.getWeek).toHaveBeenCalledWith(weekStart)
    expect(mealPlanApi.setSlot).toHaveBeenCalledWith(weekStart, 'breakfast', {
      customTitle: 'Pasta with Garlic',
      caloriesSnapshot: 510,
      proteinSnapshot: 31.2,
      imageUrlSnapshot: 'https://example.com/pasta.jpg',
      externalRecipeId: '716429',
      externalSource: 'spoonacular',
    })
    expect(wrapper.text()).toContain('Rezept wurde zum Wochenplan hinzugefügt.')
  })

  it('toggles external recipe favorite', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.findAll('.secondary-button').at(2)!.trigger('click')
    await flushPromises()

    expect(favoriteApi.addExternalFavorite).toHaveBeenCalledWith({
      externalRecipeId: '716429',
      externalTitle: 'Pasta with Garlic',
      externalImageUrl: 'https://example.com/pasta.jpg',
      externalSource: 'SPOONACULAR',
    })
  })

  it('uses a safe fallback for the back button when no history exists', async () => {
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.back-button').trigger('click')

    expect(push).toHaveBeenCalledWith('/')
  })
})

function externalDetail() {
  return {
    id: 716429,
    externalId: '716429',
    source: 'spoonacular',
    title: 'Pasta with Garlic',
    imageUrl: 'https://example.com/pasta.jpg',
    prepTimeMinutes: 0,
    cookTimeMinutes: 20,
    readyInMinutes: 20,
    servings: 2,
    category: 'main course',
    tags: ['main course', 'vegetarian'],
    calories: 510,
    protein: 31.2,
    ingredients: [
      { name: 'pasta', original: '2 cups pasta', amount: 2, unit: 'cups' },
      { name: 'olive oil', original: '1 tbsp olive oil', amount: 1, unit: 'tbsp' },
    ],
    instructions: 'Cook pasta.',
    steps: ['Cook pasta.', 'Serve warm.'],
    sourceUrl: 'https://example.com/source',
  }
}

function localRecipe() {
  return {
    id: 1,
    title: 'Dishly Pasta',
    imageUrl: '',
    prepTimeMinutes: 5,
    cookTimeMinutes: 10,
    servings: 2,
    difficulty: 'easy',
    category: 'Italian',
    rating: 4.5,
    ingredients: '200 g Tomaten, 150 g Pasta',
    instructions: 'Kochen',
    favorite: false,
    published: true,
    ownedByCurrentUser: false,
    protein: 18.6,
  }
}

function currentWeekStart() {
  const now = new Date()
  const day = now.getDay() === 0 ? 7 : now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1)
  const year = monday.getFullYear()
  const month = String(monday.getMonth() + 1).padStart(2, '0')
  const date = String(monday.getDate()).padStart(2, '0')
  return `${year}-${month}-${date}`
}
