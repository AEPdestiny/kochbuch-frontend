<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { recipeApi } from '@/shared/api/recipeApi'
import { restaurantApi } from '@/shared/api/restaurantApi'
import { shoppingListApi } from '@/shared/api/shoppingListApi'
import { mealPlanApi } from '@/shared/api/mealPlanApi'
import { ApiClientError, AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { favoriteApi } from '@/shared/api/favoriteApi'
import { displayCategory } from '@/shared/recipeDisplay'
import { exportRecipe } from '@/shared/recipeImportExport'
import { useToastStore } from '@/stores/toastStore'
import type {
  ExternalRecipeDetailResponse,
  ExternalRecipeIngredient,
  RecipeInstructionSuggestion,
  RecipeResponse,
} from '@/types/recipe'
import type { RestaurantResponse, TavilyRestaurantSearchResponse } from '@/types/restaurant'
import type { MealPlanEntryRequest, MealPlanEntryResponse, MealSlot } from '@/types/mealPlan'

type DetailIngredient = {
  name: string
  original: string
  amount?: number | null
  unit?: string | null
}

type DetailRecipe = {
  id: number | string
  source: 'dishly' | 'spoonacular'
  title: string
  imageUrl: string
  calories?: number | null
  protein?: number | null
  alcohol?: number | null
  alcoholPercent?: number | null
  readyInMinutes: number
  servings: number
  tags: string[]
  ingredients: DetailIngredient[]
  instructions: string
  steps: string[]
  hasRealInstructions: boolean
  sourceUrl?: string | null
  published: boolean
  ownedByCurrentUser: boolean
}

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const toastStore = useToastStore()

const recipe = ref<DetailRecipe | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const restaurantLoading = ref(false)
const restaurantError = ref<string | null>(null)
const restaurantUnavailable = ref(false)
const restaurantNoResults = ref(false)
const restaurantLocationTooBroad = ref(false)
const restaurants = ref<RestaurantResponse[]>([])
const restaurantLocation = ref('')
const userLatitude = ref<number | null>(null)
const userLongitude = ref<number | null>(null)
const userAccuracyMeters = ref<number | null>(null)
const geoLocating = ref(false)
const geoLocationDenied = ref(false)
const gpsNoCityHint = ref(false)
const resolvedLocation = ref<string | null>(null)
const restaurantSearchMode = ref<'exact' | 'suggestions' | null>(null)
const locationMismatch = ref(false)
const mealPlanModalOpen = ref(false)
const mealPlanError = ref<string | null>(null)
const mealPlanMessage = ref<string | null>(null)
const mealPlanLoading = ref(false)
const plannedEntries = ref<MealPlanEntryResponse[]>([])
const favorite = ref(false)
const favoriteError = ref<string | null>(null)
const ownerActionError = ref<string | null>(null)
const instructionSearchLoading = ref(false)
const instructionSearchError = ref<string | null>(null)
const instructionSearchMessage = ref<string | null>(null)
const instructionSuggestions = ref<RecipeInstructionSuggestion[]>([])

const isExternal = computed(() => route.name === 'external-recipe-detail')
const weekDays = computed(() => {
  const monday = startOfCurrentWeek()
  return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    .map((key, index) => ({
      key,
      label: t(`mealPlan.days.${key}`),
      date: formatDate(addDays(monday, index)),
    }))
})

const mealSlots: { key: MealSlot; labelKey: string }[] = [
  { key: 'breakfast', labelKey: 'mealPlan.slots.breakfast' },
  { key: 'lunch', labelKey: 'mealPlan.slots.lunch' },
  { key: 'dinner', labelKey: 'mealPlan.slots.dinner' },
  { key: 'snack', labelKey: 'mealPlan.slots.snack' },
]

const ingredientAmountPattern = String.raw`(?:\d+(?:[,.]\d+)?|\d+\/\d+|[\u00BC\u00BD\u00BE])`
const directIngredientUnitPattern = String.raw`ml|g|kg|l|el|tl|tbsp|tsp|cups?|servings?|strips?|cloves?|sticks?|prise|prisen|zehe|zehen|stück|stueck|scheiben?|dose|dosen|bund|handvoll`
const trailingIngredientUnitPattern = String.raw`cloves?|zehen?|sticks?|strips?|scheiben?`
const embeddedIngredientBoundary = new RegExp(
  String.raw`(?<=\p{L})\s+(?=${ingredientAmountPattern}\s+(?:(?:${directIngredientUnitPattern})\b|\p{Lu}|\p{L}+\s+(?:${trailingIngredientUnitPattern})\b))`,
  'giu',
)
const commaIngredientBoundary = /,\s*(?=(?:\d|\d\/|[\u00BC\u00BD\u00BE]|\p{Lu}))/gu

const hasInstructions = computed(() => {
  const current = recipe.value
  return !!current && current.hasRealInstructions && current.steps.length > 0
})
const ingredientCount = computed(() => recipe.value?.ingredients.length ?? 0)

onMounted(() => {
  loadRecipe()
})

async function loadRecipe() {
  loading.value = true
  error.value = null
  try {
    const id = route.params.id as string
    recipe.value = isExternal.value
      ? mapExternal(await recipeApi.getExternalRecipeDetail(id))
      : mapDishly(await recipeApi.getRecipe(id))
    resetInstructionSearch()
    await loadFavoriteState()
  } catch {
    error.value = t('recipeDetail.errors.load')
  } finally {
    loading.value = false
  }
}

async function loadFavoriteState() {
  favorite.value = false
  favoriteError.value = null
  if (!recipe.value || !sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    return
  }
  try {
    const favorites = await favoriteApi.getExternalFavorites()
    favorite.value = favorites.some(savedFavorite =>
      savedFavorite.externalRecipeId === favoriteId(recipe.value!)
      && (savedFavorite.externalSource ?? 'SPOONACULAR').toUpperCase() === favoriteSource(recipe.value!),
    )
  } catch {
    favorite.value = false
  }
}

function mapExternal(response: ExternalRecipeDetailResponse): DetailRecipe {
  const instructions = normalizeInstructions(response.instructions)
  const steps = normalizeSteps(response.steps)
  const hasRealInstructions = steps.length > 0 || hasRealInstructionText(instructions)
  return {
    id: response.externalId ?? response.id,
    source: 'spoonacular',
    title: response.title,
    imageUrl: response.imageUrl,
    calories: response.calories,
    protein: response.protein,
    alcohol: response.alcohol,
    alcoholPercent: response.alcoholPercent,
    readyInMinutes: response.readyInMinutes || response.cookTimeMinutes,
    servings: response.servings,
    tags: response.tags ?? [],
    ingredients: response.ingredients.map(mapIngredient),
    instructions,
    steps,
    hasRealInstructions,
    sourceUrl: response.sourceUrl,
    published: true,
    ownedByCurrentUser: false,
  }
}

function mapDishly(response: RecipeResponse): DetailRecipe {
  const instructions = normalizeInstructions(response.instructions)
  const responseSteps = normalizeResponseSteps(response.instructionsList, instructions)
  const hasRealInstructions = response.hasRealInstructions === true && responseSteps.length > 0
  const steps = hasRealInstructions ? responseSteps : []
  return {
    id: response.id,
    source: 'dishly',
    title: response.title,
    imageUrl: response.imageUrl,
    calories: response.calories,
    protein: response.protein,
    alcohol: response.alcohol,
    alcoholPercent: response.alcoholPercent,
    readyInMinutes: response.prepTimeMinutes + response.cookTimeMinutes,
    servings: response.servings,
    tags: [response.category, response.difficulty].filter(Boolean) as string[],
    ingredients: normalizeDishlyIngredients(response),
    instructions,
    steps,
    hasRealInstructions,
    sourceUrl: response.sourceUrl,
    published: response.published,
    ownedByCurrentUser: response.ownedByCurrentUser === true,
  }
}

function normalizeResponseSteps(values: string[] | null | undefined, fallbackInstructions: string) {
  const responseSteps = normalizeSteps(values)
  return responseSteps.length ? responseSteps : splitInstructionSteps(fallbackInstructions)
}

function normalizeDishlyIngredients(response: RecipeResponse) {
  const responseList = response.ingredientsList
    ?.map(item => item?.trim())
    .filter((item): item is string => !!item)
  if (responseList?.length) {
    return mapIngredientStrings(responseList)
  }
  return splitIngredients(response.ingredients ?? '')
}

function normalizeInstructions(value?: string | null) {
  const normalized = value?.trim() ?? ''
  return isInstructionPlaceholder(normalized) ? '' : normalized
}

function normalizeSteps(values?: string[] | null) {
  return (values ?? [])
    .map(step => normalizeInstructions(step))
    .filter(Boolean)
}

function splitInstructionSteps(value: string) {
  return value
    ? value.split(/\n+/)
      .map(step => normalizeInstructions(step).replace(/^\s*\d+[.)]\s*/, '').trim())
      .filter(Boolean)
    : []
}

