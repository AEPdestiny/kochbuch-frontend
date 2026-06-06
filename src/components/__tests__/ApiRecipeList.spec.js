import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ApiRecipeList from '@/components/ApiRecipeList.vue'
import { recipeApi } from '@/shared/api/recipeApi'

vi.mock('@/shared/api/recipeApi', () => ({
  recipeApi: {
    getExternalRecipes: vi.fn(),
    getPublishedRecipes: vi.fn(),
  },
}))

describe('ApiRecipeList.vue', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([])
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows loading text while recipes are being fetched', () => {
    const wrapper = mount(ApiRecipeList)

    expect(wrapper.text()).toContain('Rezepte werden geladen...')
  })

  it('loads external and published recipes on initial render', async () => {
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(1, 'Test Pasta', 'noodles', 'Italian'),
    ])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    expect(recipeApi.getExternalRecipes).toHaveBeenCalledWith()
    expect(recipeApi.getPublishedRecipes).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Test Pasta')
  })

  it('shows an error when initial loading fails', async () => {
    vi.mocked(recipeApi.getExternalRecipes).mockRejectedValue(
      new Error('Error while loading recipes'),
    )
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    expect(wrapper.text()).toContain('Fehler:')
  })

  it('searches external recipes after debounce', async () => {
    vi.useFakeTimers()
    vi.mocked(recipeApi.getExternalRecipes)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([recipe(2, 'Chicken Curry', 'chicken', 'Indian')])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    await wrapper.find('input[type="search"]').setValue('chicken')
    expect(recipeApi.getExternalRecipes).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    expect(recipeApi.getExternalRecipes).toHaveBeenLastCalledWith('chicken')
    expect(wrapper.text()).toContain('Chicken Curry')
  })

  it('does not search externally for a single character', async () => {
    vi.useFakeTimers()
    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    await wrapper.find('input[type="search"]').setValue('c')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    expect(recipeApi.getExternalRecipes).toHaveBeenCalledTimes(1)
  })

  it('loads default external recipes when search is cleared', async () => {
    vi.useFakeTimers()
    vi.mocked(recipeApi.getExternalRecipes)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([recipe(2, 'Chicken Curry', 'chicken', 'Indian')])
      .mockResolvedValueOnce([recipe(3, 'Default Pasta', 'noodles', 'Italian')])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    const input = wrapper.find('input[type="search"]')
    await input.setValue('chicken')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    await input.setValue('')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    expect(recipeApi.getExternalRecipes).toHaveBeenLastCalledWith()
    expect(wrapper.text()).toContain('Default Pasta')
  })

  it('keeps matching published recipes during external search', async () => {
    vi.useFakeTimers()
    vi.mocked(recipeApi.getExternalRecipes)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([recipe(2, 'External Chicken', 'chicken', 'American')])
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(10, 'Published Chicken Soup', 'chicken', 'Soup'),
      recipe(11, 'Published Pasta', 'noodles', 'Italian'),
    ])

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
    vi.useFakeTimers()
    vi.mocked(recipeApi.getExternalRecipes)
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('TheMealDB unavailable'))
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(10, 'Published Chicken Soup', 'chicken', 'Soup'),
    ])

    const wrapper = mount(ApiRecipeList)
    await flushPromises()

    await wrapper.find('input[type="search"]').setValue('chicken')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    expect(wrapper.text()).toContain('Published Chicken Soup')
    expect(wrapper.text()).toContain('Fehler:')
  })
})

function recipe(id, title, ingredients, category) {
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
  }
}
