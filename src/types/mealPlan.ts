import type { RecipeResponse } from './recipe'

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type MealPlanEntryRequest = {
  recipeId?: number | null
  customTitle?: string | null
}

export type MealPlanEntryResponse = {
  id: number | string
  plannedDate: string
  mealSlot?: MealSlot | string | null
  recipe?: RecipeResponse | null
  customTitle?: string | null
}

export type MealPlanWeekResponse = {
  weekStart: string
  weekEnd: string
  entries: MealPlanEntryResponse[]
}

export type MealPlanEntry = MealPlanEntryResponse
