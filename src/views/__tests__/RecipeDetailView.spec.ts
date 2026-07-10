import { mount, flushPromises, config } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import RecipeDetailView from '@/views/RecipeDetailView.vue'
import { recipeApi } from '@/shared/api/recipeApi'
import { restaurantApi } from '@/shared/api/restaurantApi'
import { favoriteApi } from '@/shared/api/favoriteApi'
import { mealPlanApi } from '@/shared/api/mealPlanApi'
import { shoppingListApi } from '@/shared/api/shoppingListApi'
import { pantryApi } from '@/shared/api/pantryApi'
import { AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { exportRecipe } from '@/shared/recipeImportExport'
import { i18n, setLocale } from '@/i18n'
import { useToastStore } from '@/stores/toastStore'

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
    getInstructionSuggestions: vi.fn(),
  },
}))

vi.mock('@/shared/api/restaurantApi', () => ({
  restaurantApi: {
    searchRestaurants: vi.fn(),
    searchByText: vi.fn(),
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
    getShoppingListItems: vi.fn(),
    createShoppingListItem: vi.fn(),
  },
}))

vi.mock('@/shared/api/pantryApi', () => ({
  pantryApi: {
    getPantryItems: vi.fn(),
  },
}))

vi.mock('@/shared/recipeImportExport', () => ({
  exportRecipe: vi.fn(),
}))

