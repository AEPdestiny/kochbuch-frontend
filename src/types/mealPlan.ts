import type { RecipeResponse } from './recipe'

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type MealPlanEntryRequest = {
  recipeId?: number | null
  customTitle?: string | null
  caloriesSnapshot?: number | null
  proteinSnapshot?: number | null
  imageUrlSnapshot?: string | null
  externalRecipeId?: string | null
  externalSource?: string | null
}

export type MealPlanEntryResponse = {
  id: number | string
  plannedDate: string
  mealSlot?: MealSlot | string | null
  recipe?: RecipeResponse | null
  customTitle?: string | null
  calories?: number | null
  caloriesSnapshot?: number | null
  proteinSnapshot?: number | null
  imageUrlSnapshot?: string | null
  externalRecipeId?: string | null
  externalSource?: string | null
}

export type MealPlanWeekResponse = {
  weekStart: string
  weekEnd: string
  entries: MealPlanEntryResponse[]
}

export type MealPlanShoppingListItem = {
  name: string
  quantity?: number | string | null
  unit?: string | null
  recipeTitle?: string | null
  ingredient?: string | null
  reason?: string | null
}

export type MealPlanShoppingListResponse = {
  added: MealPlanShoppingListItem[]
  skippedBecauseInPantry: MealPlanShoppingListItem[]
  needsReview: MealPlanShoppingListItem[]
  alreadyOnShoppingList: MealPlanShoppingListItem[]
}

export type MealPlanEntry = MealPlanEntryResponse
