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
import { ALLERGEN_ENTRIES, getMatchTerms } from '@/shared/profileSuggestions'
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
// The date/slot currently open in the add/edit modal (null when the modal is closed).
const modalDate = ref<string | null>(null)
const modalSlot = ref<MealSlot | null>(null)
const moveEditorKey = ref<string | null>(null)
const moveTargetBySlot = ref<Record<string, { date: string; slot: MealSlot }>>({})
// Native HTML5 drag & drop state for moving/swapping a planned meal between slots.
const dragSource = ref<{ date: string; slot: MealSlot } | null>(null)
const dragOverSlotKey = ref<string | null>(null)
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

// Day label shown under the modal title, e.g. "Montag" for the currently open slot.
const modalDayLabel = computed(() => {
  if (!modalDate.value) return ''
  const day = weekDays.value.find(d => d.date === modalDate.value)
  return day ? t(day.labelKey) : ''
})
const currentSwipeRecipe = computed(() => swipeSuggestions.value[swipeIndex.value] ?? null)
const currentLanguage = computed(() => {
  const [language] = String(locale.value).split('-')
  return (language || 'de').toLowerCase()
})
const englishRecipesAllowed = computed(() => currentLanguage.value === 'en')
const currentSwipeSlot = computed<MealSlot>(() => slotForRecipe(currentSwipeRecipe.value))
const currentSwipeTargetDate = computed(() => firstFreeDateForSlot(currentSwipeSlot.value))
const currentSwipeBucketIsFull = computed(() => Boolean(currentSwipeRecipe.value && !currentSwipeTargetDate.value && !allBucketsFull.value))
const currentSwipeBucketWarning = computed(() => currentSwipeBucketIsFull.value ? fullBucketWarning(currentSwipeSlot.value) : null)
const bucketCounts = computed<Record<MealSlot, number>>(() => ({
  breakfast: countEntriesForSlot('breakfast'),
  lunch: countEntriesForSlot('lunch'),
  dinner: countEntriesForSlot('dinner'),
  snack: countEntriesForSlot('snack'),
}))
const allBucketsFull = computed(() => mealSlots.every(slot => bucketCounts.value[slot.key] >= BUCKET_LIMIT))
const dailyCalorieTarget = computed(() => {
  const target = preferences.value?.dailyCalorieTarget ?? preferences.value?.calorieGoal ?? null
  return typeof target === 'number' && target > 0 ? target : null
})
const hasDailyCalorieTarget = computed(() => dailyCalorieTarget.value !== null)
const averageCaloriesPerDay = computed(() => Math.round(weekDays.value.reduce((sum, day) => sum + caloriesForDay(day.date), 0) / 7))
// Count of planned entries across the whole week that have no resolvable calorie value,
// so the week header can disclose that the average above doesn't include them.
const weekUnknownCaloriesCount = computed(() => (week.value?.entries ?? []).filter(hasUnknownCalories).length)
const calorieDelta = computed(() => hasDailyCalorieTarget.value ? averageCaloriesPerDay.value - dailyCalorieTarget.value! : 0)
const weeklyRecommendation = computed(() => {
  const freeSlots = 28 - (week.value?.entries.length ?? 0)
  if (!hasDailyCalorieTarget.value) {
    return freeSlots > 0
      ? t('mealPlan.noWeeklyGoalWithFreeSlots')
      : t('mealPlan.noWeeklyGoalFull')
  }
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
    actionError.value = t('mealPlan.errors.recipeOrCustomRequired')
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
    moveEditorKey.value = null
    modalDate.value = null
    modalSlot.value = null
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
    removeSlotFromLocalState(date, slot)
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
      await reloadWeek()
      actionError.value = 'Einige Slots konnten nicht gelöscht werden. Bitte versuche es erneut.'
      return
    }
    selectedRecipeBySlot.value = {}
    customTitleBySlot.value = {}
    customSnapshotBySlot.value = {}
    customCaloriesBySlot.value = {}
    suggestionsBySlot.value = {}
    suggestionNoticeBySlot.value = {}
    moveEditorKey.value = null
    modalDate.value = null
    modalSlot.value = null
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
  actionError.value = null
}

function isNotFoundError(error: unknown) {
  return error instanceof ApiClientError && error.status === 404
}

function entryFor(date: string, slot: MealSlot = 'dinner') {
  return week.value?.entries.find(entry => entry.plannedDate === date && normalizedSlot(entry) === slot)
}

function moveOrSwapSucceeded(
  sourceEntry: MealPlanEntryResponse,
  sourceDate: string,
  sourceSlot: MealSlot,
  targetDate: string,
  targetSlot: MealSlot,
  targetEntry?: MealPlanEntryResponse | null,
) {
  const movedEntry = entryFor(targetDate, targetSlot)
  if (movedEntry?.id === sourceEntry.id || entriesRepresentSameMeal(movedEntry, sourceEntry)) return true

  const swappedEntry = entryFor(sourceDate, sourceSlot)
  return Boolean(targetEntry && (swappedEntry?.id === targetEntry.id || entriesRepresentSameMeal(swappedEntry, targetEntry)))
}

function entriesRepresentSameMeal(
  left: MealPlanEntryResponse | null | undefined,
  right: MealPlanEntryResponse | null | undefined,
) {
  const leftKey = mealIdentityKey(left)
  return Boolean(leftKey && leftKey === mealIdentityKey(right))
}