function hasRealInstructionText(value?: string | null) {
  return !!normalizeInstructions(value)
}

function isInstructionPlaceholder(value: string) {
  const normalized = value.trim().toLowerCase()
  return normalized === ''
    || normalized === 'keine anleitung angegeben.'
    || normalized === 'keine zubereitung angegeben.'
    || normalized === 'no instructions provided.'
    || normalized === 'no instructions available.'
}

function mapIngredient(ingredient: ExternalRecipeIngredient): DetailIngredient {
  return {
    name: ingredient.name,
    original: ingredient.original || formatIngredient(ingredient),
    amount: ingredient.amount,
    unit: ingredient.unit,
  }
}

function splitIngredients(value: string): DetailIngredient[] {
  const rawParts = value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n+|;\s*/)
    .flatMap(item => item.split(commaIngredientBoundary))
    .flatMap(item => item.split(embeddedIngredientBoundary))

  return mapIngredientStrings(rawParts)
}

function mapIngredientStrings(values: string[]): DetailIngredient[] {
  return values
    .map(item => item.trim())
    .filter(item => item && /\p{L}/u.test(item) && !/^[01](?:[,.]0+)?$/.test(item))
    .filter((item, index, items) =>
      items.findIndex(candidate => candidate.toLowerCase() === item.toLowerCase()) === index,
    )
    .map(item => ({ name: item, original: item }))
}

function formatIngredient(ingredient: ExternalRecipeIngredient) {
  return [
    ingredient.amount ?? '',
    ingredient.unit ?? '',
    ingredient.name,
  ].filter(Boolean).join(' ')
}

function goBack() {
  // When arriving here right after creating a recipe, the previous history entry
  // is the "Neues Rezept erstellen" form — going back should return to the recipe
  // list instead of re-opening that now-empty form.
  if (route.query?.from === 'my-recipes') {
    router.push('/my-recipes')
    return
  }
  if (window.history.length > 1) {
    router.back()
    return
  }
  router.push('/')
}

function editOwnRecipe() {
  if (!recipe.value?.ownedByCurrentUser) return
  router.push(`/my-recipes/${recipe.value.id}/edit`)
}

async function deleteOwnRecipe() {
  if (!recipe.value?.ownedByCurrentUser) return
  if (!window.confirm(`${t('recipes.actions.delete')}?`)) return

  ownerActionError.value = null
  try {
    await recipeApi.deleteRecipe(recipe.value.id)
    await router.push('/my-recipes')
  } catch (e: unknown) {
    ownerActionError.value = e instanceof ApiClientError && e.message
      ? e.message
      : t('recipes.errors.delete')
  }
}

function exportCurrentRecipe() {
  const r = recipe.value
  if (!r) return

  const ingredientsStr = r.ingredients
    .map(i => i.original || i.name)
    .filter(Boolean)
    .join(', ')

  const instructionsStr = r.steps.length > 0
    ? r.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')
    : r.instructions

  exportRecipe({
    title: r.title,
    ingredients: ingredientsStr,
    instructions: instructionsStr,
    prepTimeMinutes: 0,
    cookTimeMinutes: r.readyInMinutes,
    servings: r.servings,
    difficulty: '',
    category: r.tags[0] ?? '',
    imageUrl: r.imageUrl,
    language: String(locale.value).split('-')[0] || 'de',
    calories: r.calories ?? null,
  })

  toastStore.addToast(t('notifications.recipeExported'), 'success')
}

