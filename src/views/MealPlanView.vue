<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ApiClientError } from '@/shared/api/apiClient'
import { useToastStore } from '@/stores/toastStore'
import { mealPlanApi } from '@/shared/api/mealPlanApi'
import { recipeApi } from '@/shared/api/recipeApi'
import { profileApi } from '@/shared/api/profileApi'
import { displayCategory } from '@/shared/recipeDisplay'
import { categorySearchTerms, matchesCategoryAwareText } from '@/shared/ingredientCategories'
import { printMealPlan } from '@/shared/printExport'
import type {
  MealPlanEntryResponse,
  MealPlanShoppingListResponse,
  MealPlanWeekResponse,
  MealSlot,
} from '@/types/mealPlan'
import type { RecipeResponse, RecipeSearchFilters } from '@/types/recipe'
import type { UserPreferencesResponse } from '@/types/profile'

type WeekDay = {
  key: string
  labelKey: string
  date: string
}

type SlotSuggestion = {
  id: number | string
  title: string
  source: 'dishly' | 'external'
  planAsRecipe?: boolean
  calories?: number | null
  protein?: number | null
  imageUrl?: string | null
  externalRecipeId?: string | null
  externalSource?: string | null
}

const { t, locale } = useI18n()
const toastStore = useToastStore()
const BUCKET_LIMIT = 7

const loading = ref(true)
const error = ref<string | null>(null)
const actionError = ref<string | null>(null)
const week = ref<MealPlanWeekResponse | null>(null)
const recipes = ref<RecipeResponse[]>([])
const planningMode = ref<'manual' | 'swipe'>('manual')
const selectedRecipeBySlot = ref<Record<string, string>>({})
const customTitleBySlot = ref<Record<string, string>>({})
const customSnapshotBySlot = ref<Record<string, Partial<MealPlanEntryResponse>>>({})
const customCaloriesBySlot = ref<Record<string, number | null>>({})
const suggestionsBySlot = ref<Record<string, SlotSuggestion[]>>({})
const suggestionLoadingBySlot = ref<Record<string, boolean>>({})
const suggestionNoticeBySlot = ref<Record<string, string>>({})
const suggestionTimers: Record<string, ReturnType<typeof setTimeout>> = {}
const suggestionRequestIds: Record<string, number> = {}
const preferences = ref<UserPreferencesResponse | null>(null)
const swipeSuggestions = ref<RecipeResponse[]>([])
const swipeIndex = ref(0)
const swipeLoading = ref(false)
const swipeError = ref<string | null>(null)
const swipeMessage = ref<string | null>(null)
const activeBucket = ref<MealSlot | null>(null)
const editingSlotKey = ref<string | null>(null)
const moveEditorKey = ref<string | null>(null)
const moveTargetBySlot = ref<Record<string, { date: string; slot: MealSlot }>>({})
const shoppingListLoading = ref(false)

const dayKeys = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const mealSlots: { key: MealSlot; labelKey: string }[] = [
  { key: 'breakfast', labelKey: 'mealPlan.slots.breakfast' },
  { key: 'lunch', labelKey: 'mealPlan.slots.lunch' },
  { key: 'dinner', labelKey: 'mealPlan.slots.dinner' },
  { key: 'snack', labelKey: 'mealPlan.slots.snack' },
]

const weekDays = computed<WeekDay[]>(() => {
  const weekStart = week.value?.weekStart ?? formatDate(startOfCurrentWeek())
  return dayKeys.map((key, index) => ({
    key,
    labelKey: `mealPlan.days.${key}`,
    date: addDays(weekStart, index),
  }))
})

const currentSwipeRecipe = computed(() => swipeSuggestions.value[swipeIndex.value] ?? null)
const currentLanguage = computed(() => {
  const [language] = String(locale.value).split('-')
  return (language || 'de').toLowerCase()
})
const englishRecipesAllowed = computed(() => currentLanguage.value === 'en')
const currentSwipeSlot = computed<MealSlot>(() => slotForRecipe(currentSwipeRecipe.value))
const currentSwipeTargetDate = computed(() => firstFreeDateForSlot(currentSwipeSlot.value))
const bucketCounts = computed<Record<MealSlot, number>>(() => ({
  breakfast: countEntriesForSlot('breakfast'),
  lunch: countEntriesForSlot('lunch'),
  dinner: countEntriesForSlot('dinner'),
  snack: countEntriesForSlot('snack'),
}))
const allBucketsFull = computed(() => mealSlots.every(slot => bucketCounts.value[slot.key] >= BUCKET_LIMIT))
const dailyCalorieTarget = computed(() => preferences.value?.dailyCalorieTarget ?? preferences.value?.calorieGoal ?? 2200)
const averageCaloriesPerDay = computed(() => Math.round(weekDays.value.reduce((sum, day) => sum + caloriesForDay(day.date), 0) / 7))
// Count of planned entries across the whole week that have no resolvable calorie value,
// so the week header can disclose that the average above doesn't include them.
const weekUnknownCaloriesCount = computed(() => (week.value?.entries ?? []).filter(hasUnknownCalories).length)
const calorieDelta = computed(() => averageCaloriesPerDay.value - dailyCalorieTarget.value)
const weeklyRecommendation = computed(() => {
  const freeSlots = 28 - (week.value?.entries.length ?? 0)
  if (calorieDelta.value > 200) {
    return 'Du liegst im Wochenschnitt über deinem Kalorienziel. Plane eher leichtere Gerichte oder kleinere Snacks.'
  }
  if (calorieDelta.value < -300) {
    return 'Du liegst deutlich unter deinem Kalorienziel. Ein zusätzlicher Snack oder sättigende Beilage könnte helfen.'
  }
  if (freeSlots > 0) {
    return `Deine Woche hat noch ${freeSlots} freie Slots. Fülle zuerst die Tage mit wenig geplanten Mahlzeiten.`
  }
  return 'Deine Woche passt gut zu deinem Kalorienziel.'
})

onMounted(() => {
  loadData()
})

async function loadData() {
  loading.value = true
  error.value = null
  actionError.value = null

  try {
    const [loadedWeek, ownRecipes, publishedRecipes] = await Promise.all([
      mealPlanApi.getWeek(),
      recipeApi.getMyRecipes(),
      recipeApi.getPublishedRecipes(currentLanguage.value),
    ])
    week.value = loadedWeek
    recipes.value = mergeRecipes(ownRecipes, publishedRecipes)
    syncSelectedRecipes(loadedWeek.entries)
    loadPreferences()
  } catch {
    error.value = t('mealPlan.errors.load')
  } finally {
    loading.value = false
  }
}

async function loadPreferences() {
  try {
    preferences.value = await profileApi.getPreferences()
  } catch {
    preferences.value = null
  }
}

function slotCaloriesToSend(key: string): number | null {
  const v = customCaloriesBySlot.value[key]
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null
}

