import { apiClient } from './apiClient'
import type {
  ShoppingListItemRequest,
  ShoppingListItemResponse,
} from '@/types/shoppingList'

export const shoppingListApi = {
  async getShoppingListItems(): Promise<ShoppingListItemResponse[]> {
    const response = await apiClient.get<ShoppingListItemResponse[]>('/shopping-list/items')
    return response.data
  },

  async createShoppingListItem(
    request: ShoppingListItemRequest,
  ): Promise<ShoppingListItemResponse> {
    const response = await apiClient.post<ShoppingListItemResponse>('/shopping-list/items', request)
    return response.data
  },

  async updateShoppingListItem(
    id: number | string,
    request: ShoppingListItemRequest,
  ): Promise<ShoppingListItemResponse> {
    const response = await apiClient.put<ShoppingListItemResponse>(`/shopping-list/items/${id}`, request)
    return response.data
  },

  async deleteShoppingListItem(id: number | string): Promise<void> {
    await apiClient.delete(`/shopping-list/items/${id}`)
  },
}
