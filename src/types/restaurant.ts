export interface RestaurantSearchRequest {
  query: string
  latitude: number
  longitude: number
}

export interface RestaurantResponse {
  name: string
  address: string | null
  distanceMeters: number | null
  googleMapsUrl: string
  latitude: number | null
  longitude: number | null
}

export interface TavilyRestaurantSearchResponse {
  status: 'ok' | 'unavailable' | 'no_results' | 'no_location'
  results: RestaurantResponse[]
  resolvedLocation?: string | null
  searchMode?: 'exact' | 'suggestions' | null
}
