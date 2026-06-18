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
  protein?: number | null
  alcohol?: number | null
  alcoholPercent?: number | null
  userCreated?: boolean
  language?: string | null
  sourceUrl?: string | null
  sourceName?: string | null
  dishTypes?: string | null
  diets?: string | null
  vegetarian?: boolean
  vegan?: boolean
  glutenFree?: boolean
  dairyFree?: boolean
}

export type Recipe = RecipeResponse

export type RecipeSearchFilters = {
  vegan?: boolean
  vegetarian?: boolean
  glutenFree?: boolean
  calorieConscious?: boolean
  highProtein?: boolean
  maxPrepTime?: number | null
  maxCalories?: number | null
  mealType?: string
}

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
  protein?: number | null
  alcohol?: number | null
  alcoholPercent?: number | null
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

export type InstructionSearchRequest = {
  recipeTitle: string
  sourceUrl?: string | null
  sourceName?: string | null
}

export type InstructionSearchResult = {
  title: string
  url: string
  snippet?: string | null
}

export type InstructionSearchResponse = {
  configured: boolean
  message?: string | null
  googleSearchUrl?: string | null
  results: InstructionSearchResult[]
}
