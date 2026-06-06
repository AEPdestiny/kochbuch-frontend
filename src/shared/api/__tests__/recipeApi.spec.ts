import { describe, expect, it, vi } from 'vitest'
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
})
