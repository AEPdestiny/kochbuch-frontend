import { beforeEach, describe, expect, it, vi } from 'vitest'
import { favoriteApi } from '@/shared/api/favoriteApi'
import { apiClient } from '@/shared/api/apiClient'

vi.mock('@/shared/api/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('favoriteApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads external favorites', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{ externalRecipeId: '716429' }] })

    const result = await favoriteApi.getExternalFavorites()

    expect(apiClient.get).toHaveBeenCalledWith('/favorites/external')
    expect(result).toEqual([{ externalRecipeId: '716429' }])
  })

  it('adds external favorite', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { externalRecipeId: '716429' } })

    await favoriteApi.addExternalFavorite({
      externalRecipeId: ' 716429 ',
      externalTitle: ' Pasta ',
      externalImageUrl: '',
      externalSource: 'SPOONACULAR',
    })

    expect(apiClient.post).toHaveBeenCalledWith('/favorites/external', {
      externalRecipeId: '716429',
      externalTitle: 'Pasta',
      externalImageUrl: null,
      externalSource: 'SPOONACULAR',
    })
  })

  it('removes external favorite', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({})

    await favoriteApi.removeExternalFavorite('SPOONACULAR', '716429')

    expect(apiClient.delete).toHaveBeenCalledWith('/favorites/external/SPOONACULAR/716429')
  })

  it('removes external favorite by favorite id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({})

    await favoriteApi.removeExternalFavoriteById(1)

    expect(apiClient.delete).toHaveBeenCalledWith('/favorites/external/1')
  })
})
