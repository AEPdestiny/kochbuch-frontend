import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Holds the Home page's search text and soft recipe filters outside of
 * ApiRecipeList's component instance. This lets logout (or any other
 * cross-cutting action) reset search/filter state even when the route
 * doesn't change (e.g. the user is already on "/"), which a component-local
 * ref cannot do since the component instance is not remounted.
 */
export const useSearchStore = defineStore('search', () => {
  const query = ref('')
  const vegan = ref(false)
  const vegetarian = ref(false)
  const glutenFree = ref(false)
  const lactoseFree = ref(false)
  const calorieConscious = ref(false)
  const highProtein = ref(false)
  const maxPrepTime = ref<number | null>(null)
  const maxCalories = ref<number | null>(null)
  const mealType = ref('')
  const sortOrder = ref('')

  function resetAll() {
    query.value = ''
    vegan.value = false
    vegetarian.value = false
    glutenFree.value = false
    lactoseFree.value = false
    calorieConscious.value = false
    highProtein.value = false
    maxPrepTime.value = null
    maxCalories.value = null
    mealType.value = ''
    sortOrder.value = ''
  }

  return {
    query,
    vegan,
    vegetarian,
    glutenFree,
    lactoseFree,
    calorieConscious,
    highProtein,
    maxPrepTime,
    maxCalories,
    mealType,
    sortOrder,
    resetAll,
  }
})