async function saveDay(date: string, slot: MealSlot = 'dinner') {
  const key = slotKey(date, slot)
  const recipeId = selectedRecipeBySlot.value[key]
  const customTitle = customTitleBySlot.value[key]?.trim()
  if (!recipeId && !customTitle) {
    actionError.value = 'Bitte wähle ein Rezept oder gib einen Freitext ein.'
    return
  }

  try {
    actionError.value = null
    const saved = recipeId
      ? await mealPlanApi.setSlot(date, slot, Number(recipeId))
      : await mealPlanApi.setSlot(date, slot, {
        customTitle,
        caloriesSnapshot: slotCaloriesToSend(key),
        proteinSnapshot: customSnapshotBySlot.value[key]?.proteinSnapshot ?? null,
        imageUrlSnapshot: customSnapshotBySlot.value[key]?.imageUrlSnapshot ?? null,
        externalRecipeId: customSnapshotBySlot.value[key]?.externalRecipeId ?? null,
        externalSource: customSnapshotBySlot.value[key]?.externalSource ?? null,
      })
    upsertEntry(saved)
    syncSlotState(saved)
    editingSlotKey.value = null
    moveEditorKey.value = null
    suggestionsBySlot.value[key] = []
    suggestionNoticeBySlot.value[key] = ''
    toastStore.addToast(
      entryFor(date, slot)?.id === saved.id
        ? t('notifications.mealPlanSaved')
        : t('notifications.mealPlanned'),
      'success',
    )
  } catch {
    actionError.value = t('mealPlan.errors.save')
  }
}

async function removeDay(date: string, slot: MealSlot = 'dinner') {
  try {
    actionError.value = null
    await mealPlanApi.deleteSlot(date, slot)
    if (week.value) {
      week.value.entries = week.value.entries.filter(entry => !(entry.plannedDate === date && normalizedSlot(entry) === slot))
    }
    selectedRecipeBySlot.value[slotKey(date, slot)] = ''
    customTitleBySlot.value[slotKey(date, slot)] = ''
    customSnapshotBySlot.value[slotKey(date, slot)] = {}
    customCaloriesBySlot.value[slotKey(date, slot)] = null
    if (editingSlotKey.value === slotKey(date, slot)) {
      editingSlotKey.value = null
    }
    if (moveEditorKey.value === slotKey(date, slot)) {
      moveEditorKey.value = null
    }
    toastStore.addToast(t('notifications.mealPlanRemoved'), 'info')
  } catch {
    actionError.value = t('mealPlan.errors.remove')
  }
}

async function clearWeek() {
  const allSlotTargets = weekDays.value.flatMap(day => mealSlots.map(slot => ({ date: day.date, slot: slot.key })))
  if (!week.value?.entries.length) {
    return
  }
  try {
    actionError.value = null
    const results = await Promise.allSettled(
      allSlotTargets.map(target => mealPlanApi.deleteSlot(target.date, target.slot)),
    )
    const failedDeletes = results.filter(result => (
      result.status === 'rejected' && !isNotFoundError(result.reason)
    ))
    if (failedDeletes.length) {
      actionError.value = 'Einige Slots konnten nicht gelöscht werden. Bitte versuche es erneut.'
      await reloadWeek()
      return
    }
    selectedRecipeBySlot.value = {}
    customTitleBySlot.value = {}
    customSnapshotBySlot.value = {}
    customCaloriesBySlot.value = {}
    suggestionsBySlot.value = {}
    suggestionNoticeBySlot.value = {}
    editingSlotKey.value = null
    moveEditorKey.value = null
    await reloadWeek()
    toastStore.addToast(t('notifications.weekCleared'), 'info')
  } catch {
    actionError.value = t('mealPlan.errors.remove')
  }
}

function buildShoppingToast(result: MealPlanShoppingListResponse): string {
  const parts: string[] = []
  if (result.added.length > 0) parts.push(t('mealPlan.shoppingList.toastAdded', { count: result.added.length }))
  if (result.skippedBecauseInPantry.length > 0) parts.push(t('mealPlan.shoppingList.toastInPantry', { count: result.skippedBecauseInPantry.length }))
  if (result.alreadyOnShoppingList.length > 0) parts.push(t('mealPlan.shoppingList.toastExisting', { count: result.alreadyOnShoppingList.length }))
  if (result.needsReview.length > 0) parts.push(t('mealPlan.shoppingList.toastReview', { count: result.needsReview.length }))
  if (parts.length === 0) return t('mealPlan.shoppingList.toastNone')
  return parts.join(', ') + '.'
}

async function createShoppingListFromWeek() {
  try {
    actionError.value = null
    shoppingListLoading.value = true
    const result = await mealPlanApi.createShoppingListFromWeek(week.value?.weekStart)
    toastStore.addToast(buildShoppingToast(result), 'success')
  } catch {
    actionError.value = t('mealPlan.shoppingList.error')
  } finally {
    shoppingListLoading.value = false
  }
}

async function reloadWeek() {
  const loadedWeek = await mealPlanApi.getWeek(week.value?.weekStart)
  week.value = loadedWeek
  syncSelectedRecipes(loadedWeek.entries)
}

function isNotFoundError(error: unknown) {
  return error instanceof ApiClientError && error.status === 404
}

function entryFor(date: string, slot: MealSlot = 'dinner') {
  return week.value?.entries.find(entry => entry.plannedDate === date && normalizedSlot(entry) === slot)
}

function entriesForBucket(slot: MealSlot) {
  return weekDays.value
    .map(day => {
      const entry = entryFor(day.date, slot)
      return entry ? { day, entry } : null
    })
    .filter((item): item is { day: WeekDay; entry: MealPlanEntryResponse } => item !== null)
}

function toggleBucket(slot: MealSlot) {
  activeBucket.value = activeBucket.value === slot ? null : slot
}

function isEditingSlot(date: string, slot: MealSlot) {
  return editingSlotKey.value === slotKey(date, slot)
}

function startEditSlot(date: string, slot: MealSlot) {
  const entry = entryFor(date, slot)
  if (!entry) {
    return
  }
  const key = slotKey(date, slot)
  editingSlotKey.value = key
  moveEditorKey.value = null
  syncSlotState(entry)
  suggestionsBySlot.value[key] = []
  suggestionNoticeBySlot.value[key] = ''
}

function cancelEditSlot(date: string, slot: MealSlot) {
  const entry = entryFor(date, slot)
  const key = slotKey(date, slot)
  if (entry) {
    syncSlotState(entry)
  } else {
    selectedRecipeBySlot.value[key] = ''
    customTitleBySlot.value[key] = ''
    customSnapshotBySlot.value[key] = {}
    customCaloriesBySlot.value[key] = null
  }
  suggestionsBySlot.value[key] = []
  suggestionNoticeBySlot.value[key] = ''
  editingSlotKey.value = null
  moveEditorKey.value = null
}

function openMoveEditor(date: string, slot: MealSlot) {
  const key = slotKey(date, slot)
  moveEditorKey.value = moveEditorKey.value === key ? null : key
  moveTargetBySlot.value[key] = { date, slot }
}

function cancelMove() {
  moveEditorKey.value = null
}

function moveTargetFor(date: string, slot: MealSlot) {
  const key = slotKey(date, slot)
  if (!moveTargetBySlot.value[key]) {
    moveTargetBySlot.value[key] = { date, slot }
  }
  return moveTargetBySlot.value[key]!
}

function isMoveTargetOccupied(date: string, slot: MealSlot) {
  const target = moveTargetFor(date, slot)
  return Boolean(entryFor(target.date, target.slot))
    && (target.date !== date || target.slot !== slot)
}