async function addIngredientToShoppingList(ingredient: DetailIngredient) {
  if (!recipe.value) return
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    toastStore.addToast(t('recipeDetail.errors.loginRequiredShopping'), 'error')
    return
  }

  try {
    await shoppingListApi.createShoppingListItem(buildShoppingListRequest(ingredient))
    toastStore.addToast(t('recipeDetail.shopping.addedOne'), 'success')
  } catch {
    toastStore.addToast(t('recipeDetail.errors.shopping'), 'error')
  }
}

async function addAllIngredientsToShoppingList() {
  if (!recipe.value) return
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    toastStore.addToast(t('recipeDetail.errors.loginRequiredShopping'), 'error')
    return
  }

  try {
    await Promise.all(recipe.value.ingredients.map(ingredient =>
      shoppingListApi.createShoppingListItem(buildShoppingListRequest(ingredient)),
    ))
    toastStore.addToast(t('recipeDetail.shopping.addedAll'), 'success')
  } catch {
    toastStore.addToast(t('recipeDetail.errors.shopping'), 'error')
  }
}

function buildShoppingListRequest(ingredient: DetailIngredient) {
  if (!recipe.value) {
    throw new Error('Recipe is not loaded.')
  }
  return {
    name: ingredient.name || ingredient.original,
    quantity: ingredient.amount ?? null,
    unit: ingredient.unit ?? null,
    category: t('recipeDetail.shopping.category'),
    checked: false,
    recipeId: String(recipe.value.id),
    recipeTitle: recipe.value.title,
  }
}

const BROAD_LOCATION_TERMS = new Set([
  'deutschland', 'germany', 'österreich', 'oesterreich', 'austria',
  'türkei', 'turkei', 'turkey', 'frankreich', 'france', 'spanien', 'spain',
  'italien', 'italy', 'schweiz', 'switzerland', 'niederlande', 'netherlands',
  'belgien', 'belgium', 'griechenland', 'greece', 'schweden', 'sweden',
  'norwegen', 'norway', 'dänemark', 'daenemark', 'denmark', 'finnland', 'finland',
  'portugal', 'polen', 'poland', 'tschechien', 'czechia', 'ungarn', 'hungary',
  'rumänien', 'romania', 'bulgarien', 'bulgaria', 'kroatien', 'croatia',
  'usa', 'united states', 'united kingdom', 'england', 'china', 'japan',
  'indien', 'india', 'russland', 'russia', 'kanada', 'canada',
  'australien', 'australia', 'brasilien', 'brazil', 'mexiko', 'mexico',
  'argentinien', 'argentina', 'europa', 'europe', 'asien', 'asia',
])

function isBroadLocation(location: string): boolean {
  return BROAD_LOCATION_TERMS.has(location.toLowerCase().trim())
}

function useMyLocation() {
  if (!navigator.geolocation) {
    geoLocationDenied.value = true
    return
  }
  geoLocating.value = true
  geoLocationDenied.value = false
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLatitude.value = pos.coords.latitude
      userLongitude.value = pos.coords.longitude
      userAccuracyMeters.value = Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null
      geoLocating.value = false
      if (restaurantLocation.value.trim() && recipe.value) {
        findRestaurantsByText()
      } else if (recipe.value) {
        findRestaurantsByGps()
      }
    },
    () => {
      geoLocating.value = false
      geoLocationDenied.value = true
    },
  )
}

function formatDistance(meters: number): string {
  if (meters < 1000) return t('restaurants.distanceMeters', { distance: meters })
  return t('restaurants.distanceKm', { distance: (meters / 1000).toFixed(1) })
}

// Defensive client-side filter: reject clearly non-restaurant names even if backend missed them.
// Blocks subreddit prefixes (r/…), platform names, recipe/how-to titles, and article/listicle titles.
function isDisplayableRestaurantName(name: string): boolean {
  if (!name) return false
  const lower = name.toLowerCase().trim()
  if (lower.startsWith('r/')) return false
  if (lower.includes('reddit')) return false
  if (lower.startsWith('the top ') || lower.startsWith('top ') || lower.startsWith('best ') || lower.startsWith('the best ')) return false
  if (lower.startsWith('the ultimate ') || lower.startsWith('where to ') || lower.startsWith('how to ')) return false
  if (lower.includes('restaurants in') || lower.includes('where to eat') || lower.includes('guide to')) return false
  if (lower.includes('best restaurants') || lower.includes('top restaurants')) return false
  if (lower.includes('recipe') || lower.includes('rezept')) return false
  if (lower.includes('how to make') || lower.includes('how to cook')) return false
  if (/\b\d+\s+\w*\s*(restaurants|spots|places)/.test(lower)) return false
  return true
}

async function findRestaurantsByGps() {
  if (!recipe.value || userLatitude.value === null || userLongitude.value === null) return

  restaurantLoading.value = true
  restaurantError.value = null
  restaurantUnavailable.value = false
  restaurantNoResults.value = false
  restaurantLocationTooBroad.value = false
  gpsNoCityHint.value = false
  resolvedLocation.value = null
  restaurantSearchMode.value = null
  locationMismatch.value = false
  restaurants.value = []

  try {
    const response: TavilyRestaurantSearchResponse = await restaurantApi.searchByText(
      recipe.value.title,
      '',
      userLatitude.value,
      userLongitude.value,
      userAccuracyMeters.value ?? undefined,
    )
    if (response.resolvedLocation) {
      resolvedLocation.value = response.resolvedLocation
    }
    locationMismatch.value = response.locationMismatch === true
    if (response.status === 'unavailable') {
      restaurantUnavailable.value = true
    } else if (response.status === 'no_location') {
      gpsNoCityHint.value = true
    } else if (response.status === 'no_results') {
      restaurantNoResults.value = true
    } else {
      applyResults(response)
    }
  } catch {
    restaurantError.value = t('restaurants.errors.searchFailed')
  } finally {
    restaurantLoading.value = false
  }
}

// Applies the client-side safety filter and records the exact/suggestions mode for the UI.
function applyResults(response: TavilyRestaurantSearchResponse) {
  const filtered = response.results.filter(r => isDisplayableRestaurantName(r.name))
  if (filtered.length === 0) {
    restaurantNoResults.value = true
    restaurantSearchMode.value = null
  } else {
    restaurants.value = filtered
    restaurantSearchMode.value = response.searchMode ?? 'exact'
  }
}

