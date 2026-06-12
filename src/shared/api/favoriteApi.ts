import { apiClient } from './apiClient'
import type {
  ExternalRecipeFavoriteRequest,
  ExternalRecipeFavoriteResponse,
} from '@/types/favorite'

export const favoriteApi = {
  async getExternalFavorites(): Promise<ExternalRecipeFavoriteResponse[]> {
    const response = await apiClient.get<ExternalRecipeFavoriteResponse[]>('/favorites/external')
    return response.data
  },

  async addExternalFavorite(request: ExternalRecipeFavoriteRequest): Promise<ExternalRecipeFavoriteResponse> {
    const response = await apiClient.post<ExternalRecipeFavoriteResponse>('/favorites/external', {
      externalRecipeId: request.externalRecipeId.trim(),
      externalTitle: request.externalTitle.trim(),
      externalImageUrl: request.externalImageUrl?.trim() || null,
      externalSource: request.externalSource?.trim() || 'SPOONACULAR',
    })
    return response.data
  },

  async removeExternalFavorite(source: string, externalRecipeId: string): Promise<void> {
    await apiClient.delete(`/favorites/external/${encodeURIComponent(source)}/${encodeURIComponent(externalRecipeId)}`)
  },
}