async function moveEntry(currentDate: string, currentSlot: MealSlot) {
  const key = slotKey(currentDate, currentSlot)
  const entry = entryFor(currentDate, currentSlot)
  const target = moveTargetBySlot.value[key]
  if (!entry || !target) {
    actionError.value = t('mealPlan.errors.move')
    return
  }

  if (target.date === currentDate && target.slot === currentSlot) {
    moveEditorKey.value = null
    return
  }

  try {
    actionError.value = null
    const updatedWeek = await mealPlanApi.moveEntry(entry.id, {
      targetDate: target.date,
      targetSlot: target.slot,
      swapIfOccupied: true,
    })
    week.value = updatedWeek
    syncSelectedRecipes(updatedWeek.entries)
    moveEditorKey.value = null
    editingSlotKey.value = null
    toastStore.addToast(t('notifications.mealPlanMoved'), 'success')
  } catch {
    await reloadWeek().catch(() => undefined)
    actionError.value = t('mealPlan.errors.move')
  }
}

function caloriesForDay(date: string) {
  return (week.value?.entries ?? [])
    .filter(entry => entry.plannedDate === date)
    .reduce((sum, entry) => sum + entryCalories(entry), 0)
}

/**
 * True when none of an entry's calorie sources (calories, recipe.calories,
 * caloriesSnapshot) are set — i.e. entryCalories() would resolve to 0 by default.
 */
function hasUnknownCalories(entry: MealPlanEntryResponse) {
  return entry.calories == null && entry.recipe?.calories == null && entry.caloriesSnapshot == null
}

/**
 * Splits a day's planned meals into known-calorie sum and unknown-calorie count,
 * so the UI can show e.g. "1230 kcal + 1 Mahlzeit ohne kcal-Angabe" instead of
 * silently treating missing nutrition data as 0 kcal.
 */
function caloriesSummaryForDay(date: string): { knownCalories: number; unknownCount: number } {
  const dayEntries = (week.value?.entries ?? []).filter(entry => entry.plannedDate === date)
  const unknownCount = dayEntries.filter(hasUnknownCalories).length
  const knownCalories = dayEntries.reduce((sum, entry) => sum + (hasUnknownCalories(entry) ? 0 : entryCalories(entry)), 0)
  return { knownCalories, unknownCount }
}

function caloriesSummaryText(date: string): string {
  const { knownCalories, unknownCount } = caloriesSummaryForDay(date)
  if (unknownCount === 0) {
    return `${caloriesForDay(date)} / ${dailyCalorieTarget.value} kcal`
  }
  if (knownCalories > 0) {
    return unknownCount === 1
      ? t('mealPlan.caloriesWithUnknownOne', { knownSum: knownCalories, count: unknownCount })
      : t('mealPlan.caloriesWithUnknown', { knownSum: knownCalories, count: unknownCount })
  }
  return unknownCount === 1
    ? t('mealPlan.caloriesUnknownOnlyOne', { count: unknownCount })
    : t('mealPlan.caloriesUnknownOnly', { count: unknownCount })
}

function syncSelectedRecipes(entries: MealPlanEntryResponse[]) {
  selectedRecipeBySlot.value = {}
  customTitleBySlot.value = {}
  customSnapshotBySlot.value = {}
  customCaloriesBySlot.value = {}
  entries.forEach(syncSlotState)
}

function upsertEntry(entry: MealPlanEntryResponse) {
  if (!week.value) {
    return
  }
  const existingIndex = week.value.entries.findIndex(item => item.plannedDate === entry.plannedDate && normalizedSlot(item) === normalizedSlot(entry))
  if (existingIndex >= 0) {
    week.value.entries.splice(existingIndex, 1, entry)
  } else {
    week.value.entries.push(entry)
  }
}

function slotKey(date: string, slot: MealSlot) {
  return `${date}-${slot}`
}

function entryTitle(entry: MealPlanEntryResponse) {
  return entry.recipe?.title ?? entry.customTitle ?? ''
}

function exportMealPlanAsPdf() {
  const now = new Date()
  const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const weekRange = week.value
    ? `${week.value.weekStart} – ${week.value.weekEnd}`
    : ''

  const days = weekDays.value.map(day => {
    const dayEntries = (week.value?.entries ?? []).filter(e => e.plannedDate === day.date)
    const slots = dayEntries.map(entry => ({
      slotLabel: t(`mealPlan.slots.${normalizedSlot(entry)}`),
      title: entryTitle(entry),
      calories: entryCalories(entry) || null,
    }))
    const dayCalories = caloriesForDay(day.date)
    return {
      label: t(day.labelKey),
      date: day.date,
      slots,
      totalCalories: dayCalories > 0 ? dayCalories : null,
    }
  })

  // Robust fallback: backend totalCalories → sum of day totals → sum of entry calories
  let totalCalories: number | null = null
  const backendTotal = week.value?.totalCalories
  if (typeof backendTotal === 'number' && backendTotal > 0) {
    totalCalories = backendTotal
  } else {
    const daySum = days.reduce((sum, day) => sum + (day.totalCalories ?? 0), 0)
    if (daySum > 0) {
      totalCalories = daySum
    } else {
      const entrySum = (week.value?.entries ?? []).reduce(
        (sum, e) => sum + entryCalories(e),
        0,
      )
      totalCalories = entrySum > 0 ? entrySum : null
    }
  }

  toastStore.addToast(t('notifications.mealPlanPdfReady'), 'success')

  setTimeout(() => {
    printMealPlan(days, totalCalories, {
      appTitle: t('print.appTitle'),
      listTitle: t('print.mealPlanTitle'),
      createdAt: `${t('print.createdAt')}: ${dateStr}`,
      weekRange,
      totalCalories: t('print.totalCalories'),
      emptyMessage: t('print.emptyList'),
      kcalUnit: 'kcal',
    })
  }, 80)
}

function syncSlotState(entry: MealPlanEntryResponse) {
  const key = slotKey(entry.plannedDate, normalizedSlot(entry))
  selectedRecipeBySlot.value[key] = entry.recipe ? String(entry.recipe.id) : ''
  customTitleBySlot.value[key] = entryTitle(entry)
  customSnapshotBySlot.value[key] = {
    caloriesSnapshot: entry.caloriesSnapshot ?? entry.calories ?? entry.recipe?.calories ?? null,
    proteinSnapshot: entry.proteinSnapshot ?? entry.recipe?.protein ?? null,
    imageUrlSnapshot: entry.imageUrlSnapshot ?? entry.recipe?.imageUrl ?? null,
    externalRecipeId: entry.externalRecipeId ?? entry.recipe?.externalId ?? null,
    externalSource: entry.externalSource ?? entry.recipe?.source ?? null,
  }
  // Populate the user-facing kcal field only for freetext entries (no recipe)
  customCaloriesBySlot.value[key] = !entry.recipe
    ? (entry.caloriesSnapshot ?? null)
    : null
}

function normalizedSlot(entry: MealPlanEntryResponse): MealSlot {
  if (entry.mealSlot === 'breakfast' || entry.mealSlot === 'lunch' || entry.mealSlot === 'snack') {
    return entry.mealSlot
  }
  return 'dinner'
}

