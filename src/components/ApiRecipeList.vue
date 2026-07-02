 <script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { ApiClientError, AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { useToastStore } from '@/stores/toastStore'
import { useSearchStore } from '@/stores/searchStore'
import { favoriteApi } from '@/shared/api/favoriteApi'
import { mealPlanApi } from '@/shared/api/mealPlanApi'
import { pantryApi } from '@/shared/api/pantryApi'
import { profileApi } from '@/shared/api/profileApi'
import { recipeApi } from '@/shared/api/recipeApi'
import { displayCategory } from '@/shared/recipeDisplay'
import { ALLERGEN_ENTRIES, DISLIKES_ENTRIES, LIKES_ENTRIES, getMatchTerms } from '@/shared/profileSuggestions'
import { categorySearchTerms, matchesCategoryAwareText } from '@/shared/ingredientCategories'
import { getRecommendationBadges } from '@/shared/recommendationBadges'
import type { RecommendationBadge } from '@/shared/recommendationBadges'
import { useAuthStore } from '@/stores/authStore'
import type { MealPlanEntryRequest, MealPlanEntryResponse, MealSlot } from '@/types/mealPlan'
import type { UserPreferencesResponse } from '@/types/profile'
import type { Recipe, RecipeSearchFilters } from '@/types/recipe'

type RecipeSource = 'external' | 'dishly'
type DisplayRecipe = Recipe & {
  source: RecipeSource
  recommendationReasons: RecommendationBadge[]
}

// Search text + soft filters live in a Pinia store (not a local ref) so logout can
// reset them even when the route doesn't change (component stays mounted on "/").
const {
  query: search,
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
} = storeToRefs(useSearchStore())
const profilePersonalizationEnabled = ref(true)
const recipes = ref<DisplayRecipe[]>([])
const baseRecipes = ref<DisplayRecipe[]>([])
const allExternal = ref<Recipe[]>([])
const ownPublished = ref<Recipe[]>([])
const loadedPreferences = ref<UserPreferencesResponse | null>(null)
const likes = ref<string[]>([])
const dislikes = ref<string[]>([])
const allergies = ref<string[]>([])
const pantryIngredients = ref<string[]>([])
const externalFavoriteIds = ref<Set<string>>(new Set())
const loading = ref(true)
const error = ref<string | null>(null)
const searchNotice = ref<string | null>(null)
const mealPlanModalOpen = ref(false)
const mealPlanTarget = ref<DisplayRecipe | null>(null)
const mealPlanLoading = ref(false)
const mealPlanError = ref<string | null>(null)
const plannedEntries = ref<MealPlanEntryResponse[]>([])
const { t, locale } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const toastStore = useToastStore()
const isLoggedIn = computed(() => authStore.isAuthenticated)

const EXTERNAL_CHUNK = 20
const SEARCH_DEBOUNCE_MS = 400
const PAGE_SIZE = 30
const SNAPSHOT_KEY = 'dishly.recipe.snapshot.v2'
let searchTimeout: ReturnType<typeof setTimeout> | null = null
let externalRequestCounter = 0
let calorieSortWasAutomatic = false
// Prevents the filter watcher from clearing the snapshot during initial profile loading.
let isInitializingProfile = false

const filtered = computed(() => recipes.value)
const currentPage = ref(1)
const listWrapRef = ref<HTMLElement | null>(null)
const totalPages = computed(() => Math.max(1, Math.ceil(recipes.value.length / PAGE_SIZE)))
const pageNumbers = computed(() => Array.from({ length: totalPages.value }, (_, i) => i + 1))
const paginatedRecipes = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return recipes.value.slice(start, start + PAGE_SIZE)
})
const currentLanguage = computed(() => {
  const [language] = String(locale.value).split('-')
  return (language || 'de').toLowerCase()
})
const englishRecipesAllowed = computed(() => currentLanguage.value === 'en')
const hasSoftProfilePreferences = computed(() => Boolean(
  likes.value.length
  || vegan.value
  || vegetarian.value
  || glutenFree.value
  || lactoseFree.value
  || calorieConscious.value
  || highProtein.value
  || maxPrepTime.value
  || maxCalories.value,
))
const personalizationActive = computed(() => profilePersonalizationEnabled.value && hasSoftProfilePreferences.value && !search.value.trim())
const personalizationButtonText = computed(() =>
  profilePersonalizationEnabled.value
    ? t('home.personalization.disable')
    : t('home.personalization.enable'),
)
const personalizationStatusText = computed(() =>
  profilePersonalizationEnabled.value
    ? t('home.personalization.active')
    : t('home.personalization.inactive'),
)
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

const toDisplayRecipe = (recipe: Recipe, source: RecipeSource): DisplayRecipe => ({
  ...recipe,
  source,
  recommendationReasons: recommendationReasons(recipe, source),
})

const shuffleArray = (items: Recipe[]): Recipe[] => {
  const arr: Recipe[] = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i] as Recipe
    arr[i] = arr[j] as Recipe
    arr[j] = tmp
  }
  return arr
}

const shuffleDisplayRecipes = (items: DisplayRecipe[]): DisplayRecipe[] => {
  const arr: DisplayRecipe[] = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i] as DisplayRecipe
    arr[i] = arr[j] as DisplayRecipe
    arr[j] = tmp
  }
  return arr
}

const filterRecipes = (items: Recipe[], q: string) => {
  const hasSearchQuery = Boolean(q.trim())
  return items.filter(r =>
    matchesText(r, q)
    && matchesHardPreferences(r)
    && (hasSearchQuery || matchesLocalFilters(r)),
  )
}

function buildContextKey() {
  // Only fields that affect the BASE list (hard preferences + preference boost).
  // Soft filters (vegan, maxPrepTime, etc.) are applied on top and do not invalidate the snapshot.
  return [
    authStore.isAuthenticated ? '1' : '0',
    currentLanguage.value,
    [...likes.value].sort().join(','),
    [...dislikes.value].sort().join(','),
    [...allergies.value].sort().join(','),
  ].join('|')
}