function mealIdentityKey(entry: MealPlanEntryResponse | null | undefined): string {
  if (!entry) return ''
  const recipeId = entry.recipe?.id
  if (recipeId != null) return `recipe:${recipeId}`
  const externalId = entry.externalRecipeId ?? entry.recipe?.externalId
  if (externalId) return `external:${externalId}`
  const title = (entry.customTitle ?? entry.recipe?.title ?? '').trim().toLowerCase()
  return title ? `title:${title}` : ''
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

function openCurrentSwipeBucket() {
  if (!currentSwipeRecipe.value) return
  activeBucket.value = currentSwipeSlot.value
}

function fullBucketWarning(slot: MealSlot) {
  return t('mealPlan.swipe.fullBucketWarning', { slot: slotLabel(slot) })
}

// Opens the add/edit modal for a day+slot — used both for an existing entry
// ("Bearbeiten") and an empty slot (the compact "Noch kein Rezept geplant." trigger).
function startEditSlot(date: string, slot: MealSlot) {
  const entry = entryFor(date, slot)
  const key = slotKey(date, slot)
  moveEditorKey.value = null
  modalDate.value = date
  modalSlot.value = slot
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
  moveEditorKey.value = null
  modalDate.value = null
  modalSlot.value = null
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

  const targetEntry = entryFor(target.date, target.slot)

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
    modalDate.value = null
    modalSlot.value = null
    toastStore.addToast(t('notifications.mealPlanMoved'), 'success')
  } catch {
    await reloadWeek().catch(() => undefined)
    if (moveOrSwapSucceeded(entry, currentDate, currentSlot, target.date, target.slot, targetEntry)) {
      actionError.value = null
      moveEditorKey.value = null
      modalDate.value = null
      modalSlot.value = null
      toastStore.addToast(t('notifications.mealPlanMoved'), 'success')
      return
    }
    actionError.value = t('mealPlan.errors.move')
  }
}

// Native HTML5 drag & drop for planned meals — reuses the same moveEntry API call
// as the manual "Verschieben" form, just driven by drag state instead of a dropdown.
function onSlotDragStart(date: string, slot: MealSlot, event: DragEvent) {
  actionError.value = null
  dragSource.value = { date, slot }
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', slotKey(date, slot))
  }
}

function onSlotDragEnd() {
  dragSource.value = null
  dragOverSlotKey.value = null
}

function onSlotDragOver(date: string, slot: MealSlot, event: DragEvent) {
  if (!dragSource.value) return
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
  dragOverSlotKey.value = slotKey(date, slot)
}

function onSlotDragLeave(date: string, slot: MealSlot) {
  if (dragOverSlotKey.value === slotKey(date, slot)) {
    dragOverSlotKey.value = null
  }
}

