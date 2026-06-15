<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiClientError } from '@/shared/api/apiClient'
import { mealPlanApi } from '@/shared/api/mealPlanApi'
import { recipeApi } from '@/shared/api/recipeApi'
import { profileApi } from '@/shared/api/profileApi'
import type { MealPlanEntryResponse, MealPlanWeekResponse, MealSlot } from '@/types/mealPlan'
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
}

const { t } = useI18n()

const loading = ref(true)
const error = ref<string | null>(null)
const actionError = ref<string | null>(null)
const week = ref<MealPlanWeekResponse | null>(null)
const recipes = ref<RecipeResponse[]>([])
const planningMode = ref<'manual' | 'swipe'>('manual')
const selectedRecipeBySlot = ref<Record<string, string>>({})
const customTitleBySlot = ref<Record<string, string>>({})
const suggestionsBySlot = ref<Record<string, SlotSuggestion[]>>({})
const suggestionLoadingBySlot = ref<Record<string, boolean>>({})
const suggestionNoticeBySlot = ref<Record<string, string>>({})
const suggestionTimers: Record<string, ReturnType<typeof setTimeout>> = {}
const preferences = ref<UserPreferencesResponse | null>(null)
const swipeSuggestions = ref<RecipeResponse[]>([])
const swipeIndex = ref(0)
const swipeLoading = ref(false)
const swipeError = ref<string | null>(null)
const swipeMessage = ref<string | null>(null)
const actionMessage = ref<string | null>(null)
const activeBucket = ref<MealSlot | null>(null)

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
const currentSwipeSlot = computed<MealSlot>(() => slotForRecipe(currentSwipeRecipe.value))
const currentSwipeTargetDate = computed(() => firstFreeDateForSlot(currentSwipeSlot.value))
const bucketCounts = computed<Record<MealSlot, number>>(() => ({
  breakfast: countEntriesForSlot('breakfast'),
  lunch: countEntriesForSlot('lunch'),
  dinner: countEntriesForSlot('dinner'),
  snack: countEntriesForSlot('snack'),
}))
const allBucketsFull = computed(() => mealSlots.every(slot => bucketCounts.value[slot.key] >= 7))

onMounted(() => {
  loadData()
})

async function loadData() {
  loading.value = true
  error.value = null
  actionError.value = null

  try {
    const [loadedWeek, ownRecipes] = await Promise.all([
      mealPlanApi.getWeek(),
      recipeApi.getMyRecipes(),
    ])
    week.value = loadedWeek
    recipes.value = ownRecipes
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
    actionMessage.value = null
    const saved = recipeId
      ? await mealPlanApi.setSlot(date, slot, Number(recipeId))
      : await mealPlanApi.setSlot(date, slot, { customTitle })
    upsertEntry(saved)
    selectedRecipeBySlot.value[key] = saved.recipe ? String(saved.recipe.id) : ''
    customTitleBySlot.value[key] = entryTitle(saved)
    suggestionsBySlot.value[key] = []
    suggestionNoticeBySlot.value[key] = ''
  } catch {
    actionError.value = t('mealPlan.errors.save')
  }
}

async function removeDay(date: string, slot: MealSlot = 'dinner') {
  try {
    actionError.value = null
    actionMessage.value = null
    await mealPlanApi.deleteSlot(date, slot)
    if (week.value) {
      week.value.entries = week.value.entries.filter(entry => !(entry.plannedDate === date && normalizedSlot(entry) === slot))
    }
    selectedRecipeBySlot.value[slotKey(date, slot)] = ''
    customTitleBySlot.value[slotKey(date, slot)] = ''
    actionMessage.value = 'Rezept wurde aus dem Wochenplan entfernt.'
  } catch {
    actionError.value = t('mealPlan.errors.remove')
  }
}

