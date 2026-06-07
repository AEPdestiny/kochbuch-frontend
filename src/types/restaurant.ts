export interface RestaurantSearchRequest {
  query: string
  latitude: number
  longitude: number
}

export interface RestaurantResponse {
  name: string
  address: string
  distanceMeters: number
  googleMapsUrl: string
  latitude: number
  longitude: number
}
