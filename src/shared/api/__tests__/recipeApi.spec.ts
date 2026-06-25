import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recipeApi } from '@/shared/api/recipeApi'
import { apiClient } from '@/shared/api/apiClient'
import type { RecipeResponse } from '@/types/recipe'

vi.mock('@/shared/api/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('recipeApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getMyRecipes calls /recipes/mine and returns recipes', async () => {
    const recipes: RecipeResponse[] = [
      {
        id: 1,
        title: 'Mine',
        imageUrl: '',
        prepTimeMinutes: 10,
        cookTimeMinutes: 20,
        servings: 2,
        difficulty: 'easy',
        category: 'Italian',
        rating: 4.5,
        ingredients: 'noodles',
        instructions: 'cook',
        favorite: false,
        published: true,
      },
    ]
    vi.mocked(apiClient.get).mockResolvedValue({ data: recipes })

    const result = await recipeApi.getMyRecipes()

    expect(apiClient.get).toHaveBeenCalledWith('/recipes/mine')
    expect(result).toEqual(recipes)
  })

  it('getExternalRecipes calls /recipes/external without params when search is empty', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] })

    await recipeApi.getExternalRecipes()

    expect(apiClient.get).toHaveBeenCalledWith('/recipes/external', undefined)
  })

  it('getPublishedRecipes sends language param when provided', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] })

    await recipeApi.getPublishedRecipes('de')

    expect(apiClient.get).toHaveBeenCalledWith('/recipes/published', {
      params: { language: 'de' },
    })
  })

  it('getPublishedRecipes sends language and search params when provided', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] })

    await recipeApi.getPublishedRecipes('de', ' sushi ')

    expect(apiClient.get).toHaveBeenCalledWith('/recipes/published', {
      params: { language: 'de', search: 'sushi' },
    })
  })

  it('getExternalRecipes calls /recipes/external with search param', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] })

    await recipeApi.getExternalRecipes(' chicken ', undefined, 'en')

    expect(apiClient.get).toHaveBeenCalledWith('/recipes/external', {
      params: { language: 'en', search: 'chicken' },
    })
  })

  it('getExternalRecipes forwards supported filters', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] })

    await recipeApi.getExternalRecipes(' bowl ', {
      vegan: true,
      glutenFree: true,
      lactoseFree: true,
      maxPrepTime: 25,
      mealType: 'lunch',
      highProtein: true,
    }, 'en')

    expect(apiClient.get).toHaveBeenCalledWith('/recipes/external', {
      params: {
        language: 'en',
        search: 'bowl',
        diet: 'vegan',
        intolerances: 'gluten,dairy',
        maxReadyTime: 25,
        type: 'lunch',
      },
    })
  })

  it('getExternalRecipeDetail calls /recipes/external/{id}', async () => {
    const detail = { id: 716429, title: 'Pasta' }
    vi.mocked(apiClient.get).mockResolvedValue({ data: detail })

    const result = await recipeApi.getExternalRecipeDetail(716429)

    expect(apiClient.get).toHaveBeenCalledWith('/recipes/external/716429')
    expect(result).toEqual(detail)
  })

  it('getRecipe calls /recipes/{id}', async () => {
    const recipe = { id: 1, title: 'Dishly Pasta' }
    vi.mocked(apiClient.get).mockResolvedValue({ data: recipe })

    const result = await recipeApi.getRecipe(1)

    expect(apiClient.get).toHaveBeenCalledWith('/recipes/1')
    expect(result).toEqual(recipe)
  })

  it('findExternalRecipesByIngredients calls /recipes/external/by-ingredients with comma separated ingredients', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] })

    await recipeApi.findExternalRecipesByIngredients(['tomato', 'pasta'])

    expect(apiClient.get).toHaveBeenCalledWith('/recipes/external/by-ingredients', {
      params: { ingredients: 'tomato,pasta' },
    })
  })

  it('searchInstructions posts recipe context to /recipes/instructions/search', async () => {
    const response = {
      configured: true,
      results: [{ title: 'Pasta instructions', url: 'https://example.com', snippet: 'Cook it.' }],
    }
    vi.mocked(apiClient.post).mockResolvedValue({ data: response })

    const result = await recipeApi.searchInstructions({
      recipeTitle: 'Pasta',
      sourceUrl: 'https://source.example.com',
      sourceName: 'Dishly',
    })

    expect(apiClient.post).toHaveBeenCalledWith('/recipes/instructions/search', {
      recipeTitle: 'Pasta',
      sourceUrl: 'https://source.example.com',
      sourceName: 'Dishly',
    })
    expect(result).toEqual(response)
  })

  it('uploadRecipeImage posts multipart form data to /recipes/images', async () => {
    const file = new File(['image'], 'recipe.png', { type: 'image/png' })
    const uploadResponse = {
      imageUrl: 'https://example.supabase.co/storage/v1/object/public/recipe-images/recipes/1/image.png',
    }
    vi.mocked(apiClient.post).mockResolvedValue({ data: uploadResponse })

    const result = await recipeApi.uploadRecipeImage(file)

    expect(apiClient.post).toHaveBeenCalledWith(
      '/recipes/images',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    const formData = vi.mocked(apiClient.post).mock.calls[0]![1] as FormData
    expect(formData.get('file')).toBe(file)
    expect(result).toEqual(uploadResponse)
  })
})