function saveSnapshot(base: DisplayRecipe[], page: number) {
  try {
    sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify({
      baseRecipes: base,
      page,
      contextKey: buildContextKey(),
    }))
  } catch {}
}

function loadSnapshot(): { baseRecipes: DisplayRecipe[]; page: number } | null {
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return null
    const snap = JSON.parse(raw)
    if (!snap || snap.contextKey !== buildContextKey()) return null
    if (!Array.isArray(snap.baseRecipes) || snap.baseRecipes.length === 0) return null
    return { baseRecipes: snap.baseRecipes, page: Number(snap.page) || 1 }
  } catch {
    return null
  }
}

function clearSnapshot() {
  try { sessionStorage.removeItem(SNAPSHOT_KEY) } catch {}
}

function updateSnapshotPage(page: number) {
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return
    const snap = JSON.parse(raw)
    snap.page = page
    sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap))
  } catch {}
}

// Builds the stable shuffled base list from ownPublished + allExternal.
// Only hard preferences (dislikes/allergies) are applied here.
// Soft filters (vegan, maxPrepTime, etc.) are applied by updateDisplayFromBase().
const buildBaseList = () => {
  const eligible = ownPublished.value.filter(r => matchesHardPreferences(r))
  const shuffledExternal = shuffleArray(allExternal.value.filter(r => matchesHardPreferences(r)))
  const externalFallbackLimit = Math.max(0, 100 - eligible.length)
  const externalSlice = externalFallbackLimit > 0
    ? shuffledExternal.slice(0, Math.min(EXTERNAL_CHUNK, externalFallbackLimit))
    : []
  baseRecipes.value = applyPreferenceBoost([
    ...eligible.map(r => toDisplayRecipe(r, 'dishly')),
    ...externalSlice.map(r => toDisplayRecipe(r, 'external')),
  ])
}

// Applies current soft filters + sort to baseRecipes WITHOUT shuffling.
// Called when filters change, search is cleared, or snapshot is restored.
const updateDisplayFromBase = () => {
  recipes.value = sortRecipes(baseRecipes.value.filter(r => matchesLocalFilters(r)))
}

// Builds a transient search-result view from ownPublished + allExternal.
// No shuffle — search results follow API relevance order.
const buildSearchView = () => {
  const q = search.value.toLowerCase().trim()
  const matchingPublished = filterRecipes(ownPublished.value, q)
  const externalFallbackLimit = Math.max(0, 100 - matchingPublished.length)
  const externalSlice = externalFallbackLimit > 0
    ? filterRecipes(allExternal.value, q).slice(0, Math.min(EXTERNAL_CHUNK, externalFallbackLimit))
    : []
  recipes.value = sortRecipes([
    ...matchingPublished.map(r => toDisplayRecipe(r, 'dishly')),
    ...externalSlice.map(r => toDisplayRecipe(r, 'external')),
  ])
}

// Visible for tests. Defensive: window.matchMedia is absent in some test/legacy
// environments, so treat that as "no preference" rather than throwing.
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Scrolls to the start of the results list/card instead of jumping to the top of
// the whole page, and respects prefers-reduced-motion instead of always animating.
// scrollIntoView is guarded because it's not implemented in some environments (e.g. jsdom).
function scrollToListStart() {
  const el = listWrapRef.value
  if (!el || typeof el.scrollIntoView !== 'function') return
  el.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'start',
  })
}

function goToPage(page: number) {
  currentPage.value = page
  updateSnapshotPage(page)
  scrollToListStart()
}

const loadRecipes = async () => {
  // Set flag BEFORE the awaits so the filter watcher (triggered by applyProfilePersonalization
  // inside loadPersonalization) sees it and skips clearSnapshot(). The watcher fires as a
  // microtask between our two awaits — isInitializingProfile must be true at that point.
  isInitializingProfile = true
  loading.value = true
  try {
    await loadPersonalization()
    ownPublished.value = await recipeApi.getPublishedRecipes(currentLanguage.value)

    // After both awaits complete, the watcher microtasks have already run (and were skipped).
    // Now it is safe to clear the flag and allow normal watcher behaviour.
    isInitializingProfile = false

    // Belt-and-suspenders: cancel any debounce that somehow slipped through.
    if (!search.value.trim() && searchTimeout) {
      clearTimeout(searchTimeout)
      searchTimeout = null
    }

    allExternal.value = []
    error.value = null

    // buildContextKey() called here — AFTER loadPersonalization() — so profile-derived refs
    // (likes, dislikes, allergies) are set and the key matches what was saved previously.
    const snap = loadSnapshot()
    if (snap) {
      baseRecipes.value = snap.baseRecipes
      updateDisplayFromBase()
      currentPage.value = snap.page
      searchNotice.value = null
    } else {
      buildBaseList()
      updateDisplayFromBase()
      saveSnapshot(baseRecipes.value, 1)
      searchNotice.value = ownPublished.value.length < 100
        ? t('home.notices.localRecipesLoaded', { count: ownPublished.value.length })
        : null
    }
  } catch (e: any) {
    error.value = e.message ?? t('home.errors.initialLoad')
  } finally {
    isInitializingProfile = false
    loading.value = false
  }
}

// For a recognized category alias (e.g. "Pasta"), queries the backend once per real
// match term ("pasta", "nudeln", "spaghetti", ...) in parallel and merges+dedupes the
// results. This finds every matching recipe via the backend's own substring search
// instead of fetching one broadened/random sample that could miss items. For a normal
// (non-category) query, behavior is unchanged: a single literal-query fetch.
async function fetchPublishedForQuery(query: string): Promise<Recipe[]> {
  const categoryTerms = categorySearchTerms(query)
  if (categoryTerms.length === 0) {
    return recipeApi.getPublishedRecipes(currentLanguage.value, query || undefined)
  }
  const resultSets = await Promise.all(
    categoryTerms.map(term => recipeApi.getPublishedRecipes(currentLanguage.value, term)),
  )
  const merged = new Map<string, Recipe>()
  for (const set of resultSets) {
    for (const r of set) {
      merged.set(`${r.source ?? 'dishly'}-${r.id}`, r)
    }
  }
  return [...merged.values()]
}

