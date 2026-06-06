import { apiClient } from './apiClient'
import type { PantryItemRequest, PantryItemResponse } from '@/types/pantry'

export const pantryApi = {
  async getPantryItems(): Promise<PantryItemResponse[]> {
    const response = await apiClient.get<PantryItemResponse[]>('/pantry/items')
    return response.data
  },

  async createPantryItem(request: PantryItemRequest): Promise<PantryItemResponse> {
    const response = await apiClient.post<PantryItemResponse>('/pantry/items', request)
    return response.data
  },

  async updatePantryItem(
    id: number | string,
    request: PantryItemRequest,
  ): Promise<PantryItemResponse> {
    const response = await apiClient.put<PantryItemResponse>(`/pantry/items/${id}`, request)
    return response.data
  },

  async deletePantryItem(id: number | string): Promise<void> {
    await apiClient.delete(`/pantry/items/${id}`)
  },
}
