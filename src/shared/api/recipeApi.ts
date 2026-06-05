import { apiClient } from './apiClient'

export type RecipeRequest = {
  title: string
  imageUrl: string
  prepTimeMinutes: number
  cookTimeMinutes: number
  servings: number
  difficulty: string
  category: string
  rating: number
  ingredients: string
  instructions: string
  favorite: boolean
  published: boolean
}

export type RecipeResponse = RecipeRequest & {
  id: number | string
}

export const recipeApi = {
  async getRecipes(): Promise<RecipeResponse[]> {
    const response = await apiClient.get<RecipeResponse[]>('/recipes')
    return response.data
  },

  async getPublishedRecipes(): Promise<RecipeResponse[]> {
    const response = await apiClient.get<RecipeResponse[]>('/recipes/published')
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