const loadExternalRecipes = async (query: string) => {
  const requestId = ++externalRequestCounter
  const normalizedQuery = query.toLowerCase().trim()

  try {
    ownPublished.value = await fetchPublishedForQuery(normalizedQuery)
  } catch (e: any) {
    error.value = e.message ?? t('home.errors.initialLoad')
    return
  }

  if (requestId !== externalRequestCounter) return

  if (!normalizedQuery) {
    // Search cleared: restore stable filtered view without re-shuffling the base list.
    allExternal.value = []
    updateDisplayFromBase()
    error.value = null
    searchNotice.value = null
    return
  }

  const localSource = ownPublished.value.filter(recipe => !recipe.userCreated)
  const localMatches = filterRecipes(localSource, normalizedQuery)

  if (!englishRecipesAllowed.value) {
    allExternal.value = []
    buildSearchView()
    error.value = null
    searchNotice.value = null
    return
  }

  if (localMatches.length >= 20 || !isSpecificSearch(normalizedQuery)) {
    allExternal.value = []
    buildSearchView()
    error.value = null
    searchNotice.value = null
    return
  }

  try {
    const external = await fetchExternalRecipes(query)
    if (requestId !== externalRequestCounter) return
    allExternal.value = external
    buildSearchView()
    error.value = null
    searchNotice.value = null
  } catch {
    if (requestId !== externalRequestCounter) return
    allExternal.value = []
    buildSearchView()
    error.value = t('home.errors.externalSearch')
    searchNotice.value = null
  }
}

const openDetails = (recipe: DisplayRecipe) => {
  if (recipe.source === 'external') {
    router.push(`/recipe/external/${recipe.externalId ?? recipe.id}`)
    return
  }
  router.push(`/recipe/${recipe.id}`)
}

async function openMealPlanModal(recipe: DisplayRecipe) {
  mealPlanError.value = null
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    mealPlanError.value = t('recipeDetail.errors.loginRequiredMealPlan')
    return
  }

  mealPlanTarget.value = recipe
  mealPlanModalOpen.value = true
  mealPlanLoading.value = true
  try {
    const weekStart = weekDays.value[0]?.date
    const week = await mealPlanApi.getWeek(weekStart)
    plannedEntries.value = week.entries
  } catch (e: unknown) {
    plannedEntries.value = []
    mealPlanError.value = e instanceof ApiClientError && e.message
      ? e.message
      : t('mealPlan.errors.load')
  } finally {
    mealPlanLoading.value = false
  }
}

