import { mount, flushPromises, config } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RecipeList from '@/components/RecipeList.vue'
import { recipeApi } from '@/shared/api/recipeApi'
import { favoriteApi } from '@/shared/api/favoriteApi'
import { ApiClientError, AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { i18n, setLocale } from '@/i18n'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@/shared/api/recipeApi', () => ({
  recipeApi: {
    getRecipes: vi.fn(),
    getMyRecipes: vi.fn(),
    createRecipe: vi.fn(),
    updateRecipe: vi.fn(),
    deleteRecipe: vi.fn(),
  },
}))

vi.mock('@/shared/api/favoriteApi', () => ({
  favoriteApi: {
    getExternalFavorites: vi.fn(),
    removeExternalFavorite: vi.fn(),
  },
}))

describe('RecipeList.vue', () => {
  // Vor jedem Test Mocks zurücksetzen, damit Tests unabhängig bleiben
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    push.mockClear()
    sessionStorage.clear()
    setLocale('de')
    config.global.plugins = [i18n]
    vi.mocked(recipeApi.getRecipes).mockResolvedValue([])
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([])
    vi.mocked(favoriteApi.getExternalFavorites).mockResolvedValue([])
    vi.mocked(favoriteApi.removeExternalFavorite).mockResolvedValue()
  })

  it('loads /recipes/mine and shows "Deine erstellten Rezepte" with items for logged-in users', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    // Fake-Daten für initiales GET /recipes/mine
    const fakeRecipes = [
      {
        id: 1,
        title: 'Test Pasta',
        imageUrl: '',
        prepTimeMinutes: 5,
        cookTimeMinutes: 10,
        servings: 2,
        difficulty: 'easy',
        category: 'Italian',
        rating: 4.5,
        ingredients: 'noodles',
        instructions: 'cook',
        favorite: false,
        published: false,
      },
    ]

    // recipeApi so mocken, dass diese Fake-Daten zurückkommen
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue(fakeRecipes)

    const wrapper = mount(RecipeList)

    await flushPromises()

    // Erwartung: Überschrift + Rezepttitel sichtbar
    expect(recipeApi.getMyRecipes).toHaveBeenCalledTimes(1)
    expect(recipeApi.getRecipes).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Deine erstellten Rezepte')
    expect(wrapper.text()).toContain('Test Pasta')
  })

  it('does not load recipes without login and shows a hint', async () => {
    const wrapper = mount(RecipeList)

    await flushPromises()

    expect(recipeApi.getMyRecipes).not.toHaveBeenCalled()
    expect(recipeApi.getRecipes).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Bitte melde dich an, um deine Rezepte zu sehen.')
    const loginLink = wrapper.find('a.login-link')
    expect(loginLink.exists()).toBe(true)
    expect(loginLink.attributes('href')).toBe('/login')
    expect(loginLink.text()).toBe('Zum Login')
  })

  it('shows a readable message when loading my recipes returns 401', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(recipeApi.getMyRecipes).mockRejectedValue(
      new ApiClientError('Missing or invalid Bearer token.', 401),
    )

    const wrapper = mount(RecipeList)
    await flushPromises()

    expect(recipeApi.getMyRecipes).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Bitte melde dich erneut an, um deine Rezepte zu sehen.')
  })

  it('creates a recipe via form submit', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(RecipeList)
    await flushPromises()

    // 2. Aufruf: POST /recipes -> neues Rezept wird zurückgegeben
    vi.mocked(recipeApi.createRecipe).mockResolvedValue({
        id: 1,
        title: 'New Dish',
        imageUrl: '',
        prepTimeMinutes: 0,
        cookTimeMinutes: 0,
        servings: 0,
        difficulty: '',
        category: '',
        rating: 0,
        ingredients: 'x',
        instructions: 'y',
        favorite: false,
        published: false,
    })

    // Formularfelder mit Testwerten befüllen
    await wrapper
      .find('input[placeholder="z. B. Cremige Tomatenpasta"]')
      .setValue('New Dish')
    await wrapper
      .find('textarea[placeholder="Zutaten mit Kommas getrennt eintragen."]')
      .setValue('x')
    await wrapper
      .find('textarea[placeholder="Beschreibe die Zubereitung Schritt für Schritt."]')
      .setValue('y')

    // Formular absenden
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    // Erwartung: initialer Read lief über recipeApi, Create über recipeApi.createRecipe
    expect(recipeApi.getMyRecipes).toHaveBeenCalledTimes(1)
    expect(recipeApi.createRecipe).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New Dish',
        ingredients: 'x',
        instructions: 'y',
      })
    )
    // Neues Rezept erscheint
    expect(wrapper.text()).toContain('New Dish')
  })

  it('does not create a recipe without login', async () => {
    const wrapper = mount(RecipeList)
    await flushPromises()

    await wrapper
      .find('input[placeholder="z. B. Cremige Tomatenpasta"]')
      .setValue('New Dish')
    await wrapper
      .find('textarea[placeholder="Zutaten mit Kommas getrennt eintragen."]')
      .setValue('x')
    await wrapper
      .find('textarea[placeholder="Beschreibe die Zubereitung Schritt für Schritt."]')
      .setValue('y')

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(recipeApi.getMyRecipes).not.toHaveBeenCalled()
    expect(recipeApi.createRecipe).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Bitte melde dich an, um ein Rezept zu erstellen.')
  })

  it('shows validation error if required fields are missing', async () => {
    const wrapper = mount(RecipeList)
    await flushPromises()

    // Ohne Eingaben Submit auslösen
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    // Erwartung: kein zusätzlicher Create-Request
    expect(recipeApi.getMyRecipes).not.toHaveBeenCalled()
    // Validierungsfehlermeldung sichtbar
    expect(wrapper.text()).toContain('Bitte fülle alle Pflichtfelder aus.')
  })

  it('updates a recipe via edit panel', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    // Startzustand mit einem vorhandenen Rezept
    const initial = [
      {
        id: 1,
        title: 'Old Title',
        imageUrl: '',
        prepTimeMinutes: 0,
        cookTimeMinutes: 0,
        servings: 0,
        difficulty: '',
        category: '',
        rating: 0,
        ingredients: 'x',
        instructions: 'y',
        favorite: false,
        published: false,
      },
    ]

    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue(initial)

    const wrapper = mount(RecipeList)
    await flushPromises()

    // Edit-Button des ersten Rezepts anklicken, um Edit-Panel zu öffnen
    await wrapper.find('.link-btn').trigger('click')

    // Update-Request liefert das aktualisierte Rezept zurück
    vi.mocked(recipeApi.updateRecipe).mockResolvedValue({
      ...initial[0],
      title: 'Updated Title',
    })

    // Titel im Edit-Panel anpassen
    const titleInput = wrapper.find('.edit-panel input[type="text"]')
    await titleInput.setValue('Updated Title')

    // Speichern-Button klicken
    const saveBtn = wrapper.find('.edit-panel .submit-btn')
    await saveBtn.trigger('click')
    await flushPromises()

    // Erwartung: PUT auf /recipes/1 wurde abgesetzt
    expect(recipeApi.getMyRecipes).toHaveBeenCalledTimes(1)
    expect(recipeApi.updateRecipe).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        title: 'Updated Title',
        ingredients: 'x',
        instructions: 'y',
      })
    )
    // Neuer Titel wird angezeigt
    expect(wrapper.text()).toContain('Updated Title')
  })

  it('does not update a recipe without login', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const initial = [
      {
        id: 1,
        title: 'Old Title',
        imageUrl: '',
        prepTimeMinutes: 0,
        cookTimeMinutes: 0,
        servings: 0,
        difficulty: '',
        category: '',
        rating: 0,
        ingredients: 'x',
        instructions: 'y',
        favorite: false,
        published: false,
      },
    ]

    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue(initial)

    const wrapper = mount(RecipeList)
    await flushPromises()
    sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)

    await wrapper.find('.link-btn').trigger('click')
    const titleInput = wrapper.find('.edit-panel input[type="text"]')
    await titleInput.setValue('Updated Title')

    const saveBtn = wrapper.find('.edit-panel .submit-btn')
    await saveBtn.trigger('click')
    await flushPromises()

    expect(recipeApi.getMyRecipes).toHaveBeenCalledTimes(1)
    expect(recipeApi.updateRecipe).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Bitte melde dich an, um ein Rezept zu bearbeiten.')
  })

  it('deletes a recipe when clicking Delete', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    // Startzustand mit einem Rezept, das gelöscht werden soll
    const initial = [
      {
        id: 1,
        title: 'To Delete',
        imageUrl: '',
        prepTimeMinutes: 0,
        cookTimeMinutes: 0,
        servings: 0,
        difficulty: '',
        category: '',
        rating: 0,
        ingredients: 'x',
        instructions: 'y',
        favorite: false,
        published: false,
      },
    ]

    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue(initial)

    const wrapper = mount(RecipeList)
    await flushPromises()

    // Delete-Request erfolgreich mocken
    vi.mocked(recipeApi.deleteRecipe).mockResolvedValue()

    // Delete-Button klicken
    const deleteBtn = wrapper.find('.link-btn.danger')
    await deleteBtn.trigger('click')
    await flushPromises()

    // Erwartung: DELETE auf /recipes/1
    expect(recipeApi.getMyRecipes).toHaveBeenCalledTimes(1)
    expect(recipeApi.deleteRecipe).toHaveBeenCalledWith(1)
    expect(wrapper.text()).not.toContain('To Delete')
  })

  it('does not delete a recipe without login', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const initial = [
      {
        id: 1,
        title: 'To Delete',
        imageUrl: '',
        prepTimeMinutes: 0,
        cookTimeMinutes: 0,
        servings: 0,
        difficulty: '',
        category: '',
        rating: 0,
        ingredients: 'x',
        instructions: 'y',
        favorite: false,
        published: false,
      },
    ]

    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue(initial)

    const wrapper = mount(RecipeList)
    await flushPromises()
    sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)

    const deleteBtn = wrapper.find('.link-btn.danger')
    await deleteBtn.trigger('click')
    await flushPromises()

    expect(recipeApi.getMyRecipes).toHaveBeenCalledTimes(1)
    expect(recipeApi.deleteRecipe).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Bitte melde dich an, um ein Rezept zu löschen.')
  })

  it('shows only favorite recipes in favorites grid', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    // Zwei Rezepte: eines favorite, eines nicht
    const initial = [
      {
        id: 1,
        title: 'Fav 1',
        imageUrl: '',
        prepTimeMinutes: 0,
        cookTimeMinutes: 0,
        servings: 0,
        difficulty: '',
        category: '',
        rating: 0,
        ingredients: 'x',
        instructions: 'y',
        favorite: true,
        published: false,
      },
      {
        id: 2,
        title: 'Not Fav',
        imageUrl: '',
        prepTimeMinutes: 0,
        cookTimeMinutes: 0,
        servings: 0,
        difficulty: '',
        category: '',
        rating: 0,
        ingredients: 'x',
        instructions: 'y',
        favorite: false,
        published: false,
      },
    ]

    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue(initial)

    const wrapper = mount(RecipeList)
    await flushPromises()

    // Titel aus der Favoriten-Ansicht auslesen
    const favGrid = wrapper
      .findAll('.recipe-grid .card-title')
      .map(n => n.text())

    // Erwartung: Nur das Favorite-Rezept wird angezeigt
    expect(favGrid).toContain('Fav 1')
    expect(favGrid).not.toContain('Not Fav')
  })

  it('shows external API favorites and opens external detail route', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([])
    vi.mocked(favoriteApi.getExternalFavorites).mockResolvedValue([
      {
        id: 1,
        externalRecipeId: '716429',
        externalTitle: 'External Pasta',
        externalImageUrl: 'https://example.com/pasta.jpg',
        externalSource: 'SPOONACULAR',
      },
    ])

    const wrapper = mount(RecipeList)
    await flushPromises()

    expect(wrapper.text()).toContain('External Pasta')
    await wrapper.find('.recipe-grid .recipe-card').trigger('click')

    expect(push).toHaveBeenCalledWith('/recipe/external/716429')
  })

  it('removes external favorites directly from the favorites grid', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([])
    vi.mocked(favoriteApi.getExternalFavorites).mockResolvedValue([
      {
        id: 1,
        externalRecipeId: '716429',
        externalTitle: 'External Pasta',
        externalImageUrl: 'https://example.com/pasta.jpg',
        externalSource: 'SPOONACULAR',
      },
    ])

    const wrapper = mount(RecipeList)
    await flushPromises()

    expect(wrapper.text()).toContain('External Pasta')
    await wrapper.find('.favorite-remove-button').trigger('click')
    await flushPromises()

    expect(favoriteApi.removeExternalFavorite).toHaveBeenCalledWith('SPOONACULAR', '716429')
    expect(wrapper.text()).not.toContain('External Pasta')
  })

  it('removes own favorites directly by updating the recipe', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const ownFavorite = {
      id: 1,
      title: 'Fav 1',
      imageUrl: '',
      prepTimeMinutes: 0,
      cookTimeMinutes: 0,
      servings: 0,
      difficulty: '',
      category: '',
      rating: 0,
      ingredients: 'x',
      instructions: 'y',
      favorite: true,
      published: false,
    }
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([ownFavorite])
    vi.mocked(recipeApi.updateRecipe).mockResolvedValue({ ...ownFavorite, favorite: false })

    const wrapper = mount(RecipeList)
    await flushPromises()

    await wrapper.find('.favorite-remove-button').trigger('click')
    await flushPromises()

    expect(recipeApi.updateRecipe).toHaveBeenCalledWith(1, expect.objectContaining({
      favorite: false,
      published: false,
    }))
    expect(wrapper.find('.recipe-grid').text()).not.toContain('Fav 1')
  })
  it('shows English recipe UI texts after locale switch while recipe data stays unchanged', async () => {
    setLocale('en')
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([
      {
        id: 1,
        title: 'Kartoffelsuppe',
        imageUrl: '',
        prepTimeMinutes: 5,
        cookTimeMinutes: 10,
        servings: 2,
        difficulty: 'einfach',
        category: 'Hausmannskost',
        rating: 4.5,
        ingredients: 'Kartoffeln, Lauch',
        instructions: 'Kochen',
        favorite: true,
        published: true,
      },
    ])

    const wrapper = mount(RecipeList)
    await flushPromises()

    expect(wrapper.text()).toContain('Create a new recipe')
    expect(wrapper.text()).toContain('Your created recipes')
    expect(wrapper.text()).toContain('Your favorite recipes')
    expect(wrapper.text()).toContain('Save recipe')
    expect(wrapper.text()).toContain('Kartoffelsuppe')
    expect(wrapper.text()).toContain('Kartoffeln, Lauch')
    expect(wrapper.text()).toContain('Hausmannskost')
  })

  it('renders Arabic recipe UI texts without errors', async () => {
    setLocale('ar')

    const wrapper = mount(RecipeList)
    await flushPromises()

    expect(wrapper.text()).toContain('إنشاء وصفة جديدة')
    expect(wrapper.text()).toContain('يرجى تسجيل الدخول لرؤية وصفاتك.')
  })
})
