export type RecipeRequest = {
  title: string
  imageUrl: string
  prepTimeMinutes: number
  cookTimeMinutes: number
  servings: number
  difficulty: string
  category: string
  rating: number
  ingredients: string
  instructions: string
  favorite: boolean
  published: boolean
}

export type RecipeResponse = RecipeRequest & {
  id: number | string
  externalId?: string | null
  source?: 'dishly' | 'spoonacular' | string | null
  calories?: number | null
  sourceUrl?: string | null
}

export type Recipe = RecipeResponse

export type ExternalRecipeIngredient = {
  name: string
  original?: string | null
  amount?: number | null
  unit?: string | null
}

export type ExternalRecipeDetailResponse = {
  id: number | string
  externalId?: string | null
  source: 'spoonacular' | string
  title: string
  imageUrl: string
  prepTimeMinutes: number
  cookTimeMinutes: number
  readyInMinutes: number
  servings: number
  category?: string | null
  tags: string[]
  calories?: number | null
  ingredients: ExternalRecipeIngredient[]
  instructions?: string | null
  steps: string[]
  sourceUrl?: string | null
}

export type ExternalRecipeMatchResponse = {
  id: number | string
  externalId?: string | null
  source: 'spoonacular' | string
  title: string
  imageUrl: string
  usedIngredientCount: number
  missedIngredientCount: number
  usedIngredients: string[]
  missedIngredients: string[]
}