// For a recognized category alias (e.g. "Pasta"), queries the backend once per real
// match term ("pasta", "nudeln", "spaghetti", ...) in parallel and merges+dedupes the
// results, so the slot recipe search finds real category matches instead of only
// recipes containing the literal typed word.
async function fetchPublishedForSlotQuery(language: string, query: string): Promise<RecipeResponse[]> {
  const categoryTerms = categorySearchTerms(query)
  if (categoryTerms.length === 0) {
    return recipeApi.getPublishedRecipes(language, query)
  }
  const resultSets = await Promise.all(categoryTerms.map(term => recipeApi.getPublishedRecipes(language, term)))
  const merged = new Map<string, RecipeResponse>()
  for (const set of resultSets) {
    for (const r of set) {
      merged.set(`${r.source ?? 'dishly'}-${r.id}`, r)
    }
  }
  return [...merged.values()]
}

function onSlotSearch(date: string, slot: MealSlot) {
  const key = slotKey(date, slot)
  const requestId = (suggestionRequestIds[key] ?? 0) + 1
  suggestionRequestIds[key] = requestId
  selectedRecipeBySlot.value[key] = ''
  customSnapshotBySlot.value[key] = {}
  suggestionNoticeBySlot.value[key] = ''
  clearTimeout(suggestionTimers[key])

  const query = customTitleBySlot.value[key]?.trim() ?? ''
  if (query.length < 2) {
    suggestionsBySlot.value[key] = []
    suggestionLoadingBySlot.value[key] = false
    return
  }

  suggestionLoadingBySlot.value[key] = true
  suggestionTimers[key] = setTimeout(async () => {
    try {
      const language = currentLanguage.value
      const publishedMatches = await fetchPublishedForSlotQuery(language, query)
      if (suggestionRequestIds[key] !== requestId) {
        return
      }

      const normalizedQuery = query.toLowerCase()
      const ownMatches = recipes.value.filter(recipe => (
        recipe.userCreated === true
        && matchesCategoryAwareText(recipe.title.toLowerCase(), normalizedQuery)
      ))
      const suggestions = shuffleArray(mergeRecipes(ownMatches, publishedMatches))
        .slice(0, 5)
        .map(toSlotSuggestion)

      suggestionsBySlot.value[key] = suggestions
      if (suggestions.length === 0) {
        suggestionNoticeBySlot.value[key] = 'Keine passenden Rezepte gefunden. Freitext bleibt möglich.'
      }
    } catch {
      if (suggestionRequestIds[key] !== requestId) {
        return
      }
      suggestionsBySlot.value[key] = []
      suggestionNoticeBySlot.value[key] = 'Vorschläge konnten nicht geladen werden. Freitext bleibt möglich.'
    } finally {
      if (suggestionRequestIds[key] === requestId) {
        suggestionLoadingBySlot.value[key] = false
      }
    }
  }, 300)
}

function toSlotSuggestion(recipe: RecipeResponse): SlotSuggestion {
  const hasRecipeId = Number.isFinite(Number(recipe.id)) && Number(recipe.id) > 0
  return {
    id: recipe.id,
    title: recipe.title,
    source: hasRecipeId ? 'dishly' : 'external',
    planAsRecipe: hasRecipeId,
    calories: recipe.calories,
    protein: recipe.protein,
    imageUrl: recipe.imageUrl,
    externalRecipeId: recipe.externalId ? String(recipe.externalId) : hasRecipeId ? null : String(recipe.id),
    externalSource: recipe.source ?? 'dishly',
  }
}

function chooseSuggestion(date: string, slot: MealSlot, suggestion: SlotSuggestion) {
  const key = slotKey(date, slot)
  customTitleBySlot.value[key] = suggestion.title
  suggestionsBySlot.value[key] = []
  if (suggestion.planAsRecipe) {
    selectedRecipeBySlot.value[key] = String(suggestion.id)
    customSnapshotBySlot.value[key] = {}
    customCaloriesBySlot.value[key] = null
    suggestionNoticeBySlot.value[key] = ''
    return
  }
  selectedRecipeBySlot.value[key] = ''
  customCaloriesBySlot.value[key] = suggestion.calories ?? null
  customSnapshotBySlot.value[key] = {
    caloriesSnapshot: suggestion.calories ?? null,
    proteinSnapshot: suggestion.protein ?? null,
    imageUrlSnapshot: suggestion.imageUrl ?? null,
    externalRecipeId: suggestion.externalRecipeId ?? String(suggestion.id),
    externalSource: suggestion.externalSource ?? 'external',
  }
  suggestionNoticeBySlot.value[key] = 'Dieser Vorschlag wird mit Kalorien/Protein als Freitext gespeichert.'
}

