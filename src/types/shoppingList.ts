export type ShoppingListItemRequest = {
  name: string
  quantity?: number | null
  unit?: string | null
  category?: string | null
  recipeId?: string | null
  recipeTitle?: string | null
  checked: boolean
}

export type ShoppingListItemResponse = ShoppingListItemRequest & {
  id: number | string
  createdAt: string
  updatedAt: string
}

export type ShoppingListItem = ShoppingListItemResponse
