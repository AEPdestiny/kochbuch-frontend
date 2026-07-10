import { apiClient } from './apiClient'
import type {
  ExternalRecipeDetailResponse,
  ExternalRecipeMatchResponse,
  ImageUploadResponse,
  InstructionSearchRequest,
  InstructionSearchResponse,
  RecipeInstructionSuggestionResponse,
  RecipeSearchFilters,
  RecipeRequest,
  RecipeResponse,
} from '@/types/recipe'

export const recipeApi = {
  async getRecipes(language?: string): Promise<RecipeResponse[]> {
    const response = await apiClient.get<RecipeResponse[]>('/recipes', languageConfig(language))
    return response.data
  },

  async getPublishedRecipes(language?: string, search?: string): Promise<RecipeResponse[]> {
    const response = await apiClient.get<RecipeResponse[]>('/recipes/published', languageSearchConfig(language, search))
    return response.data
  },

  async getExternalRecipes(search?: string, filters?: RecipeSearchFilters, language?: string): Promise<RecipeResponse[]> {
    const params: Record<string, string | number> = {}
    if (language?.trim()) {
      params.language = language.trim().toLowerCase()
    }
    if (search?.trim()) {
      params.search = search.trim()
    }
    const diet = toDiet(filters)
    const intolerances = toIntolerances(filters)
    if (diet) {
      params.diet = diet
    }
    if (intolerances) {
      params.intolerances = intolerances
    }
    if (filters?.maxPrepTime && filters.maxPrepTime > 0) {
      params.maxReadyTime = filters.maxPrepTime
    }
    if (filters?.mealType) {
      params.type = filters.mealType
    }
    const config = Object.keys(params).length ? { params } : undefined
    const response = await apiClient.get<RecipeResponse[]>('/recipes/external', config)
    return response.data
  },

  async getExternalRecipeDetail(id: number | string, language?: string): Promise<ExternalRecipeDetailResponse> {
    const response = await apiClient.get<ExternalRecipeDetailResponse>(`/recipes/external/${id}`, languageConfig(language))
    return response.data
  },

  async findExternalRecipesByIngredients(ingredients: string[]): Promise<ExternalRecipeMatchResponse[]> {
    const response = await apiClient.get<ExternalRecipeMatchResponse[]>('/recipes/external/by-ingredients', {
      params: { ingredients: ingredients.join(',') },
    })
    return response.data
  },

  async searchInstructions(request: InstructionSearchRequest): Promise<InstructionSearchResponse> {
    const response = await apiClient.post<InstructionSearchResponse>('/recipes/instructions/search', request)
    return response.data
  },

  async getInstructionSuggestions(id: number | string): Promise<RecipeInstructionSuggestionResponse> {
    const response = await apiClient.post<RecipeInstructionSuggestionResponse>(`/recipes/${id}/instruction-suggestions`)
    return response.data
  },

  async getRecipe(id: number | string, language?: string): Promise<RecipeResponse> {
    const response = await apiClient.get<RecipeResponse>(`/recipes/${id}`, languageConfig(language))
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

  async removeRecipeFavorite(id: number | string): Promise<void> {
    await apiClient.delete(`/recipes/${id}/favorite`)
  },

  async deleteRecipe(id: number | string): Promise<void> {
    await apiClient.delete(`/recipes/${id}`)
  },

  async uploadRecipeImage(file: File): Promise<ImageUploadResponse> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post<ImageUploadResponse>('/recipes/images', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },
}

function languageConfig(language?: string) {
  const normalized = language?.trim().toLowerCase()
  return normalized ? { params: { language: normalized } } : undefined
}

function languageSearchConfig(language?: string, search?: string) {
  const params: Record<string, string> = {}
  const normalized = language?.trim().toLowerCase()
  const normalizedSearch = search?.trim()
  if (normalized) {
    params.language = normalized
  }
  if (normalizedSearch) {
    params.search = normalizedSearch
  }
  return Object.keys(params).length ? { params } : undefined
}

function toDiet(filters?: RecipeSearchFilters) {
  if (!filters) return undefined
  if (filters.vegan) return 'vegan'
  if (filters.vegetarian) return 'vegetarian'
  return undefined
}

function toIntolerances(filters?: RecipeSearchFilters) {
  if (!filters) return undefined
  const values = []
  if (filters.glutenFree) values.push('gluten')
  if (filters.lactoseFree) values.push('dairy')
  return values.join(',') || undefined
}
