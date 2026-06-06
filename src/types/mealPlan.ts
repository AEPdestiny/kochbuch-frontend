import type { RecipeResponse } from './recipe'

export type MealPlanEntryRequest = {
  recipeId: number
}

export type MealPlanEntryResponse = {
  id: number | string
  plannedDate: string
  recipe: RecipeResponse
}

export type MealPlanWeekResponse = {
  weekStart: string
  weekEnd: string
  entries: MealPlanEntryResponse[]
}

export type MealPlanEntry = MealPlanEntryResponse
