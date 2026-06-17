import { describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/shared/api/apiClient'
import { profileApi } from '@/shared/api/profileApi'
import type { UserPreferencesRequest, UserPreferencesResponse } from '@/types/profile'

vi.mock('@/shared/api/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
  },
}))

describe('profileApi', () => {
  it('getPreferences calls GET /profile/preferences and returns preferences', async () => {
    const preferences = response()
    vi.mocked(apiClient.get).mockResolvedValue({ data: preferences })

    const result = await profileApi.getPreferences()

    expect(apiClient.get).toHaveBeenCalledWith('/profile/preferences')
    expect(result).toEqual(preferences)
  })

  it('updatePreferences calls PUT /profile/preferences and returns preferences', async () => {
    const request = response()
    vi.mocked(apiClient.put).mockResolvedValue({ data: request })

    const result = await profileApi.updatePreferences(request)

    expect(apiClient.put).toHaveBeenCalledWith('/profile/preferences', request)
    expect(result).toEqual(request)
  })
})

function response(): UserPreferencesResponse & UserPreferencesRequest {
  return {
    likes: ['pasta'],
    dislikes: ['mushrooms'],
    allergies: ['nuts'],
    vegan: true,
    vegetarian: false,
    glutenFree: true,
    lactoseFree: false,
    highProtein: true,
    calorieConscious: false,
    budgetFriendly: true,
    maxPrepTimeMinutes: 30,
    calorieGoal: 2200,
    goal: 'MAINTAIN',
    dailyCalorieTarget: 2200,
  }
}
