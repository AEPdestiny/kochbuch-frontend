import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EditRecipeView from '@/views/EditRecipeView.vue'
import { recipeApi } from '@/shared/api/recipeApi'
import { AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { i18n, setLocale } from '@/i18n'
import type { Recipe } from '@/types/recipe'

vi.mock('@/shared/api/recipeApi', () => ({
  recipeApi: {
    getRecipe: vi.fn(),
    updateRecipe: vi.fn(),
    uploadRecipeImage: vi.fn(),
  },
}))

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: '1',
    title: 'Pasta Carbonara',
    imageUrl: 'https://example.com/pasta.jpg',
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    servings: 2,
    difficulty: 'easy',
    category: 'dinner',
    rating: 0,
    ingredients: '200 g Spaghetti, 2 Eier',
    instructions: 'Kochen.',
    favorite: false,
    published: true,
    calories: 600,
    ...overrides,
  }
}

function testRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/my-recipes/:id/edit', name: 'edit-recipe', component: EditRecipeView },
      { path: '/recipe/:id', component: { template: '<div />' } },
    ],
  })
  router.push('/my-recipes/1/edit')
  return router
}

describe('EditRecipeView', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.clearAllMocks()
    setLocale('de')
    vi.mocked(recipeApi.getRecipe).mockResolvedValue(recipe())
  })

  it('opens correctly and renders the title as a single-line text input, not a textarea', async () => {
    const router = testRouter()
    await router.isReady()
    const wrapper = mount(EditRecipeView, { global: { plugins: [i18n, router] } })
    await flushPromises()

    const titleInput = wrapper.find('input[type="text"]')
    expect(titleInput.exists()).toBe(true)
    expect((titleInput.element as HTMLInputElement).value).toBe('Pasta Carbonara')
    // Title's own form-field must contain a plain <input>, never a <textarea>
    // (other fields like instructions legitimately use a textarea).
    const titleField = titleInput.element.closest('.form-field')
    expect(titleField?.querySelector('textarea')).toBeNull()
  })

  it('title remains editable', async () => {
    const router = testRouter()
    await router.isReady()
    const wrapper = mount(EditRecipeView, { global: { plugins: [i18n, router] } })
    await flushPromises()

    const titleInput = wrapper.find('input[type="text"]')
    await titleInput.setValue('Neuer Titel')
    expect((titleInput.element as HTMLInputElement).value).toBe('Neuer Titel')
  })

  it('saving submits the edited title and navigates to the recipe detail page', async () => {
    vi.mocked(recipeApi.updateRecipe).mockResolvedValue(recipe({ title: 'Neuer Titel' }))
    const router = testRouter()
    await router.isReady()
    const wrapper = mount(EditRecipeView, { global: { plugins: [i18n, router] } })
    await flushPromises()

    await wrapper.find('input[type="text"]').setValue('Neuer Titel')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(recipeApi.updateRecipe).toHaveBeenCalledWith('1', expect.objectContaining({ title: 'Neuer Titel' }))
    expect(router.currentRoute.value.path).toBe('/recipe/1')
  })

  it('keeps the image preview correct (shows the loaded imageUrl)', async () => {
    const router = testRouter()
    await router.isReady()
    const wrapper = mount(EditRecipeView, { global: { plugins: [i18n, router] } })
    await flushPromises()

    const img = wrapper.find('img.image-preview')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/pasta.jpg')
  })
})
