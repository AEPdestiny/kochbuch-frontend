import { apiClient } from './apiClient'
import type { RestaurantResponse, RestaurantSearchRequest } from '@/types/restaurant'

export const restaurantApi = {
  async searchRestaurants(request: RestaurantSearchRequest): Promise<RestaurantResponse[]> {
    const response = await apiClient.post<RestaurantResponse[]>('/restaurants/search', request)
    return response.data
  },
}