async function addToMealPlan(date: string, slot: MealSlot) {
  if (!mealPlanTarget.value) return
  mealPlanLoading.value = true
  mealPlanError.value = null
  const payload = mealPlanPayload(mealPlanTarget.value)

  try {
    const savedEntry = await mealPlanApi.setSlot(date, slot, payload)
    plannedEntries.value = plannedEntries.value
      .filter(entry => !(entry.plannedDate === date && normalizedSlot(entry) === slot))
      .concat(savedEntry)
    toastStore.addToast(t('notifications.mealPlanAdded'), 'success')
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

function mealPlanPayload(recipe: DisplayRecipe): number | MealPlanEntryRequest {
  const id = Number(recipe.id)
  if (recipe.source === 'dishly' && Number.isFinite(id) && id > 0) {
    return id
  }
  return {
    customTitle: recipe.title,
    caloriesSnapshot: recipe.calories ?? null,
    proteinSnapshot: recipe.protein ?? null,
    imageUrlSnapshot: recipe.imageUrl ?? null,
    externalRecipeId: String(recipe.externalId ?? recipe.id),
    externalSource: recipe.sourceName ?? 'spoonacular',
  }
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
  if (entry.mealSlot === 'breakfast' || entry.mealSlot === 'lunch' || entry.mealSlot === 'snack') {
    return entry.mealSlot
  }
  return 'dinner'
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

const shuffleRecipes = async () => {
  clearSnapshot()
  currentPage.value = 1
  loading.value = true
  error.value = null
  try {
    ownPublished.value = await recipeApi.getPublishedRecipes(currentLanguage.value)
    allExternal.value = []
    buildBaseList()
    updateDisplayFromBase()
    saveSnapshot(baseRecipes.value, 1)
    toastStore.addToast(t('notifications.shuffled'), 'info')
  } catch (e: any) {
    error.value = e.message ?? t('home.errors.initialLoad')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadRecipes()
})

watch([search, vegan, vegetarian, glutenFree, lactoseFree, calorieConscious, highProtein, maxPrepTime, maxCalories, mealType, sortOrder, profilePersonalizationEnabled], () => {
  // Skip during initial profile loading — ref changes from applyProfilePersonalization are not
  // user actions and must not discard the snapshot or trigger re-shuffles.
  if (isInitializingProfile) return

  currentPage.value = 1

  if (searchTimeout) {
    clearTimeout(searchTimeout)
    searchTimeout = null
  }

  const query = search.value.trim()

  if (!query || query.length < 2) {
    // No search or single char: apply filters to stable base — no API call, no shuffle.
    updateDisplayFromBase()
    // Re-save snapshot so F5 after a filter change restores the updated view.
    if (baseRecipes.value.length > 0) {
      saveSnapshot(baseRecipes.value, 1)
    }
    return
  }

  // Active search (2+ chars): fetch from API, results are transient.
  clearSnapshot()
  searchTimeout = setTimeout(() => {
    loadExternalRecipes(query)
  }, SEARCH_DEBOUNCE_MS)
})

watch(calorieConscious, enabled => {
  if (enabled) {
    sortOrder.value = 'caloriesAsc'
    calorieSortWasAutomatic = true
    return
  }

  if (calorieSortWasAutomatic && sortOrder.value === 'caloriesAsc') {
    sortOrder.value = ''
  }
  calorieSortWasAutomatic = false
})

watch(locale, () => {
  clearSnapshot()
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  loadRecipes()
})

watch(() => authStore.isAuthenticated, (authenticated) => {
  if (!authenticated) {
    loadedPreferences.value = null
    likes.value = []
    dislikes.value = []
    allergies.value = []
    pantryIngredients.value = []
    externalFavoriteIds.value = new Set()
    clearSoftProfilePersonalization()
    // Search text and the two remaining soft filters aren't covered by
    // clearSoftProfilePersonalization() — clear them too so a stale search
    // never survives logout, even if the component itself stays mounted.
    search.value = ''
    mealType.value = ''
    sortOrder.value = ''
    profilePersonalizationEnabled.value = true
    clearSnapshot()
    currentPage.value = 1
  }
})

async function loadPersonalization() {
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    return
  }

  const [profileResult, pantryResult] = await Promise.allSettled([
    profileApi.getPreferences(),
    pantryApi.getPantryItems(),
  ])

  if (profileResult.status === 'fulfilled') {
    const preferences = profileResult.value
    loadedPreferences.value = preferences
    likes.value = preferences.likes?.map(value => value.toLowerCase()) ?? []
    dislikes.value = preferences.dislikes?.map(value => value.toLowerCase()) ?? []
    allergies.value = preferences.allergies?.map(value => value.toLowerCase()) ?? []
    applyProfilePersonalization()
  }

  if (pantryResult.status === 'fulfilled') {
    pantryIngredients.value = pantryResult.value
      .map(item => item.name.toLowerCase())
      .filter(Boolean)
  }

  try {
    const favorites = await favoriteApi.getExternalFavorites()
    externalFavoriteIds.value = new Set(favorites.map(favorite => favoriteKey(
      favorite.externalSource ?? 'SPOONACULAR',
      favorite.externalRecipeId,
    )))
  } catch {
    externalFavoriteIds.value = new Set()
  }
}

function currentFilters(): RecipeSearchFilters {
  return {
    vegan: vegan.value,
    vegetarian: vegetarian.value,
    glutenFree: glutenFree.value,
    lactoseFree: lactoseFree.value,
    calorieConscious: calorieConscious.value,
    highProtein: highProtein.value,
    maxPrepTime: maxPrepTime.value,
    maxCalories: maxCalories.value,
    mealType: mealType.value,
  }
}

function onVeganChanged() {
  if (vegan.value) {
    vegetarian.value = false
  }
}

function onVegetarianChanged() {
  if (vegetarian.value) {
    vegan.value = false
  }
}

function onSortChanged() {
  calorieSortWasAutomatic = false
}

function toggleProfilePersonalization() {
  profilePersonalizationEnabled.value = !profilePersonalizationEnabled.value
  applyProfilePersonalization()
  // Rebuild base so recommendation reasons and preference boost reflect the new state.
  buildBaseList()
  updateDisplayFromBase()
  saveSnapshot(baseRecipes.value, currentPage.value)
}

function applyProfilePersonalization() {
  const preferences = loadedPreferences.value
  if (!preferences || !profilePersonalizationEnabled.value) {
    clearSoftProfilePersonalization()
    return
  }

  vegan.value = preferences.vegan
  vegetarian.value = !preferences.vegan && preferences.vegetarian
  glutenFree.value = preferences.glutenFree
  lactoseFree.value = preferences.lactoseFree
  calorieConscious.value = preferences.calorieConscious
  highProtein.value = preferences.highProtein
  maxPrepTime.value = preferences.maxPrepTimeMinutes ?? null
  // maxCalories is intentionally NOT set from the daily calorie target — the home page
  // filter applies per dish, not per day. The user sets it manually if needed.
}

function clearSoftProfilePersonalization() {
  vegan.value = false
  vegetarian.value = false
  glutenFree.value = false
  lactoseFree.value = false
  calorieConscious.value = false
  highProtein.value = false
  maxPrepTime.value = null
  maxCalories.value = null
}

function activeFilters(query = search.value): RecipeSearchFilters | undefined {
  if (query.trim()) {
    return undefined
  }
  const filters = currentFilters()
  const hasActiveFilter = Object.entries(filters).some(([, value]) => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value > 0
    return Boolean(value)
  })
  return hasActiveFilter ? filters : undefined
}

function fetchExternalRecipes(query = search.value) {
  if (!englishRecipesAllowed.value) {
    return Promise.resolve([])
  }
  const externalQuery = buildExternalQuery(query)
  const filters = activeFilters(query)
  if (!externalQuery && !filters) {
    return recipeApi.getExternalRecipes(undefined, undefined, currentLanguage.value)
  }
  if (externalQuery && !filters) {
    return recipeApi.getExternalRecipes(externalQuery, undefined, currentLanguage.value)
  }
  if (!externalQuery && filters) {
    return recipeApi.getExternalRecipes(undefined, filters, currentLanguage.value)
  }
  return recipeApi.getExternalRecipes(externalQuery, filters, currentLanguage.value)
}

function buildExternalQuery(query = search.value) {
  const parts = [query.trim()].filter(Boolean)
  if (!query.trim() && profilePersonalizationEnabled.value && highProtein.value) parts.push('high protein')
  if (!query.trim() && profilePersonalizationEnabled.value && calorieConscious.value) parts.push('low calorie')
  return parts.join(' ').trim() || undefined
}

function isSpecificSearch(query: string) {
  return query.trim().length >= 2
}

function matchesText(recipe: Recipe, query: string) {
  if (!query) return true
  const haystack = `${recipe.title} ${recipe.ingredients} ${recipe.category}`.toLowerCase()
  return matchesCategoryAwareText(haystack, query)
}

function matchesLocalFilters(recipe: Recipe) {
  const text = `${recipe.title} ${recipe.ingredients} ${recipe.category} ${recipe.dishTypes ?? ''} ${recipe.diets ?? ''}`.toLowerCase()
  const totalTime = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0)
  if (maxPrepTime.value && totalTime > maxPrepTime.value) return false
  if (maxCalories.value && recipe.calories && recipe.calories > maxCalories.value) return false
  if (calorieConscious.value && recipe.calories && recipe.calories > 650) return false
  if (mealType.value && !text.includes(mealType.value.toLowerCase())) return false
  if (vegan.value && !recipe.vegan && !text.includes('vegan')) return false
  if (vegetarian.value && !recipe.vegetarian && !text.includes('vegetarian') && !text.includes('vegetarisch')) return false
  if (glutenFree.value && !recipe.glutenFree && !text.includes('gluten free') && !text.includes('glutenfrei')) return false
  if (lactoseFree.value && !recipe.dairyFree && !text.includes('dairy free') && !text.includes('lactose free') && !text.includes('laktosefrei') && !text.includes('milchfrei')) return false
  return true
}

