import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { recipeApi } from '@/shared/api/recipeApi'
import { mealPlanApi } from '@/shared/api/mealPlanApi'
import { i18n, setLocale } from '@/i18n'

vi.mock('@/shared/api/recipeApi', () => ({
  recipeApi: {
    getRecipes: vi.fn(),
    getMyRecipes: vi.fn(),
    getExternalRecipes: vi.fn(),
    getPublishedRecipes: vi.fn(),
    createRecipe: vi.fn(),
    updateRecipe: vi.fn(),
    deleteRecipe: vi.fn(),
  },
}))

vi.mock('@/shared/api/mealPlanApi', () => ({
  mealPlanApi: {
    getWeek: vi.fn(),
    setDay: vi.fn(),
    deleteDay: vi.fn(),
  },
}))

import HomeView from '@/views/HomeView.vue'
import MyRecipesView from '@/views/MyRecipesView.vue'
import NewRecipeView from '@/views/NewRecipeView.vue'
import PantryView from '@/views/PantryView.vue'
import ShoppingListView from '@/views/ShoppingListView.vue'
import MealPlanView from '@/views/MealPlanView.vue'
import AboutView from '@/views/AboutView.vue'
import ContactView from '@/views/ContactView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/my-recipes', component: MyRecipesView },
    { path: '/recipes/new', component: NewRecipeView },
    { path: '/pantry', component: PantryView },
    { path: '/shopping-list', component: ShoppingListView },
    { path: '/meal-plan', component: MealPlanView },
    { path: '/about', component: AboutView },
    { path: '/contact', component: ContactView },
  ],
})

describe('App routing', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    })
    vi.mocked(recipeApi.getRecipes).mockResolvedValue([])
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([])
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([])
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([])
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
      weekStart: '2026-06-01',
      weekEnd: '2026-06-07',
      entries: [],
    })
    setLocale('de')
    setActivePinia(createPinia())
  })

  it('renders Home with ApiRecipeList on /', async () => {
    router.push('/')
    await router.isReady()
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(HomeView, {
      global: { plugins: [router, i18n, pinia] },
    })

    expect(wrapper.html()).toContain('Entdecke Gerichte')
  })

  it('renders MyRecipesView on /my-recipes', async () => {
    router.push('/my-recipes')
    await router.isReady()
    const wrapper = mount(MyRecipesView, {
      global: { plugins: [router, i18n] },
    })

    expect(wrapper.text()).toContain('Dein persönliches Dishly-Kochbuch')
    expect(wrapper.text()).toContain('+ Neues Rezept erstellen')
    expect(wrapper.find('.new-recipe-form').exists()).toBe(false)
    expect(wrapper.find('a.create-recipe-link').attributes('href')).toBe('/recipes/new')
  })

  it('renders NewRecipeView on /recipes/new with the creation form', async () => {
    router.push('/recipes/new')
    await router.isReady()
    const wrapper = mount(NewRecipeView, {
      global: { plugins: [router, i18n] },
    })

    expect(wrapper.text()).toContain('Neues Rezept erstellen')
    expect(wrapper.find('.new-recipe-form').exists()).toBe(true)
    expect(wrapper.find('input[type="file"]').exists()).toBe(true)
    expect(wrapper.find('a.back-link').attributes('href')).toBe('/my-recipes')
  })

  it('renders PantryView on /pantry', async () => {
    router.push('/pantry')
    await router.isReady()
    const wrapper = mount(PantryView, {
      global: { plugins: [router, i18n] },
    })
    expect(wrapper.text()).toContain('Dein Vorrat')
  })

  it('renders ShoppingListView on /shopping-list', async () => {
    router.push('/shopping-list')
    await router.isReady()
    const wrapper = mount(ShoppingListView, {
      global: { plugins: [router, i18n] },
    })
    expect(wrapper.text()).toContain('Deine Einkaufsliste')
  })

  it('renders MealPlanView on /meal-plan', async () => {
    router.push('/meal-plan')
    await router.isReady()
    const wrapper = mount(MealPlanView, {
      global: { plugins: [router, i18n] },
    })
    expect(wrapper.text()).toContain('Wochenplan')
  })

  it('renders AboutView on /about', async () => {
    router.push('/about')
    await router.isReady()
    const wrapper = mount(AboutView, {
      global: { plugins: [router, i18n] },
    })

    expect(wrapper.text()).toContain('Die Person hinter Dishly')
  })

  it('renders AboutView in English', async () => {
    setLocale('en')
    router.push('/about')
    await router.isReady()
    const wrapper = mount(AboutView, {
      global: { plugins: [router, i18n] },
    })

    expect(wrapper.text()).toContain('The person behind Dishly')
    expect(wrapper.text()).not.toContain('Die Person hinter Dishly')
  })

  it('renders ContactView on /contact', async () => {
    router.push('/contact')
    await router.isReady()
    const wrapper = mount(ContactView, {
      global: { plugins: [router, i18n] },
    })

    expect(wrapper.text()).toContain('Schreib uns')
    expect(wrapper.text()).toContain('Dishly.Rezepte@gmx.de')
  })

  it('renders ContactView in English', async () => {
    setLocale('en')
    router.push('/contact')
    await router.isReady()
    const wrapper = mount(ContactView, {
      global: { plugins: [router, i18n] },
    })

    expect(wrapper.text()).toContain('Write to us')
    expect(wrapper.text()).toContain('Dishly.Rezepte@gmx.de')
  })

  it('renders About and Contact with Arabic direction enabled', async () => {
    setLocale('ar')
    router.push('/about')
    await router.isReady()
    const aboutWrapper = mount(AboutView, {
      global: { plugins: [router, i18n] },
    })
    const contactWrapper = mount(ContactView, {
      global: { plugins: [router, i18n] },
    })

    expect(document.documentElement.dir).toBe('rtl')
    expect(aboutWrapper.text().length).toBeGreaterThan(0)
    expect(contactWrapper.text().length).toBeGreaterThan(0)
  })
})
