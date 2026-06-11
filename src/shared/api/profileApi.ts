import { apiClient } from './apiClient'
import type { UserPreferencesRequest, UserPreferencesResponse } from '@/types/profile'

export const profileApi = {
  async getPreferences(): Promise<UserPreferencesResponse> {
    const response = await apiClient.get<UserPreferencesResponse>('/profile/preferences')
    return response.data
  },

  async updatePreferences(request: UserPreferencesRequest): Promise<UserPreferencesResponse> {
    const response = await apiClient.put<UserPreferencesResponse>('/profile/preferences', request)
    return response.data
  },
}
