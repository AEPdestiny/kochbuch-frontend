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
}

export type Recipe = RecipeResponse