function matchesHardPreferences(recipe: Recipe) {
  const text = `${recipe.title} ${recipe.ingredients} ${recipe.category}`.toLowerCase()
  return ![...dislikes.value, ...allergies.value]
    .filter(Boolean)
    .some(term => {
      const terms = getMatchTerms(term, [...ALLERGEN_ENTRIES, ...DISLIKES_ENTRIES])
      return terms.some(t => text.includes(t))
    })
}

function matchesLikes(recipe: DisplayRecipe) {
  if (!profilePersonalizationEnabled.value || likes.value.length === 0) {
    return false
  }
  const text = `${recipe.title} ${recipe.ingredients} ${recipe.category}`.toLowerCase()
  return likes.value.some(term => {
    if (!term) return false
    const terms = getMatchTerms(term, LIKES_ENTRIES)
    return terms.some(t => text.includes(t))
  })
}

function applyPreferenceBoost(items: DisplayRecipe[]) {
  if (!profilePersonalizationEnabled.value) {
    return shuffleDisplayRecipes(items)
  }
  if (likes.value.length === 0 || items.length < 4) {
    return items
  }
  const preferred = shuffleDisplayRecipes(items.filter(matchesLikes))
  const mixed = shuffleDisplayRecipes(items.filter(recipe => !matchesLikes(recipe)))
  const preferredLimit = Math.min(preferred.length, Math.floor(items.length * 0.5))
  const mixedLimit = Math.min(mixed.length, items.length - preferredLimit)
  const balanced = [
    ...preferred.slice(0, preferredLimit),
    ...mixed.slice(0, mixedLimit),
  ]
  const selected = new Set(balanced.map(recipe => `${recipe.source}-${recipe.id}`))
  const remaining = [...mixed.slice(mixedLimit), ...preferred.slice(preferredLimit)]
    .filter(recipe => !selected.has(`${recipe.source}-${recipe.id}`))

  return shuffleDisplayRecipes([...balanced, ...remaining].slice(0, items.length))
}

function getRecipeCalories(recipe: Recipe): number | null {
  const v = recipe.calories
  return typeof v === 'number' && v > 0 ? v : null
}

function getRecipeProtein(recipe: Recipe): number | null {
  const v = recipe.protein
  return typeof v === 'number' && v > 0 ? v : null
}

function getProteinDensity(recipe: Recipe): number | null {
  const protein = getRecipeProtein(recipe)
  const calories = getRecipeCalories(recipe)
  if (protein === null || calories === null) return null
  return protein / calories
}

function sortRecipes(items: DisplayRecipe[]) {
  const sorted = [...items]

  // Both active: sort by protein density (protein g / kcal) descending — highest density first
  if (calorieConscious.value && highProtein.value) {
    return sorted.sort((a, b) => compareOptionalNumbers(getProteinDensity(a), getProteinDensity(b), 'desc'))
  }

  if (sortOrder.value === 'caloriesAsc') {
    return sorted.sort((a, b) => compareOptionalNumbers(a.calories, b.calories, 'asc'))
  }
  if (sortOrder.value === 'caloriesDesc') {
    return sorted.sort((a, b) => compareOptionalNumbers(a.calories, b.calories, 'desc'))
  }
  if (sortOrder.value === 'proteinAsc') {
    return sorted.sort((a, b) => compareOptionalNumbers(a.protein, b.protein, 'asc'))
  }
  if (sortOrder.value === 'proteinDesc') {
    return sorted.sort((a, b) => compareOptionalNumbers(a.protein, b.protein, 'desc'))
  }
  if (sortOrder.value === 'timeAsc') {
    return sorted.sort((a, b) => compareOptionalNumbers(totalRecipeTime(a), totalRecipeTime(b), 'asc'))
  }
  if (sortOrder.value === 'timeDesc') {
    return sorted.sort((a, b) => compareOptionalNumbers(totalRecipeTime(a), totalRecipeTime(b), 'desc'))
  }
  if (highProtein.value) {
    return sorted.sort((a, b) => compareOptionalNumbers(a.protein, b.protein, 'desc'))
  }
  return sorted
}

function totalRecipeTime(recipe: Recipe) {
  const prepTime = recipe.prepTimeMinutes ?? 0
  const cookTime = recipe.cookTimeMinutes ?? 0
  const total = prepTime + cookTime
  return total > 0 ? total : null
}

function compareOptionalNumbers(
  a: number | null | undefined,
  b: number | null | undefined,
  direction: 'asc' | 'desc',
) {
  const hasA = typeof a === 'number'
  const hasB = typeof b === 'number'
  if (!hasA && !hasB) return 0
  if (!hasA) return 1
  if (!hasB) return -1
  return direction === 'asc' ? a - b : b - a
}