async function findRestaurantsByText() {
  if (!recipe.value) return
  const location = restaurantLocation.value.trim()
  if (!location) return

  if (isBroadLocation(location)) {
    restaurantLocationTooBroad.value = true
    restaurantNoResults.value = false
    restaurantUnavailable.value = false
    restaurantError.value = null
    gpsNoCityHint.value = false
    resolvedLocation.value = null
    restaurantSearchMode.value = null
    locationMismatch.value = false
    restaurants.value = []
    return
  }

  restaurantLoading.value = true
  restaurantError.value = null
  restaurantUnavailable.value = false
  restaurantNoResults.value = false
  restaurantLocationTooBroad.value = false
  gpsNoCityHint.value = false
  resolvedLocation.value = null
  restaurantSearchMode.value = null
  locationMismatch.value = false
  restaurants.value = []

  try {
    const response: TavilyRestaurantSearchResponse = await restaurantApi.searchByText(
      recipe.value.title,
      location,
      userLatitude.value ?? undefined,
      userLongitude.value ?? undefined,
      userAccuracyMeters.value ?? undefined,
    )
    if (response.resolvedLocation) {
      resolvedLocation.value = response.resolvedLocation
    }
    locationMismatch.value = response.locationMismatch === true
    if (response.status === 'unavailable') {
      restaurantUnavailable.value = true
    } else if (response.status === 'no_results') {
      restaurantNoResults.value = true
    } else {
      applyResults(response)
    }
  } catch {
    restaurantError.value = t('restaurants.errors.searchFailed')
  } finally {
    restaurantLoading.value = false
  }
}

async function toggleFavorite() {
  if (!recipe.value) return
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    favoriteError.value = 'Bitte melde dich an, um Rezepte zu favorisieren.'
    return
  }

  const id = favoriteId(recipe.value)
  const source = favoriteSource(recipe.value)
  try {
    favoriteError.value = null
    if (favorite.value) {
      await favoriteApi.removeExternalFavorite(source, id)
      favorite.value = false
      return
    }

    await favoriteApi.addExternalFavorite({
      externalRecipeId: id,
      externalTitle: recipe.value.title,
      externalImageUrl: recipe.value.imageUrl,
      externalSource: source,
    })
    favorite.value = true
  } catch (e: unknown) {
    favoriteError.value = e instanceof ApiClientError && e.message
      ? e.message
      : 'Favorit konnte nicht gespeichert werden.'
  }
}

function favoriteId(detailRecipe: DetailRecipe) {
  return String(detailRecipe.id)
}

function favoriteSource(detailRecipe: DetailRecipe) {
  return detailRecipe.source === 'spoonacular' ? 'SPOONACULAR' : 'DISHLY'
}

function visibleTag(tag: string) {
  return displayCategory(tag, String(locale.value))
}

async function searchInstructionsOnline() {
  if (!recipe.value) return
  if (recipe.value.source !== 'dishly') {
    instructionSearchError.value = 'Zubereitungsvorschläge sind aktuell nur für Dishly-Rezepte verfügbar.'
    instructionSearchMessage.value = null
    instructionSuggestions.value = []
    return
  }
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    instructionSearchError.value = 'Bitte melde dich an, um Zubereitungsvorschläge zu suchen.'
    instructionSearchMessage.value = null
    instructionSuggestions.value = []
    return
  }
  instructionSearchLoading.value = true
  instructionSearchError.value = null
  instructionSearchMessage.value = null
  instructionSuggestions.value = []

  try {
    const response = await recipeApi.getInstructionSuggestions(recipe.value.id)
    instructionSuggestions.value = response.suggestions ?? []
    if (!response.configured) {
      instructionSearchError.value = response.message || t('recipeDetail.instructions.searchNotConfigured')
    } else if (response.message) {
      instructionSearchMessage.value = response.message
    } else if (instructionSuggestions.value.length === 0) {
      instructionSearchMessage.value = t('recipeDetail.instructions.noSearchResults')
    }
  } catch (e: unknown) {
    const responseMessage = e instanceof ApiClientError && isInstructionSuggestionError(e.data)
      ? e.data.message
      : null
    if (responseMessage) {
      instructionSearchError.value = responseMessage
    } else if (e instanceof ApiClientError && e.message) {
      instructionSearchError.value = e.message
    } else {
      instructionSearchError.value = t('recipeDetail.instructions.searchFailed')
    }
  } finally {
    instructionSearchLoading.value = false
  }
}

function resetInstructionSearch() {
  instructionSearchLoading.value = false
  instructionSearchError.value = null
  instructionSearchMessage.value = null
  instructionSuggestions.value = []
}

function isInstructionSuggestionError(value: unknown): value is { message?: string | null } {
  return typeof value === 'object' && value !== null && 'message' in value
}

async function openMealPlanModal() {
  mealPlanMessage.value = null
  mealPlanError.value = null
  if (!recipe.value) return
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    mealPlanError.value = t('recipeDetail.errors.loginRequiredMealPlan')
    return
  }
  mealPlanModalOpen.value = true
  mealPlanLoading.value = true
  try {
    const weekStart = weekDays.value[0]?.date
    const week = await mealPlanApi.getWeek(weekStart)
    plannedEntries.value = week.entries
  } catch {
    plannedEntries.value = []
  } finally {
    mealPlanLoading.value = false
  }
}

async function addToMealPlan(date: string, slot: MealSlot) {
  if (!recipe.value) return
  mealPlanLoading.value = true
  mealPlanError.value = null
  const payload = mealPlanPayload(recipe.value)
  try {
    const savedEntry = await mealPlanApi.setSlot(date, slot, payload)
    plannedEntries.value = plannedEntries.value
      .filter(entry => !(entry.plannedDate === date && normalizedSlot(entry) === slot))
      .concat(savedEntry)
    mealPlanMessage.value = t('recipeDetail.mealPlan.added')
    mealPlanModalOpen.value = false
  } catch (e: unknown) {
    logMealPlanError(e, date, slot, payload)
    mealPlanError.value = e instanceof ApiClientError && e.message
      ? e.message
      : t('recipeDetail.errors.mealPlan')
  } finally {
    mealPlanLoading.value = false
  }
}

function mealPlanPayload(detailRecipe: DetailRecipe): number | MealPlanEntryRequest {
  const id = Number(detailRecipe.id)
  if (detailRecipe.source === 'dishly' && Number.isFinite(id) && id > 0) {
    return id
  }
  return {
    customTitle: detailRecipe.title,
    caloriesSnapshot: detailRecipe.calories ?? null,
    proteinSnapshot: detailRecipe.protein ?? null,
    imageUrlSnapshot: detailRecipe.imageUrl ?? null,
    externalRecipeId: String(detailRecipe.id),
    externalSource: detailRecipe.source,
  }
}