async function clearWeek() {
  const allSlotTargets = weekDays.value.flatMap(day => mealSlots.map(slot => ({ date: day.date, slot: slot.key })))
  if (!week.value?.entries.length) {
    actionMessage.value = 'Die Woche ist bereits leer.'
    return
  }
  try {
    actionError.value = null
    actionMessage.value = null
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
    suggestionsBySlot.value = {}
    suggestionNoticeBySlot.value = {}
    await reloadWeek()
    actionMessage.value = 'Die Woche wurde geleert.'
  } catch {
    actionError.value = t('mealPlan.errors.remove')
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

function caloriesForDay(date: string) {
  return (week.value?.entries ?? [])
    .filter(entry => entry.plannedDate === date)
    .reduce((sum, entry) => sum + (entry.recipe?.calories ?? 0), 0)
}

function syncSelectedRecipes(entries: MealPlanEntryResponse[]) {
  selectedRecipeBySlot.value = Object.fromEntries(
    entries.map(entry => [slotKey(entry.plannedDate, normalizedSlot(entry)), entry.recipe ? String(entry.recipe.id) : '']),
  )
  customTitleBySlot.value = Object.fromEntries(
    entries.map(entry => [slotKey(entry.plannedDate, normalizedSlot(entry)), entryTitle(entry)]),
  )
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

function normalizedSlot(entry: MealPlanEntryResponse): MealSlot {
  if (entry.mealSlot === 'breakfast' || entry.mealSlot === 'lunch' || entry.mealSlot === 'snack') {
    return entry.mealSlot
  }
  return 'dinner'
}

function onSlotSearch(date: string, slot: MealSlot) {
  const key = slotKey(date, slot)
  selectedRecipeBySlot.value[key] = ''
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
    const localSuggestions = recipes.value
      .filter(recipe => recipe.title.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5)
      .map(recipe => ({ id: recipe.id, title: recipe.title, source: 'dishly' as const }))
    try {
      const externalSuggestions = (await recipeApi.getExternalRecipes(query))
        .slice(0, 5)
        .map(recipe => ({
          id: recipe.externalId ?? recipe.id,
          title: recipe.title,
          source: 'external' as const,
        }))
      suggestionsBySlot.value[key] = [...localSuggestions, ...externalSuggestions].slice(0, 8)
    } catch {
      suggestionsBySlot.value[key] = localSuggestions
    } finally {
      suggestionLoadingBySlot.value[key] = false
    }
  }, 300)
}

function chooseSuggestion(date: string, slot: MealSlot, suggestion: SlotSuggestion) {
  const key = slotKey(date, slot)
  customTitleBySlot.value[key] = suggestion.title
  suggestionsBySlot.value[key] = []
  if (suggestion.source === 'dishly') {
    selectedRecipeBySlot.value[key] = String(suggestion.id)
    suggestionNoticeBySlot.value[key] = ''
    return
  }
  selectedRecipeBySlot.value[key] = ''
  suggestionNoticeBySlot.value[key] = 'Externe Vorschläge werden aktuell als Freitext gespeichert.'
}

async function loadSwipeSuggestions() {
  swipeLoading.value = true
  swipeError.value = null
  swipeMessage.value = null
  swipeIndex.value = 0
  try {
    const [publishedRecipes, externalRecipes] = await Promise.all([
      recipeApi.getPublishedRecipes(),
      recipeApi.getExternalRecipes(undefined, swipeFilters()),
    ])
    swipeSuggestions.value = [...publishedRecipes, ...externalRecipes].slice(0, 20)
    if (swipeSuggestions.value.length === 0) {
      swipeError.value = 'Keine Vorschläge gefunden.'
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
    const saved = await mealPlanApi.setSlot(date, slot, {
      customTitle: suggestion.title,
    })
    upsertEntry(saved)
    customTitleBySlot.value[slotKey(date, slot)] = entryTitle(saved)
    selectedRecipeBySlot.value[slotKey(date, slot)] = ''
    swipeMessage.value = `${suggestion.title} wurde für ${slotLabel(slot)} am ${date} übernommen.`
    if (bucketCounts.value[slot] >= 7) {
      activeBucket.value = slot
    }
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

function countEntriesForSlot(slot: MealSlot) {
  return (week.value?.entries ?? []).filter(entry => normalizedSlot(entry) === slot).length
}

function totalCaloriesForBucket(slot: MealSlot) {
  return entriesForBucket(slot).reduce((sum, item) => sum + (item.entry.recipe?.calories ?? 0), 0)
}

function firstFreeDateForSlot(slot: MealSlot) {
  return weekDays.value.find(day => !entryFor(day.date, slot))?.date ?? null
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
      <p v-if="actionMessage" class="status-text success full-width">{{ actionMessage }}</p>
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
        <span>Woche manuell planen</span>
        <button type="button" class="clear-week-button" :disabled="!week?.entries.length" @click="clearWeek">
          {{ t('mealPlan.actions.clearWeek') }}
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
            :class="{ full: bucketCounts[slot.key] >= 7, active: activeBucket === slot.key }"
            @click="toggleBucket(slot.key)"
          >
            <span>{{ slotLabel(slot.key) }}</span>
            <strong>{{ bucketCounts[slot.key] }}/7</strong>
          </button>
        </div>

        <section v-if="activeBucket" class="bucket-panel" aria-live="polite">
          <div class="bucket-panel-header">
            <div>
              <h3>{{ slotLabel(activeBucket) }}</h3>
              <p>{{ bucketCounts[activeBucket] }}/7 geplant · {{ totalCaloriesForBucket(activeBucket) }} kcal</p>
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
                  <span v-if="item.entry.recipe?.calories"> · {{ item.entry.recipe.calories }} kcal</span>
                </p>
              </div>
              <button type="button" class="secondary-button" @click="removeDay(item.day.date, activeBucket)">
                Entfernen
              </button>
            </li>
          </ul>
        </section>

        <p v-if="swipeMessage" class="status-text success">{{ swipeMessage }}</p>
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
            </div>
            <div class="tag-list">
              <span v-if="currentSwipeRecipe.category">{{ currentSwipeRecipe.category }}</span>
              <span v-if="currentSwipeRecipe.difficulty">{{ currentSwipeRecipe.difficulty }}</span>
            </div>
            <p class="suggestion-state">
              Externe Vorschläge werden aktuell ehrlich als Freitext gespeichert.
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
            <span>{{ caloriesForDay(day.date) }} kcal</span>
          </div>
          <span>{{ day.date }}</span>
        </div>

        <div v-for="slot in mealSlots" :key="slot.key" class="slot-block">
          <h3>{{ t(slot.labelKey) }}</h3>
          <div v-if="entryFor(day.date, slot.key)" class="planned-recipe">
            <span class="planned-label">{{ t('mealPlan.plannedRecipe') }}</span>
            <strong>{{ entryFor(day.date, slot.key) ? entryTitle(entryFor(day.date, slot.key)!) : '' }}</strong>
          </div>
          <p v-else class="empty-day">{{ t('mealPlan.empty.day') }}</p>

          <label class="recipe-select">
            <span>Rezept suchen oder Freitext eingeben</span>
            <input
              v-model="customTitleBySlot[slotKey(day.date, slot.key)]"
              type="text"
              placeholder="z. B. Sushi"
              @input="onSlotSearch(day.date, slot.key)"
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
                <small>{{ suggestion.source === 'dishly' ? 'Dishly-Rezept' : 'Externer Vorschlag' }}</small>
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
              @click="removeDay(day.date, slot.key)"
            >
              {{ t('mealPlan.actions.remove') }}
            </button>
          </div>
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
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
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
  grid-template-columns: repeat(4, minmax(120px, 1fr));
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
}

.swipe-card {
  border: 1px solid #d6eee9;
  border-radius: 14px;
  display: grid;
  grid-template-columns: minmax(140px, 220px) 1fr;
  overflow: hidden;
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
  .swipe-controls,
  .swipe-card {
    grid-template-columns: 1fr;
  }

  .swipe-card img {
    max-height: 220px;
  }
}
</style>