function recommendationReasons(recipe: Recipe, source: RecipeSource): RecommendationBadge[] {
  const profile = profilePersonalizationEnabled.value ? loadedPreferences.value : null
  return getRecommendationBadges(
    recipe,
    profile,
    pantryIngredients.value,
    {
      matchTermsFn: (term: string) => getMatchTerms(term, LIKES_ENTRIES),
      isExternal: source === 'external',
    },
  )
}

function favoriteId(recipe: DisplayRecipe) {
  return String(recipe.externalId ?? recipe.id)
}

function favoriteSource(recipe: DisplayRecipe) {
  return recipe.source === 'external' ? 'SPOONACULAR' : 'DISHLY'
}

function favoriteKey(source: string, id: number | string) {
  return `${source.toUpperCase()}:${String(id)}`
}

function isRecipeFavorite(recipe: DisplayRecipe) {
  return externalFavoriteIds.value.has(favoriteKey(favoriteSource(recipe), favoriteId(recipe)))
}

function hasAlcohol(recipe: Recipe) {
  return (recipe.alcohol ?? 0) > 0 || (recipe.alcoholPercent ?? 0) > 0
}

function visibleCategory(recipe: Recipe) {
  const category = recipe.category?.trim()
  if (!category || category.toLowerCase() === 'side dish') {
    return ''
  }
  return displayCategory(category, currentLanguage.value)
}

