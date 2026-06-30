import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardView from '@/views/DashboardView.vue'
import { recipeApi } from '@/shared/api/recipeApi'
import { pantryApi } from '@/shared/api/pantryApi'
import { shoppingListApi } from '@/shared/api/shoppingListApi'
import { mealPlanApi } from '@/shared/api/mealPlanApi'
import { profileApi } from '@/shared/api/profileApi'
import { useAuthStore } from '@/stores/authStore'
import { i18n, setLocale } from '@/i18n'

vi.mock('@/shared/api/recipeApi', () => ({ recipeApi: { getMyRecipes: vi.fn() } }))
vi.mock('@/shared/api/pantryApi', () => ({ pantryApi: { getPantryItems: vi.fn() } }))
vi.mock('@/shared/api/shoppingListApi', () => ({ shoppingListApi: { getShoppingListItems: vi.fn() } }))
vi.mock('@/shared/api/mealPlanApi', () => ({ mealPlanApi: { getWeek: vi.fn() } }))
vi.mock('@/shared/api/profileApi', () => ({ profileApi: { getPreferences: vi.fn() } }))

const TODAY = new Date()
const todayStr = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}-${String(TODAY.getDate()).padStart(2, '0')}`

const STUBS = { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } }

function mountDashboard() {
  return mount(DashboardView, { global: { plugins: [i18n], stubs: STUBS } })
}

describe('DashboardView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    setLocale('de')

    const authStore = useAuthStore()
    authStore.user = { id: 1, username: 'salma', email: 'salma@example.com', role: 'USER', createdAt: '2026-06-05T12:00:00Z' }

    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([recipe(1), recipe(2), recipe(3)])
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([pantryItem(1), pantryItem(2)])
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([shoppingItem(1, false), shoppingItem(2, true), shoppingItem(3, false)])
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue(emptyWeek())
    vi.mocked(profileApi.getPreferences).mockResolvedValue(defaultPreferences())
  })

  // ── Basic render ──────────────────────────────────────────────────────────

  it('renders dashboard title', async () => {
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.text()).toContain('Dein Dashboard')
  })

  it('renders current date', async () => {
    const wrapper = mountDashboard()
    await flushPromises()
    // The localized date string should contain the current year
    expect(wrapper.text()).toContain(String(TODAY.getFullYear()))
  })

  // ── Today's plan ─────────────────────────────────────────────────────────

  it('shows empty state when nothing is planned today', async () => {
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue(emptyWeek())
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.text()).toContain('Heute ist noch nichts geplant.')
  })

  it('shows today\'s meal plan entries', async () => {
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
      weekStart: todayStr,
      weekEnd: todayStr,
      entries: [
        { id: '1', plannedDate: todayStr, mealSlot: 'lunch', recipe: recipe(1), calories: 520 },
        { id: '2', plannedDate: todayStr, mealSlot: 'dinner', recipe: recipe(2), calories: 750 },
      ],
    })
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.text()).toContain('Recipe 1')
    expect(wrapper.text()).toContain('Recipe 2')
    expect(wrapper.text()).toContain('520 kcal')
  })

  it('does not show yesterday\'s entries', async () => {
    const yesterday = new Date(TODAY)
    yesterday.setDate(yesterday.getDate() - 1)
    const yd = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
      weekStart: yd, weekEnd: yd,
      entries: [{ id: '1', plannedDate: yd, mealSlot: 'dinner', recipe: recipe(1), calories: 600 }],
    })
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.text()).toContain('Heute ist noch nichts geplant.')
  })

  // ── Calories ─────────────────────────────────────────────────────────────

  it('shows calorie goal and progress when profile has dailyCalorieTarget', async () => {
    vi.mocked(profileApi.getPreferences).mockResolvedValue({ ...defaultPreferences(), dailyCalorieTarget: 2200 })
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
      weekStart: todayStr, weekEnd: todayStr,
      entries: [{ id: '1', plannedDate: todayStr, mealSlot: 'dinner', calories: 1200 }],
    })
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.text()).toContain('1200 / 2200 kcal')
  })

  it('shows no-goal hint when profile has no dailyCalorieTarget', async () => {
    vi.mocked(profileApi.getPreferences).mockResolvedValue({ ...defaultPreferences(), dailyCalorieTarget: null, calorieGoal: null })
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.text()).toContain('Kein Tagesziel gesetzt.')
  })

  it('renders progress bar element', async () => {
    vi.mocked(profileApi.getPreferences).mockResolvedValue({ ...defaultPreferences(), dailyCalorieTarget: 2000 })
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
      weekStart: todayStr, weekEnd: todayStr,
      entries: [{ id: '1', plannedDate: todayStr, mealSlot: 'dinner', calories: 1000 }],
    })
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.find('.cal-bar-bg').exists()).toBe(true)
    expect(wrapper.find('.cal-bar-fill').exists()).toBe(true)
  })

  // ── Shopping list ─────────────────────────────────────────────────────────

  it('shows open shopping list items (max 5)', async () => {
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      shoppingItem(1, false), shoppingItem(2, false), shoppingItem(3, true),
    ])
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.text()).toContain('Shopping 1')
    expect(wrapper.text()).toContain('Shopping 2')
    expect(wrapper.text()).not.toContain('Shopping 3') // checked item not shown
  })

  it('shows shopping list empty state when no open items', async () => {
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([shoppingItem(1, true)])
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.text()).toContain('Keine offenen Einträge.')
  })

  // ── Pantry ────────────────────────────────────────────────────────────────

  it('shows pantry items', async () => {
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.text()).toContain('Pantry 1')
    expect(wrapper.text()).toContain('Pantry 2')
  })

  it('shows pantry empty state', async () => {
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([])
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.text()).toContain('Vorrat noch leer.')
  })

  // ── Recipes ───────────────────────────────────────────────────────────────

  it('shows own recipe count and first recipes', async () => {
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.text()).toContain('3 Rezepte')
    expect(wrapper.text()).toContain('Recipe 1')
    expect(wrapper.text()).toContain('Recipe 2')
    expect(wrapper.text()).toContain('Recipe 3')
  })

  it('shows recipe empty state when no own recipes', async () => {
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([])
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.text()).toContain('Noch keine eigenen Rezepte.')
  })

  // ── Profile chips ─────────────────────────────────────────────────────────

  it('shows profile chips for likes and highProtein', async () => {
    vi.mocked(profileApi.getPreferences).mockResolvedValue({
      ...defaultPreferences(), likes: ['Pasta'], highProtein: true,
    })
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.text()).toContain('Vorlieben')
    expect(wrapper.text()).toContain('Proteinreich')
  })

  // ── Error resilience ──────────────────────────────────────────────────────

  it('still shows other cards when pantry fails', async () => {
    vi.mocked(pantryApi.getPantryItems).mockRejectedValue(new Error('Pantry unavailable'))
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.text()).toContain('Vorratsdaten konnten nicht geladen werden.')
    expect(wrapper.text()).toContain('Recipe 1')
    expect(wrapper.text()).toContain('Shopping 1')
  })

  it('still shows other cards when meal plan fails', async () => {
    vi.mocked(mealPlanApi.getWeek).mockRejectedValue(new Error('Plan unavailable'))
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.text()).toContain('Wochenplan konnte nicht geladen werden.')
    expect(wrapper.text()).toContain('Pantry 1')
    expect(wrapper.text()).toContain('Recipe 1')
  })

  it('still shows other cards when profile fails', async () => {
    vi.mocked(profileApi.getPreferences).mockRejectedValue(new Error('Profile unavailable'))
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.text()).toContain('Profildaten konnten nicht geladen werden.')
    expect(wrapper.text()).toContain('Pantry 1')
  })

  // ── Navigation links ──────────────────────────────────────────────────────

  it('has navigation links to key routes', async () => {
    const wrapper = mountDashboard()
    await flushPromises()
    const hrefs = wrapper.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toContain('/meal-plan')
    expect(hrefs).toContain('/shopping-list')
    expect(hrefs).toContain('/pantry')
    expect(hrefs).toContain('/my-recipes')
    expect(hrefs).toContain('/profile')
    expect(hrefs).toContain('/recipes/new')
  })

  // ── English locale ────────────────────────────────────────────────────────

  it('renders in English', async () => {
    setLocale('en')
    vi.mocked(profileApi.getPreferences).mockResolvedValue({ ...defaultPreferences(), dailyCalorieTarget: 2000 })
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
      weekStart: todayStr, weekEnd: todayStr,
      entries: [{ id: '1', plannedDate: todayStr, mealSlot: 'dinner', calories: 800 }],
    })
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.text()).toContain('Your Dashboard')
    expect(wrapper.text()).toContain('800 / 2000 kcal')
    expect(wrapper.text()).toContain('My Recipes')
  })
})

// ── Fixtures ──────────────────────────────────────────────────────────────

function recipe(id: number) {
  return {
    id, title: `Recipe ${id}`, imageUrl: '', prepTimeMinutes: 0, cookTimeMinutes: 0,
    servings: 2, difficulty: '', category: '', rating: 0, ingredients: 'x',
    instructions: 'y', published: false, favorite: false, calories: 400,
  }
}

function pantryItem(id: number) {
  return { id, name: `Pantry ${id}`, quantity: 1, unit: 'Stück', category: '', createdAt: '', updatedAt: '' }
}

function shoppingItem(id: number, checked: boolean) {
  return { id, name: `Shopping ${id}`, quantity: 1, unit: 'Stück', category: '', checked, createdAt: '', updatedAt: '' }
}

function emptyWeek() {
  return { weekStart: todayStr, weekEnd: todayStr, entries: [] }
}

function defaultPreferences() {
  return {
    likes: [], dislikes: [], allergies: [], vegan: false, vegetarian: false,
    glutenFree: false, lactoseFree: false, highProtein: false, calorieConscious: false,
    budgetFriendly: false, maxPrepTimeMinutes: null, calorieGoal: null, dailyCalorieTarget: null,
  }
}
