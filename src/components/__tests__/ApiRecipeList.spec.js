import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ApiRecipeList from '@/components/ApiRecipeList.vue'
import { recipeApi } from '@/shared/api/recipeApi'

vi.mock('@/shared/api/recipeApi', () => ({
  recipeApi: {
    getExternalRecipes: vi.fn(),
    getPublishedRecipes: vi.fn(),
  },
}))

describe('ApiRecipeList.vue', () => {
  // Vor jedem Test Mocks zurücksetzen, damit Tests unabhängig bleiben
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([])
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([])
  })

  it('shows loading text while recipes are being fetched', () => {
    // recipeApi liefert standardmaessig leere Ergebnisse
    // Komponente mounten, der initiale State sollte "Loading…" anzeigen
    const wrapper = mount(ApiRecipeList)

    expect(wrapper.text()).toContain('Rezepte werden geladen...')
  })

  it('loads recipes and renders cards', async () => {
    // Fake-Daten für ein Rezept definieren
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
      },
    ]

    // recipeApi so mocken, dass Fake-Rezepte zurückgegeben werden
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue(fakeRecipes)
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([])

    const wrapper = mount(ApiRecipeList)
    // Warten, bis alle Promises abgearbeitet sind
    await flushPromises()

    // Erwartung: Titel des Rezepts taucht irgendwo im Text auf
    expect(wrapper.text()).toContain('Test Pasta')
  })

  it('shows an error when loading fails', async () => {
    // recipeApi so mocken, dass ein Ladefehler zurückkommt
    vi.mocked(recipeApi.getExternalRecipes).mockRejectedValue(
      new Error('Error while loading recipes'),
    )
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    // Erwartung: Fehlermeldung mit „Fehler:“ wird angezeigt
    expect(wrapper.text()).toContain('Fehler:')
  })

  it('filters recipes by search term', async () => {
    // Zwei Rezepte, damit der Filter getestet werden kann
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
      },
      {
        id: 2,
        title: 'Tomato Soup',
        imageUrl: '',
        prepTimeMinutes: 5,
        cookTimeMinutes: 15,
        servings: 2,
        difficulty: 'easy',
        category: 'Soup',
        rating: 4.0,
        ingredients: 'tomato',
        instructions: 'cook',
      },
    ]

    // recipeApi liefert externe Rezepte, published bleibt leer
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue(fakeRecipes)
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    // Suchfeld finden und „Pasta“ eintippen
    const input = wrapper.find('input[type="search"]')
    await input.setValue('Pasta')

    // Erwartung: Nur das passende Rezept bleibt sichtbar
    expect(wrapper.text()).toContain('Test Pasta')
    expect(wrapper.text()).not.toContain('Tomato Soup')
  })
})
