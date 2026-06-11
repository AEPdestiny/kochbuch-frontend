import { apiClient } from './apiClient'
import type {
  ExternalRecipeDetailResponse,
  ExternalRecipeMatchResponse,
  RecipeRequest,
  RecipeResponse,
} from '@/types/recipe'

export const recipeApi = {
  async getRecipes(): Promise<RecipeResponse[]> {
    const response = await apiClient.get<RecipeResponse[]>('/recipes')
    return response.data
  },

  async getPublishedRecipes(): Promise<RecipeResponse[]> {
    const response = await apiClient.get<RecipeResponse[]>('/recipes/published')
    return response.data
  },

  async getExternalRecipes(search?: string): Promise<RecipeResponse[]> {
    const params = search?.trim() ? { search: search.trim() } : undefined
    const response = await apiClient.get<RecipeResponse[]>('/recipes/external', { params })
    return response.data
  },

  async getExternalRecipeDetail(id: number | string): Promise<ExternalRecipeDetailResponse> {
    const response = await apiClient.get<ExternalRecipeDetailResponse>(`/recipes/external/${id}`)
    return response.data
  },

  async findExternalRecipesByIngredients(ingredients: string[]): Promise<ExternalRecipeMatchResponse[]> {
    const response = await apiClient.get<ExternalRecipeMatchResponse[]>('/recipes/external/by-ingredients', {
      params: { ingredients: ingredients.join(',') },
    })
    return response.data
  },

  async getRecipe(id: number | string): Promise<RecipeResponse> {
    const response = await apiClient.get<RecipeResponse>(`/recipes/${id}`)
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
