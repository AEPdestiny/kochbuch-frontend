import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ApiRecipeList from '@/components/ApiRecipeList.vue'

describe('ApiRecipeList.vue', () => {
  // Vor jedem Test Mocks zurücksetzen, damit Tests unabhängig bleiben
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading text while recipes are being fetched', () => {
    // fetch so mocken, dass er ein leeres Ergebnis liefert
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    })

    // Komponente mounten, der initiale State sollte "Loading…" anzeigen
    const wrapper = mount(ApiRecipeList)

    expect(wrapper.text()).toContain('Loading recipes…')
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

    // fetch so mocken, dass Fake-Rezepte zurückgegeben werden
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => fakeRecipes,
    })

    const wrapper = mount(ApiRecipeList)
    // Warten, bis alle Promises abgearbeitet sind
    await flushPromises()

    // Erwartung: Titel des Rezepts taucht irgendwo im Text auf
    expect(wrapper.text()).toContain('Test Pasta')
  })

  it('shows an error when loading fails', async () => {
    // fetch so mocken, dass ok:false zurückkommt (HTTP-Fehler)
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    })

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    // Erwartung: Fehlermeldung mit „Error:“ wird angezeigt
    expect(wrapper.text()).toContain('Error:')
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

    // fetch-Mock liefert beide Rezepte
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => fakeRecipes,
    })

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
