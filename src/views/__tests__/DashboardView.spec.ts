import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardView from '@/views/DashboardView.vue'
import { recipeApi } from '@/shared/api/recipeApi'
import { pantryApi } from '@/shared/api/pantryApi'
import { shoppingListApi } from '@/shared/api/shoppingListApi'
import { useAuthStore } from '@/stores/authStore'
import { i18n, setLocale } from '@/i18n'

vi.mock('@/shared/api/recipeApi', () => ({
  recipeApi: {
    getMyRecipes: vi.fn(),
  },
}))

vi.mock('@/shared/api/pantryApi', () => ({
  pantryApi: {
    getPantryItems: vi.fn(),
  },
}))

vi.mock('@/shared/api/shoppingListApi', () => ({
  shoppingListApi: {
    getShoppingListItems: vi.fn(),
  },
}))

describe('DashboardView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    setLocale('de')
    const authStore = useAuthStore()
    authStore.user = {
      id: 1,
      username: 'salma',
      email: 'salma@example.com',
      role: 'USER',
      createdAt: '2026-06-05T12:00:00Z',
    }

    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([
      recipe(1, true, true),
      recipe(2, false, true),
      recipe(3, false, false),
    ])
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([
      pantryItem(1),
      pantryItem(2),
    ])
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      shoppingItem(1, false),
      shoppingItem(2, true),
      shoppingItem(3, false),
    ])
  })

  it('calculates dashboard numbers from API data', async () => {
    const wrapper = mount(DashboardView, {
      global: {
        plugins: [i18n],
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Willkommen zurück, salma')
    expect(statValue(wrapper, 'Eigene Rezepte')).toBe('3')
    expect(statValue(wrapper, 'Veröffentlichte Rezepte')).toBe('1')
    expect(statValue(wrapper, 'Favoriten')).toBe('2')
    expect(statValue(wrapper, 'Vorratsartikel')).toBe('2')
    expect(statValue(wrapper, 'Einkaufslisten-Items')).toBe('3')
    expect(statValue(wrapper, 'Noch offen')).toBe('2')
  })

  it('keeps recipe and shopping stats visible when pantry loading fails', async () => {
    vi.mocked(pantryApi.getPantryItems).mockRejectedValue(new Error('Pantry unavailable'))

    const wrapper = mount(DashboardView, {
      global: {
        plugins: [i18n],
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    })

    await flushPromises()

    expect(statValue(wrapper, 'Eigene Rezepte')).toBe('3')
    expect(statValue(wrapper, 'Einkaufslisten-Items')).toBe('3')
    expect(statValue(wrapper, 'Vorratsartikel')).toBe('–')
    expect(wrapper.text()).toContain('Vorratsdaten konnten nicht geladen werden.')
  })

  it('renders quick links', async () => {
    const wrapper = mount(DashboardView, {
      global: {
        plugins: [i18n],
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Meine Rezepte')
    expect(wrapper.text()).toContain('Vorrat')
    expect(wrapper.text()).toContain('Einkaufsliste')
    expect(wrapper.text()).toContain('Externe Rezepte suchen')
  })

  it('renders translated dashboard labels in English', async () => {
    setLocale('en')

    const wrapper = mount(DashboardView, {
      global: {
        plugins: [i18n],
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Welcome back, salma')
    expect(statValue(wrapper, 'My Recipes')).toBe('3')
    expect(statValue(wrapper, 'Published Recipes')).toBe('1')
    expect(statValue(wrapper, 'Pantry Items')).toBe('2')
    expect(wrapper.text()).toContain('Search External Recipes')
  })
})

function statValue(wrapper: ReturnType<typeof mount>, label: string) {
  const card = wrapper
    .findAll('.stat-card')
    .find(item => item.text().includes(label))
  return card?.find('.stat-value').text()
}

function recipe(id: number, published: boolean, favorite: boolean) {
  return {
    id,
    title: `Recipe ${id}`,
    imageUrl: '',
    prepTimeMinutes: 0,
    cookTimeMinutes: 0,
    servings: 0,
    difficulty: '',
    category: '',
    rating: 0,
    ingredients: 'x',
    instructions: 'y',
    published,
    favorite,
  }
}

function pantryItem(id: number) {
  return {
    id,
    name: `Pantry ${id}`,
    quantity: 1,
    unit: 'Stück',
    category: 'Gemüse',
    createdAt: '2026-06-06T10:00:00Z',
    updatedAt: '2026-06-06T10:00:00Z',
  }
}

function shoppingItem(id: number, checked: boolean) {
  return {
    id,
    name: `Shopping ${id}`,
    quantity: 1,
    unit: 'Stück',
    category: 'Gemüse',
    checked,
    createdAt: '2026-06-06T10:00:00Z',
    updatedAt: '2026-06-06T10:00:00Z',
  }
}