function logMealPlanError(
  errorValue: unknown,
  date: string,
  slot: MealSlot,
  payload: number | MealPlanEntryRequest,
) {
  if (errorValue instanceof ApiClientError) {
    console.error('Meal plan request failed', {
      status: errorValue.status,
      body: errorValue.data,
      payload,
      date,
      slot,
    })
    return
  }
  console.error('Meal plan request failed', { error: errorValue, payload, date, slot })
}

function plannedTitle(date: string, slot: MealSlot) {
  return plannedEntries.value.find(entry =>
    entry.plannedDate === date && normalizedSlot(entry) === slot,
  )?.recipe?.title
    ?? plannedEntries.value.find(entry =>
      entry.plannedDate === date && normalizedSlot(entry) === slot,
    )?.customTitle
}

function normalizedSlot(entry: MealPlanEntryResponse): MealSlot {
  return (entry.mealSlot ?? 'dinner') as MealSlot
}

function startOfCurrentWeek() {
  const now = new Date()
  const day = now.getDay() === 0 ? 7 : now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1)
  return monday
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(date.getDate() + days)
  return next
}

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
</script>

<template>
  <section class="detail-page">
    <button type="button" class="back-button" @click="goBack">
      {{ t('recipeDetail.actions.back') }}
    </button>

    <p v-if="loading" class="status-text">{{ t('recipeDetail.loading') }}</p>
    <p v-else-if="error" class="status-text error">{{ error }}</p>

    <article v-else-if="recipe" class="detail-layout">
      <section class="recipe-hero">
        <div v-if="recipe.imageUrl" class="image-panel">
          <img :src="recipe.imageUrl" :alt="recipe.title" />
        </div>
        <div v-else class="image-panel image-panel-empty">
          <span>{{ recipe.title.charAt(0) }}</span>
        </div>

        <div class="content-panel">
          <p class="source-label">
            {{ recipe.source === 'dishly' ? t('home.source.dishly') : t('home.source.external') }}
          </p>
          <h1>{{ recipe.title }}</h1>

        <div class="meta-grid">
          <span v-if="recipe.readyInMinutes" class="meta-card">{{ t('recipeDetail.meta.time', { minutes: recipe.readyInMinutes }) }}</span>
          <span v-if="recipe.servings" class="meta-card">{{ t('recipeDetail.meta.servings', { count: recipe.servings }) }}</span>
          <span v-if="recipe.calories" class="meta-card highlight">{{ t('recipeDetail.meta.calories', { calories: recipe.calories }) }}</span>
          <span v-if="recipe.protein" class="meta-card highlight">{{ t('recipeDetail.meta.protein', { protein: Math.round(recipe.protein) }) }}</span>
          <span v-if="(recipe.alcohol ?? 0) > 0 || (recipe.alcoholPercent ?? 0) > 0" class="meta-card">{{ t('recipeDetail.meta.alcohol') }}</span>
        </div>

        <div v-if="recipe.tags.length" class="tag-list">
          <span v-for="tag in recipe.tags" :key="tag" class="tag">{{ visibleTag(tag) }}</span>
        </div>

        <div class="action-row">
          <button type="button" class="primary-button" @click="addAllIngredientsToShoppingList">
            {{ t('recipeDetail.actions.addAllToShoppingList') }}
          </button>
          <button type="button" class="secondary-button" @click="openMealPlanModal">
            {{ t('recipeDetail.actions.addToMealPlan') }}
          </button>
          <button
            type="button"
            class="secondary-button"
            :aria-pressed="favorite"
            @click="toggleFavorite"
          >
            {{ favorite ? `♥ ${t('recipeDetail.actions.favorite')}` : `♡ ${t('recipeDetail.actions.favorite')}` }}
          </button>
          <button
            v-if="recipe.ownedByCurrentUser"
            type="button"
            class="secondary-button owner-edit-button"
            @click="editOwnRecipe"
          >
            {{ t('recipes.actions.edit') }}
          </button>
          <button
            v-if="recipe.ownedByCurrentUser"
            type="button"
            class="secondary-button owner-delete-button"
            @click="deleteOwnRecipe"
          >
            {{ t('recipes.actions.delete') }}
          </button>
          <button
            type="button"
            class="secondary-button"
            @click="exportCurrentRecipe"
          >
            {{ t('recipeDetail.actions.export') }}
          </button>
        </div>

          <p v-if="mealPlanMessage" class="status-text success">{{ mealPlanMessage }}</p>
          <p v-if="mealPlanError" class="status-text error">{{ mealPlanError }}</p>
          <p v-if="favoriteError" class="status-text error">{{ favoriteError }}</p>
          <p v-if="ownerActionError" class="status-text error">{{ ownerActionError }}</p>
        </div>
      </section>

      <section class="detail-section">
        <h2>
          {{ t('recipeDetail.ingredients.title') }}
          <span v-if="ingredientCount">({{ t('recipeDetail.ingredients.count', { count: ingredientCount }) }})</span>
        </h2>
        <ul class="ingredient-list">
          <li v-for="ingredient in recipe.ingredients" :key="ingredient.original">
            <span class="ingredient-name">{{ ingredient.original }}</span>
            <button type="button" class="small-button" @click="addIngredientToShoppingList(ingredient)">
              {{ t('recipeDetail.actions.addOne') }}
            </button>
          </li>
        </ul>
      </section>

      <section class="detail-section">
        <h2>{{ t('recipeDetail.instructions.title') }}</h2>
        <ol v-if="hasInstructions" class="step-list">
          <li v-for="step in recipe.steps" :key="step">
            <span>{{ step }}</span>
          </li>
        </ol>
        <div v-else class="instruction-search-panel">
          <p class="instruction-text">
            {{ t('recipeDetail.instructions.missingVerified') }}
          </p>
          <p class="hint">{{ t('recipeDetail.instructions.suggestionDisclaimer') }}</p>
          <a
            v-if="recipe.sourceUrl"
            :href="recipe.sourceUrl"
            class="google-search-link"
            target="_blank"
            rel="noreferrer"
          >
            {{ t('recipeDetail.instructions.openSource') }}
          </a>
          <button
            type="button"
            class="secondary-button"
            :disabled="instructionSearchLoading"
            @click="searchInstructionsOnline"
          >
            {{ instructionSearchLoading
              ? t('recipeDetail.instructions.searchingSuggestions')
              : t('recipeDetail.instructions.searchSuggestions') }}
          </button>
          <p v-if="instructionSearchError" class="status-text error">{{ instructionSearchError }}</p>
          <p v-if="instructionSearchMessage" class="status-text">{{ instructionSearchMessage }}</p>
          <div v-if="instructionSuggestions.length" class="instruction-results">
            <h3>{{ t('recipeDetail.instructions.suggestionsTitle') }}</h3>
            <p class="hint">{{ t('recipeDetail.instructions.suggestionsDisclaimer') }}</p>
            <ul>
              <li v-for="suggestion in instructionSuggestions" :key="suggestion.sourceUrl">
                <a :href="suggestion.sourceUrl" target="_blank" rel="noopener noreferrer">
                  {{ suggestion.sourceTitle || suggestion.sourceUrl }}
                </a>
                <ol class="step-list suggestion-step-list">
                  <li v-for="step in suggestion.steps" :key="`${suggestion.sourceUrl}-${step}`">{{ step }}</li>
                </ol>
                <p v-if="suggestion.reason">{{ suggestion.reason }}</p>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section class="detail-section">
        <h2>{{ t('recipeDetail.restaurants.title') }}</h2>
        <p class="hint">{{ t('restaurants.disclaimer') }}</p>
        <div class="restaurant-search-form">
          <label class="location-label" for="restaurant-location">{{ t('restaurants.cityLabel') }}</label>
          <div class="location-input-row">
            <input
              id="restaurant-location"
              v-model="restaurantLocation"
              type="text"
              class="location-input"
              :placeholder="t('restaurants.locationPlaceholder')"
              :disabled="restaurantLoading"
              @keyup.enter="findRestaurantsByText"
            />
          </div>
          <p class="location-help">{{ t('restaurants.cityHelp') }}</p>
          <div class="restaurant-search-actions">
            <button
              type="button"
              class="secondary-button restaurant-search-button"
              :disabled="restaurantLoading || !restaurantLocation.trim()"
              @click="findRestaurantsByText"
            >
              {{ restaurantLoading ? t('restaurants.loading.search') : t('restaurants.actions.search') }}
            </button>
            <button
              type="button"
              class="secondary-button gps-button"
              :disabled="restaurantLoading || geoLocating"
              @click="useMyLocation"
            >
              {{ geoLocating ? t('restaurants.loading.location') : (userLatitude !== null ? t('restaurants.locationActive') : t('restaurants.useMyLocation')) }}
            </button>
          </div>
          <p v-if="geoLocationDenied" class="status-text">{{ t('restaurants.locationDeniedHint') }}</p>
        </div>
        <template v-if="!restaurantLoading">
          <p v-if="restaurantError" class="status-text error">{{ restaurantError }}</p>
          <p v-else-if="restaurantLocationTooBroad" class="status-text">{{ t('restaurants.locationTooBroad') }}</p>
          <p v-else-if="restaurantUnavailable" class="status-text">{{ t('restaurants.unavailable') }}</p>
          <p v-else-if="gpsNoCityHint" class="status-text">{{ t('restaurants.gpsNoCityHint') }}</p>
          <p v-else-if="restaurantNoResults" class="status-text">{{ t('restaurants.noResults') }}</p>
          <p v-if="locationMismatch" class="status-text location-mismatch">{{ t('restaurants.locationMismatch') }}</p>
          <p v-if="resolvedLocation" class="status-text">{{ t('restaurants.resolvedLocation', { city: resolvedLocation }) }}</p>
          <p v-if="userLatitude !== null && userAccuracyMeters !== null" class="status-text location-accuracy">{{ t('restaurants.locationAccuracy', { accuracy: userAccuracyMeters }) }}</p>
        </template>
        <template v-if="!restaurantLoading && restaurants.length">
          <p v-if="restaurantSearchMode === 'exact'" class="restaurant-mode-heading">{{ t('restaurants.exactMatchesHeading') }}</p>
          <p v-else-if="restaurantSearchMode === 'suggestions'" class="restaurant-mode-heading">{{ t('restaurants.suggestionsHeading') }}</p>
          <ul class="restaurant-list">
            <li v-for="restaurant in restaurants" :key="`${restaurant.name}-${restaurant.googleMapsUrl}`">
              <strong class="restaurant-name">{{ restaurant.name }}</strong>
              <span v-if="restaurant.address" class="restaurant-address">{{ restaurant.address }}</span>
              <span v-if="restaurant.distanceMeters != null" class="restaurant-distance">{{ formatDistance(restaurant.distanceMeters) }}</span>
              <span v-else class="restaurant-distance-hint">{{ t('restaurants.distanceInMaps') }}</span>
              <span v-if="restaurantSearchMode === 'exact'" class="restaurant-match-note">{{ t('restaurants.exactCardNote') }}</span>
              <span v-else-if="restaurantSearchMode === 'suggestions'" class="restaurant-match-note suggestion">{{ t('restaurants.suggestionCardNote') }}</span>
              <a :href="restaurant.googleMapsUrl" target="_blank" rel="noopener noreferrer" class="maps-link">
                {{ t('restaurants.openRouteInMaps') }}
              </a>
            </li>
          </ul>
        </template>
      </section>
    </article>

    <div v-if="mealPlanModalOpen" class="modal-backdrop" @click.self="mealPlanModalOpen = false">
      <section class="meal-plan-modal" :aria-label="t('recipeDetail.mealPlan.title')">
        <h2>{{ t('recipeDetail.mealPlan.title') }}</h2>
        <p>{{ t('recipeDetail.mealPlan.subtitle') }}</p>
        <p v-if="mealPlanLoading" class="status-text">{{ t('mealPlan.loading') }}</p>
        <div class="day-buttons">
          <div v-for="day in weekDays" :key="day.date" class="day-button-group">
            <strong>{{ day.label }}</strong>
            <span>{{ day.date }}</span>
            <button
              v-for="slot in mealSlots"
              :key="slot.key"
              type="button"
              class="day-button"
              :disabled="mealPlanLoading"
              @click="addToMealPlan(day.date, slot.key)"
            >
              <span>{{ t(slot.labelKey) }}</span>
              <small v-if="plannedTitle(day.date, slot.key)">{{ plannedTitle(day.date, slot.key) }}</small>
              <small v-else>{{ t('recipeDetail.mealPlan.freeSlot') }}</small>
            </button>
          </div>
        </div>
        <button type="button" class="cancel-modal" @click="mealPlanModalOpen = false">
          {{ t('recipeDetail.actions.cancel') }}
        </button>
      </section>
    </div>
  </section>
