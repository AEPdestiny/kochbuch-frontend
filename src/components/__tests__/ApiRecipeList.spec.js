import { mount, flushPromises, config, enableAutoUnmount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ApiRecipeList from '@/components/ApiRecipeList.vue'
import { recipeApi } from '@/shared/api/recipeApi'
import { mealPlanApi } from '@/shared/api/mealPlanApi'
import { pantryApi } from '@/shared/api/pantryApi'
import { profileApi } from '@/shared/api/profileApi'
import { favoriteApi } from '@/shared/api/favoriteApi'
import { i18n, setLocale } from '@/i18n'
import { AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@/shared/api/recipeApi', () => ({
  recipeApi: {
    getExternalRecipes: vi.fn(),
    getPublishedRecipes: vi.fn(),
  },
}))

vi.mock('@/shared/api/mealPlanApi', () => ({
  mealPlanApi: {
    getWeek: vi.fn(),
    setSlot: vi.fn(),
  },
}))

vi.mock('@/shared/api/pantryApi', () => ({
  pantryApi: {
    getPantryItems: vi.fn(),
  },
}))

vi.mock('@/shared/api/profileApi', () => ({
  profileApi: {
    getPreferences: vi.fn(),
  },
}))

vi.mock('@/shared/api/favoriteApi', () => ({
  favoriteApi: {
    getExternalFavorites: vi.fn(),
    addExternalFavorite: vi.fn(),
    removeExternalFavorite: vi.fn(),
  },
}))

enableAutoUnmount(afterEach)

