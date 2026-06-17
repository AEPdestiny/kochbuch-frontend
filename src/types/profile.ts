export type UserPreferencesRequest = {
  likes: string[]
  dislikes: string[]
  allergies: string[]
  vegan: boolean
  vegetarian: boolean
  glutenFree: boolean
  lactoseFree: boolean
  highProtein: boolean
  calorieConscious: boolean
  budgetFriendly: boolean
  maxPrepTimeMinutes?: number | null
  calorieGoal?: number | null
  dailyCalorieTarget?: number | null
}

export type UserPreferencesResponse = UserPreferencesRequest
