import { apiClient } from './apiClient'
import type {
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

  async setDay(date: string, recipeId: number): Promise<MealPlanEntryResponse> {
    const response = await apiClient.put<MealPlanEntryResponse>(`/meal-plan/days/${date}`, {
      recipeId,
    })
    return response.data
  },

  async deleteDay(date: string): Promise<void> {
    await apiClient.delete(`/meal-plan/days/${date}`)
  },

  async setSlot(date: string, slot: MealSlot, recipeId: number): Promise<MealPlanEntryResponse> {
    const response = await apiClient.put<MealPlanEntryResponse>(`/meal-plan/days/${date}/slots/${slot}`, {
      recipeId,
    })
    return response.data
  },

  async deleteSlot(date: string, slot: MealSlot): Promise<void> {
    await apiClient.delete(`/meal-plan/days/${date}/slots/${slot}`)
  },
}