</template>

<style scoped>
.detail-page {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto 56px auto;
  padding: 28px 24px 56px;
  box-sizing: border-box;
}

.back-button,
.primary-button,
.secondary-button,
.small-button {
  border: none;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  text-decoration: none;
}

.back-button {
  background: #ffffff;
  border: 1.5px solid rgba(94, 203, 181, 0.45);
  color: var(--mint-darker, #2b8c7b);
  padding: 9px 18px;
  margin-bottom: 22px;
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.back-button:hover {
  box-shadow: var(--shadow-card-hover, 0 12px 32px rgba(61, 174, 155, 0.18));
  transform: translateY(-1px);
}

.status-text {
  color: #486b68;
  margin: 12px 0;
}

.status-text.error {
  color: #a14c2b;
  font-weight: 700;
}

.status-text.success {
  color: #1d8e90;
  font-weight: 700;
}

.detail-layout {
  display: grid;
  gap: 24px;
  min-width: 0;
}

.recipe-hero {
  align-items: stretch;
  background: var(--pink-bg, #fdf1f5);
  border-radius: 28px;
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  display: grid;
  gap: 30px;
  grid-template-columns: minmax(320px, 0.98fr) minmax(0, 1.02fr);
  overflow: hidden;
  padding: 28px;
}

.image-panel {
  border: 5px solid #ffffff;
  border-radius: 24px;
  overflow: hidden;
  background: var(--mint-bg, #ecfaf6);
  box-shadow: var(--shadow-card-hover, 0 12px 32px rgba(61, 174, 155, 0.18));
  min-height: 380px;
}

.image-panel img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.image-panel-empty {
  align-items: center;
  display: flex;
  justify-content: center;
}

.image-panel-empty span {
  align-items: center;
  background: #ffffff;
  border-radius: 999px;
  color: var(--pink-dark, #d44488);
  display: flex;
  font-size: clamp(4rem, 10vw, 7rem);
  font-weight: 900;
  height: 160px;
  justify-content: center;
  width: 160px;
}

.content-panel {
  align-content: center;
  display: grid;
  gap: 18px;
  min-width: 0;
  padding: 12px 6px;
}

.content-panel h1 {
  color: var(--text-dark, #2e3437);
  font-size: clamp(2.15rem, 4vw, 3.6rem);
  line-height: 1.04;
  letter-spacing: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

.source-label {
  color: var(--pink-dark, #d44488);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  margin: 0;
  text-transform: uppercase;
}

.meta-grid,
.tag-list,
.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0;
}

.meta-card,
.tag {
  border-radius: 999px;
  background: #ffffff;
  color: var(--mint-darker, #2b8c7b);
  box-shadow: 0 8px 18px rgba(61, 174, 155, 0.08);
  font-weight: 800;
  padding: 9px 13px;
}

.meta-card.highlight {
  background: var(--mint-bg, #ecfaf6);
  color: var(--mint-darker, #2b8c7b);
}

.tag {
  background: #fff7fb;
  color: var(--pink-dark, #d44488);
  box-shadow: none;
}

.primary-button {
  background: var(--pink, #e85a9b);
  color: #ffffff;
  padding: 11px 18px;
  min-height: 44px;
  box-shadow: 0 10px 22px rgba(232, 90, 155, 0.22);
}

.secondary-button {
  background: var(--mint, #5ecbb5);
  color: #ffffff;
  padding: 11px 18px;
  min-height: 44px;
}

.secondary-button[aria-pressed="true"] {
  background: var(--pink-dark, #d44488);
}

.small-button {
  background: #ffffff;
  color: var(--mint-darker, #2b8c7b);
  border: 1.5px solid rgba(94, 203, 181, 0.55);
  padding: 6px 12px;
  min-height: 40px;
}

.primary-button:hover,
.secondary-button:hover,
.small-button:hover {
  filter: brightness(0.98);
  transform: translateY(-1px);
}

.detail-section {
  grid-column: 1 / -1;
  background: #ffffff;
  border: 1px solid rgba(94, 203, 181, 0.22);
  border-radius: var(--radius-card, 18px);
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  padding: 26px;
}

.detail-section h2 {
  color: var(--pink-dark, #d44488);
  font-size: 1.45rem;
  letter-spacing: 0;
  margin: 0 0 16px;
}

.ingredient-list,
.restaurant-mode-heading {
  margin: 4px 0 8px;
  font-weight: 600;
  color: var(--text-dark, #2e3437);
}

.location-mismatch {
  color: #9a6a1c;
  font-weight: 600;
}

.location-accuracy {
  font-size: 0.82rem;
  color: #6b7c79;
}

.restaurant-match-note {
  font-size: 0.82rem;
  color: var(--mint-darker, #2b8c7b);
}

.restaurant-match-note.suggestion {
  color: #9a6a1c;
}

.restaurant-list {
  list-style: none;
  display: grid;
  gap: 12px;
  margin: 14px 0 0;
  padding: 0;
}

.ingredient-list li,
.restaurant-list li {
  background: var(--mint-bg, #ecfaf6);
  border: 1px solid rgba(94, 203, 181, 0.28);
  border-radius: 14px;
  padding: 13px 14px;
}

.ingredient-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  overflow-wrap: anywhere;
}

.ingredient-name {
  color: var(--text-dark, #2e3437);
  font-weight: 700;
}

.step-list {
  counter-reset: recipe-step;
  display: grid;
  gap: 12px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.step-list li {
  align-items: flex-start;
  background: #fff8fb;
  border: 1px solid rgba(232, 90, 155, 0.16);
  border-radius: 16px;
  color: var(--text-dark, #2e3437);
  counter-increment: recipe-step;
  display: grid;
  gap: 12px;
  grid-template-columns: auto 1fr;
  line-height: 1.6;
  padding: 15px;
}

.step-list li::before {
  align-items: center;
  background: var(--pink, #e85a9b);
  border-radius: 999px;
  color: #ffffff;
  content: counter(recipe-step);
  display: inline-flex;
  font-size: 0.88rem;
  font-weight: 900;
  height: 30px;
  justify-content: center;
  margin-top: 1px;
  width: 30px;
}

.instruction-text,
.hint {
  color: #486b68;
  white-space: pre-line;
}

.instruction-search-panel {
  display: grid;
  gap: 12px;
  background: var(--mint-bg, #ecfaf6);
  border: 1px solid rgba(94, 203, 181, 0.28);
  border-radius: 16px;
  padding: 18px;
}

.google-search-link {
  color: var(--pink-dark, #d44488);
  font-weight: 800;
}

.instruction-results {
  background: #ffffff;
  border: 1px solid rgba(94, 203, 181, 0.28);
  border-radius: 16px;
  padding: 14px;
  overflow-wrap: anywhere;
}

.instruction-results h3 {
  color: #2b1b23;
  font-size: 1rem;
  margin: 0 0 8px 0;
}

.instruction-results ul {
  display: grid;
  gap: 10px;
  list-style: none;
  margin: 10px 0 0 0;
  padding: 0;
}

.instruction-results li {
  background: #ffffff;
  border: 1px solid #d6eee9;
  border-radius: 12px;
  padding: 10px 12px;
}

.instruction-results a {
  color: #1d8e90;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.instruction-results p {
  color: #486b68;
  margin: 4px 0 0 0;
}

.restaurant-search-form {
  display: grid;
  gap: 10px;
  max-width: 720px;
  margin: 16px 0;
  background: var(--mint-bg, #ecfaf6);
  border: 1px solid rgba(94, 203, 181, 0.28);
  border-radius: 16px;
  padding: 16px;
}

.location-label {
  font-weight: 700;
  font-size: 0.875rem;
  color: var(--text-dark, #2e3437);
}

.location-input-row {
  display: grid;
}

.location-input {
  border: 1.5px solid rgba(94, 203, 181, 0.5);
  border-radius: 999px;
  padding: 10px 18px;
  font: inherit;
  font-size: 0.95rem;
  outline: none;
  background: #fff;
  box-sizing: border-box;
  transition: border-color 0.15s;
}

.location-input:focus {
  border-color: var(--mint-darker, #2b8c7b);
}

.location-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.location-help {
  font-size: 0.8rem;
  color: #486b68;
  margin: 0;
  padding: 0 4px;
}

.restaurant-list li {
  display: grid;
  gap: 6px;
  overflow-wrap: anywhere;
}

.restaurant-name {
  font-size: 1.05rem;
  color: var(--text-dark, #2e3437);
}

.restaurant-list a,
.maps-link {
  color: var(--pink-dark, #d44488);
  font-weight: 800;
  overflow-wrap: anywhere;
  text-decoration: none;
}

.maps-link:hover {
  text-decoration: underline;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(10, 20, 25, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
}

.meal-plan-modal {
  width: min(620px, 100%);
  max-height: 90vh;
  overflow: auto;
  background: #ffffff;
  border-radius: 18px;
  padding: 22px;
  box-shadow: 0 14px 42px rgba(0, 0, 0, 0.24);
}

.meal-plan-modal h2 {
  color: #cc7da9;
  margin-bottom: 8px;
}

.meal-plan-modal p {
  color: #486b68;
  margin-bottom: 16px;
}

.day-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.day-button-group {
  border: 1px solid #d6eee9;
  border-radius: 14px;
  display: grid;
  gap: 8px;
  padding: 10px;
}

.day-button-group > strong {
  color: #2b1b23;
}

.day-button-group > span {
  color: #486b68;
  font-size: 0.85rem;
}

.day-button {
  border: 1px solid #c3e7e1;
  border-radius: 12px;
  background: #f4fbfa;
  color: #2b1b23;
  cursor: pointer;
  display: grid;
  gap: 4px;
  padding: 9px 10px;
  text-align: left;
}

.day-button:hover {
  border-color: #26b6b8;
}

.day-button span {
  color: #2f6f62;
  font-size: 0.9rem;
  font-weight: 800;
}

.day-button small {
  color: #486b68;
}

.cancel-modal {
  margin-top: 16px;
  border: none;
  border-radius: 999px;
  background: #fff0eb;
  color: #a14c2b;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  padding: 9px 16px;
}

@media (max-width: 960px) {
  .recipe-hero {
    grid-template-columns: 1fr;
  }

  .image-panel {
    min-height: 320px;
  }
}

@media (max-width: 760px) {
  .detail-page {
    margin-bottom: 32px;
    padding: 16px 12px 32px;
  }

  .back-button {
    min-height: 44px;
    text-align: center;
    width: 100%;
  }

  .detail-layout {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .recipe-hero {
    border-radius: 20px;
    gap: 18px;
    padding: 18px;
  }

  .image-panel {
    aspect-ratio: 16 / 10;
    min-height: 180px;
  }

  .image-panel-empty span {
    font-size: 3.6rem;
    height: 104px;
    width: 104px;
  }

  .content-panel {
    gap: 14px;
    padding: 0;
  }

  .content-panel h1 {
    font-size: 2rem;
    line-height: 1.1;
  }

  .meta-card,
  .tag {
    flex: 1 1 auto;
    justify-content: center;
    text-align: center;
  }

  .action-row {
    display: grid;
    grid-template-columns: 1fr;
  }

  .primary-button,
  .secondary-button,
  .small-button {
    text-align: center;
    width: 100%;
  }

  .detail-section {
    border-radius: 16px;
    padding: 18px;
  }

  .ingredient-list li {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .step-list {
    gap: 10px;
  }

  .step-list li {
    grid-template-columns: auto minmax(0, 1fr);
    padding: 13px;
  }

  .instruction-results {
    padding: 12px;
  }

  .modal-backdrop {
    align-items: flex-end;
    padding: 10px;
  }

  .meal-plan-modal {
    border-radius: 18px 18px 0 0;
    max-height: 92vh;
    padding: 18px 14px;
  }

  .day-buttons {
    grid-template-columns: 1fr;
  }

  .cancel-modal {
    min-height: 44px;
    width: 100%;
  }
}
</style>