async function loadSwipeSuggestions() {
  swipeLoading.value = true
  swipeError.value = null
  swipeMessage.value = null
  swipeIndex.value = 0
  try {
    const publishedRecipes = await recipeApi.getPublishedRecipes(currentLanguage.value)
    const seen = new Set<string>()
    let candidates: RecipeResponse[] = publishedRecipes
      .map(recipe => ({ ...recipe, source: 'dishly' }))
      .filter(recipe => bucketCounts.value[slotForRecipe(recipe)] < BUCKET_LIMIT)
      .filter(recipe => {
        const key = `${recipe.source ?? 'dishly'}-${recipe.externalId ?? recipe.id ?? recipe.title}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

    if (candidates.length === 0 && englishRecipesAllowed.value) {
      const externalRecipes = await recipeApi.getExternalRecipes(undefined, swipeFilters(), currentLanguage.value)
      candidates = externalRecipes
        .filter(recipe => bucketCounts.value[slotForRecipe(recipe)] < BUCKET_LIMIT)
        .filter(recipe => {
          const key = `${recipe.source ?? 'external'}-${recipe.externalId ?? recipe.id ?? recipe.title}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
    }

    swipeSuggestions.value = shuffleArray(candidates)
      .slice(0, 20)
    if (swipeSuggestions.value.length === 0) {
      swipeError.value = englishRecipesAllowed.value
        ? 'Keine Vorschläge gefunden.'
        : 'Für diese Sprache sind noch keine lokalen Rezepte verfügbar.'
    }
  } catch {
    swipeSuggestions.value = []
    swipeError.value = 'Vorschläge konnten nicht geladen werden.'
  } finally {
    swipeLoading.value = false
  }
}

function skipSwipeSuggestion() {
  swipeMessage.value = null
  swipeError.value = null
  if (swipeIndex.value < swipeSuggestions.value.length - 1) {
    swipeIndex.value += 1
    return
  }
  swipeError.value = 'Keine weiteren Vorschläge vorhanden.'
}

async function acceptSwipeSuggestion() {
  const suggestion = currentSwipeRecipe.value
  if (!suggestion) {
    swipeError.value = 'Kein Vorschlag ausgewählt.'
    return
  }
  const slot = slotForRecipe(suggestion)
  const date = firstFreeDateForSlot(slot)
  if (!date) {
    swipeError.value = allBucketsFull.value
      ? 'Glückwunsch! Deine Woche ist vollständig geplant.'
      : `Dein ${slotLabel(slot)}-Bucket ist voll. Entferne ein Rezept oder tausche eines aus.`
    return
  }

  try {
    swipeError.value = null
    const saved = suggestion.source === 'dishly' && Number.isFinite(Number(suggestion.id))
      ? await mealPlanApi.setSlot(date, slot, Number(suggestion.id))
      : await mealPlanApi.setSlot(date, slot, {
        customTitle: suggestion.title,
        caloriesSnapshot: suggestion.calories ?? null,
        proteinSnapshot: suggestion.protein ?? null,
        imageUrlSnapshot: suggestion.imageUrl ?? null,
        externalRecipeId: suggestion.externalId ? String(suggestion.externalId) : suggestion.id ? String(suggestion.id) : null,
        externalSource: suggestion.source ?? 'dishly-public',
      })
    upsertEntry(saved)
    syncSlotState(saved)
    toastStore.addToast(t('notifications.swipePlanned', { title: suggestion.title }), 'success')
    if (swipeIndex.value < swipeSuggestions.value.length - 1) {
      swipeIndex.value += 1
    }
  } catch {
    swipeError.value = 'Vorschlag konnte nicht übernommen werden.'
  }
}

function swipeFilters(): RecipeSearchFilters {
  const profile = preferences.value
  return {
    vegan: profile?.vegan || undefined,
    vegetarian: profile?.vegetarian || undefined,
    glutenFree: profile?.glutenFree || undefined,
    maxPrepTime: profile?.maxPrepTimeMinutes ?? null,
  }
}

function mergeRecipes(ownRecipes: RecipeResponse[], publishedRecipes: RecipeResponse[]) {
  const seen = new Set<string>()
  const own = ownRecipes.map(recipe => ({ ...recipe, userCreated: true }))
  return [...own, ...publishedRecipes].filter(recipe => {
    const key = `${recipe.source ?? 'dishly'}-${recipe.externalId ?? recipe.id ?? recipe.title}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function shuffleArray<T>(items: T[]): T[] {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const current = shuffled[i]
    shuffled[i] = shuffled[j] as T
    shuffled[j] = current as T
  }
  return shuffled
}

function countEntriesForSlot(slot: MealSlot) {
  return (week.value?.entries ?? []).filter(entry => normalizedSlot(entry) === slot).length
}

function totalCaloriesForBucket(slot: MealSlot) {
  return entriesForBucket(slot).reduce((sum, item) => sum + entryCalories(item.entry), 0)
}

// Resolves an entry's calories from whichever source is available (manual override,
// linked recipe, or the snapshot taken when it was planned), defaulting to 0 so sums
// stay numeric. That default silently hides "no kcal known" as "0 kcal" — callers that
// need to distinguish the two (e.g. day/week summaries) must also check hasUnknownCalories().
function entryCalories(entry: MealPlanEntryResponse | null | undefined) {
  return entry?.calories ?? entry?.recipe?.calories ?? entry?.caloriesSnapshot ?? 0
}

function entryProtein(entry: MealPlanEntryResponse | null | undefined) {
  return entry?.recipe?.protein ?? entry?.proteinSnapshot ?? null
}

function formatProtein(value: number | null | undefined) {
  return typeof value === 'number' ? `${Math.round(value)} g Protein` : ''
}


function firstFreeDateForSlot(slot: MealSlot) {
  if (bucketCounts.value[slot] >= BUCKET_LIMIT) {
    return null
  }
  return weekDays.value.find(day => !entryFor(day.date, slot))?.date ?? null
}

function caloriesStatusClass(date: string) {
  const calories = caloriesForDay(date)
  if (calories <= dailyCalorieTarget.value) return 'good'
  if (calories <= dailyCalorieTarget.value + 200) return 'warning'
  return 'over'
}

function calorieProgress(date: string) {
  return Math.min(100, Math.round((caloriesForDay(date) / dailyCalorieTarget.value) * 100))
}

function slotForRecipe(recipe: RecipeResponse | null | undefined): MealSlot {
  const text = `${recipe?.category ?? ''} ${recipe?.title ?? ''}`.toLowerCase()
  if (text.includes('breakfast') || text.includes('frühstück') || text.includes('pancake') || text.includes('oat')) {
    return 'breakfast'
  }
  if (text.includes('snack') || text.includes('cookie') || text.includes('smoothie') || text.includes('bar')) {
    return 'snack'
  }
  if (text.includes('lunch') || text.includes('mittag') || text.includes('salad') || text.includes('sandwich') || text.includes('bowl')) {
    return 'lunch'
  }
  return 'dinner'
}

function visibleCategory(category?: string | null) {
  return displayCategory(category, currentLanguage.value)
}

function slotLabel(slot: MealSlot) {
  if (slot === 'breakfast') return 'Frühstück'
  if (slot === 'lunch') return 'Mittagessen'
  if (slot === 'snack') return 'Snack'
  return 'Abendessen'
}

function startOfCurrentWeek() {
  const now = new Date()
  const day = now.getDay() === 0 ? 7 : now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1)
  return monday
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`)
  value.setDate(value.getDate() + days)
  return formatDate(value)
}

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
</script>

<template>
  <section class="meal-plan-page">
    <header class="meal-plan-header">
      <p class="eyebrow">{{ t('mealPlan.week.current') }}</p>
      <h1>{{ t('mealPlan.title') }}</h1>
      <p>{{ t('mealPlan.subtitle') }}</p>
    </header>

    <p v-if="loading" class="status-text">{{ t('mealPlan.loading') }}</p>
    <p v-else-if="error" class="status-text error">{{ error }}</p>

    <section v-else class="week-grid" :aria-label="t('mealPlan.title')">
      <p v-if="actionError" class="status-text error full-width">{{ actionError }}</p>
      <p v-if="recipes.length === 0" class="status-text full-width">{{ t('mealPlan.empty.noRecipes') }}</p>
      <div class="mode-switch full-width" aria-label="Planungsmodus">
        <button type="button" :class="{ active: planningMode === 'manual' }" @click="planningMode = 'manual'">
          Manuell planen
        </button>
        <button type="button" :class="{ active: planningMode === 'swipe' }" @click="planningMode = 'swipe'">
          Swipe planen
        </button>
      </div>

      <div v-if="planningMode === 'manual'" class="week-summary full-width">
        <div>
          <strong>Woche manuell planen</strong>
          <p>
            Schnitt: {{ averageCaloriesPerDay }} / {{ dailyCalorieTarget }} kcal pro Tag
            <span v-if="calorieDelta > 0">(+{{ calorieDelta }} kcal)</span>
            <span v-else-if="calorieDelta < 0">({{ calorieDelta }} kcal)</span>
          </p>
          <p v-if="weekUnknownCaloriesCount > 0" class="hint calorie-unknown-hint">
            {{ weekUnknownCaloriesCount === 1 ? t('mealPlan.weekUnknownCaloriesHintOne', { count: weekUnknownCaloriesCount }) : t('mealPlan.weekUnknownCaloriesHint', { count: weekUnknownCaloriesCount }) }}
          </p>
          <p>{{ weeklyRecommendation }}</p>
        </div>
        <button type="button" class="clear-week-button" :disabled="!week?.entries.length" @click="clearWeek">
          {{ t('mealPlan.actions.clearWeek') }}
        </button>
        <button type="button" class="secondary-button" @click="exportMealPlanAsPdf">
          {{ t('mealPlan.actions.exportPdf') }}
        </button>
        <button
          type="button"
          class="secondary-button"
          :disabled="shoppingListLoading || !week?.entries.length"
          @click="createShoppingListFromWeek"
        >
          {{ shoppingListLoading ? t('mealPlan.shoppingList.loading') : t('mealPlan.shoppingList.action') }}
        </button>
      </div>


      <section v-if="planningMode === 'swipe'" class="swipe-planner full-width" aria-label="Swipe-Planung">
        <div class="swipe-controls">
          <div>
            <h2>Swipe-Planung</h2>
            <p>Swipe durch Vorschläge. Dishly legt jedes Rezept automatisch in den passenden Wochenplan-Bucket.</p>
          </div>
          <button
            v-if="!allBucketsFull"
            type="button"
            class="primary-button"
            :disabled="swipeLoading"
            @click="loadSwipeSuggestions"
          >
            {{ swipeLoading ? 'Vorschläge werden geladen...' : 'Vorschläge laden' }}
          </button>
        </div>

        <div class="bucket-grid">
          <button
            v-for="slot in mealSlots"
            :key="slot.key"
            type="button"
            class="bucket-card"
            :class="{ full: bucketCounts[slot.key] >= BUCKET_LIMIT, active: activeBucket === slot.key }"
            @click="toggleBucket(slot.key)"
          >
            <span>{{ slotLabel(slot.key) }}</span>
            <strong>{{ bucketCounts[slot.key] }}/{{ BUCKET_LIMIT }}</strong>
          </button>
        </div>

        <section v-if="activeBucket" class="bucket-panel" aria-live="polite">
          <div class="bucket-panel-header">
            <div>
              <h3>{{ slotLabel(activeBucket) }}</h3>
              <p>{{ bucketCounts[activeBucket] }}/{{ BUCKET_LIMIT }} geplant · {{ totalCaloriesForBucket(activeBucket) }} kcal</p>
            </div>
            <button type="button" class="secondary-button" @click="activeBucket = null">Schließen</button>
          </div>

          <p v-if="entriesForBucket(activeBucket).length === 0" class="empty-day">
            Noch keine Rezepte in diesem Bucket.
          </p>
          <ul v-else class="bucket-entry-list">
            <li v-for="item in entriesForBucket(activeBucket)" :key="`${item.day.date}-${activeBucket}`">
              <div>
                <strong>{{ entryTitle(item.entry) }}</strong>
                <p>
                  {{ t(item.day.labelKey) }} · {{ item.day.date }}
                  <span v-if="entryCalories(item.entry)"> · {{ entryCalories(item.entry) }} kcal</span>
                  <span v-if="entryProtein(item.entry)"> · {{ formatProtein(entryProtein(item.entry)) }}</span>
                </p>
              </div>
              <button type="button" class="secondary-button" @click="removeDay(item.day.date, activeBucket)">
                Entfernen
              </button>
            </li>
          </ul>
        </section>

        <p v-if="swipeError" class="status-text error">{{ swipeError }}</p>
        <div v-if="allBucketsFull" class="completion-card">
          <h3>Glückwunsch! Deine Woche ist vollständig geplant.</h3>
          <p>Alle Buckets sind voll. Du kannst jetzt Rezepte entfernen oder verwalten.</p>
          <button type="button" class="secondary-button" @click="planningMode = 'manual'">
            Rezepte verwalten
          </button>
        </div>

        <article v-if="currentSwipeRecipe && !allBucketsFull" class="swipe-card">
          <img v-if="currentSwipeRecipe.imageUrl" :src="currentSwipeRecipe.imageUrl" :alt="currentSwipeRecipe.title" />
          <div class="swipe-card-content">
            <span class="progress-pill">{{ swipeIndex + 1 }}/{{ swipeSuggestions.length }}</span>
            <h3>{{ currentSwipeRecipe.title }}</h3>
            <div class="swipe-meta">
              <span v-if="currentSwipeRecipe.prepTimeMinutes || currentSwipeRecipe.cookTimeMinutes">
                {{ currentSwipeRecipe.prepTimeMinutes + currentSwipeRecipe.cookTimeMinutes }} min
              </span>
              <span v-if="currentSwipeRecipe.calories">{{ currentSwipeRecipe.calories }} kcal</span>
              <span v-if="currentSwipeRecipe.protein">{{ Math.round(currentSwipeRecipe.protein) }} g Protein</span>
            </div>
            <div class="tag-list">
              <span v-if="currentSwipeRecipe.category">{{ visibleCategory(currentSwipeRecipe.category) }}</span>
              <span v-if="currentSwipeRecipe.difficulty">{{ currentSwipeRecipe.difficulty }}</span>
            </div>
            <p v-if="currentSwipeRecipe.source !== 'dishly'" class="suggestion-state">
              Externe Vorschläge werden aktuell ehrlich als Freitext gespeichert.
            </p>
            <p v-else class="suggestion-state">
              Dishly-Rezepte werden als echte Rezeptverknüpfung gespeichert.
            </p>
            <p class="suggestion-state">
              Dieses Rezept kommt zu: <strong>{{ slotLabel(currentSwipeSlot) }}</strong>
              <span v-if="currentSwipeTargetDate"> am {{ currentSwipeTargetDate }}</span>
              <span v-else> - dieser Bucket ist voll</span>
            </p>
            <div class="actions">
              <button type="button" class="secondary-button" @click="skipSwipeSuggestion">
                ← Überspringen
              </button>
              <button type="button" class="primary-button" @click="acceptSwipeSuggestion">
                → Übernehmen
              </button>
            </div>
          </div>
        </article>
      </section>

      <template v-if="planningMode === 'manual'">
      <article v-for="day in weekDays" :key="day.date" class="day-card">
        <div class="day-card-header">
          <div>
            <h2>{{ t(day.labelKey) }}</h2>
            <span>{{ caloriesSummaryText(day.date) }}</span>
          </div>
          <span>{{ day.date }}</span>
        </div>
        <div class="calorie-meter" :class="caloriesStatusClass(day.date)">
          <span :style="{ width: `${calorieProgress(day.date)}%` }"></span>
        </div>
        <p v-if="caloriesSummaryForDay(day.date).unknownCount > 0" class="hint calorie-unknown-hint">
          {{ t('mealPlan.unknownCaloriesHint') }}
        </p>

        <div v-for="slot in mealSlots" :key="slot.key" class="slot-block">
          <h3>{{ t(slot.labelKey) }}</h3>

          <div v-if="entryFor(day.date, slot.key) && !isEditingSlot(day.date, slot.key)" class="planned-recipe compact">
            <span class="planned-label">{{ t('mealPlan.plannedRecipe') }}</span>
            <strong>{{ entryTitle(entryFor(day.date, slot.key)!) }}</strong>
            <div class="planned-meta">
              <span v-if="entryCalories(entryFor(day.date, slot.key))">
                {{ entryCalories(entryFor(day.date, slot.key)) }} kcal
              </span>
              <span v-if="entryProtein(entryFor(day.date, slot.key))">
                {{ formatProtein(entryProtein(entryFor(day.date, slot.key))) }}
              </span>
              <span v-if="!entryFor(day.date, slot.key)?.recipe?.id">Freitext</span>
            </div>
            <div class="planned-actions">
              <RouterLink
                v-if="entryFor(day.date, slot.key)?.recipe?.id"
                class="secondary-button planned-link"
                :to="`/recipe/${entryFor(day.date, slot.key)!.recipe!.id}`"
              >
                {{ t('mealPlan.actions.viewRecipe') }}
              </RouterLink>
              <button type="button" class="secondary-button" @click="startEditSlot(day.date, slot.key)">
                Bearbeiten
              </button>
              <button type="button" class="secondary-button" @click="removeDay(day.date, slot.key)">
                {{ t('mealPlan.actions.remove') }}
              </button>
            </div>
          </div>

          <template v-else>
            <p v-if="!entryFor(day.date, slot.key)" class="empty-day">{{ t('mealPlan.empty.day') }}</p>
            <div v-else class="planned-recipe edit-summary">
              <span class="planned-label">Bearbeitung</span>
              <strong>{{ entryTitle(entryFor(day.date, slot.key)!) }}</strong>
              <div class="planned-meta">
                <span v-if="entryCalories(entryFor(day.date, slot.key))">
                  {{ entryCalories(entryFor(day.date, slot.key)) }} kcal
                </span>
                <span v-if="entryProtein(entryFor(day.date, slot.key))">
                  {{ formatProtein(entryProtein(entryFor(day.date, slot.key))) }}
                </span>
              </div>
            </div>

            <label class="recipe-select">
              <span>Rezept suchen oder Freitext eingeben</span>
              <input
                v-model="customTitleBySlot[slotKey(day.date, slot.key)]"
                type="text"
                placeholder="z. B. Sushi"
                @input="onSlotSearch(day.date, slot.key)"
              />
            </label>
            <label
              v-if="!selectedRecipeBySlot[slotKey(day.date, slot.key)]"
              class="recipe-select slot-calories-input"
            >
              <span>{{ t('mealPlan.form.calories') }}</span>
              <input
                v-model.number="customCaloriesBySlot[slotKey(day.date, slot.key)]"
                type="number"
                min="0"
                :placeholder="t('mealPlan.form.caloriesPlaceholder')"
              />
            </label>
            <p v-if="suggestionLoadingBySlot[slotKey(day.date, slot.key)]" class="suggestion-state">
              Vorschläge werden geladen...
            </p>
            <ul v-if="suggestionsBySlot[slotKey(day.date, slot.key)]?.length" class="suggestion-list">
              <li
                v-for="suggestion in suggestionsBySlot[slotKey(day.date, slot.key)]"
                :key="`${suggestion.source}-${suggestion.id}`"
              >
                <button type="button" @click="chooseSuggestion(day.date, slot.key, suggestion)">
                  <span>{{ suggestion.title }}</span>
                  <small>{{ suggestion.planAsRecipe ? 'Dishly-Rezept' : 'Freitext-Vorschlag' }}</small>
                  <small v-if="suggestion.calories || suggestion.protein">
                    <span v-if="suggestion.calories">{{ suggestion.calories }} kcal</span>
                    <span v-if="suggestion.calories && suggestion.protein"> · </span>
                    <span v-if="suggestion.protein">{{ Math.round(suggestion.protein) }} g Protein</span>
                  </small>
                </button>
              </li>
            </ul>
            <p v-if="suggestionNoticeBySlot[slotKey(day.date, slot.key)]" class="suggestion-state">
              {{ suggestionNoticeBySlot[slotKey(day.date, slot.key)] }}
            </p>

            <div class="actions">
              <button type="button" class="primary-button" @click="saveDay(day.date, slot.key)">
                {{ entryFor(day.date, slot.key) ? t('mealPlan.actions.save') : t('mealPlan.actions.add') }}
              </button>
              <button
                v-if="entryFor(day.date, slot.key)"
                type="button"
                class="secondary-button"
                @click="cancelEditSlot(day.date, slot.key)"
              >
                {{ t('mealPlan.actions.cancel') }}
              </button>
              <button
                v-if="entryFor(day.date, slot.key)"
                type="button"
                class="secondary-button"
                @click="openMoveEditor(day.date, slot.key)"
              >
                {{ t('mealPlan.actions.move') }}
              </button>
              <button
                v-if="entryFor(day.date, slot.key)"
                type="button"
                class="secondary-button"
                @click="removeDay(day.date, slot.key)"
              >
                {{ t('mealPlan.actions.remove') }}
              </button>
            </div>

            <form
              v-if="moveEditorKey === slotKey(day.date, slot.key)"
              class="move-form"
              @submit.prevent="moveEntry(day.date, slot.key)"
            >
              <label>
                <span>{{ t('mealPlan.form.targetDay') }}</span>
                <select v-model="moveTargetFor(day.date, slot.key).date">
                  <option v-for="targetDay in weekDays" :key="targetDay.date" :value="targetDay.date">
                    {{ t(targetDay.labelKey) }} · {{ targetDay.date }}
                  </option>
                </select>
              </label>
              <label>
                <span>{{ t('mealPlan.form.targetSlot') }}</span>
                <select v-model="moveTargetFor(day.date, slot.key).slot">
                  <option v-for="targetSlot in mealSlots" :key="targetSlot.key" :value="targetSlot.key">
                    {{ t(targetSlot.labelKey) }}
                  </option>
                </select>
              </label>
              <p
                v-if="isMoveTargetOccupied(day.date, slot.key)"
                class="suggestion-state"
              >
                Der Zielslot ist belegt. Beim Verschieben werden beide Einträge getauscht.
              </p>
              <div class="move-actions">
                <button type="submit" class="primary-button">{{ t('mealPlan.actions.moveSave') }}</button>
                <button type="button" class="secondary-button" @click="cancelMove">{{ t('mealPlan.actions.cancel') }}</button>
              </div>
            </form>
          </template>
        </div>
      </article>
      </template>
    </section>
  </section>
</template>

<style scoped>
.meal-plan-page {
  width: 100%;
  max-width: 1180px;
  margin: 30px auto 44px auto;
  padding: 0 6vw;
  box-sizing: border-box;
}

.meal-plan-header {
  background: #fff7fb;
  border: 1px solid #f6d9ea;
  border-radius: 22px;
  box-shadow: 0 2px 18px rgba(191, 140, 167, 0.12);
  padding: 24px 22px 20px 22px;
  margin-bottom: 22px;
}

.eyebrow {
  color: #26b6b8;
  font-size: 0.85rem;
  font-weight: 800;
  text-transform: uppercase;
  margin: 0 0 6px 0;
}

.meal-plan-header h1 {
  margin: 0 0 6px 0;
  color: #cc7da9;
  font-size: 2rem;
}

.meal-plan-header p {
  color: #486b68;
}

.week-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(230px, 100%), 1fr));
  gap: 16px;
}

