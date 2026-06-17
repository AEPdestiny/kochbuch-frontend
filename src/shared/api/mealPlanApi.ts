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
    if (!Number.isFinite(recipeIdOrRequest) || recipeIdOrRequest <= 0) {
      throw new Error('recipeId oder customTitle fehlt.')
    }
    return { recipeId: recipeIdOrRequest }
  }

  if (recipeIdOrRequest.recipeId !== null && recipeIdOrRequest.recipeId !== undefined) {
    if (!Number.isFinite(recipeIdOrRequest.recipeId) || recipeIdOrRequest.recipeId <= 0) {
      throw new Error('recipeId oder customTitle fehlt.')
    }
    return { recipeId: recipeIdOrRequest.recipeId }
  }

  const customTitle = recipeIdOrRequest.customTitle?.trim()
  if (customTitle) {
    return {
      customTitle,
      caloriesSnapshot: normalizeOptionalNumber(recipeIdOrRequest.caloriesSnapshot),
      proteinSnapshot: normalizeOptionalNumber(recipeIdOrRequest.proteinSnapshot),
      imageUrlSnapshot: normalizeOptionalString(recipeIdOrRequest.imageUrlSnapshot),
      externalRecipeId: normalizeOptionalString(recipeIdOrRequest.externalRecipeId),
      externalSource: normalizeOptionalString(recipeIdOrRequest.externalSource),
    }
  }

  throw new Error('recipeId oder customTitle fehlt.')
}

function normalizeOptionalNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed || null
}
