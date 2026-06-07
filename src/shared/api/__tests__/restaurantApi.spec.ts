import { describe, expect, it, vi } from 'vitest'
import { restaurantApi } from '@/shared/api/restaurantApi'
import { apiClient, ApiClientError } from '@/shared/api/apiClient'
import type { RestaurantResponse, RestaurantSearchRequest } from '@/types/restaurant'

vi.mock('@/shared/api/apiClient', async importOriginal => {
  const actual = await importOriginal<typeof import('@/shared/api/apiClient')>()
  return {
    ...actual,
    apiClient: {
      post: vi.fn(),
    },
  }
})

describe('restaurantApi', () => {
  it('searchRestaurants calls POST /restaurants/search with request body and returns restaurants', async () => {
    const request = restaurantRequest()
    const restaurants = [restaurantResponse()]
    vi.mocked(apiClient.post).mockResolvedValue({ data: restaurants })

    const result = await restaurantApi.searchRestaurants(request)

    expect(apiClient.post).toHaveBeenCalledWith('/restaurants/search', request)
    expect(result).toEqual(restaurants)
  })

  it('searchRestaurants forwards api client errors', async () => {
    const error = new ApiClientError('Validation failed: query must not be blank', 400)
    vi.mocked(apiClient.post).mockRejectedValue(error)

    await expect(restaurantApi.searchRestaurants(restaurantRequest())).rejects.toBe(error)
  })
})

function restaurantRequest(): RestaurantSearchRequest {
  return {
    query: 'Pizza',
    latitude: 52.52,
    longitude: 13.405,
  }
}

function restaurantResponse(): RestaurantResponse {
  return {
    name: 'Pasta Place',
    address: 'Pasta Street 1, Berlin',
    distanceMeters: 850,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=52.5201,13.4052',
    latitude: 52.5201,
    longitude: 13.4052,
  }
}