.mode-switch {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(180px, 1fr));
}

.mode-switch button {
  background: #ffffff;
  border: 1.5px solid #c3e7e1;
  border-radius: 16px;
  color: #2f6f62;
  cursor: pointer;
  font: inherit;
  font-size: 1rem;
  font-weight: 900;
  padding: 18px;
}

.mode-switch button.active {
  background: #cc7da9;
  border-color: #cc7da9;
  color: #ffffff;
}

.day-card {
  background: #f4fbfa;
  border: 1px solid #c3e7e1;
  border-radius: 16px;
  box-shadow: 0 1px 7px rgba(79, 127, 120, 0.12);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.day-card-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.day-card-header h2 {
  color: #2b1b23;
  font-size: 1.15rem;
  margin: 0;
}

.day-card-header span {
  color: #486b68;
  font-size: 0.88rem;
}

.calorie-meter {
  background: #e8f4f1;
  border-radius: 999px;
  height: 8px;
  overflow: hidden;
}

.calorie-meter span {
  display: block;
  height: 100%;
}

.calorie-meter.good span {
  background: #2f8f7b;
}

.calorie-meter.warning span {
  background: #d89a2b;
}

.calorie-meter.over span {
  background: #b94d4d;
}

.slot-block {
  border-top: 1px solid #d6eee9;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
}

.slot-block h3 {
  color: #2f6f62;
  font-size: 0.98rem;
  margin: 0;
}

.planned-recipe,
.empty-day {
  min-height: 48px;
}

.planned-recipe {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-wrap: anywhere;
}

.planned-actions,
.move-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}

