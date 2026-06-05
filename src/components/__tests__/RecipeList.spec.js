import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RecipeList from '@/components/RecipeList.vue'
import { recipeApi } from '@/shared/api/recipeApi'
import { AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'

vi.mock('@/shared/api/recipeApi', () => ({
  recipeApi: {
    getRecipes: vi.fn(),
    createRecipe: vi.fn(),
    updateRecipe: vi.fn(),
    deleteRecipe: vi.fn(),
  },
}))

describe('RecipeList.vue', () => {
  // Vor jedem Test Mocks zurücksetzen, damit Tests unabhängig bleiben
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    sessionStorage.clear()
    vi.mocked(recipeApi.getRecipes).mockResolvedValue([])
  })

  it('loads /recipes and shows "Your created recipes" with items', async () => {
    // Fake-Daten für initiales GET /recipes
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

    // fetch so mocken, dass diese Fake-Daten zurückkommen
    vi.mocked(recipeApi.getRecipes).mockResolvedValue(fakeRecipes)

    const wrapper = mount(RecipeList)

    await flushPromises()

    // Erwartung: Überschrift + Rezepttitel sichtbar
    expect(wrapper.text()).toContain('Your created recipes')
    expect(wrapper.text()).toContain('Test Pasta')
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
      .find('input[placeholder="e.g. Creamy Tomato Pasta"]')
      .setValue('New Dish')
    await wrapper
      .find('textarea[placeholder="List your ingredients, separated by commas."]')
      .setValue('x')
    await wrapper
      .find('textarea[placeholder="Write your step-by-step instructions."]')
      .setValue('y')

    // Formular absenden
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    // Erwartung: letzter fetch war ein POST auf /recipes
    expect(recipeApi.getRecipes).toHaveBeenCalledTimes(1)
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
      .find('input[placeholder="e.g. Creamy Tomato Pasta"]')
      .setValue('New Dish')
    await wrapper
      .find('textarea[placeholder="List your ingredients, separated by commas."]')
      .setValue('x')
    await wrapper
      .find('textarea[placeholder="Write your step-by-step instructions."]')
      .setValue('y')

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(recipeApi.getRecipes).toHaveBeenCalledTimes(1)
    expect(recipeApi.createRecipe).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Bitte melde dich an, um ein Rezept zu erstellen.')
  })

  it('shows validation error if required fields are missing', async () => {
    const wrapper = mount(RecipeList)
    await flushPromises()

    // Ohne Eingaben Submit auslösen
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    // Erwartung: kein zusätzlicher fetch (also kein POST)
    expect(recipeApi.getRecipes).toHaveBeenCalledTimes(1)
    // Validierungsfehlermeldung sichtbar
    expect(wrapper.text()).toContain('Please fill in all required fields.')
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

    vi.mocked(recipeApi.getRecipes).mockResolvedValue(initial)

    const wrapper = mount(RecipeList)
    await flushPromises()

    // Edit-Button des ersten Rezepts anklicken, um Edit-Panel zu öffnen
    await wrapper.find('.link-btn').trigger('click')

    // Zweites fetch: PUT /recipes/1 -> aktualisiertes Rezept zurück
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
    expect(recipeApi.getRecipes).toHaveBeenCalledTimes(1)
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

    vi.mocked(recipeApi.getRecipes).mockResolvedValue(initial)

    const wrapper = mount(RecipeList)
    await flushPromises()

    await wrapper.find('.link-btn').trigger('click')
    const titleInput = wrapper.find('.edit-panel input[type="text"]')
    await titleInput.setValue('Updated Title')

    const saveBtn = wrapper.find('.edit-panel .submit-btn')
    await saveBtn.trigger('click')
    await flushPromises()

    expect(recipeApi.getRecipes).toHaveBeenCalledTimes(1)
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

    vi.mocked(recipeApi.getRecipes).mockResolvedValue(initial)

    const wrapper = mount(RecipeList)
    await flushPromises()

    // Zweites fetch: DELETE /recipes/1
    vi.mocked(recipeApi.deleteRecipe).mockResolvedValue()

    // Delete-Button klicken
    const deleteBtn = wrapper.find('.link-btn.danger')
    await deleteBtn.trigger('click')
    await flushPromises()

    // Erwartung: DELETE auf /recipes/1
    expect(recipeApi.getRecipes).toHaveBeenCalledTimes(1)
    expect(recipeApi.deleteRecipe).toHaveBeenCalledWith(1)
    expect(wrapper.text()).not.toContain('To Delete')
  })

  it('does not delete a recipe without login', async () => {
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

    vi.mocked(recipeApi.getRecipes).mockResolvedValue(initial)

    const wrapper = mount(RecipeList)
    await flushPromises()

    const deleteBtn = wrapper.find('.link-btn.danger')
    await deleteBtn.trigger('click')
    await flushPromises()

    expect(recipeApi.getRecipes).toHaveBeenCalledTimes(1)
    expect(recipeApi.deleteRecipe).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Bitte melde dich an, um ein Rezept zu löschen.')
  })

  it('shows only favorite recipes in favorites grid', async () => {
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

    vi.mocked(recipeApi.getRecipes).mockResolvedValue(initial)

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
})
