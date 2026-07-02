import { apiClient } from './apiClient'
import type { RestaurantResponse, RestaurantSearchRequest, TavilyRestaurantSearchResponse } from '@/types/restaurant'

export const restaurantApi = {
  async searchRestaurants(request: RestaurantSearchRequest): Promise<RestaurantResponse[]> {
    const response = await apiClient.post<RestaurantResponse[]>('/restaurants/search', request)
    return response.data
  },

  async searchByText(recipeTitle: string, location: string, latitude?: number, longitude?: number, accuracyMeters?: number): Promise<TavilyRestaurantSearchResponse> {
    const response = await apiClient.get<TavilyRestaurantSearchResponse>('/restaurants/search', {
      params: { recipeTitle, location, latitude, longitude, accuracyMeters },
    })
    return response.data
  },
}