.planned-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.planned-meta span {
  background: #e0f5f2;
  border-radius: 999px;
  color: #1d8e90;
  font-size: 0.78rem;
  font-weight: 800;
  padding: 4px 8px;
  width: fit-content;
}

.planned-link {
  text-decoration: none;
}

.move-form {
  border-top: 1px solid #d6eee9;
  display: grid;
  gap: 10px;
  margin-top: 10px;
  padding-top: 10px;
}

.move-form label {
  color: #2b1b23;
  display: grid;
  gap: 5px;
  font-weight: 700;
}

.move-form select {
  background: #ffffff;
  border: 1.5px solid #c3e7e1;
  border-radius: 8px;
  font: inherit;
  min-height: 40px;
  padding: 8px 10px;
  width: 100%;
}

.planned-label {
  color: #26b6b8;
  font-size: 0.8rem;
  font-weight: 800;
}

.empty-day {
  color: #486b68;
  margin: 0;
}

.recipe-select {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #2b1b23;
  font-weight: 700;
}

.recipe-select select,
.recipe-select input {
  min-height: 40px;
  border: 1.5px solid #c3e7e1;
  border-radius: 8px;
  padding: 8px 10px;
  background: #ffffff;
  font: inherit;
  width: 100%;
}

.suggestion-list {
  display: grid;
  gap: 6px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.suggestion-list button {
  background: #ffffff;
  border: 1px solid #d6eee9;
  border-radius: 8px;
  color: #2b1b23;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  font: inherit;
  gap: 2px;
  padding: 8px 10px;
  text-align: left;
  width: 100%;
  overflow-wrap: anywhere;
}

.suggestion-list small,
.suggestion-state {
  color: #486b68;
  font-size: 0.82rem;
  margin: 0;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: auto;
}

.week-summary {
  align-items: center;
  background: #ffffff;
  border: 1px solid #c3e7e1;
  border-radius: 14px;
  color: #486b68;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
  padding: 12px 16px;
}

.week-summary p {
  color: #486b68;
  margin: 4px 0 0;
}


.swipe-planner {
  background: #ffffff;
  border: 1px solid #c3e7e1;
  border-radius: 16px;
  display: grid;
  gap: 14px;
  padding: 16px;
}

.swipe-controls {
  align-items: end;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(220px, 1fr) minmax(150px, auto);
}

.swipe-controls h2 {
  color: #cc7da9;
  margin: 0 0 4px 0;
}

.swipe-controls p {
  color: #486b68;
  margin: 0;
}

.bucket-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr));
}

