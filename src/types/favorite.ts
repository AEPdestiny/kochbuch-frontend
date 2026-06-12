export type ExternalRecipeFavoriteRequest = {
  externalRecipeId: string
  externalTitle: string
  externalImageUrl?: string | null
  externalSource?: string | null
}

export type ExternalRecipeFavoriteResponse = ExternalRecipeFavoriteRequest & {
  id: number | string
  createdAt?: string | null
}

export type ExternalRecipeFavorite = ExternalRecipeFavoriteResponse
