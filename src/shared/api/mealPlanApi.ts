import { apiClient } from './apiClient'
import type {
  MealPlanEntryRequest,
  MealPlanEntryResponse,
  MealSlot,
  MealPlanWeekResponse,
} from '@/types/mealPlan'

export const mealPlanApi = {
  async getWeek(startDate?: string): Promise<MealPlanWeekResponse> {
    const response = await apiClient.get<MealPlanWeekResponse>('/meal-plan/week', {
      params: startDate ? { startDate } : undefined,
    })
    return response.data
  },

  async setDay(date: string, recipeIdOrRequest: number | MealPlanEntryRequest): Promise<MealPlanEntryResponse> {
    const response = await apiClient.put<MealPlanEntryResponse>(
      `/meal-plan/days/${date}`,
      toRequest(recipeIdOrRequest),
    )
    return response.data
  },

  async deleteDay(date: string): Promise<void> {
    await apiClient.delete(`/meal-plan/days/${date}`)
  },

  async setSlot(date: string, slot: MealSlot, recipeIdOrRequest: number | MealPlanEntryRequest): Promise<MealPlanEntryResponse> {
    const response = await apiClient.put<MealPlanEntryResponse>(
      `/meal-plan/days/${date}/slots/${slot}`,
      toRequest(recipeIdOrRequest),
    )
    return response.data
  },

  async deleteSlot(date: string, slot: MealSlot): Promise<void> {
    await apiClient.delete(`/meal-plan/days/${date}/slots/${slot}`)
  },
}

function toRequest(recipeIdOrRequest: number | MealPlanEntryRequest): MealPlanEntryRequest {
  if (typeof recipeIdOrRequest === 'number') {
    return { recipeId: recipeIdOrRequest }
  }
  return recipeIdOrRequest
}