.bucket-card {
  background: #f4fbfa;
  border: 1px solid #c3e7e1;
  border-radius: 14px;
  color: #2f6f62;
  cursor: pointer;
  display: flex;
  font: inherit;
  justify-content: space-between;
  padding: 12px;
  text-align: left;
  min-height: 44px;
}

.bucket-card.full {
  background: #fff7fb;
  border-color: #e7b6d0;
  color: #b94d83;
}

.bucket-card.active {
  border-color: #cc7da9;
  box-shadow: 0 0 0 3px rgba(204, 125, 169, 0.16);
}

.bucket-panel,
.completion-card {
  background: #fff7fb;
  border: 1px solid #f6d9ea;
  border-radius: 14px;
  display: grid;
  gap: 12px;
  padding: 14px;
}

.bucket-panel-header,
.bucket-entry-list li {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.bucket-panel h3,
.completion-card h3 {
  color: #cc7da9;
  margin: 0 0 4px 0;
}

.bucket-panel p,
.completion-card p {
  color: #486b68;
  margin: 0;
}

.bucket-entry-list {
  display: grid;
  gap: 10px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.bucket-entry-list li {
  background: #ffffff;
  border: 1px solid #d6eee9;
  border-radius: 12px;
  padding: 10px 12px;
  overflow-wrap: anywhere;
}

.swipe-card {
  border: 1px solid #d6eee9;
  border-radius: 14px;
  display: grid;
  grid-template-columns: minmax(140px, 220px) 1fr;
  overflow: hidden;
  min-width: 0;
}

.swipe-card img {
  height: 100%;
  min-height: 180px;
  object-fit: cover;
  width: 100%;
}

.swipe-card-content {
  display: grid;
  gap: 10px;
  padding: 14px;
}

.swipe-card-content h3 {
  color: #2b1b23;
  font-size: 1.25rem;
  margin: 0;
  overflow-wrap: anywhere;
}

.progress-pill,
.swipe-meta span,
.tag-list span {
  background: #e0f5f2;
  border-radius: 999px;
  color: #1d8e90;
  display: inline-flex;
  font-size: 0.86rem;
  font-weight: 800;
  padding: 5px 10px;
  width: fit-content;
}

.swipe-meta,
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-list span {
  background: #fff7fb;
  color: #b96593;
}

.primary-button,
.secondary-button,
.clear-week-button {
  border-radius: 999px;
  min-height: 44px;
  padding: 8px 14px;
  font-weight: 700;
  cursor: pointer;
}

.primary-button {
  background: #cc7da9;
  border: none;
  color: #ffffff;
}

.primary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.secondary-button,
.clear-week-button {
  background: #ffffff;
  border: 1px solid #c3e7e1;
  color: #486b68;
}

.status-text {
  text-align: center;
  color: #486b68;
  margin: 20px 0;
}

.status-text.error {
  color: #a14c2b;
  font-weight: 700;
}

.status-text.success {
  color: #1d8e90;
  font-weight: 700;
}

.full-width {
  grid-column: 1 / -1;
}

@media (max-width: 760px) {
  .meal-plan-page {
    margin: 18px auto 32px auto;
    padding: 0 12px;
  }

  .meal-plan-header {
    border-radius: 16px;
    padding: 20px 16px 18px;
  }

  .meal-plan-header h1 {
    font-size: 1.55rem;
    line-height: 1.2;
  }

  .mode-switch {
    grid-template-columns: 1fr;
  }

  .day-card-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .week-summary {
    align-items: stretch;
    flex-direction: column;
  }

  .week-summary .clear-week-button,
  .week-summary .secondary-button {
    width: 100%;
  }

.swipe-controls,
  .swipe-card {
    grid-template-columns: 1fr;
  }

  .swipe-planner {
    padding: 14px;
  }

  .bucket-panel-header,
  .bucket-entry-list li {
    align-items: stretch;
    flex-direction: column;
  }

  .swipe-card img {
    max-height: 220px;
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .planned-actions,
  .move-actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .primary-button,
  .secondary-button,
  .clear-week-button {
    width: 100%;
  }
}
</style>
