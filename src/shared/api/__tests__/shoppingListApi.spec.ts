import { describe, expect, it, vi } from 'vitest'
import { shoppingListApi } from '@/shared/api/shoppingListApi'
import { apiClient } from '@/shared/api/apiClient'
import type {
  ShoppingListItemRequest,
  ShoppingListItemResponse,
} from '@/types/shoppingList'

vi.mock('@/shared/api/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('shoppingListApi', () => {
  it('getShoppingListItems calls GET /shopping-list/items and returns items', async () => {
    const items: ShoppingListItemResponse[] = [itemResponse()]
    vi.mocked(apiClient.get).mockResolvedValue({ data: items })

    const result = await shoppingListApi.getShoppingListItems()

    expect(apiClient.get).toHaveBeenCalledWith('/shopping-list/items')
    expect(result).toEqual(items)
  })

  it('createShoppingListItem calls POST /shopping-list/items and returns created item', async () => {
    const request: ShoppingListItemRequest = itemRequest()
    const created = itemResponse()
    vi.mocked(apiClient.post).mockResolvedValue({ data: created })

    const result = await shoppingListApi.createShoppingListItem(request)

    expect(apiClient.post).toHaveBeenCalledWith('/shopping-list/items', request)
    expect(result).toEqual(created)
  })

  it('updateShoppingListItem calls PUT /shopping-list/items/{id} and returns updated item', async () => {
    const request: ShoppingListItemRequest = {
      ...itemRequest(),
      name: 'Cherry Tomatoes',
      checked: true,
    }
    const updated = { ...itemResponse(), ...request }
    vi.mocked(apiClient.put).mockResolvedValue({ data: updated })

    const result = await shoppingListApi.updateShoppingListItem(1, request)

    expect(apiClient.put).toHaveBeenCalledWith('/shopping-list/items/1', request)
    expect(result).toEqual(updated)
  })

  it('deleteShoppingListItem calls DELETE /shopping-list/items/{id}', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({})

    await shoppingListApi.deleteShoppingListItem(1)

    expect(apiClient.delete).toHaveBeenCalledWith('/shopping-list/items/1')
  })
})

function itemRequest(): ShoppingListItemRequest {
  return {
    name: 'Tomatoes',
    quantity: 3,
    unit: 'piece',
    category: 'Vegetables',
    checked: false,
  }
}

function itemResponse(): ShoppingListItemResponse {
  return {
    ...itemRequest(),
    id: 1,
    createdAt: '2026-06-06T00:00:00Z',
    updatedAt: '2026-06-06T00:00:00Z',
  }
}
