import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mealPlanApi } from '@/shared/api/mealPlanApi'
import { apiClient, ApiClientError } from '@/shared/api/apiClient'
import type { MealPlanEntryResponse, MealPlanWeekResponse } from '@/types/mealPlan'

vi.mock('@/shared/api/apiClient', async () => {
  const actual = await vi.importActual<typeof import('@/shared/api/apiClient')>('@/shared/api/apiClient')
  return {
    ApiClientError: actual.ApiClientError,
    apiClient: {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  }
})

describe('mealPlanApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getWeek calls GET /meal-plan/week without startDate and returns week', async () => {
    const week = weekResponse()
    vi.mocked(apiClient.get).mockResolvedValue({ data: week })

    const result = await mealPlanApi.getWeek()

    expect(apiClient.get).toHaveBeenCalledWith('/meal-plan/week', { params: undefined })
    expect(result).toEqual(week)
  })

  it('getWeek calls GET /meal-plan/week with startDate and returns week', async () => {
    const week = weekResponse()
    vi.mocked(apiClient.get).mockResolvedValue({ data: week })

    const result = await mealPlanApi.getWeek('2026-06-03')

    expect(apiClient.get).toHaveBeenCalledWith('/meal-plan/week', {
      params: { startDate: '2026-06-03' },
    })
    expect(result).toEqual(week)
  })

  it('setDay calls PUT /meal-plan/days/{date} with recipeId and returns entry', async () => {
    const entry = entryResponse('2026-06-03')
    vi.mocked(apiClient.put).mockResolvedValue({ data: entry })

    const result = await mealPlanApi.setDay('2026-06-03', 1)

    expect(apiClient.put).toHaveBeenCalledWith('/meal-plan/days/2026-06-03', {
      recipeId: 1,
    })
    expect(result).toEqual(entry)
  })

  it('deleteDay calls DELETE /meal-plan/days/{date}', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({})

    await mealPlanApi.deleteDay('2026-06-03')

    expect(apiClient.delete).toHaveBeenCalledWith('/meal-plan/days/2026-06-03')
  })

  it('setSlot calls PUT /meal-plan/days/{date}/slots/{slot}', async () => {
    const entry = { ...entryResponse('2026-06-03'), mealSlot: 'breakfast' }
    vi.mocked(apiClient.put).mockResolvedValue({ data: entry })

    const result = await mealPlanApi.setSlot('2026-06-03', 'breakfast', 1)

    expect(apiClient.put).toHaveBeenCalledWith('/meal-plan/days/2026-06-03/slots/breakfast', {
      recipeId: 1,
    })
    expect(result).toEqual(entry)
  })

  it('setSlot sends customTitle request body', async () => {
    const entry = { ...entryResponse('2026-06-03'), recipe: null, customTitle: 'Sushi frei' }
    vi.mocked(apiClient.put).mockResolvedValue({ data: entry })

    const result = await mealPlanApi.setSlot('2026-06-03', 'snack', { customTitle: 'Sushi frei' })

    expect(apiClient.put).toHaveBeenCalledWith('/meal-plan/days/2026-06-03/slots/snack', {
      customTitle: 'Sushi frei',
    })
    expect(result).toEqual(entry)
  })

  it('setSlot trims customTitle before sending request body', async () => {
    const entry = { ...entryResponse('2026-06-03'), recipe: null, customTitle: 'Sushi frei' }
    vi.mocked(apiClient.put).mockResolvedValue({ data: entry })

    await mealPlanApi.setSlot('2026-06-03', 'snack', { customTitle: '  Sushi frei  ' })

    expect(apiClient.put).toHaveBeenCalledWith('/meal-plan/days/2026-06-03/slots/snack', {
      customTitle: 'Sushi frei',
    })
  })

  it('setSlot does not send invalid empty payloads', async () => {
    await expect(mealPlanApi.setSlot('2026-06-03', 'snack', { customTitle: ' ' }))
      .rejects.toThrow('recipeId oder customTitle fehlt.')
    await expect(mealPlanApi.setSlot('2026-06-03', 'snack', 0))
      .rejects.toThrow('recipeId oder customTitle fehlt.')

    expect(apiClient.put).not.toHaveBeenCalled()
  })

  it('deleteSlot calls DELETE /meal-plan/days/{date}/slots/{slot}', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({})

    await mealPlanApi.deleteSlot('2026-06-03', 'snack')

    expect(apiClient.delete).toHaveBeenCalledWith('/meal-plan/days/2026-06-03/slots/snack')
  })

  it('getWeek forwards ApiClientError from apiClient', async () => {
    const error = new ApiClientError('Missing or invalid Bearer token.', 401)
    vi.mocked(apiClient.get).mockRejectedValue(error)

    await expect(mealPlanApi.getWeek()).rejects.toBe(error)
  })

  it('setDay forwards ApiClientError from apiClient', async () => {
    const error = new ApiClientError('Only own recipes can be planned.', 403)
    vi.mocked(apiClient.put).mockRejectedValue(error)

    await expect(mealPlanApi.setDay('2026-06-03', 2)).rejects.toBe(error)
  })

  it('deleteDay forwards ApiClientError from apiClient', async () => {
    const error = new ApiClientError('Meal plan entry for date 2026-06-03 not found.', 404)
    vi.mocked(apiClient.delete).mockRejectedValue(error)

    await expect(mealPlanApi.deleteDay('2026-06-03')).rejects.toBe(error)
  })
})

function weekResponse(): MealPlanWeekResponse {
  return {
    weekStart: '2026-06-01',
    weekEnd: '2026-06-07',
    entries: [entryResponse('2026-06-03')],
  }
}

function entryResponse(plannedDate: string): MealPlanEntryResponse {
  return {
    id: 1,
    plannedDate,
    mealSlot: 'dinner',
    recipe: {
      id: 1,
      title: 'Pasta',
      imageUrl: '',
      prepTimeMinutes: 10,
      cookTimeMinutes: 20,
      servings: 2,
      difficulty: 'easy',
      category: 'Italian',
      rating: 4.5,
      ingredients: 'noodles',
      instructions: 'cook',
      favorite: false,
      published: true,
    },
  }
}