async function toggleRecipeFavorite(recipe: DisplayRecipe) {
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    error.value = 'Bitte melde dich an, um Rezepte zu favorisieren.'
    return
  }

  const id = favoriteId(recipe)
  const source = favoriteSource(recipe)
  const key = favoriteKey(source, id)
  try {
    if (externalFavoriteIds.value.has(key)) {
      await favoriteApi.removeExternalFavorite(source, id)
      const next = new Set(externalFavoriteIds.value)
      next.delete(key)
      externalFavoriteIds.value = next
      toastStore.addToast(t('notifications.favoriteRemoved'), 'info')
      return
    }

    await favoriteApi.addExternalFavorite({
      externalRecipeId: id,
      externalTitle: recipe.title,
      externalImageUrl: recipe.imageUrl,
      externalSource: source,
    })
    externalFavoriteIds.value = new Set([...externalFavoriteIds.value, key])
    toastStore.addToast(t('notifications.favoriteAdded'), 'success')
  } catch (e: unknown) {
    error.value = e instanceof ApiClientError && e.message
      ? e.message
      : t('home.errors.prefix')
  }
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
  <section class="home-wrap">
    <section class="hero">
      <p class="hero-desc">
        {{ t('home.description') }}
      </p>
      <input
        v-model="search"
        class="search-input"
        type="search"
        :placeholder="t('home.searchPlaceholder')"
        :aria-label="t('home.searchAria')"
      />
      <div class="filter-panel" :aria-label="t('home.filters.ariaLabel')">
        <label><input v-model="vegan" type="checkbox" @change="onVeganChanged" /> {{ t('home.filters.vegan') }}</label>
        <label><input v-model="vegetarian" type="checkbox" @change="onVegetarianChanged" /> {{ t('home.filters.vegetarian') }}</label>
        <label><input v-model="glutenFree" type="checkbox" /> {{ t('home.filters.glutenFree') }}</label>
        <label><input v-model="lactoseFree" type="checkbox" /> {{ t('home.filters.lactoseFree') }}</label>
        <label><input v-model="calorieConscious" type="checkbox" /> {{ t('home.filters.calorieConscious') }}</label>
        <label><input v-model="highProtein" type="checkbox" /> {{ t('home.filters.highProtein') }}</label>
        <button
          v-if="isLoggedIn"
          type="button"
          class="plain-filter-button"
          :aria-pressed="!profilePersonalizationEnabled"
          @click="toggleProfilePersonalization"
        >
          {{ personalizationButtonText }}
        </button>
        <label>
          {{ t('home.filters.maxPrepTime') }}
          <input v-model.number="maxPrepTime" class="small-input" min="1" type="number" />
        </label>
        <label>
          {{ t('home.filters.maxCalories') }}
          <input v-model.number="maxCalories" class="small-input" min="1" type="number" />
        </label>
        <label>
          {{ t('home.filters.mealType') }}
          <select v-model="mealType" class="small-input">
            <option value="">{{ t('home.filters.anyMealType') }}</option>
            <option value="breakfast">{{ t('home.filters.breakfast') }}</option>
            <option value="lunch">{{ t('home.filters.lunch') }}</option>
            <option value="dinner">{{ t('home.filters.dinner') }}</option>
            <option value="snack">{{ t('home.filters.snack') }}</option>
          </select>
        </label>
        <label>
          {{ t('home.sort.label') }}
          <select v-model="sortOrder" class="small-input" @change="onSortChanged">
            <option value="">{{ t('home.sort.default') }}</option>
            <option value="caloriesAsc">{{ t('home.sort.caloriesAsc') }}</option>
            <option value="caloriesDesc">{{ t('home.sort.caloriesDesc') }}</option>
            <option value="proteinAsc">{{ t('home.sort.proteinAsc') }}</option>
            <option value="proteinDesc">{{ t('home.sort.proteinDesc') }}</option>
            <option value="timeAsc">{{ t('home.sort.timeAsc') }}</option>
            <option value="timeDesc">{{ t('home.sort.timeDesc') }}</option>
          </select>
        </label>
      </div>
      <p v-if="isLoggedIn" class="personalization-status">
        {{ personalizationStatusText }}
      </p>
      <p v-if="isLoggedIn && personalizationActive" class="personalization-note">
        {{ t('home.personalization.note') }}
      </p>
    </section>

    <div class="shuffle-wrap">
      <button class="shuffle-btn" type="button" @click="shuffleRecipes">
        <span class="shuffle-icon">↻</span>
        <span>{{ t('home.shuffle') }}</span>
      </button>
    </div>

    <section class="list-wrap" ref="listWrapRef">
      <p v-if="loading" class="status-text">{{ t('home.loading') }}</p>
      <p v-else-if="error && filtered.length === 0" class="status-text error">
        {{ t('home.errors.prefix') }} {{ error }}
      </p>

      <div v-else class="recipe-grid">
        <p v-if="error" class="status-text error">
          {{ t('home.errors.prefix') }} {{ error }}
        </p>

        <p v-if="mealPlanError && !mealPlanModalOpen" class="status-text error">
          {{ mealPlanError }}
        </p>

        <article
          v-for="r in paginatedRecipes"
          :key="`${r.source}-${r.id}`"
          class="recipe-card"
          @click="openDetails(r)"
        >
          <div v-if="r.imageUrl" class="image-wrap">
            <img :src="r.imageUrl" :alt="r.title" />
          </div>

          <div class="card-content">
            <h3 class="card-title">{{ r.title }}</h3>
            <span
              v-if="r.userCreated"
              class="user-created-icon"
              :title="t('home.card.userCreated')"
              :aria-label="t('home.card.userCreated')"
            >👤</span>
            <button
              type="button"
              class="favorite-button"
              :aria-pressed="isRecipeFavorite(r)"
              @click.stop="toggleRecipeFavorite(r)"
            >
              {{ isRecipeFavorite(r) ? `♥ ${t('home.card.favorite')}` : `♡ ${t('home.card.favorite')}` }}
            </button>
            <p class="card-meta">
              <span v-if="visibleCategory(r)" class="pill pill-mint">{{ visibleCategory(r) }}</span>
              <span v-if="r.difficulty" class="pill pill-soft">{{ r.difficulty }}</span>
              <span v-if="hasAlcohol(r)" class="pill pill-warning">{{ t('home.card.alcohol') }}</span>
              <span v-if="r.rating" class="pill pill-rating">
                {{ t('home.meta.rating', { rating: r.rating.toFixed(1) }) }}
              </span>
            </p>

            <p class="card-times">
              <span v-if="r.calories">{{ r.calories }} kcal</span>
              <span v-if="r.protein"> · {{ t('home.meta.protein', { protein: Math.round(r.protein) }) }}</span>
              <span v-if="r.prepTimeMinutes || r.cookTimeMinutes">
                · {{ t('home.meta.minutes', { minutes: r.prepTimeMinutes + r.cookTimeMinutes }) }}
              </span>
            </p>

            <button type="button" class="meal-plan-card-button" @click.stop="openMealPlanModal(r)">
              {{ t('recipeDetail.actions.addToMealPlan') }}
            </button>

            <div v-if="r.recommendationReasons.length" class="reason-badges">
              <span
                v-for="badge in r.recommendationReasons"
                :key="badge.key"
                class="reason-badge"
                :class="`reason-badge--${badge.type}`"
              >{{ t(badge.labelKey, badge.labelParams ?? {}) }}</span>
            </div>
          </div>
        </article>

        <p v-if="!loading && filtered.length === 0" class="status-text">
          {{ search.trim() ? t('home.emptySearch') : t('home.empty') }}
        </p>
      </div>

      <nav v-if="totalPages > 1" class="pagination" :aria-label="t('home.pagination.label')">
        <button
          type="button"
          class="pagination-btn"
          :disabled="currentPage === 1"
          @click="goToPage(currentPage - 1)"
        >
          {{ t('home.pagination.previous') }}
        </button>
        <button
          v-for="page in pageNumbers"
          :key="page"
          type="button"
          class="pagination-btn"
          :class="{ 'pagination-btn--active': page === currentPage }"
          :aria-current="page === currentPage ? 'page' : undefined"
          @click="goToPage(page)"
        >
          {{ page }}
        </button>
        <button
          type="button"
          class="pagination-btn"
          :disabled="currentPage === totalPages"
          @click="goToPage(currentPage + 1)"
        >
          {{ t('home.pagination.next') }}
        </button>
      </nav>
    </section>

    <div v-if="mealPlanModalOpen" class="modal-backdrop" @click.self="mealPlanModalOpen = false">
      <section class="meal-plan-modal" :aria-label="t('recipeDetail.mealPlan.title')">
        <h2>{{ t('recipeDetail.mealPlan.title') }}</h2>
        <p v-if="mealPlanTarget">
          {{ t('home.mealPlan.chooseSlot') }} <strong>{{ mealPlanTarget.title }}</strong>
        </p>
        <p v-if="mealPlanLoading" class="status-text">{{ t('mealPlan.loading') }}</p>
        <p v-if="mealPlanError" class="status-text error">{{ mealPlanError }}</p>

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
.home-wrap {
  width: 100%;
  box-sizing: border-box;
  max-width: min(1100px, 100%);
  margin: 0 auto;
  padding: 0 20px;
}

.hero {
  background: #fff7fb;
  border-radius: 22px;
  box-shadow: 0 2px 21px 0 rgba(191, 140, 167, 0.12);
  padding: 40px 28px 26px 28px;
  text-align: center;
  margin: 30px 0 20px 0;
  width: 100%;
  border: 1px solid #f6d9ea;
  box-sizing: border-box;
}

.hero-desc {
  color: #486b68;
  margin-bottom: 19px;
  font-size: 1.05rem;
}

.search-input {
  background: #ffffff;
  border: 2px solid #8fd5cc;
  border-radius: 13px;
  padding: 15px 19px;
  font-size: 1.1rem;
  width: 90%;
  max-width: 560px;
  outline: none;
  margin: 0 auto;
}

.search-input:focus {
  border: 2px solid #26b6b8;
}

.filter-panel {
  margin: 18px auto 0;
  max-width: 860px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

.filter-panel label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #ffffff;
  border: 1px solid #c3e7e1;
  border-radius: 999px;
  padding: 7px 11px;
  color: #486b68;
  font-size: 0.9rem;
}

