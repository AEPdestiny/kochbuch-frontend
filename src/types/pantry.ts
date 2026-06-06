export type PantryItemRequest = {
  name: string
  quantity?: number | null
  unit?: string | null
  category?: string | null
}

export type PantryItemResponse = PantryItemRequest & {
  id: number | string
  createdAt: string
  updatedAt: string
}

export type PantryItem = PantryItemResponse
