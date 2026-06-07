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

    expect(apiClient.get).toHaveBeenCalledWith('/recipes/external', { params: undefined })
  })

  it('getExternalRecipes calls /recipes/external with search param', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] })

    await recipeApi.getExternalRecipes(' chicken ')

    expect(apiClient.get).toHaveBeenCalledWith('/recipes/external', {
      params: { search: 'chicken' },
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
})