.plain-filter-button {
  border: 1px solid #c3e7e1;
  border-radius: 999px;
  background: #ffffff;
  color: #486b68;
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  padding: 7px 11px;
}

.personalization-note {
  color: #2f6f62;
  font-size: 0.92rem;
  font-weight: 700;
  margin: 12px 0 0;
}

.personalization-status {
  color: #486b68;
  font-size: 0.9rem;
  margin: 10px 0 0;
}

.filter-panel .context-filter {
  border-radius: 12px;
}

.small-input {
  max-width: 150px;
  border: 1px solid #8fd5cc;
  border-radius: 8px;
  padding: 5px 8px;
  font: inherit;
}

.shuffle-wrap {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto 10px auto;
  display: flex;
  justify-content: flex-end;
}

.shuffle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: #ffffff;
  border-radius: 999px;
  border: 1.5px solid #26b6b8;
  color: #26b6b8;
  padding: 7px 16px;
  font-size: 0.94rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 1px 7px rgba(79, 127, 120, 0.18);
  min-height: 44px;
}

.shuffle-btn:hover {
  background: #e0f5f2;
}

.shuffle-icon {
  font-size: 1.05rem;
}

.list-wrap {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto 40px auto;
}

.status-text {
  text-align: center;
  color: #486b68;
  margin-top: 20px;
}

.status-text.error {
  color: #a14c2b;
  font-weight: 600;
}

.status-text.success {
  color: #1d8e90;
  font-weight: 700;
}

.recipe-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
  gap: 22px;
  margin-top: 28px;
}

.recipe-card {
  background: #f4fbfa;
  border-radius: 18px;
  box-shadow: 0 1px 7px 0 rgba(79, 127, 120, 0.12);
  border: 1px solid #c3e7e1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease,
    border-color 0.15s ease;
  cursor: pointer;
  min-width: 0;
}

.recipe-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 18px 0 rgba(79, 127, 120, 0.2);
  background: #eefaf8;
  border-color: #8fd5cc;
}

.image-wrap {
  width: 100%;
  height: 170px;
  overflow: hidden;
}

.image-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.card-content {
  padding: 14px 18px 16px 18px;
}

.card-title {
  font-size: 1.2rem;
  font-weight: 800;
  color: #2b1b23;
  margin-bottom: 8px;
  overflow-wrap: anywhere;
}

.favorite-button {
  border: 1px solid #f6d9ea;
  border-radius: 999px;
  background: #ffffff;
  color: #b96593;
  cursor: pointer;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 800;
  margin-bottom: 8px;
  min-height: 44px;
  padding: 6px 10px;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}

.pill {
  font-size: 0.8rem;
  padding: 4px 9px;
  border-radius: 999px;
}

.pill-mint {
  background: #e0f5f2;
  color: #26b6b8;
}

.pill-soft {
  background: #fbe5f0;
  color: #cc7da9;
}

.pill-rating {
  background: #fff5c7;
  color: #b38700;
}

.pill-warning {
  background: #fff0eb;
  color: #a14c2b;
}

.user-created-icon {
  display: inline-flex;
  margin-bottom: 8px;
}

.card-times {
  font-size: 0.92rem;
  color: #486b68;
  margin-bottom: 6px;
  overflow-wrap: anywhere;
}

.meal-plan-card-button {
  border: 1px solid #8fd5cc;
  border-radius: 999px;
  background: #ffffff;
  color: #1d8e90;
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 800;
  margin-top: 12px;
  min-height: 44px;
  padding: 8px 12px;
  width: fit-content;
}

.meal-plan-card-button:hover {
  background: #e0f5f2;
}

.reason-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
}

.reason-badge {
  display: inline-flex;
  align-items: center;
  background: #e3f6f1;
  color: #2f8f7b;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.reason-badge--pantry  { background: #fce8f3; color: #cc7da9; }
.reason-badge--likes   { background: #fff3e6; color: #c4742e; }
.reason-badge--diet    { background: #e3f6f1; color: #2f8f7b; }
.reason-badge--calorie { background: #f0f8ff; color: #2a6fa8; }
.reason-badge--time    { background: #cef3f4; color: #0e8b8d; }

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
  width: min(720px, 100%);
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

.pagination {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin: 28px 0 12px;
}

.pagination-btn {
  border: 1.5px solid #8fd5cc;
  border-radius: 999px;
  background: #ffffff;
  color: #1d8e90;
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  min-width: 36px;
  min-height: 36px;
  padding: 4px 12px;
}

.pagination-btn:hover:not(:disabled) {
  background: #e0f5f2;
}

.pagination-btn--active {
  background: #26b6b8;
  border-color: #26b6b8;
  color: #ffffff;
  font-weight: 800;
}

.pagination-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

@media (max-width: 640px) {
  .home-wrap {
    padding: 0 12px;
  }

  .hero {
    border-radius: 16px;
    margin: 16px 0;
    padding: 24px 14px 18px;
  }

  .hero h1 {
    font-size: 1.65rem;
    line-height: 1.2;
  }

  .hero-desc {
    font-size: 0.98rem;
  }

  .search-input {
    font-size: 1rem;
    width: 100%;
  }

  .filter-panel {
    align-items: stretch;
    justify-content: stretch;
  }

  .filter-panel label,
  .plain-filter-button {
    border-radius: 14px;
    justify-content: space-between;
    min-height: 44px;
    width: 100%;
  }

  .small-input {
    max-width: none;
    width: 100%;
  }

  .shuffle-wrap {
    justify-content: stretch;
  }

  .shuffle-btn {
    width: 100%;
  }

  .recipe-grid {
    gap: 14px;
    grid-template-columns: 1fr;
    margin-top: 18px;
  }

  .image-wrap {
    height: clamp(150px, 48vw, 210px);
  }

  .card-content {
    padding: 14px;
  }

  .card-title {
    font-size: 1.08rem;
  }

  .favorite-button,
  .meal-plan-card-button {
    justify-content: center;
    width: 100%;
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