async function onSlotDrop(targetDate: string, targetSlot: MealSlot) {
  actionError.value = null
  const source = dragSource.value
  dragOverSlotKey.value = null
  dragSource.value = null
  if (!source) return
  if (source.date === targetDate && source.slot === targetSlot) return

  const sourceEntry = entryFor(source.date, source.slot)
  if (!sourceEntry) return
  const targetEntry = entryFor(targetDate, targetSlot)

  try {
    actionError.value = null
    const updatedWeek = await mealPlanApi.moveEntry(sourceEntry.id, {
      targetDate,
      targetSlot,
      swapIfOccupied: true,
    })
    week.value = updatedWeek
    syncSelectedRecipes(updatedWeek.entries)
    toastStore.addToast(t('notifications.mealPlanMoved'), 'success')
  } catch {
    await reloadWeek().catch(() => undefined)
    if (moveOrSwapSucceeded(sourceEntry, source.date, source.slot, targetDate, targetSlot, targetEntry)) {
      actionError.value = null
      toastStore.addToast(t('notifications.mealPlanMoved'), 'success')
      return
    }
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
  const target = dailyCalorieTarget.value
  if (unknownCount === 0) {
    return target ? `${caloriesForDay(date)} kcal / ${target} kcal` : `${caloriesForDay(date)} kcal`
  }
  if (!target) {
    return knownCalories > 0
      ? `${knownCalories} kcal + ${unknownCount} ${unknownCount === 1 ? 'Mahlzeit' : 'Mahlzeiten'} ohne kcal-Angabe`
      : `${unknownCount} ${unknownCount === 1 ? 'Mahlzeit' : 'Mahlzeiten'} ohne kcal-Angabe`
  }
  if (knownCalories > 0) {
    return unknownCount === 1
      ? t('mealPlan.caloriesWithUnknownOne', { knownSum: knownCalories, count: unknownCount, target })
      : t('mealPlan.caloriesWithUnknown', { knownSum: knownCalories, count: unknownCount, target })
  }
  return unknownCount === 1
    ? t('mealPlan.caloriesUnknownOnlyOne', { count: unknownCount, target })
    : t('mealPlan.caloriesUnknownOnly', { count: unknownCount, target })
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

function removeSlotFromLocalState(date: string, slot: MealSlot) {
  if (week.value) {
    week.value.entries = week.value.entries.filter(entry => !(entry.plannedDate === date && normalizedSlot(entry) === slot))
  }
  selectedRecipeBySlot.value[slotKey(date, slot)] = ''
  customTitleBySlot.value[slotKey(date, slot)] = ''
  customSnapshotBySlot.value[slotKey(date, slot)] = {}
  customCaloriesBySlot.value[slotKey(date, slot)] = null
  if (modalDate.value === date && modalSlot.value === slot) {
    modalDate.value = null
    modalSlot.value = null
  }
  if (moveEditorKey.value === slotKey(date, slot)) {
    moveEditorKey.value = null
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
        suggestionNoticeBySlot.value[key] = t('mealPlan.suggestions.empty')
      }
    } catch {
      if (suggestionRequestIds[key] !== requestId) {
        return
      }
      suggestionsBySlot.value[key] = []
      suggestionNoticeBySlot.value[key] = t('mealPlan.suggestions.error')
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
  suggestionNoticeBySlot.value[key] = t('mealPlan.suggestions.customSaved')
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
      .filter(matchesSwipePreferences)
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
        .filter(matchesSwipePreferences)
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

function recipeSearchText(recipe: RecipeResponse): string {
  return [
    recipe.title,
    recipe.category,
    recipe.ingredients,
    ...(recipe.ingredientsList ?? []),
    recipe.diets,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function textContainsTerm(text: string, term: string): boolean {
  const normalizedTerm = term.trim().toLowerCase()
  if (!normalizedTerm) return false
  return new RegExp(`(^|[^\\p{L}])${escapeRegExp(normalizedTerm)}([^\\p{L}]|$)`, 'u').test(text)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function conflictsWithAllergies(recipe: RecipeResponse, profile: UserPreferencesResponse): boolean {
  const text = recipeSearchText(recipe)
  return profile.allergies.some(allergy =>
    getMatchTerms(allergy, ALLERGEN_ENTRIES).some(term => textContainsTerm(text, term)),
  )
}

function matchesSwipePreferences(recipe: RecipeResponse): boolean {
  const profile = preferences.value
  if (!profile) return true
  if (conflictsWithAllergies(recipe, profile)) return false

  if (profile.vegan && recipe.vegan === false) return false
  if (profile.vegetarian && recipe.vegetarian === false && recipe.vegan === false) return false
  if (profile.glutenFree && recipe.glutenFree === false) return false

  return true
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

async function saveSwipeSuggestionAt(suggestion: RecipeResponse, date: string, slot: MealSlot) {
  return suggestion.source === 'dishly' && Number.isFinite(Number(suggestion.id))
    ? mealPlanApi.setSlot(date, slot, Number(suggestion.id))
    : mealPlanApi.setSlot(date, slot, {
      customTitle: suggestion.title,
      caloriesSnapshot: suggestion.calories ?? null,
      proteinSnapshot: suggestion.protein ?? null,
      imageUrlSnapshot: suggestion.imageUrl ?? null,
      externalRecipeId: suggestion.externalId ? String(suggestion.externalId) : suggestion.id ? String(suggestion.id) : null,
      externalSource: suggestion.source ?? 'dishly-public',
    })
}

function advanceSwipeSuggestion() {
  if (swipeIndex.value < swipeSuggestions.value.length - 1) {
    swipeIndex.value += 1
  }
}

async function acceptSwipeSuggestion() {
  const suggestion = currentSwipeRecipe.value
  if (!suggestion) {
    swipeError.value = t('mealPlan.swipe.noSuggestion')
    return
  }
  const slot = slotForRecipe(suggestion)
  const date = firstFreeDateForSlot(slot)
  if (!date) {
    swipeError.value = allBucketsFull.value
      ? 'Glückwunsch! Deine Woche ist vollständig geplant.'
      : fullBucketWarning(slot)
    return
  }

  try {
    swipeError.value = null
    const saved = await saveSwipeSuggestionAt(suggestion, date, slot)
    upsertEntry(saved)
    syncSlotState(saved)
    toastStore.addToast(t('notifications.swipePlanned', { title: suggestion.title }), 'success')
    advanceSwipeSuggestion()
  } catch {
    swipeError.value = t('mealPlan.swipe.acceptError')
  }
}

async function replaceWithCurrentSwipeSuggestion(date: string, slot: MealSlot) {
  const suggestion = currentSwipeRecipe.value
  if (!suggestion) {
    swipeError.value = t('mealPlan.swipe.noSuggestion')
    return
  }

  try {
    swipeError.value = null
    await mealPlanApi.deleteSlot(date, slot)
    removeSlotFromLocalState(date, slot)
    const saved = await saveSwipeSuggestionAt(suggestion, date, slot)
    upsertEntry(saved)
    syncSlotState(saved)
    toastStore.addToast(t('notifications.swipePlanned', { title: suggestion.title }), 'success')
    activeBucket.value = null
    advanceSwipeSuggestion()
  } catch {
    swipeError.value = t('mealPlan.swipe.replaceError')
    toastStore.addToast(t('mealPlan.swipe.replaceError'), 'error')
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
  if (!dailyCalorieTarget.value) return 'good'
  const calories = caloriesForDay(date)
  if (calories <= dailyCalorieTarget.value) return 'good'
  if (calories <= dailyCalorieTarget.value + 200) return 'warning'
  return 'over'
}

function calorieProgress(date: string) {
  if (!dailyCalorieTarget.value) return 0
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
  return t(`mealPlan.slots.${slot}`)
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
      <div class="mode-switch full-width" :aria-label="t('mealPlan.planningMode.label')">
        <button type="button" :class="{ active: planningMode === 'manual' }" @click="planningMode = 'manual'">
          {{ t('mealPlan.planningMode.manual') }}
        </button>
        <button type="button" :class="{ active: planningMode === 'swipe' }" @click="planningMode = 'swipe'">
          {{ t('mealPlan.planningMode.swipe') }}
        </button>
      </div>

      <div v-if="planningMode === 'manual'" class="week-summary full-width">
        <div class="week-stats">
          <div class="week-stat">
            <span class="week-stat-label">{{ t('mealPlan.stats.averagePerDay') }}</span>
            <span class="week-stat-value">
              {{ hasDailyCalorieTarget ? `${averageCaloriesPerDay} / ${dailyCalorieTarget} kcal` : `${averageCaloriesPerDay} kcal` }}
            </span>
          </div>
          <div v-if="hasDailyCalorieTarget" class="week-stat">
            <span class="week-stat-label">{{ t('mealPlan.stats.difference') }}</span>
            <span class="week-stat-value" :class="{ over: calorieDelta > 0, under: calorieDelta < 0 }">
              {{ calorieDelta > 0 ? '+' : '' }}{{ calorieDelta }} kcal
            </span>
          </div>
          <p class="week-hint">{{ weeklyRecommendation }}</p>
        </div>
        <p v-if="weekUnknownCaloriesCount > 0" class="hint calorie-unknown-hint">
          {{ weekUnknownCaloriesCount === 1 ? t('mealPlan.weekUnknownCaloriesHintOne', { count: weekUnknownCaloriesCount }) : t('mealPlan.weekUnknownCaloriesHint', { count: weekUnknownCaloriesCount }) }}
        </p>
        <div class="week-actions">
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
      </div>


      <section v-if="planningMode === 'swipe'" class="swipe-planner full-width" :aria-label="t('mealPlan.swipe.title')">
        <div class="swipe-controls">
          <div>
            <h2>{{ t('mealPlan.swipe.title') }}</h2>
            <p>{{ t('mealPlan.swipe.description') }}</p>
          </div>
          <button
            v-if="!allBucketsFull"
            type="button"
            class="primary-button"
            :disabled="swipeLoading"
            @click="loadSwipeSuggestions"
          >
            {{ swipeLoading ? t('mealPlan.swipe.loading') : t('mealPlan.swipe.load') }}
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
              <p>{{ t('mealPlan.swipe.bucketProgress', { count: bucketCounts[activeBucket], limit: BUCKET_LIMIT, calories: totalCaloriesForBucket(activeBucket) }) }}</p>
            </div>
            <button type="button" class="secondary-button" @click="activeBucket = null">{{ t('mealPlan.actions.close') }}</button>
          </div>

          <p v-if="activeBucket === currentSwipeSlot && currentSwipeRecipe" class="bucket-current-suggestion">
            {{ t('mealPlan.swipe.currentSuggestion') }}: <strong>{{ currentSwipeRecipe.title }}</strong>
          </p>
          <p v-if="entriesForBucket(activeBucket).length === 0" class="empty-day">
            {{ t('mealPlan.swipe.emptyBucket') }}
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
              <div class="bucket-entry-actions">
                <button type="button" class="secondary-button" @click="removeDay(item.day.date, activeBucket)">
                  {{ t('mealPlan.actions.remove') }}
                </button>
                <button
                  v-if="activeBucket === currentSwipeSlot && currentSwipeRecipe"
                  type="button"
                  class="primary-button"
                  @click="replaceWithCurrentSwipeSuggestion(item.day.date, activeBucket)"
                >
                  {{ t('mealPlan.swipe.replaceWithCurrent') }}
                </button>
              </div>
            </li>
          </ul>
        </section>

        <p v-if="swipeError && swipeError !== currentSwipeBucketWarning" class="status-text error">{{ swipeError }}</p>
        <div v-if="allBucketsFull" class="completion-card">
          <h3>{{ t('mealPlan.swipe.completeTitle') }}</h3>
          <p>{{ t('mealPlan.swipe.completeBody') }}</p>
          <button type="button" class="secondary-button" @click="planningMode = 'manual'">
            {{ t('mealPlan.swipe.manageRecipes') }}
          </button>
        </div>

        <div v-if="currentSwipeBucketWarning" class="swipe-bucket-warning" aria-live="polite">
          <p>{{ currentSwipeBucketWarning }}</p>
          <button type="button" class="secondary-button" @click="openCurrentSwipeBucket">
            {{ t('mealPlan.swipe.editBucket') }}
          </button>
        </div>

        <article v-if="currentSwipeRecipe && !allBucketsFull" class="swipe-card">
          <button
            type="button"
            class="secondary-button swipe-action swipe-action-reject"
            :aria-label="t('mealPlan.swipe.skip')"
            @click="skipSwipeSuggestion"
          >
            X
          </button>

          <div class="swipe-recipe-card">
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
                {{ t('mealPlan.swipe.externalFreestyle') }}
              </p>
              <p class="suggestion-state">
                {{ t('mealPlan.swipe.targetPrefix') }}: <strong>{{ slotLabel(currentSwipeSlot) }}</strong>
                <span v-if="currentSwipeTargetDate"> {{ t('mealPlan.swipe.targetDate', { date: currentSwipeTargetDate }) }}</span>
                <span v-else> - {{ t('mealPlan.swipe.bucketFull') }}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            class="primary-button swipe-action swipe-action-accept"
            :aria-label="t('mealPlan.swipe.accept')"
            @click="acceptSwipeSuggestion"
          >
            ♥
          </button>
        </article>
      </section>

      <template v-if="planningMode === 'manual'">
      <div class="week-days-row full-width">
      <article v-for="day in weekDays" :key="day.date" class="day-card">
        <div class="day-card-header">
          <h2>{{ t(day.labelKey) }}</h2>
          <span class="day-card-date">{{ day.date }}</span>
          <span class="day-card-kcal">{{ caloriesSummaryText(day.date) }}</span>
        </div>
        <div class="calorie-meter" :class="caloriesStatusClass(day.date)">
          <span :style="{ width: `${calorieProgress(day.date)}%` }"></span>
        </div>
        <p v-if="caloriesSummaryForDay(day.date).unknownCount > 0" class="hint calorie-unknown-hint">
          {{ t('mealPlan.unknownCaloriesHint') }}
        </p>

        <div
          v-for="slot in mealSlots"
          :key="slot.key"
          class="slot-block"
          :class="{ 'drop-target-active': dragOverSlotKey === slotKey(day.date, slot.key) }"
          @dragover="onSlotDragOver(day.date, slot.key, $event)"
          @dragleave="onSlotDragLeave(day.date, slot.key)"
          @drop.prevent="onSlotDrop(day.date, slot.key)"
        >
          <h3>{{ t(slot.labelKey) }}</h3>

          <div
            v-if="entryFor(day.date, slot.key)"
            class="planned-recipe compact"
            draggable="true"
            :class="{ dragging: dragSource && dragSource.date === day.date && dragSource.slot === slot.key }"
            @dragstart="onSlotDragStart(day.date, slot.key, $event)"
            @dragend="onSlotDragEnd"
          >
            <span class="planned-label">{{ t('mealPlan.plannedRecipe') }}</span>
            <strong>{{ entryTitle(entryFor(day.date, slot.key)!) }}</strong>
            <div class="planned-meta">
              <span v-if="entryCalories(entryFor(day.date, slot.key))">
                {{ entryCalories(entryFor(day.date, slot.key)) }} kcal
              </span>
              <span v-if="entryProtein(entryFor(day.date, slot.key))">
                {{ formatProtein(entryProtein(entryFor(day.date, slot.key))) }}
              </span>
              <span v-if="!entryFor(day.date, slot.key)?.recipe?.id">{{ t('mealPlan.customEntry') }}</span>
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
                {{ t('mealPlan.actions.edit') }}
              </button>
              <button type="button" class="secondary-button" @click="removeDay(day.date, slot.key)">
                {{ t('mealPlan.actions.remove') }}
              </button>
            </div>
          </div>

          <button
            v-else
            type="button"
            class="slot-empty-trigger"
            @click="startEditSlot(day.date, slot.key)"
          >
            <span class="empty-day">{{ t('mealPlan.empty.day') }}</span>
            <span class="slot-add-hint">{{ t('mealPlan.form.chooseRecipe') }}</span>
          </button>
        </div>
      </article>
      </div>

      <Transition name="slot-modal">
        <div
          v-if="modalDate && modalSlot"
          class="slot-modal-overlay"
          @click.self="cancelEditSlot(modalDate!, modalSlot!)"
        >
          <div class="slot-modal">
            <div class="slot-modal-header">
              <div>
                <h2 class="slot-modal-title">
                  {{ t('mealPlan.modal.title', { slot: t(mealSlots.find(s => s.key === modalSlot)!.labelKey) }) }}
                </h2>
                <p class="slot-modal-subtitle">{{ modalDayLabel }} · {{ modalDate }}</p>
              </div>
              <button
                type="button"
                class="slot-modal-close"
                :aria-label="t('mealPlan.actions.close')"
                @click="cancelEditSlot(modalDate!, modalSlot!)"
              >
                ✕
              </button>
            </div>

            <div v-if="entryFor(modalDate!, modalSlot!)" class="planned-recipe edit-summary">
              <span class="planned-label">{{ t('mealPlan.actions.edit') }}</span>
              <strong>{{ entryTitle(entryFor(modalDate!, modalSlot!)!) }}</strong>
              <div class="planned-meta">
                <span v-if="entryCalories(entryFor(modalDate!, modalSlot!))">
                  {{ entryCalories(entryFor(modalDate!, modalSlot!)) }} kcal
                </span>
                <span v-if="entryProtein(entryFor(modalDate!, modalSlot!))">
                  {{ formatProtein(entryProtein(entryFor(modalDate!, modalSlot!))) }}
                </span>
              </div>
            </div>

            <label class="recipe-select">
              <span>{{ t('mealPlan.form.searchOrCustom') }}</span>
              <input
                v-model="customTitleBySlot[slotKey(modalDate!, modalSlot!)]"
                type="text"
                :placeholder="t('mealPlan.form.searchOrCustomPlaceholder')"
                @input="onSlotSearch(modalDate!, modalSlot!)"
              />
            </label>
            <label
              v-if="!selectedRecipeBySlot[slotKey(modalDate!, modalSlot!)]"
              class="recipe-select slot-calories-input"
            >
              <span>{{ t('mealPlan.form.calories') }}</span>
              <input
                v-model.number="customCaloriesBySlot[slotKey(modalDate!, modalSlot!)]"
                type="number"
                min="0"
                :placeholder="t('mealPlan.form.caloriesPlaceholder')"
              />
            </label>
            <p v-if="suggestionLoadingBySlot[slotKey(modalDate!, modalSlot!)]" class="suggestion-state">
              {{ t('mealPlan.swipe.loading') }}
            </p>
            <ul v-if="suggestionsBySlot[slotKey(modalDate!, modalSlot!)]?.length" class="suggestion-list">
              <li
                v-for="suggestion in suggestionsBySlot[slotKey(modalDate!, modalSlot!)]"
                :key="`${suggestion.source}-${suggestion.id}`"
              >
                <button type="button" @click="chooseSuggestion(modalDate!, modalSlot!, suggestion)">
                  <img v-if="suggestion.imageUrl" :src="suggestion.imageUrl" :alt="suggestion.title" class="suggestion-thumb" />
                  <span class="suggestion-info">
                    <span>{{ suggestion.title }}</span>
                    <small>{{ suggestion.planAsRecipe ? t('mealPlan.swipe.dishlyRecipe') : t('mealPlan.swipe.customSuggestion') }}</small>
                    <small v-if="suggestion.calories || suggestion.protein">
                      <span v-if="suggestion.calories">{{ suggestion.calories }} kcal</span>
                      <span v-if="suggestion.calories && suggestion.protein"> · </span>
                      <span v-if="suggestion.protein">{{ Math.round(suggestion.protein) }} g Protein</span>
                    </small>
                  </span>
                </button>
              </li>
            </ul>
            <p v-if="suggestionNoticeBySlot[slotKey(modalDate!, modalSlot!)]" class="suggestion-state">
              {{ suggestionNoticeBySlot[slotKey(modalDate!, modalSlot!)] }}
            </p>

            <div class="actions">
              <button type="button" class="primary-button" @click="saveDay(modalDate!, modalSlot!)">
                {{ entryFor(modalDate!, modalSlot!) ? t('mealPlan.actions.save') : t('mealPlan.actions.add') }}
              </button>
              <button
                type="button"
                class="secondary-button"
                @click="cancelEditSlot(modalDate!, modalSlot!)"
              >
                {{ t('mealPlan.actions.cancel') }}
              </button>
              <button
                v-if="entryFor(modalDate!, modalSlot!)"
                type="button"
                class="secondary-button"
                @click="openMoveEditor(modalDate!, modalSlot!)"
              >
                {{ t('mealPlan.actions.move') }}
              </button>
              <button
                v-if="entryFor(modalDate!, modalSlot!)"
                type="button"
                class="secondary-button"
                @click="removeDay(modalDate!, modalSlot!)"
              >
                {{ t('mealPlan.actions.remove') }}
              </button>
            </div>

            <form
              v-if="moveEditorKey === slotKey(modalDate!, modalSlot!)"
              class="move-form"
              @submit.prevent="moveEntry(modalDate!, modalSlot!)"
            >
              <label>
                <span>{{ t('mealPlan.form.targetDay') }}</span>
                <select v-model="moveTargetFor(modalDate!, modalSlot!).date">
                  <option v-for="targetDay in weekDays" :key="targetDay.date" :value="targetDay.date">
                    {{ t(targetDay.labelKey) }} · {{ targetDay.date }}
                  </option>
                </select>
              </label>
              <label>
                <span>{{ t('mealPlan.form.targetSlot') }}</span>
                <select v-model="moveTargetFor(modalDate!, modalSlot!).slot">
                  <option v-for="targetSlot in mealSlots" :key="targetSlot.key" :value="targetSlot.key">
                    {{ t(targetSlot.labelKey) }}
                  </option>
                </select>
              </label>
              <p
                v-if="isMoveTargetOccupied(modalDate!, modalSlot!)"
                class="suggestion-state"
              >
                {{ t('mealPlan.messages.targetOccupiedSwap') }}
              </p>
              <div class="move-actions">
                <button type="submit" class="primary-button">{{ t('mealPlan.actions.moveSave') }}</button>
                <button type="button" class="secondary-button" @click="cancelMove">{{ t('mealPlan.actions.cancel') }}</button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
      </template>
    </section>
  </section>
</template>

<style scoped>
.meal-plan-page {
  width: 100%;
  max-width: 1400px;
  margin: 32px auto 48px auto;
  padding: 0 24px;
  box-sizing: border-box;
}

.meal-plan-header {
  background: var(--pink-bg, #fdf1f5);
  border-radius: var(--radius-card, 18px);
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  padding: 26px 32px;
  margin-bottom: 26px;
}

.eyebrow {
  color: var(--pink, #e85a9b);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin: 0 0 6px 0;
}

.meal-plan-header h1 {
  margin: 0 0 6px 0;
  color: var(--pink-dark, #d44488);
  font-size: 2rem;
}

.meal-plan-header p {
  color: var(--text-gray, #6b7478);
}

.week-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Keeps the seven day cards in a single horizontal row at all viewport widths,
   scrolling instead of wrapping when there isn't enough space. */
.week-days-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 16px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.mode-switch {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(180px, 1fr));
}

.mode-switch button {
  background: #ffffff;
  border: 1.5px solid var(--line, #e6ecea);
  border-radius: var(--radius-pill, 999px);
  color: var(--text-gray, #6b7478);
  cursor: pointer;
  font: inherit;
  font-size: 1rem;
  font-weight: 700;
  padding: 16px;
  transition: background 0.16s ease, color 0.16s ease, border-color 0.16s ease;
}

.mode-switch button:hover:not(.active) {
  border-color: var(--mint, #5ecbb5);
  color: var(--mint-darker, #2b8c7b);
}

.mode-switch button.active {
  background: var(--pink, #e85a9b);
  border-color: var(--pink, #e85a9b);
  color: #ffffff;
}

.day-card {
  background: #ffffff;
  border-radius: var(--radius-card, 18px);
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 220px;
  flex-shrink: 0;
}

.day-card-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.day-card-header h2 {
  color: var(--text-dark, #2e3437);
  font-size: 1.05rem;
  margin: 0;
}

.day-card-date {
  color: var(--text-light, #9aa2a5);
  font-size: 0.78rem;
}

.day-card-kcal {
  color: var(--text-gray, #6b7478);
  font-size: 0.85rem;
  margin-top: 4px;
}

.calorie-meter {
  background: var(--line, #e6ecea);
  border-radius: var(--radius-pill, 999px);
  height: 8px;
  overflow: hidden;
}

.calorie-meter span {
  display: block;
  height: 100%;
  transition: width 0.3s ease;
}

.calorie-meter.good span {
  background: var(--mint, #5ecbb5);
}

.calorie-meter.warning span {
  background: var(--gold, #f0b73d);
}

.calorie-meter.over span {
  background: var(--pink, #e85a9b);
}

.slot-block {
  border-top: 1px solid var(--line, #e6ecea);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 10px;
  transition: background-color 0.16s ease, box-shadow 0.16s ease;
}

/* Drop target highlight while dragging a planned meal over this slot. */
.slot-block.drop-target-active {
  background: var(--mint-bg, #ecfaf6);
  outline: 2px dashed var(--mint, #5ecbb5);
  outline-offset: -2px;
}

.slot-block h3 {
  color: var(--pink, #e85a9b);
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin: 0;
}

.planned-recipe {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-wrap: anywhere;
}

.planned-recipe.compact {
  cursor: grab;
  transition: opacity 0.16s ease;
}

.planned-recipe.compact.dragging {
  opacity: 0.5;
}

.planned-actions,
.move-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}

/* Compact, click-to-plan trigger replacing the always-visible inline form for
   an empty slot — opens the add/search modal instead. */
.slot-empty-trigger {
  align-items: flex-start;
  background: var(--mint-bg, #ecfaf6);
  border: 1.5px dashed var(--line, #e6ecea);
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  font: inherit;
  gap: 2px;
  padding: 8px 10px;
  text-align: left;
  transition: border-color 0.16s ease, background 0.16s ease;
  width: 100%;
}

.slot-empty-trigger:hover {
  background: var(--mint, #5ecbb5);
  border-color: var(--mint, #5ecbb5);
}

.slot-empty-trigger:hover .empty-day,
.slot-empty-trigger:hover .slot-add-hint {
  color: #ffffff;
}

.slot-empty-trigger .slot-add-hint {
  color: var(--mint-darker, #2b8c7b);
  font-size: 0.8rem;
  font-weight: 700;
  transition: color 0.16s ease;
}

.planned-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.planned-meta span {
  background: var(--mint-bg, #ecfaf6);
  border-radius: var(--radius-pill, 999px);
  color: var(--mint-darker, #2b8c7b);
  font-size: 0.78rem;
  font-weight: 700;
  padding: 4px 10px;
  width: fit-content;
}

.planned-link {
  text-decoration: none;
}

.move-form {
  border-top: 1px solid var(--line, #e6ecea);
  display: grid;
  gap: 10px;
  margin-top: 10px;
  padding-top: 10px;
}

.move-form label {
  color: var(--text-dark, #2e3437);
  display: grid;
  gap: 5px;
  font-weight: 700;
}

.move-form select {
  background: #ffffff;
  border: 1.5px solid var(--line, #e6ecea);
  border-radius: 10px;
  font: inherit;
  min-height: 40px;
  padding: 8px 10px;
  width: 100%;
}

.planned-label {
  color: var(--mint-darker, #2b8c7b);
  font-size: 0.8rem;
  font-weight: 700;
}

.empty-day {
  color: var(--text-light, #9aa2a5);
  margin: 0;
}

.recipe-select {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--text-dark, #2e3437);
  font-weight: 700;
}

.recipe-select select,
.recipe-select input {
  min-height: 40px;
  border: 1.5px solid var(--line, #e6ecea);
  border-radius: 10px;
  padding: 8px 10px;
  background: #ffffff;
  font: inherit;
  width: 100%;
  outline: none;
  transition: border-color 0.16s ease;
}

.recipe-select select:focus,
.recipe-select input:focus {
  border-color: var(--mint, #5ecbb5);
}

.suggestion-list {
  display: grid;
  gap: 6px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.suggestion-list button {
  align-items: center;
  background: var(--mint-bg, #ecfaf6);
  border: none;
  border-radius: 10px;
  color: var(--text-dark, #2e3437);
  cursor: pointer;
  display: flex;
  font: inherit;
  gap: 10px;
  padding: 6px 10px;
  text-align: left;
  width: 100%;
  overflow-wrap: anywhere;
  transition: background 0.16s ease;
}

.suggestion-list button:hover {
  background: var(--mint, #5ecbb5);
  color: #ffffff;
}

.suggestion-thumb {
  border-radius: 8px;
  flex-shrink: 0;
  height: 36px;
  object-fit: cover;
  width: 36px;
}

.suggestion-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.suggestion-list small,
.suggestion-state {
  color: var(--text-gray, #6b7478);
  font-size: 0.82rem;
  margin: 0;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: auto;
}

/* Add/edit slot modal — opened by the compact slot trigger, replaces the old
   always-visible inline form so day cards stay short. */
.slot-modal-overlay {
  align-items: center;
  background: rgba(46, 52, 55, 0.4);
  display: flex;
  inset: 0;
  justify-content: center;
  padding: 24px;
  position: fixed;
  z-index: 1000;
}

.slot-modal {
  background: #ffffff;
  border-radius: var(--radius-card, 18px);
  box-shadow: var(--shadow-pop, 0 16px 48px rgba(46, 52, 55, 0.16));
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 85vh;
  overflow-y: auto;
  padding: 26px;
  width: min(440px, 100%);
}

.slot-modal-header {
  align-items: flex-start;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.slot-modal-title {
  color: var(--pink-dark, #d44488);
  font-size: 1.25rem;
  margin: 0 0 4px;
}

.slot-modal-subtitle {
  color: var(--text-gray, #6b7478);
  font-size: 0.9rem;
  margin: 0;
}

.slot-modal-close {
  background: var(--mint-bg, #ecfaf6);
  border: none;
  border-radius: 50%;
  color: var(--mint-darker, #2b8c7b);
  cursor: pointer;
  flex-shrink: 0;
  font-size: 1rem;
  height: 32px;
  width: 32px;
}

.slot-modal-enter-active,
.slot-modal-leave-active {
  transition: opacity 0.18s ease;
}

.slot-modal-enter-from,
.slot-modal-leave-to {
  opacity: 0;
}

.week-summary {
  align-items: center;
  background: #ffffff;
  border-radius: var(--radius-card, 18px);
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  color: var(--text-gray, #6b7478);
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  justify-content: space-between;
  padding: 18px 22px;
}

.week-summary p {
  color: var(--text-gray, #6b7478);
  margin: 4px 0 0;
}

.week-stats {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

.week-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.week-stat-label {
  color: var(--text-light, #9aa2a5);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.week-stat-value {
  color: var(--text-dark, #2e3437);
  font-size: 1.05rem;
  font-weight: 700;
}

.week-stat-value.over {
  color: var(--pink, #e85a9b);
}

.week-stat-value.under {
  color: var(--mint-darker, #2b8c7b);
}

.week-summary p.week-hint {
  background: var(--mint-bg, #ecfaf6);
  border-radius: var(--radius-pill, 999px);
  color: var(--mint-darker, #2b8c7b);
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0;
  padding: 8px 16px;
}

.week-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.swipe-planner {
  background: #ffffff;
  border-radius: var(--radius-card, 18px);
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  display: grid;
  gap: 16px;
  padding: 22px;
}

.swipe-controls {
  align-items: end;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(220px, 1fr) minmax(150px, auto);
}

.swipe-controls h2 {
  color: var(--pink-dark, #d44488);
  margin: 0 0 4px 0;
}

.swipe-controls p {
  color: var(--text-gray, #6b7478);
  margin: 0;
}

.bucket-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr));
}

.bucket-card {
  background: var(--mint-bg, #ecfaf6);
  border: none;
  border-radius: 14px;
  color: var(--mint-darker, #2b8c7b);
  cursor: pointer;
  display: flex;
  font: inherit;
  font-weight: 600;
  justify-content: space-between;
  padding: 14px;
  text-align: left;
  min-height: 44px;
  transition: box-shadow 0.16s ease;
}

.bucket-card.full {
  background: var(--pink-light, #fdeef5);
  color: var(--pink-dark, #d44488);
}

.bucket-card.active {
  box-shadow: 0 0 0 3px rgba(232, 90, 155, 0.25);
}

.bucket-panel,
.swipe-bucket-warning,
.completion-card {
  background: var(--pink-bg, #fdf1f5);
  border-radius: 14px;
  display: grid;
  gap: 12px;
  padding: 18px;
}

.swipe-bucket-warning {
  align-items: center;
  grid-template-columns: minmax(0, 1fr) auto;
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
  color: var(--pink-dark, #d44488);
  margin: 0 0 4px 0;
}

.bucket-panel p,
.swipe-bucket-warning p,
.completion-card p {
  color: var(--text-gray, #6b7478);
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
  border-radius: 12px;
  box-shadow: var(--shadow-sm, 0 2px 10px rgba(61, 174, 155, 0.06));
  padding: 10px 14px;
  overflow-wrap: anywhere;
}

.bucket-current-suggestion {
  background: #ffffff;
  border-radius: var(--radius-pill, 999px);
  color: var(--pink-dark, #d44488);
  font-weight: 700;
  padding: 8px 14px;
  width: fit-content;
}

.bucket-entry-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.swipe-card {
  align-items: center;
  display: grid;
  gap: 18px;
  grid-template-columns: 76px minmax(0, 560px) 76px;
  justify-content: center;
  min-width: 0;
}

.swipe-recipe-card {
  background: #ffffff;
  border-radius: var(--radius-card, 18px);
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  display: grid;
  grid-template-columns: minmax(140px, 220px) 1fr;
  overflow: hidden;
  min-width: 0;
}

.swipe-recipe-card img {
  height: 100%;
  min-height: 180px;
  object-fit: cover;
  width: 100%;
}

.swipe-action-reject {
  border-color: var(--pink-light, #fdeef5);
  color: var(--pink-dark, #d44488);
}

.swipe-action-reject:hover:not(:disabled) {
  background: var(--pink-light, #fdeef5);
  color: var(--pink-dark, #d44488);
}

.swipe-action-accept {
  box-shadow: 0 10px 24px rgba(232, 90, 155, 0.24);
  font-size: 1.9rem;
}

.swipe-card-content {
  display: grid;
  gap: 10px;
  padding: 18px;
}

.swipe-card-content h3 {
  color: var(--text-dark, #2e3437);
  font-size: 1.25rem;
  margin: 0;
  overflow-wrap: anywhere;
}

.progress-pill,
.swipe-meta span,
.tag-list span {
  background: var(--mint-bg, #ecfaf6);
  border-radius: var(--radius-pill, 999px);
  color: var(--mint-darker, #2b8c7b);
  display: inline-flex;
  font-size: 0.86rem;
  font-weight: 700;
  padding: 5px 12px;
  width: fit-content;
}

.swipe-meta,
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-list span {
  background: var(--pink-light, #fdeef5);
  color: var(--pink-dark, #d44488);
}

.primary-button,
.secondary-button,
.clear-week-button {
  border-radius: var(--radius-pill, 999px);
  min-height: 44px;
  padding: 10px 18px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.16s ease, color 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
}

.primary-button {
  background: var(--pink, #e85a9b);
  border: none;
  color: #ffffff;
}

.primary-button:hover:not(:disabled) {
  background: var(--pink-dark, #d44488);
  transform: translateY(-1px);
}

.primary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.secondary-button,
.clear-week-button {
  background: #ffffff;
  border: 1.5px solid var(--mint, #5ecbb5);
  color: var(--mint-darker, #2b8c7b);
}

.secondary-button:hover:not(:disabled),
.clear-week-button:hover:not(:disabled) {
  background: var(--mint, #5ecbb5);
  color: #ffffff;
}

.swipe-card .swipe-action {
  align-items: center;
  border-radius: 50%;
  display: inline-flex;
  font-size: 1.6rem;
  height: 72px;
  justify-content: center;
  line-height: 1;
  min-height: 72px;
  padding: 0;
  width: 72px;
}

.clear-week-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-text {
  text-align: center;
  color: var(--text-gray, #6b7478);
  margin: 20px 0;
}

.status-text.error {
  color: var(--pink-dark, #d44488);
  font-weight: 700;
}

.status-text.success {
  color: var(--mint-darker, #2b8c7b);
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

  .slot-modal-overlay {
    padding: 12px;
  }

  .slot-modal {
    padding: 20px;
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

  .swipe-card {
    gap: 12px;
    justify-items: center;
  }

  .swipe-bucket-warning {
    grid-template-columns: 1fr;
  }

  .swipe-bucket-warning .secondary-button {
    width: 100%;
  }

  .swipe-recipe-card {
    grid-row: 1;
    grid-template-columns: 1fr;
    width: 100%;
  }

  .swipe-card .swipe-action {
    height: 58px;
    min-height: 58px;
    width: 58px;
  }

  .swipe-action-reject {
    grid-column: 1;
    grid-row: 2;
    justify-self: start;
  }

  .swipe-action-accept {
    grid-column: 1;
    grid-row: 2;
    justify-self: end;
  }

  .bucket-panel-header,
  .bucket-entry-list li {
    align-items: stretch;
    flex-direction: column;
  }

  .bucket-entry-actions {
    justify-content: stretch;
  }

  .bucket-entry-actions .primary-button,
  .bucket-entry-actions .secondary-button {
    width: 100%;
  }

  .swipe-recipe-card img {
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

  .planned-actions > .secondary-button {
    justify-content: center;
    text-align: center;
    width: 100%;
  }

  .primary-button,
  .secondary-button,
  .clear-week-button {
    width: 100%;
  }
}
</style>