describe('RecipeDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeName = 'external-recipe-detail'
    sessionStorage.clear()
    setLocale('de')
    const pinia = createPinia()
    setActivePinia(pinia)
    config.global.plugins = [i18n, pinia]
    vi.mocked(recipeApi.getExternalRecipeDetail).mockResolvedValue(externalDetail())
    vi.mocked(recipeApi.getRecipe).mockResolvedValue(localRecipe())
    vi.mocked(recipeApi.deleteRecipe).mockResolvedValue()
    vi.mocked(recipeApi.searchInstructions).mockResolvedValue({
      configured: true,
      results: [],
    })
    vi.mocked(recipeApi.getInstructionSuggestions).mockResolvedValue({
      recipeId: 1,
      hasRealInstructions: false,
      configured: true,
      suggestions: [],
    })
    vi.mocked(restaurantApi.searchRestaurants).mockResolvedValue([])
    vi.mocked(restaurantApi.searchByText).mockResolvedValue({ status: 'no_results', results: [] })
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
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([])
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([])
    vi.mocked(shoppingListApi.createShoppingListItem).mockResolvedValue({
      id: 1,
      name: 'pasta',
      quantity: 2,
      unit: 'cup',
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

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('loads external recipe details and shows ingredients and steps', async () => {
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    expect(recipeApi.getExternalRecipeDetail).toHaveBeenCalledWith('716429', 'de')
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
      unit: 'cup',
      category: 'Rezeptzutat',
      checked: false,
      recipeId: '716429',
      recipeTitle: 'Pasta with Garlic',
    })
    expect(shoppingListApi.createShoppingListItem).toHaveBeenCalledTimes(2)
  })

  it('parses package, spoon, oz, lb and slice units when adding recipe ingredients', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(recipeApi.getExternalRecipeDetail).mockResolvedValue({
      ...externalDetail(),
      ingredients: [
        { name: 'Knorr-Sauce Hollandaise', original: '1 Packung Knorr-Sauce Hollandaise', amount: null, unit: null },
        { name: 'weißer Essig', original: '1 Teelöffel weißer Essig', amount: null, unit: null },
        { name: 'butter', original: '0.5 oz butter', amount: null, unit: null },
        { name: 'potatoes', original: '1 lb potatoes', amount: null, unit: null },
        { name: 'prosciutto-style ham', original: '3 slices prosciutto-style ham', amount: null, unit: null },
      ],
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.primary-button').trigger('click')
    await flushPromises()

    expect(shoppingListApi.createShoppingListItem).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Knorr-Sauce Hollandaise',
      quantity: 1,
      unit: 'package',
    }))
    expect(shoppingListApi.createShoppingListItem).toHaveBeenCalledWith(expect.objectContaining({
      name: 'weißer Essig',
      quantity: 1,
      unit: 'tsp',
    }))
    expect(shoppingListApi.createShoppingListItem).toHaveBeenCalledWith(expect.objectContaining({
      name: 'butter',
      quantity: 0.5,
      unit: 'oz',
    }))
    expect(shoppingListApi.createShoppingListItem).toHaveBeenCalledWith(expect.objectContaining({
      name: 'potatoes',
      quantity: 1,
      unit: 'lb',
    }))
    expect(shoppingListApi.createShoppingListItem).toHaveBeenCalledWith(expect.objectContaining({
      name: 'prosciutto-style ham',
      quantity: 3,
      unit: 'slice',
    }))
  })

  it('strips bullet markers before parsing recipe ingredients for the shopping list', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(recipeApi.getExternalRecipeDetail).mockResolvedValue({
      ...externalDetail(),
      ingredients: [
        { name: 'soy sauce', original: '•1/2 tbsp soy sauce', amount: null, unit: null },
        { name: 'shrimp flavored udon', original: '•2 package shrimp flavored udon', amount: null, unit: null },
        { name: 'scallion, finely cut', original: '•scallion, finely cut', amount: null, unit: null },
        { name: 'fish cake, thinly sliced flat', original: '.1/2 cup fish cake, thinly sliced flat', amount: null, unit: null },
        { name: 'minced garlic', original: '.1 tsp minced garlic', amount: null, unit: null },
        { name: 'eggs, poached', original: '•2 eggs, poached', amount: null, unit: null },
      ],
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.primary-button').trigger('click')
    await flushPromises()

    expect(shoppingListApi.createShoppingListItem).toHaveBeenCalledWith(expect.objectContaining({
      name: 'soy sauce',
      quantity: 0.5,
      unit: 'tbsp',
    }))
    expect(shoppingListApi.createShoppingListItem).toHaveBeenCalledWith(expect.objectContaining({
      name: 'shrimp flavored udon',
      quantity: 2,
      unit: 'package',
    }))
    expect(shoppingListApi.createShoppingListItem).toHaveBeenCalledWith(expect.objectContaining({
      name: 'scallion, finely cut',
      quantity: null,
      unit: null,
    }))
    expect(shoppingListApi.createShoppingListItem).toHaveBeenCalledWith(expect.objectContaining({
      name: 'fish cake, thinly sliced flat',
      quantity: 0.5,
      unit: 'cup',
    }))
    expect(shoppingListApi.createShoppingListItem).toHaveBeenCalledWith(expect.objectContaining({
      name: 'minced garlic',
      quantity: 1,
      unit: 'tsp',
    }))
    expect(shoppingListApi.createShoppingListItem).toHaveBeenCalledWith(expect.objectContaining({
      name: 'eggs, poached',
      quantity: 2,
      unit: null,
    }))
  })

  it('adds only recipe ingredients that are missing from the pantry and shopping list', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([{
      id: 1,
      name: 'pasta',
      quantity: 1,
      unit: null,
      category: null,
      createdAt: '2026-06-06T00:00:00Z',
      updatedAt: '2026-06-06T00:00:00Z',
    }])
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([])
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.primary-button').trigger('click')
    await flushPromises()

    expect(shoppingListApi.createShoppingListItem).toHaveBeenCalledTimes(1)
    expect(shoppingListApi.createShoppingListItem).toHaveBeenCalledWith(expect.objectContaining({
      name: 'olive oil',
      quantity: 1,
      unit: 'tbsp',
    }))
    expect(shoppingListApi.createShoppingListItem).not.toHaveBeenCalledWith(expect.objectContaining({
      name: 'pasta',
    }))
  })

  it('adds one ingredient to the shopping list', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.small-button').trigger('click')
    await flushPromises()

    expect(shoppingListApi.createShoppingListItem).toHaveBeenCalledTimes(1)
  })

  it('asks before adding a single ingredient that is already in the pantry', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([{
      id: 1,
      name: 'pasta',
      quantity: 1,
      unit: null,
      category: null,
      createdAt: '2026-06-06T00:00:00Z',
      updatedAt: '2026-06-06T00:00:00Z',
    }])
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.small-button').trigger('click')
    await flushPromises()

    expect(document.body.textContent).toContain('Zutat bereits im Vorrat')
    expect(document.body.textContent).toContain('Du hast pasta bereits im Vorrat. Trotzdem zur Einkaufsliste hinzufügen?')
    const cancelButton = Array.from(document.body.querySelectorAll('button'))
      .find(button => button.textContent?.trim() === 'Abbrechen') as HTMLButtonElement
    cancelButton.click()
    await flushPromises()
    expect(shoppingListApi.createShoppingListItem).not.toHaveBeenCalled()

    await wrapper.find('.small-button').trigger('click')
    await flushPromises()
    const confirmButton = Array.from(document.body.querySelectorAll('button'))
      .find(button => button.textContent?.trim() === 'Trotzdem hinzufügen') as HTMLButtonElement
    confirmButton.click()
    await flushPromises()

    expect(shoppingListApi.createShoppingListItem).toHaveBeenCalledWith(expect.objectContaining({
      name: 'pasta',
    }))
  })

  it('searches restaurants with recipe title and text location', async () => {
    vi.mocked(restaurantApi.searchByText).mockResolvedValue({
      status: 'ok',
      results: [{
        name: 'Pasta Place',
        address: null,
        distanceMeters: null,
        googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Pasta+Place+Berlin',
        latitude: null,
        longitude: null,
      }],
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.location-input').setValue('Berlin')
    await wrapper.find('.restaurant-search-button').trigger('click')
    await flushPromises()

    expect(restaurantApi.searchByText).toHaveBeenCalledWith('Pasta with Garlic', 'Berlin', undefined, undefined, undefined)
    expect(wrapper.text()).toContain('Pasta Place')
  })

  it('shows error message when restaurant search fails', async () => {
    vi.mocked(restaurantApi.searchByText).mockRejectedValue(new Error('Network error'))
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.location-input').setValue('Berlin')
    await wrapper.find('.restaurant-search-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Restaurants konnten nicht geladen werden.')
  })

  it('shows no-results message when status is no_results', async () => {
    vi.mocked(restaurantApi.searchByText).mockResolvedValue({ status: 'no_results', results: [] })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.location-input').setValue('Berlin')
    await wrapper.find('.restaurant-search-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Wir haben keine passenden Restaurants gefunden.')
  })

  it('shows unavailable message when Tavily is not configured', async () => {
    vi.mocked(restaurantApi.searchByText).mockResolvedValue({ status: 'unavailable', results: [] })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.location-input').setValue('Berlin')
    await wrapper.find('.restaurant-search-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Restaurant-Suche ist aktuell nicht verfügbar.')
  })

  it('restaurant search button is disabled when location input is empty', async () => {
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    const button = wrapper.find('.restaurant-search-button')
    expect((button.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('does not show status messages while loading', async () => {
    vi.mocked(restaurantApi.searchByText).mockReturnValue(new Promise(() => {}))
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.location-input').setValue('Berlin')
    await wrapper.find('.restaurant-search-button').trigger('click')

    expect(wrapper.text()).not.toContain('Wir haben keine passenden Restaurants gefunden')
    expect(wrapper.text()).not.toContain('Restaurant-Suche ist aktuell nicht verfügbar')
    expect(wrapper.text()).not.toContain('Restaurants konnten nicht geladen werden')
    expect(wrapper.text()).not.toContain('Bitte gib eine Stadt ein, z. B. Berlin.')
  })

  it('shows button loading text while searching', async () => {
    vi.mocked(restaurantApi.searchByText).mockReturnValue(new Promise(() => {}))
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.location-input').setValue('Berlin')
    await wrapper.find('.restaurant-search-button').trigger('click')

    expect(wrapper.find('.restaurant-search-button').text()).toContain('Restaurants werden gesucht')
  })

  it('shows city hint and does not call API when user enters "Deutschland"', async () => {
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.location-input').setValue('Deutschland')
    await wrapper.find('.restaurant-search-button').trigger('click')
    await flushPromises()

    expect(restaurantApi.searchByText).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Bitte gib eine Stadt ein, z. B. Berlin.')
  })

  it('shows city hint and does not call API when user enters "Germany"', async () => {
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.location-input').setValue('Germany')
    await wrapper.find('.restaurant-search-button').trigger('click')
    await flushPromises()

    expect(restaurantApi.searchByText).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Bitte gib eine Stadt ein, z. B. Berlin.')
  })

  it('calls API when user enters a city like "Berlin"', async () => {
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.location-input').setValue('Berlin')
    await wrapper.find('.restaurant-search-button').trigger('click')
    await flushPromises()

    expect(restaurantApi.searchByText).toHaveBeenCalledWith('Pasta with Garlic', 'Berlin', undefined, undefined, undefined)
  })

  it('GPS button is rendered in restaurant section', async () => {
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    expect(wrapper.find('.gps-button').exists()).toBe(true)
  })

  it('GPS success stores coordinates and passes them to API on next search', async () => {
    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation((success: PositionCallback) => {
      success({ coords: { latitude: 52.52, longitude: 13.405 } } as GeolocationPosition)
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.gps-button').trigger('click')
    await flushPromises()

    await wrapper.find('.location-input').setValue('Berlin')
    await wrapper.find('.restaurant-search-button').trigger('click')
    await flushPromises()

    expect(restaurantApi.searchByText).toHaveBeenCalledWith('Pasta with Garlic', 'Berlin', 52.52, 13.405, undefined)
  })

  it('GPS success without city triggers GPS-only search via searchByText with empty location', async () => {
    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation((success: PositionCallback) => {
      success({ coords: { latitude: 52.52, longitude: 13.405 } } as GeolocationPosition)
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.gps-button').trigger('click')
    await flushPromises()

    expect(restaurantApi.searchByText).toHaveBeenCalledWith('Pasta with Garlic', '', 52.52, 13.405, undefined)
  })

  it('GPS success captures accuracy and forwards it to the API', async () => {
    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation((success: PositionCallback) => {
      success({ coords: { latitude: 52.52, longitude: 13.405, accuracy: 35 } } as GeolocationPosition)
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.gps-button').trigger('click')
    await flushPromises()

    expect(restaurantApi.searchByText).toHaveBeenCalledWith('Pasta with Garlic', '', 52.52, 13.405, 35)
  })

  it('shows location accuracy hint after GPS success', async () => {
    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation((success: PositionCallback) => {
      success({ coords: { latitude: 52.52, longitude: 13.405, accuracy: 35 } } as GeolocationPosition)
    })
    vi.mocked(restaurantApi.searchByText).mockResolvedValue({
      status: 'ok',
      searchMode: 'exact',
      resolvedLocation: 'Berlin, Germany',
      results: [{ name: 'Sushi Circle', address: null, distanceMeters: 400, googleMapsUrl: 'https://x', latitude: 52.5, longitude: 13.4 }],
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.gps-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Suche in Berlin, Germany')
    expect(wrapper.text()).toContain('Standortgenauigkeit ca. 35 m')
  })

  it('shows location mismatch message when backend reports locationMismatch', async () => {
    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation((success: PositionCallback) => {
      success({ coords: { latitude: 41.8781, longitude: -87.6298, accuracy: 20 } } as GeolocationPosition)
    })
    vi.mocked(restaurantApi.searchByText).mockResolvedValue({
      status: 'ok',
      searchMode: 'exact',
      resolvedLocation: 'Chicago, United States',
      locationMismatch: true,
      results: [{ name: 'Lou Malnatis', address: null, distanceMeters: 300, googleMapsUrl: 'https://x', latitude: 41.9, longitude: -87.6 }],
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.location-input').setValue('Berlin')
    await wrapper.find('.gps-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Dein Standort passt nicht zur eingegebenen Stadt')
  })

  it('GPS-only search: no_location status shows gpsNoCityHint', async () => {
    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation((success: PositionCallback) => {
      success({ coords: { latitude: 52.52, longitude: 13.405 } } as GeolocationPosition)
    })
    vi.mocked(restaurantApi.searchByText).mockResolvedValue({ status: 'no_location', results: [] })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.gps-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Standort gespeichert. Gib zusätzlich eine Stadt ein')
  })

  it('GPS-only search: ok with resolvedLocation shows resolved city', async () => {
    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation((success: PositionCallback) => {
      success({ coords: { latitude: 52.52, longitude: 13.405 } } as GeolocationPosition)
    })
    vi.mocked(restaurantApi.searchByText).mockResolvedValue({
      status: 'ok',
      results: [{ name: 'Pasta Palace Berlin', address: null, distanceMeters: null, googleMapsUrl: 'https://maps.google.com', latitude: null, longitude: null }],
      resolvedLocation: 'Berlin',
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.gps-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Suche in Berlin')
    expect(wrapper.text()).toContain('Pasta Palace Berlin')
  })

  it('client-side filter: "r/sushi" is not rendered and shows no_results', async () => {
    vi.mocked(restaurantApi.searchByText).mockResolvedValue({
      status: 'ok',
      results: [{
        name: 'r/sushi',
        address: null,
        distanceMeters: null,
        googleMapsUrl: 'https://maps.google.com/x',
        latitude: null,
        longitude: null,
      }],
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.location-input').setValue('Berlin')
    await wrapper.find('.restaurant-search-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('r/sushi')
    expect(wrapper.text()).toContain('Wir haben keine passenden Restaurants gefunden.')
  })

  it('client-side filter: "The top 11 sushi restaurants in Berlin" is not rendered', async () => {
    vi.mocked(restaurantApi.searchByText).mockResolvedValue({
      status: 'ok',
      results: [{
        name: 'The top 11 sushi restaurants in Berlin',
        address: null,
        distanceMeters: null,
        googleMapsUrl: 'https://maps.google.com/x',
        latitude: null,
        longitude: null,
      }],
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.location-input').setValue('Berlin')
    await wrapper.find('.restaurant-search-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('The top 11 sushi restaurants in Berlin')
    expect(wrapper.text()).toContain('Wir haben keine passenden Restaurants gefunden.')
  })

  it('client-side filter: mix of bad + good results renders only the good one', async () => {
    vi.mocked(restaurantApi.searchByText).mockResolvedValue({
      status: 'ok',
      results: [
        { name: 'r/sushi', address: null, distanceMeters: null, googleMapsUrl: 'https://x', latitude: null, longitude: null },
        { name: 'Sushi Circle', address: 'Sushistraße 1, Berlin', distanceMeters: 500, googleMapsUrl: 'https://y', latitude: 52.52, longitude: 13.4 },
      ],
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.location-input').setValue('Berlin')
    await wrapper.find('.restaurant-search-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Sushi Circle')
    expect(wrapper.text()).not.toContain('r/sushi')
  })

  it('searchMode "exact" shows exact heading and exact card note', async () => {
    vi.mocked(restaurantApi.searchByText).mockResolvedValue({
      status: 'ok',
      searchMode: 'exact',
      results: [{
        name: 'Trattoria Mario',
        address: 'Hauptstraße 1, Berlin',
        distanceMeters: 700,
        googleMapsUrl: 'https://maps.google.com/x',
        latitude: 52.52,
        longitude: 13.4,
      }],
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.location-input').setValue('Berlin')
    await wrapper.find('.restaurant-search-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Exakte Treffer für dieses Gericht')
    expect(wrapper.text()).toContain('Treffer für genau dieses Gericht geprüft')
    expect(wrapper.text()).toContain('Trattoria Mario')
    expect(wrapper.text()).not.toContain('Allgemeiner Restaurantvorschlag')
  })

  it('searchMode "suggestions" shows suggestions heading and suggestion card note, not exact note', async () => {
    vi.mocked(restaurantApi.searchByText).mockResolvedValue({
      status: 'ok',
      searchMode: 'suggestions',
      results: [{
        name: 'Sushi Circle',
        address: 'Sushistraße 1, Berlin',
        distanceMeters: 500,
        googleMapsUrl: 'https://maps.google.com/x',
        latitude: 52.52,
        longitude: 13.4,
      }],
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.location-input').setValue('Berlin')
    await wrapper.find('.restaurant-search-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Keine exakten Treffer gefunden.')
    expect(wrapper.text()).toContain('Allgemeiner Restaurantvorschlag')
    expect(wrapper.text()).toContain('Sushi Circle')
    expect(wrapper.text()).not.toContain('Treffer für genau dieses Gericht geprüft')
  })

  it('typed search with resolvedLocation "Berlin, Germany" shows the disambiguated city', async () => {
    vi.mocked(restaurantApi.searchByText).mockResolvedValue({
      status: 'ok',
      searchMode: 'exact',
      resolvedLocation: 'Berlin, Germany',
      results: [{
        name: 'Trattoria Mario',
        address: 'Hauptstraße 1, Berlin',
        distanceMeters: 700,
        googleMapsUrl: 'https://www.google.com/maps/dir/?api=1&origin=52.52,13.4&destination=Trattoria+Mario+Berlin+Germany',
        latitude: null,
        longitude: null,
      }],
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.location-input').setValue('Berlin')
    await wrapper.find('.restaurant-search-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Suche in Berlin, Germany')
    expect(wrapper.find('.maps-link').attributes('href')).toContain('Germany')
  })

  it('GPS denied shows friendly hint message', async () => {
    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(
      (_success: PositionCallback, error?: PositionErrorCallback | null) => {
        error?.({ code: 1, message: 'Permission denied' } as GeolocationPositionError)
      },
    )
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.gps-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Standortfreigabe abgelehnt')
  })

  it('shows formatted distance in meters when distanceMeters < 1000', async () => {
    vi.mocked(restaurantApi.searchByText).mockResolvedValue({
      status: 'ok',
      results: [{
        name: 'Pasta Place',
        address: 'Musterstraße 1, Berlin',
        distanceMeters: 850,
        googleMapsUrl: 'https://www.google.com/maps/dir/?api=1&origin=52.52,13.405&destination=52.521,13.406',
        latitude: 52.521,
        longitude: 13.406,
      }],
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.location-input').setValue('Berlin')
    await wrapper.find('.restaurant-search-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('850 m entfernt')
    expect(wrapper.find('.maps-link').text()).toContain('Route in Google Maps öffnen')
  })

  it('shows formatted distance in km when distanceMeters >= 1000', async () => {
    vi.mocked(restaurantApi.searchByText).mockResolvedValue({
      status: 'ok',
      results: [{
        name: 'Pasta Place',
        address: null,
        distanceMeters: 2400,
        googleMapsUrl: 'https://www.google.com/maps/dir/?api=1&origin=52.52,13.405&destination=52.54,13.43',
        latitude: 52.54,
        longitude: 13.43,
      }],
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.location-input').setValue('Berlin')
    await wrapper.find('.restaurant-search-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('2.4 km entfernt')
  })

  it('shows distance hint when distanceMeters is null', async () => {
    vi.mocked(restaurantApi.searchByText).mockResolvedValue({
      status: 'ok',
      results: [{
        name: 'Pasta Place',
        address: null,
        distanceMeters: null,
        googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Pasta+Place+Berlin',
        latitude: null,
        longitude: null,
      }],
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.find('.location-input').setValue('Berlin')
    await wrapper.find('.restaurant-search-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Entfernung in Google Maps prüfen')
  })

  it('disclaimer mentions exact dish check, not restaurant type', async () => {
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    expect(wrapper.text()).not.toContain('Restauranttyp und Umgebung')
    expect(wrapper.text()).toContain('genau dieses Gericht')
  })

  it('loads local Dishly recipes from /recipes/{id}', async () => {
    routeName = 'recipe-detail'
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    expect(recipeApi.getRecipe).toHaveBeenCalledWith('716429', 'de')
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
      name: 'geröstetes Kürbispüree',
      quantity: 61,
      unit: 'g',
      category: 'Rezeptzutat',
      checked: false,
      recipeId: '1',
      recipeTitle: 'Dishly Pasta',
    })
  })

  it('prefers instructionsList for local Dishly recipe details', async () => {
    routeName = 'recipe-detail'
    vi.mocked(recipeApi.getRecipe).mockResolvedValue({
      ...localRecipe(),
      instructions: 'Dieser Smoothie eignet sich gut als Frühstück. Das Rezept ergibt 2 Portionen. Quelle: Foodista.',
      instructionsList: [
        'Obst und weitere Zutaten vorbereiten.',
        'Alle Zutaten in einen Mixer geben.',
        'Fein und cremig mixen.',
        'Sofort servieren.',
      ],
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    expect(wrapper.findAll('.step-list li')).toHaveLength(4)
    expect(wrapper.text()).toContain('Obst und weitere Zutaten vorbereiten.')
    expect(wrapper.text()).toContain('Alle Zutaten in einen Mixer geben.')
    expect(wrapper.text()).not.toContain('Dieser Smoothie eignet sich gut als Frühstück.')
  })

  it('falls back to instructions text when instructionsList is missing', async () => {
    routeName = 'recipe-detail'
    vi.mocked(recipeApi.getRecipe).mockResolvedValue({
      ...localRecipe(),
      instructions: '1. Gemüse waschen.\n2. Zutaten schneiden.\n3. Servieren.',
      instructionsList: null,
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    expect(wrapper.findAll('.step-list li')).toHaveLength(3)
    expect(wrapper.text()).toContain('Gemüse waschen.')
    expect(wrapper.text()).toContain('Zutaten schneiden.')
    expect(wrapper.text()).toContain('Servieren.')
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
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    expect(wrapper.find('.owner-edit-button').exists()).toBe(true)
    expect(wrapper.find('.owner-delete-button').exists()).toBe(true)

    await wrapper.find('.owner-edit-button').trigger('click')
    expect(push).toHaveBeenCalledWith('/my-recipes/1/edit')

    await wrapper.find('.owner-delete-button').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('Rezept löschen?')
    const confirmButton = Array.from(document.body.querySelectorAll('button'))
      .find(button => button.textContent?.trim() === 'Löschen') as HTMLButtonElement
    confirmButton.click()
    await flushPromises()
    expect(recipeApi.deleteRecipe).toHaveBeenCalledWith(1)
    expect(push).toHaveBeenCalledWith('/my-recipes')
  })

  it('shows transparent suggestion search when instructions are missing', async () => {
    routeName = 'recipe-detail'
    vi.mocked(recipeApi.getRecipe).mockResolvedValue({
      ...localRecipe(),
      instructions: '',
      instructionsList: [],
      hasRealInstructions: false,
      sourceUrl: 'https://example.com/source',
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    expect(wrapper.text()).toContain('Für dieses Rezept ist noch keine geprüfte Zubereitung vorhanden.')
    expect(wrapper.text()).toContain('Zubereitungsvorschläge suchen')
    expect(wrapper.text()).toContain('Zur Originalquelle')
    expect(wrapper.find('.google-search-link').attributes('href')).toBe('https://example.com/source')
    expect(recipeApi.getInstructionSuggestions).not.toHaveBeenCalled()
  })

  it('treats placeholder instructions as missing and shows source hint', async () => {
    routeName = 'recipe-detail'
    vi.mocked(recipeApi.getRecipe).mockResolvedValue({
      ...localRecipe(),
      instructions: 'Keine Anleitung angegeben.',
      instructionsList: ['Keine Anleitung angegeben.'],
      hasRealInstructions: false,
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    expect(wrapper.text()).toContain('Für dieses Rezept ist noch keine geprüfte Zubereitung vorhanden.')
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

    expect(wrapper.text()).toContain('Für dieses Rezept ist noch keine geprüfte Zubereitung vorhanden.')
    expect(wrapper.text()).toContain('Zur Originalquelle')
    expect(wrapper.text()).not.toContain('Keine Anleitung angegeben.')
  })

  it('does not render a source link when instructions and source url are missing', async () => {
    routeName = 'recipe-detail'
    vi.mocked(recipeApi.getRecipe).mockResolvedValue({
      ...localRecipe(),
      instructions: '',
      instructionsList: [],
      hasRealInstructions: false,
      sourceUrl: null,
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    expect(wrapper.text()).toContain('Für dieses Rezept ist noch keine geprüfte Zubereitung vorhanden.')
    expect(wrapper.find('.google-search-link').exists()).toBe(false)
  })

  it('loads instruction suggestions for a local recipe without real instructions', async () => {
    routeName = 'recipe-detail'
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(recipeApi.getRecipe).mockResolvedValue({
      ...localRecipe(),
      instructions: 'Keine Anleitung angegeben.',
      instructionsList: [],
      hasRealInstructions: false,
    })
    vi.mocked(recipeApi.getInstructionSuggestions).mockResolvedValue({
      recipeId: 1,
      hasRealInstructions: false,
      configured: true,
      suggestions: [{
        sourceTitle: 'Pasta Anleitung',
        sourceUrl: 'https://example.com/pasta',
        steps: ['Zutaten vorbereiten.', 'Sauce kochen.', 'Servieren.'],
        confidence: 0.7,
        reason: 'Aus Websuche abgeleitete Vorschlagsquelle. Bitte vor dem Kochen prüfen.',
      }],
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    const searchButton = wrapper.findAll('button').find(button => button.text().includes('Zubereitungsvorschläge suchen'))
    expect(searchButton).toBeTruthy()
    await searchButton!.trigger('click')
    await flushPromises()

    expect(recipeApi.getInstructionSuggestions).toHaveBeenCalledWith(1)
    expect(wrapper.text()).toContain('Pasta Anleitung')
    expect(wrapper.text()).toContain('Zutaten vorbereiten.')
    expect(wrapper.text()).toContain('Sauce kochen.')
    expect(wrapper.text()).toContain('Diese Vorschläge stammen aus der Websuche')
  })

  it('opens meal plan modal and adds local recipe to selected slot', async () => {
    routeName = 'recipe-detail'
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const weekStart = currentWeekStart()
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.findAll('.secondary-button').at(0)!.trigger('click')
    await flushPromises()

    expect(mealPlanApi.getWeek).toHaveBeenCalledWith(weekStart)
    expect(wrapper.findAll('.day-button-group')).toHaveLength(7)
    expect(wrapper.findAll('.day-button')).toHaveLength(28)
    expect(wrapper.text()).toContain('Abendessen')
    expect(wrapper.text()).toContain('Dishly Pasta')

    await wrapper.find('.day-button').trigger('click')
    await flushPromises()

    expect(mealPlanApi.setSlot).toHaveBeenCalledWith(weekStart, 'breakfast', 1)
    expect(useToastStore().toasts.some(t => t.message === 'Rezept wurde zum Wochenplan hinzugefügt.' && t.type === 'success')).toBe(true)
    expect(wrapper.text()).not.toContain('Rezept wurde zum Wochenplan hinzugefügt.')
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

    await wrapper.findAll('.secondary-button').at(0)!.trigger('click')
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
    expect(useToastStore().toasts.some(t => t.message === 'Rezept wurde zum Wochenplan hinzugefügt.' && t.type === 'success')).toBe(true)
    expect(wrapper.text()).not.toContain('Rezept wurde zum Wochenplan hinzugefügt.')
  })

  it('toggles external recipe favorite', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    await wrapper.findAll('.secondary-button').at(1)!.trigger('click')
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

  // ─── Export button tests ──────────────────────────────────────────────────

  it('shows an export button on the recipe detail page', async () => {
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    const buttons = wrapper.findAll('button')
    const exportBtn = buttons.find(b => b.text().includes('Exportieren'))
    expect(exportBtn).toBeTruthy()
  })

  it('clicking export button calls exportRecipe for an external recipe', async () => {
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    const exportBtn = wrapper.findAll('button').find(b => b.text().includes('Exportieren'))
    await exportBtn!.trigger('click')

    expect(exportRecipe).toHaveBeenCalledTimes(1)
    const arg = vi.mocked(exportRecipe).mock.calls[0]![0]
    expect(arg.title).toBe('Pasta with Garlic')
    expect(arg.calories).toBe(510)
    expect(typeof (arg as { ingredients: string }).ingredients).toBe('string')
    expect((arg as { ingredients: string }).ingredients).toContain('pasta')
  })

  it('export does not include internal id', async () => {
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    const exportBtn = wrapper.findAll('button').find(b => b.text().includes('Exportieren'))
    await exportBtn!.trigger('click')

    const arg = vi.mocked(exportRecipe).mock.calls[0]![0]
    expect(arg).not.toHaveProperty('id')
    expect(arg).not.toHaveProperty('externalId')
  })

  it('export works for a local Dishly recipe', async () => {
    routeName = 'recipe-detail'
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    const exportBtn = wrapper.findAll('button').find(b => b.text().includes('Exportieren'))
    await exportBtn!.trigger('click')

    expect(exportRecipe).toHaveBeenCalledTimes(1)
    const arg = vi.mocked(exportRecipe).mock.calls[0]![0]
    expect(arg.title).toBe('Dishly Pasta')
  })

  it('export handles recipe with missing optional fields gracefully', async () => {
    vi.mocked(recipeApi.getExternalRecipeDetail).mockResolvedValue({
      ...externalDetail(),
      calories: undefined,
      protein: undefined,
      tags: [],
      ingredients: [],
    })
    const wrapper = mount(RecipeDetailView)
    await flushPromises()

    const exportBtn = wrapper.findAll('button').find(b => b.text().includes('Exportieren'))
    await exportBtn!.trigger('click')

    expect(exportRecipe).toHaveBeenCalledTimes(1)
    const arg = vi.mocked(exportRecipe).mock.calls[0]![0]
    expect(arg.title).toBe('Pasta with Garlic')
    expect(arg.calories).toBeNull()
    expect(typeof (arg as { ingredients: string }).ingredients).toBe('string')
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
    instructionsList: ['Kochen'],
    hasRealInstructions: true,
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
