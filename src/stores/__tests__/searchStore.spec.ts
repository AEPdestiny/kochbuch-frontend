import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSearchStore } from '@/stores/searchStore'

describe('searchStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with an empty query and default filters', () => {
    const store = useSearchStore()

    expect(store.query).toBe('')
    expect(store.vegan).toBe(false)
    expect(store.calorieConscious).toBe(false)
    expect(store.highProtein).toBe(false)
    expect(store.sortOrder).toBe('')
  })

  it('resetAll clears the query and every soft filter back to its default', () => {
    const store = useSearchStore()

    store.query = 'Pasta Carbonara'
    store.vegan = true
    store.calorieConscious = true
    store.highProtein = true
    store.maxPrepTime = 30
    store.maxCalories = 600
    store.mealType = 'dinner'
    store.sortOrder = 'caloriesAsc'

    store.resetAll()

    expect(store.query).toBe('')
    expect(store.vegan).toBe(false)
    expect(store.calorieConscious).toBe(false)
    expect(store.highProtein).toBe(false)
    expect(store.maxPrepTime).toBeNull()
    expect(store.maxCalories).toBeNull()
    expect(store.mealType).toBe('')
    expect(store.sortOrder).toBe('')
  })
})