describe('ApiRecipeList.vue', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    sessionStorage.clear()
    push.mockClear()
    setLocale('de')
    config.global.plugins = [i18n]
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([])
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([])
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([])
    vi.mocked(profileApi.getPreferences).mockResolvedValue({
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
    })
    vi.mocked(favoriteApi.getExternalFavorites).mockResolvedValue([])
    vi.mocked(favoriteApi.addExternalFavorite).mockResolvedValue({ externalRecipeId: '716429' })
    vi.mocked(favoriteApi.removeExternalFavorite).mockResolvedValue()
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
      weekStart: '2026-06-08',
      weekEnd: '2026-06-14',
      entries: [],
    })
    vi.mocked(mealPlanApi.setSlot).mockResolvedValue({
      id: 1,
      plannedDate: '2026-06-08',
      mealSlot: 'breakfast',
      recipe: null,
      customTitle: 'External Pasta',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    config.global.plugins = []
  })

  it('shows loading text while recipes are being fetched', () => {
    const wrapper = mount(ApiRecipeList)

    expect(wrapper.text()).toContain('Rezepte werden geladen...')
  })

  it('loads only published local-language recipes on initial render', async () => {
    setLocale('en')
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(1, 'Test Pasta', 'noodles', 'Italian'),
    ])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    expect(recipeApi.getPublishedRecipes).toHaveBeenCalledWith('en')
    expect(recipeApi.getExternalRecipes).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Test Pasta')
  })

  it('does not show an external source badge for external recipes', async () => {
    setLocale('en')
    vi.useFakeTimers()
    vi.mocked(recipeApi.getPublishedRecipes)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(1, 'External Pasta', 'noodles', 'Italian', { externalId: '716429', source: 'spoonacular' }),
    ])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()
    await wrapper.find('input[type="search"]').setValue('pasta')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    const firstCard = wrapper.find('.recipe-card')
    expect(firstCard.find('.source-pill-external').exists()).toBe(false)
    expect(firstCard.text()).toContain('External Pasta')
  })

  it('does not show a Dishly source badge for own published recipes', async () => {
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(10, 'Published Pasta', 'noodles', 'Italian', { userCreated: true, published: true }),
    ])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    const firstCard = wrapper.find('.recipe-card')
    expect(firstCard.find('.source-pill-dishly').exists()).toBe(false)
    expect(firstCard.text()).toContain('Published Pasta')
  })

  it('shows published seed recipes when ingredients are missing', async () => {
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(10, 'Breakfast Without Ingredients', '', 'breakfast'),
    ])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    expect(wrapper.text()).toContain('Breakfast Without Ingredients')
    expect(wrapper.text()).toContain('Frühstück')
  })

  it('shows protein on recipe cards when protein exists', async () => {
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(10, 'Protein Bowl', 'beans', 'lunch', { protein: 24.4 }),
    ])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    expect(wrapper.text()).toContain('24 g Protein')
  })

  it('shows protein on English recipe cards', async () => {
    setLocale('en')
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(10, 'Protein Bowl', 'beans', 'lunch', { protein: 24.4 }),
    ])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    expect(wrapper.text()).toContain('24 g Protein')
  })

  it('shows protein on Arabic recipe cards', async () => {
    setLocale('ar')
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(10, 'Protein Bowl', 'beans', 'lunch', { protein: 24.4 }),
    ])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    expect(wrapper.text()).toContain('24 g Protein')
  })

  it('shows a clear profile personalization toggle and status', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    expect(wrapper.text()).toContain('Personalisierung ausschalten')
    expect(wrapper.text()).toContain('Profil aktiv')

    await wrapper.find('.plain-filter-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Personalisierung aktivieren')
    expect(wrapper.text()).toContain('Profil ignoriert – Allergien und Abneigungen bleiben aktiv')
  })

  it('translates the personalization controls into English', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    setLocale('en')
    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    expect(wrapper.text()).toContain('Turn off personalization')
    expect(wrapper.text()).toContain('Profile active')
    expect(wrapper.text()).not.toContain('Personalisierung ausschalten')

    await wrapper.find('.plain-filter-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Turn on personalization')
    expect(wrapper.text()).toContain('Profile ignored – allergies and dislikes remain active')
  })

  it('does not show profile personalization controls for guests', async () => {
    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    expect(wrapper.text()).not.toContain('Personalisierung ausschalten')
    expect(wrapper.text()).not.toContain('Personalisierung aktivieren')
    expect(wrapper.text()).not.toContain('Profil aktiv')
    expect(wrapper.find('.plain-filter-button').exists()).toBe(false)
  })

  it('disables soft profile personalization but keeps allergies and dislikes active', async () => {
    vi.useFakeTimers()
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(profileApi.getPreferences).mockResolvedValue({
      likes: ['pasta'],
      dislikes: ['mushroom'],
      allergies: ['nuts'],
      vegan: true,
      vegetarian: false,
      glutenFree: true,
      lactoseFree: true,
      highProtein: true,
      calorieConscious: true,
      budgetFriendly: false,
      maxPrepTimeMinutes: 30,
      calorieGoal: null,
      dailyCalorieTarget: 650,
    })
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(10, 'Vegan Pasta', 'tomato pasta', 'lunch', {
        vegan: true,
        glutenFree: true,
        dairyFree: true,
        calories: 420,
      }),
      recipe(11, 'Chicken Rice', 'rice chicken', 'lunch', {
        vegan: false,
        glutenFree: false,
        dairyFree: false,
        calories: 700,
      }),
      recipe(12, 'Mushroom Pasta', 'mushroom pasta', 'lunch', {
        vegan: true,
        glutenFree: true,
        dairyFree: true,
        calories: 400,
      }),
      recipe(13, 'Nut Salad', 'nuts salad', 'lunch', {
        vegan: true,
        glutenFree: true,
        dairyFree: true,
        calories: 400,
      }),
    ])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    expect(wrapper.text()).toContain('Vegan Pasta')
    expect(wrapper.text()).not.toContain('Chicken Rice')
    expect(wrapper.text()).not.toContain('Mushroom Pasta')
    expect(wrapper.text()).not.toContain('Nut Salad')

    await wrapper.find('.plain-filter-button').trigger('click')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    expect(wrapper.text()).toContain('Chicken Rice')
    expect(wrapper.text()).not.toContain('Mushroom Pasta')
    expect(wrapper.text()).not.toContain('Nut Salad')
    expect(recipeApi.getPublishedRecipes).toHaveBeenCalled()
  })

  it('prioritizes search query over soft profile filters while keeping hard exclusions', async () => {
    vi.useFakeTimers()
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(profileApi.getPreferences).mockResolvedValue({
      likes: ['pasta'],
      dislikes: ['mushroom'],
      allergies: [],
      vegan: true,
      vegetarian: false,
      glutenFree: true,
      lactoseFree: false,
      highProtein: false,
      calorieConscious: false,
      budgetFriendly: false,
      maxPrepTimeMinutes: null,
      calorieGoal: null,
      dailyCalorieTarget: null,
    })
    vi.mocked(recipeApi.getPublishedRecipes)
      .mockResolvedValueOnce([
        recipe(10, 'Vegan Pasta', 'tomato pasta', 'lunch', {
          vegan: true,
          glutenFree: true,
        }),
      ])
      .mockResolvedValue([
        recipe(11, 'Chicken Rice', 'rice chicken', 'lunch', {
          vegan: false,
          glutenFree: false,
        }),
        recipe(12, 'Mushroom Rice', 'mushroom rice', 'lunch', {
          vegan: false,
          glutenFree: false,
        }),
      ])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    await wrapper.find('input[type="search"]').setValue('rice')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    expect(wrapper.text()).toContain('Chicken Rice')
    expect(wrapper.text()).not.toContain('Mushroom Rice')
    expect(recipeApi.getExternalRecipes).not.toHaveBeenCalled()
  })

  it('renders 100 published database recipes from the backend response', async () => {
    setLocale('en')
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue(
      Array.from({ length: 100 }, (_, index) =>
        recipe(index + 1, `Recipe ${index + 1}`, 'ingredient', index < 25 ? 'breakfast' : index < 50 ? 'lunch' : index < 75 ? 'dinner' : 'snack'),
      ),
    )

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    expect(wrapper.findAll('.recipe-card')).toHaveLength(100)
    expect(wrapper.text()).toContain('Recipe 1')
    expect(wrapper.text()).toContain('Recipe 100')
    expect(recipeApi.getExternalRecipes).not.toHaveBeenCalled()
  })

  it('navigates external recipe cards to the external detail route', async () => {
    setLocale('en')
    vi.useFakeTimers()
    vi.mocked(recipeApi.getPublishedRecipes)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(1, 'External Pasta', 'noodles', 'Italian', { externalId: '716429', source: 'spoonacular' }),
    ])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()
    await wrapper.find('input[type="search"]').setValue('pasta')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    await wrapper.find('.recipe-card').trigger('click')

    expect(push).toHaveBeenCalledWith('/recipe/external/716429')
  })

  it('navigates Dishly recipe cards to the local detail route', async () => {
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(10, 'Published Pasta', 'noodles', 'Italian'),
    ])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()
    await wrapper.find('.recipe-card').trigger('click')

    expect(push).toHaveBeenCalledWith('/recipe/10')
  })

  it('opens meal plan modal from home and plans external recipe as customTitle', async () => {
    setLocale('en')
    vi.useFakeTimers()
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(recipeApi.getPublishedRecipes)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(1, 'External Pasta', 'noodles', 'Italian', { externalId: '716429', source: 'spoonacular' }),
    ])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()
    await wrapper.find('input[type="search"]').setValue('pasta')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    await wrapper.find('.meal-plan-card-button').trigger('click')
    await flushPromises()
    expect(mealPlanApi.getWeek).toHaveBeenCalled()
    expect(wrapper.find('.meal-plan-modal').exists()).toBe(true)
    expect(wrapper.findAll('.day-button')).toHaveLength(28)

    await wrapper.find('.day-button').trigger('click')
    await flushPromises()

    expect(mealPlanApi.setSlot).toHaveBeenCalledWith(expect.any(String), 'breakfast', {
      customTitle: 'External Pasta',
      caloriesSnapshot: null,
      proteinSnapshot: null,
      imageUrlSnapshot: '',
      externalRecipeId: '716429',
      externalSource: 'spoonacular',
    })
    expect(wrapper.text()).toContain('Recipe added to meal plan.')
  })

  it('plans Dishly recipe from home with recipeId', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(10, 'Published Pasta', 'noodles', 'Italian'),
    ])
    vi.mocked(mealPlanApi.setSlot).mockResolvedValue({
      id: 2,
      plannedDate: '2026-06-08',
      mealSlot: 'breakfast',
      recipe: recipe(10, 'Published Pasta', 'noodles', 'Italian'),
    })

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    await wrapper.find('.meal-plan-card-button').trigger('click')
    await flushPromises()
    await wrapper.find('.day-button').trigger('click')
    await flushPromises()

    expect(mealPlanApi.setSlot).toHaveBeenCalledWith(expect.any(String), 'breakfast', 10)
  })
  it('favorites external recipes from home through backend api', async () => {
    setLocale('en')
    vi.useFakeTimers()
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(recipeApi.getPublishedRecipes)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(1, 'External Pasta', 'noodles', 'Italian', { externalId: '716429', source: 'spoonacular' }),
    ])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()
    await wrapper.find('input[type="search"]').setValue('pasta')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    await wrapper.find('.favorite-button').trigger('click')
    await flushPromises()

    expect(favoriteApi.addExternalFavorite).toHaveBeenCalledWith({
      externalRecipeId: '716429',
      externalTitle: 'External Pasta',
      externalImageUrl: '',
      externalSource: 'SPOONACULAR',
    })
    expect(wrapper.text()).toContain('♥ Favorit')
  })

  it('favorites local Dishly recipes from home through backend favorite api', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(10, 'Published Pasta', 'noodles', 'dinner'),
    ])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    await wrapper.find('.favorite-button').trigger('click')
    await flushPromises()

    expect(favoriteApi.addExternalFavorite).toHaveBeenCalledWith({
      externalRecipeId: '10',
      externalTitle: 'Published Pasta',
      externalImageUrl: '',
      externalSource: 'DISHLY',
    })
    expect(wrapper.text()).toContain('♥ Favorit')
  })

  it('shows translated English home UI while keeping recipe data unchanged', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    setLocale('en')
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(1, 'Chicken Pasta', 'noodles', 'Italian'),
      recipe(10, 'Dishly Kartoffelsuppe', 'Kartoffeln', 'Deutsch'),
    ])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    expect(wrapper.text()).toContain('Discover dishes from around the world')
    expect(wrapper.find('input[type="search"]').attributes('placeholder')).toBe(
      'Search by title, cuisine or ingredients',
    )
    expect(wrapper.text()).toContain('Shuffle recipes')
    expect(wrapper.text()).toContain('Low calorie')
    expect(wrapper.text()).toContain('Calories ascending')
    expect(wrapper.text()).toContain('Turn off personalization')
    expect(wrapper.text()).toContain('Chicken Pasta')
    expect(wrapper.text()).toContain('Italian')
    expect(wrapper.text()).toContain('Dishly Kartoffelsuppe')
    expect(wrapper.text()).not.toContain('Kartoffeln')
  })

  it('shows an error when initial loading fails', async () => {
    setLocale('en')
    vi.mocked(recipeApi.getPublishedRecipes).mockRejectedValue(
      new Error('Error while loading recipes'),
    )

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    expect(wrapper.text()).toContain('Error:')
  })

  it('searches external recipes after debounce', async () => {
    setLocale('en')
    vi.useFakeTimers()
    vi.mocked(recipeApi.getExternalRecipes)
      .mockResolvedValueOnce([recipe(2, 'Chicken Curry', 'chicken', 'Indian')])
    vi.mocked(recipeApi.getPublishedRecipes)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    await wrapper.find('input[type="search"]').setValue('chicken')
    expect(recipeApi.getExternalRecipes).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    expect(recipeApi.getPublishedRecipes).toHaveBeenLastCalledWith('en', 'chicken')
    expect(recipeApi.getExternalRecipes).toHaveBeenLastCalledWith('chicken', undefined, 'en')
    expect(wrapper.text()).toContain('Chicken Curry')
  })

  it('does not search externally for a single character', async () => {
    setLocale('en')
    vi.useFakeTimers()
    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    await wrapper.find('input[type="search"]').setValue('c')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    expect(recipeApi.getExternalRecipes).not.toHaveBeenCalled()
  })

  it('reloads local recipes when search is cleared without default external fallback', async () => {
    setLocale('en')
    vi.useFakeTimers()
    vi.mocked(recipeApi.getPublishedRecipes).mockImplementation((_, query) =>
      Promise.resolve(query ? [] : [recipe(3, 'Default Pasta', 'noodles', 'Italian')]),
    )
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([recipe(2, 'Chicken Curry', 'chicken', 'Indian')])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    const input = wrapper.find('input[type="search"]')
    await input.setValue('chicken')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    await input.setValue('')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    expect(recipeApi.getPublishedRecipes).toHaveBeenLastCalledWith('en', undefined)
    expect(wrapper.text()).toContain('Default Pasta')
  })

  it('keeps matching published recipes during external search', async () => {
    setLocale('en')
    vi.useFakeTimers()
    vi.mocked(recipeApi.getExternalRecipes)
      .mockResolvedValueOnce([recipe(2, 'External Chicken', 'chicken', 'American')])
    vi.mocked(recipeApi.getPublishedRecipes).mockImplementation((_, query) =>
      Promise.resolve(query
        ? [recipe(10, 'Published Chicken Soup', 'chicken', 'Soup')]
        : [recipe(11, 'Published Pasta', 'noodles', 'Italian')]),
    )

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    await wrapper.find('input[type="search"]').setValue('chicken')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    expect(wrapper.text()).toContain('External Chicken')
    expect(wrapper.text()).toContain('Published Chicken Soup')
    expect(wrapper.text()).not.toContain('Published Pasta')
  })

  it('keeps matching published recipes when external search fails', async () => {
    setLocale('en')
    vi.useFakeTimers()
    vi.mocked(recipeApi.getExternalRecipes)
      .mockRejectedValueOnce(new Error('Spoonacular unavailable'))
    vi.mocked(recipeApi.getPublishedRecipes)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([recipe(10, 'Published Chicken Soup', 'chicken', 'Soup')])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    await wrapper.find('input[type="search"]').setValue('chicken')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    expect(wrapper.text()).toContain('Published Chicken Soup')
    expect(wrapper.text()).toContain('Error:')
    expect(wrapper.text()).toContain('External recipes could not be loaded.')
  })

  it('sorts by real protein values and keeps missing protein last', async () => {
    vi.useFakeTimers()
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(10, 'No Protein Recipe', 'rice', 'lunch', { protein: null }),
      recipe(11, 'High Protein Recipe', 'beans', 'lunch', { protein: 35 }),
      recipe(12, 'Low Protein Recipe', 'salad', 'lunch', { protein: 8 }),
    ])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    const sortSelect = wrapper.findAll('select').find(select =>
      select.text().includes('Protein absteigend'),
    )
    expect(sortSelect?.exists()).toBe(true)
    if (!sortSelect) throw new Error('Protein sort select not found')
    await sortSelect.setValue('proteinDesc')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    const cards = wrapper.findAll('.recipe-card').map(card => card.text())
    expect(cards[0]).toContain('High Protein Recipe')
    expect(cards[1]).toContain('Low Protein Recipe')
    expect(cards[2]).toContain('No Protein Recipe')
  })

  it('sorts calorie conscious recipes by calories ascending and keeps missing calories last', async () => {
    vi.useFakeTimers()
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(10, 'No Calories Recipe', 'rice', 'lunch', { calories: null }),
      recipe(11, 'Low Calories Recipe', 'salad', 'lunch', { calories: 220 }),
      recipe(12, 'Medium Calories Recipe', 'beans', 'lunch', { calories: 480 }),
    ])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    const calorieCheckbox = wrapper.findAll('label').find(label =>
      label.text().includes('Kalorienarm'),
    )?.find('input')
    expect(calorieCheckbox?.exists()).toBe(true)
    if (!calorieCheckbox) throw new Error('Calorie conscious checkbox not found')
    await calorieCheckbox.setValue(true)
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    const sortSelect = wrapper.findAll('select').find(select =>
      select.text().includes('Kalorien aufsteigend'),
    )
    expect(sortSelect?.element.value).toBe('caloriesAsc')

    const cards = wrapper.findAll('.recipe-card').map(card => card.text())
    expect(cards[0]).toContain('Low Calories Recipe')
    expect(cards[1]).toContain('Medium Calories Recipe')
    expect(cards[2]).toContain('No Calories Recipe')
  })

  it('keeps low-calorie, high-protein, sorting and personalization state after shuffle', async () => {
    vi.useFakeTimers()
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(10, 'Protein Bowl', 'beans', 'lunch', { calories: 350, protein: 28 }),
    ])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    const calorieLabel = wrapper.findAll('label').find(label => label.text().includes('Kalorienarm'))
    const proteinLabel = wrapper.findAll('label').find(label => label.text().includes('Proteinreich'))
    const calorieCheckbox = calorieLabel?.find('input')
    const proteinCheckbox = proteinLabel?.find('input')
    const sortSelect = wrapper.findAll('select').find(select => select.text().includes('Kalorien aufsteigend'))

    expect(calorieCheckbox?.exists()).toBe(true)
    expect(proteinCheckbox?.exists()).toBe(true)
    expect(sortSelect?.exists()).toBe(true)
    if (!calorieCheckbox || !proteinCheckbox || !sortSelect) throw new Error('Filter controls not found')

    await calorieCheckbox.setValue(true)
    await proteinCheckbox.setValue(true)
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    await wrapper.find('.shuffle-btn').trigger('click')
    await flushPromises()

    expect(calorieCheckbox.element.checked).toBe(true)
    expect(proteinCheckbox.element.checked).toBe(true)
    expect(sortSelect.element.value).toBe('caloriesAsc')
    expect(wrapper.text()).toContain('Personalisierung ausschalten')
    expect(wrapper.text()).toContain('Profil aktiv')
  })

  it('shows alcohol badge only when alcohol values are present', async () => {
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(10, 'Wine Sauce', 'wine', 'dinner', { alcohol: 1.2, alcoholPercent: 0.4 }),
      recipe(11, 'Apple Juice', 'apple', 'snack', { alcohol: 0, alcoholPercent: 0 }),
    ])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    const cards = wrapper.findAll('.recipe-card').map(card => card.text())
    expect(cards[0]).toContain('Alkohol')
    expect(cards[1]).not.toContain('Alkohol')
  })

  it('renders Arabic home UI without errors', async () => {
    setLocale('ar')

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    expect(wrapper.find('.hero-desc').exists()).toBe(true)
    expect(document.documentElement.dir).toBe('rtl')
  })

  it('does not load external English recipes for German locale and shows local-language empty state', async () => {
    setLocale('de')

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    expect(recipeApi.getPublishedRecipes).toHaveBeenCalledWith('de')
    expect(recipeApi.getExternalRecipes).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Für diese Sprache sind noch keine lokalen Rezepte verfügbar.')
  })
})

function recipe(id, title, ingredients, category, overrides = {}) {
  return {
    id,
    title,
    imageUrl: '',
    prepTimeMinutes: 5,
    cookTimeMinutes: 10,
    servings: 2,
    difficulty: 'easy',
    category,
    rating: 4.5,
    ingredients,
    instructions: 'cook',
    favorite: false,
    published: true,
    ...overrides,
  }
}
