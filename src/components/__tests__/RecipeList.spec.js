import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RecipeList from '@/components/RecipeList.vue'

describe('RecipeList.vue', () => {
  // Vor jedem Test Mocks zurücksetzen, damit Tests unabhängig bleiben
  beforeEach(() => {
    vi.restoreAllMocks()
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
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => fakeRecipes,
    })

    const wrapper = mount(RecipeList)

    await flushPromises()

    // Erwartung: Überschrift + Rezepttitel sichtbar
    expect(wrapper.text()).toContain('Your created recipes')
    expect(wrapper.text()).toContain('Test Pasta')
  })

  it('creates a recipe via form submit', async () => {
    const fetchMock = vi.spyOn(global, 'fetch')

    // 1. Aufruf: initiales GET /recipes -> leere Liste
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    const wrapper = mount(RecipeList)
    await flushPromises()

    // 2. Aufruf: POST /recipes -> neues Rezept wird zurückgegeben
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
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
      }),
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
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/recipes'),
      expect.objectContaining({ method: 'POST' })
    )
    // Neues Rezept erscheint
    expect(wrapper.text()).toContain('New Dish')
  })

  it('shows validation error if required fields are missing', async () => {
    const fetchMock = vi.spyOn(global, 'fetch')

    // Initial nur GET /recipes -> leere Liste
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    const wrapper = mount(RecipeList)
    await flushPromises()

    // Ohne Eingaben Submit auslösen
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    // Erwartung: kein zusätzlicher fetch (also kein POST)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // Validierungsfehlermeldung sichtbar
    expect(wrapper.text()).toContain('Please fill in all required fields.')
  })

  it('updates a recipe via edit panel', async () => {
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

    const fetchMock = vi.spyOn(global, 'fetch')
    // Erstes fetch: GET /recipes -> initiale Daten
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => initial,
    })

    const wrapper = mount(RecipeList)
    await flushPromises()

    // Edit-Button des ersten Rezepts anklicken, um Edit-Panel zu öffnen
    await wrapper.find('.link-btn').trigger('click')

    // Zweites fetch: PUT /recipes/1 -> aktualisiertes Rezept zurück
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...initial[0],
        title: 'Updated Title',
      }),
    })

    // Titel im Edit-Panel anpassen
    const titleInput = wrapper.find('.edit-panel input[type="text"]')
    await titleInput.setValue('Updated Title')

    // Speichern-Button klicken
    const saveBtn = wrapper.find('.edit-panel .submit-btn')
    await saveBtn.trigger('click')
    await flushPromises()

    // Erwartung: PUT auf /recipes/1 wurde abgesetzt
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/recipes/1'),
      expect.objectContaining({ method: 'PUT' })
    )
    // Neuer Titel wird angezeigt
    expect(wrapper.text()).toContain('Updated Title')
  })

  it('deletes a recipe when clicking Delete', async () => {
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

    const fetchMock = vi.spyOn(global, 'fetch')
    // Erstes fetch: GET /recipes -> initiale Daten
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => initial,
    })

    const wrapper = mount(RecipeList)
    await flushPromises()

    // Zweites fetch: DELETE /recipes/1
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    // Delete-Button klicken
    const deleteBtn = wrapper.find('.link-btn.danger')
    await deleteBtn.trigger('click')
    await flushPromises()

    // Erwartung: DELETE auf /recipes/1
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/recipes/1'),
      expect.objectContaining({ method: 'DELETE' })
    )
    expect(wrapper.text()).not.toContain('To Delete')
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

    // fetch liefert beide Rezepte
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => initial,
    })

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
