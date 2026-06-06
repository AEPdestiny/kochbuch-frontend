import { apiClient } from './apiClient'
import type { RecipeRequest, RecipeResponse } from '@/types/recipe'

export const recipeApi = {
  async getRecipes(): Promise<RecipeResponse[]> {
    const response = await apiClient.get<RecipeResponse[]>('/recipes')
    return response.data
  },

  async getPublishedRecipes(): Promise<RecipeResponse[]> {
    const response = await apiClient.get<RecipeResponse[]>('/recipes/published')
    return response.data
  },

  async getExternalRecipes(): Promise<RecipeResponse[]> {
    const response = await apiClient.get<RecipeResponse[]>('/recipes/external')
    return response.data
  },

  async getMyRecipes(): Promise<RecipeResponse[]> {
    const response = await apiClient.get<RecipeResponse[]>('/recipes/mine')
    return response.data
  },

  async createRecipe(request: RecipeRequest): Promise<RecipeResponse> {
    const response = await apiClient.post<RecipeResponse>('/recipes', request)
    return response.data
  },

  async updateRecipe(
    id: number | string,
    request: RecipeRequest,
  ): Promise<RecipeResponse> {
    const response = await apiClient.put<RecipeResponse>(`/recipes/${id}`, request)
    return response.data
  },

  async deleteRecipe(id: number | string): Promise<void> {
    await apiClient.delete(`/recipes/${id}`)
  },
}
