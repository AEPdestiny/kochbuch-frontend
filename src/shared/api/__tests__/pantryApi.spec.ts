import { describe, expect, it, vi } from 'vitest'
import { pantryApi } from '@/shared/api/pantryApi'
import { apiClient } from '@/shared/api/apiClient'
import type { PantryItemRequest, PantryItemResponse } from '@/types/pantry'

vi.mock('@/shared/api/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('pantryApi', () => {
  it('getPantryItems calls GET /pantry/items and returns items', async () => {
    const items: PantryItemResponse[] = [itemResponse()]
    vi.mocked(apiClient.get).mockResolvedValue({ data: items })

    const result = await pantryApi.getPantryItems()

    expect(apiClient.get).toHaveBeenCalledWith('/pantry/items')
    expect(result).toEqual(items)
  })

  it('createPantryItem calls POST /pantry/items and returns created item', async () => {
    const request: PantryItemRequest = itemRequest()
    const created = itemResponse()
    vi.mocked(apiClient.post).mockResolvedValue({ data: created })

    const result = await pantryApi.createPantryItem(request)

    expect(apiClient.post).toHaveBeenCalledWith('/pantry/items', request)
    expect(result).toEqual(created)
  })

  it('updatePantryItem calls PUT /pantry/items/{id} and returns updated item', async () => {
    const request: PantryItemRequest = { ...itemRequest(), name: 'Basmati Rice' }
    const updated = { ...itemResponse(), name: 'Basmati Rice' }
    vi.mocked(apiClient.put).mockResolvedValue({ data: updated })

    const result = await pantryApi.updatePantryItem(1, request)

    expect(apiClient.put).toHaveBeenCalledWith('/pantry/items/1', request)
    expect(result).toEqual(updated)
  })

  it('deletePantryItem calls DELETE /pantry/items/{id}', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({})

    await pantryApi.deletePantryItem(1)

    expect(apiClient.delete).toHaveBeenCalledWith('/pantry/items/1')
  })
})

function itemRequest(): PantryItemRequest {
  return {
    name: 'Rice',
    quantity: 2,
    unit: 'kg',
    category: 'Grains',
  }
}

function itemResponse(): PantryItemResponse {
  return {
    ...itemRequest(),
    id: 1,
    createdAt: '2026-06-06T00:00:00Z',
    updatedAt: '2026-06-06T00:00:00Z',
  }
}
