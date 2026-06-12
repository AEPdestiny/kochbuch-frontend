<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ApiClientError, AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { favoriteApi } from '@/shared/api/favoriteApi'
import { mealPlanApi } from '@/shared/api/mealPlanApi'
import { pantryApi } from '@/shared/api/pantryApi'
import { profileApi } from '@/shared/api/profileApi'
import { recipeApi } from '@/shared/api/recipeApi'
import type { MealPlanEntryRequest, MealPlanEntryResponse, MealSlot } from '@/types/mealPlan'
import type { Recipe, RecipeSearchFilters } from '@/types/recipe'

type RecipeSource = 'external' | 'dishly'
type DisplayRecipe = Recipe & {
  source: RecipeSource
  recommendationReasons: string[]
}

const search = ref('')
const vegan = ref(false)
const vegetarian = ref(false)
const glutenFree = ref(false)
const calorieConscious = ref(false)
const highProtein = ref(false)
const budgetFriendly = ref(false)
const maxPrepTime = ref<number | null>(null)
const mealType = ref('')
const contextSearch = ref('')
const recipes = ref<DisplayRecipe[]>([])
const allExternal = ref<Recipe[]>([])
const ownPublished = ref<Recipe[]>([])
const pantryIngredients = ref<string[]>([])
const externalFavoriteIds = ref<Set<string>>(new Set())
const loading = ref(true)
const error = ref<string | null>(null)
const mealPlanModalOpen = ref(false)
const mealPlanTarget = ref<DisplayRecipe | null>(null)
const mealPlanLoading = ref(false)
const mealPlanError = ref<string | null>(null)
const mealPlanMessage = ref<string | null>(null)
const plannedEntries = ref<MealPlanEntryResponse[]>([])
const { t } = useI18n()
const router = useRouter()

const EXTERNAL_CHUNK = 20
const SEARCH_DEBOUNCE_MS = 400
let searchTimeout: ReturnType<typeof setTimeout> | null = null
let externalRequestCounter = 0

const filtered = computed(() => recipes.value)
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

const filterRecipes = (items: Recipe[], q: string) => {
  return items.filter(r => matchesText(r, q) && matchesLocalFilters(r))
}

const buildView = () => {
  const q = search.value.toLowerCase().trim()
  const matchingPublished = filterRecipes(ownPublished.value, q)
  const shuffled = q ? allExternal.value : shuffleArray(allExternal.value)
  const externalSlice = shuffled.slice(0, EXTERNAL_CHUNK)
  recipes.value = [
    ...externalSlice.map(recipe => toDisplayRecipe(recipe, 'external')),
    ...matchingPublished.map(recipe => toDisplayRecipe(recipe, 'dishly')),
  ]
}

const loadRecipes = async () => {
  loading.value = true
  try {
    await loadPersonalization()
    const [external, own] = await Promise.all([
      fetchExternalRecipes(),
      recipeApi.getPublishedRecipes(),
    ])

    allExternal.value = external
    ownPublished.value = own
    buildView()
    error.value = null
  } catch (e: any) {
    error.value = e.message ?? t('home.errors.initialLoad')
  } finally {
    loading.value = false
  }
}

const loadExternalRecipes = async (query: string) => {
  const requestId = ++externalRequestCounter
  try {
    const external = await fetchExternalRecipes(query)
    if (requestId !== externalRequestCounter) {
      return
    }

    allExternal.value = external
    buildView()
    error.value = null
  } catch {
    if (requestId !== externalRequestCounter) {
      return
    }

    allExternal.value = []
    buildView()
    error.value = t('home.errors.externalSearch')
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
  mealPlanMessage.value = null
  mealPlanError.value = null
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    mealPlanError.value = 'Bitte melde dich an, um Rezepte zum Wochenplan hinzuzufügen.'
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
      : 'Der Wochenplan konnte nicht geladen werden.'
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
    mealPlanMessage.value = 'Rezept wurde zum Wochenplan hinzugefügt.'
    mealPlanModalOpen.value = false
  } catch (e: unknown) {
    logMealPlanError(e, date, slot, payload)
    mealPlanError.value = e instanceof ApiClientError && e.message
      ? e.message
      : 'Das Rezept konnte nicht zum Wochenplan hinzugefügt werden.'
  } finally {
    mealPlanLoading.value = false
  }
}

function mealPlanPayload(recipe: DisplayRecipe): number | MealPlanEntryRequest {
  const id = Number(recipe.id)
  if (recipe.source === 'dishly' && Number.isFinite(id) && id > 0) {
    return id
  }
  return { customTitle: recipe.title }
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

const shuffleRecipes = () => {
  if (!allExternal.value.length) return
  buildView()
}

onMounted(() => {
  loadRecipes()
})

watch([search, vegan, vegetarian, glutenFree, calorieConscious, highProtein, budgetFriendly, maxPrepTime, mealType, contextSearch], () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  const query = search.value.trim()
  if (query.length > 0 && query.length < 2) {
    buildView()
    return
  }

  searchTimeout = setTimeout(() => {
    loadExternalRecipes(query)
  }, SEARCH_DEBOUNCE_MS)
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
    vegan.value = preferences.vegan
    vegetarian.value = preferences.vegetarian
    glutenFree.value = preferences.glutenFree
    calorieConscious.value = preferences.calorieConscious
    highProtein.value = preferences.highProtein
    budgetFriendly.value = preferences.budgetFriendly
    maxPrepTime.value = preferences.maxPrepTimeMinutes ?? null
  }

  if (pantryResult.status === 'fulfilled') {
    pantryIngredients.value = pantryResult.value
      .map(item => item.name.toLowerCase())
      .filter(Boolean)
  }

  try {
    const favorites = await favoriteApi.getExternalFavorites()
    externalFavoriteIds.value = new Set(favorites.map(favorite => favorite.externalRecipeId))
  } catch {
    externalFavoriteIds.value = new Set()
  }
}

function currentFilters(): RecipeSearchFilters {
  return {
    vegan: vegan.value,
    vegetarian: vegetarian.value,
    glutenFree: glutenFree.value,
    calorieConscious: calorieConscious.value,
    highProtein: highProtein.value,
    budgetFriendly: budgetFriendly.value,
    maxPrepTime: maxPrepTime.value,
    mealType: mealType.value,
    context: contextSearch.value,
  }
}

function activeFilters(): RecipeSearchFilters | undefined {
  const filters = currentFilters()
  const hasActiveFilter = Object.entries(filters).some(([, value]) => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value > 0
    return Boolean(value)
  })
  return hasActiveFilter ? filters : undefined
}

function fetchExternalRecipes(query = search.value) {
  const externalQuery = buildExternalQuery(query)
  const filters = activeFilters()
  if (!externalQuery && !filters) {
    return recipeApi.getExternalRecipes()
  }
  if (externalQuery && !filters) {
    return recipeApi.getExternalRecipes(externalQuery)
  }
  if (!externalQuery && filters) {
    return recipeApi.getExternalRecipes(undefined, filters)
  }
  return recipeApi.getExternalRecipes(externalQuery, filters)
}

function buildExternalQuery(query = search.value) {
  const parts = [query.trim(), contextToQuery(contextSearch.value)].filter(Boolean)
  if (highProtein.value) parts.push('high protein')
  if (calorieConscious.value) parts.push('low calorie')
  if (budgetFriendly.value) parts.push('cheap')
  return parts.join(' ').trim() || undefined
}

function contextToQuery(value: string) {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return ''
  if (normalized.includes('gestresst')) return 'quick easy'
  if (normalized.includes('günstig') || normalized.includes('guenstig')) return 'cheap budget'
  if (normalized.includes('date')) return 'date night'
  return normalized
}

function matchesText(recipe: Recipe, query: string) {
  if (!query) return true
  const haystack = `${recipe.title} ${recipe.ingredients} ${recipe.category}`.toLowerCase()
  return haystack.includes(query)
}

function matchesLocalFilters(recipe: Recipe) {
  const text = `${recipe.title} ${recipe.ingredients} ${recipe.category}`.toLowerCase()
  const totalTime = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0)
  if (maxPrepTime.value && totalTime > maxPrepTime.value) return false
  if (calorieConscious.value && recipe.calories && recipe.calories > 650) return false
  if (mealType.value && !text.includes(mealType.value.toLowerCase())) return false
  if (vegan.value && !text.includes('vegan')) return false
  if (vegetarian.value && !text.includes('vegetarian') && !text.includes('vegetarisch')) return false
  if (glutenFree.value && !text.includes('gluten')) return false
  if (highProtein.value && !/(protein|chicken|egg|fish|tofu|beans)/.test(text)) return false
  if (budgetFriendly.value && !/(cheap|budget|günstig|guenstig|preiswert)/.test(text)) return false
  return true
}

function recommendationReasons(recipe: Recipe, source: RecipeSource) {
  const reasons: string[] = []
  const text = `${recipe.title} ${recipe.ingredients} ${recipe.category}`.toLowerCase()
  if (source === 'external' && vegan.value) reasons.push(t('home.reasons.vegan'))
  if (source === 'external' && vegetarian.value) reasons.push(t('home.reasons.vegetarian'))
  if (source === 'external' && glutenFree.value) reasons.push(t('home.reasons.glutenFree'))
  if (calorieConscious.value && recipe.calories && recipe.calories <= 650) reasons.push(t('home.reasons.calorieConscious'))
  if (maxPrepTime.value && (recipe.prepTimeMinutes + recipe.cookTimeMinutes) <= maxPrepTime.value) reasons.push(t('home.reasons.time'))
  if (highProtein.value && /(protein|chicken|egg|fish|tofu|beans)/.test(text)) reasons.push(t('home.reasons.highProtein'))
  const pantryHit = pantryIngredients.value.find(ingredient => text.includes(ingredient))
  if (pantryHit) reasons.push(t('home.reasons.pantry', { ingredient: pantryHit }))
  return reasons.slice(0, 3)
}

function externalFavoriteId(recipe: DisplayRecipe) {
  return String(recipe.externalId ?? recipe.id)
}

function isExternalFavorite(recipe: DisplayRecipe) {
  return recipe.source === 'external' && externalFavoriteIds.value.has(externalFavoriteId(recipe))
}

async function toggleExternalFavorite(recipe: DisplayRecipe) {
  if (recipe.source !== 'external') {
    return
  }
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    error.value = 'Bitte melde dich an, um API-Rezepte zu favorisieren.'
    return
  }

  const id = externalFavoriteId(recipe)
  try {
    if (externalFavoriteIds.value.has(id)) {
      await favoriteApi.removeExternalFavorite('SPOONACULAR', id)
      const next = new Set(externalFavoriteIds.value)
      next.delete(id)
      externalFavoriteIds.value = next
      return
    }

    await favoriteApi.addExternalFavorite({
      externalRecipeId: id,
      externalTitle: recipe.title,
      externalImageUrl: recipe.imageUrl,
      externalSource: 'SPOONACULAR',
    })
    externalFavoriteIds.value = new Set([...externalFavoriteIds.value, id])
  } catch (e: unknown) {
    error.value = e instanceof ApiClientError && e.message
      ? e.message
      : 'Favorit konnte nicht gespeichert werden.'
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
      <div class="filter-panel" aria-label="Recipe filters">
        <label><input v-model="vegan" type="checkbox" /> {{ t('home.filters.vegan') }}</label>
        <label><input v-model="vegetarian" type="checkbox" /> {{ t('home.filters.vegetarian') }}</label>
        <label><input v-model="glutenFree" type="checkbox" /> {{ t('home.filters.glutenFree') }}</label>
        <label><input v-model="calorieConscious" type="checkbox" /> {{ t('home.filters.calorieConscious') }}</label>
        <label><input v-model="highProtein" type="checkbox" /> {{ t('home.filters.highProtein') }}</label>
        <label><input v-model="budgetFriendly" type="checkbox" /> {{ t('home.filters.budgetFriendly') }}</label>
        <label>
          {{ t('home.filters.maxPrepTime') }}
          <input v-model.number="maxPrepTime" class="small-input" min="1" type="number" />
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
        <label class="context-filter">
          {{ t('home.filters.context') }}
          <input v-model="contextSearch" class="small-input" type="text" :placeholder="t('home.filters.contextPlaceholder')" />
        </label>
      </div>
    </section>

    <div class="shuffle-wrap">
      <button class="shuffle-btn" type="button" @click="shuffleRecipes">
        <span class="shuffle-icon">↻</span>
        <span>{{ t('home.shuffle') }}</span>
      </button>
    </div>

    <section class="list-wrap">
      <p v-if="loading" class="status-text">{{ t('home.loading') }}</p>
      <p v-else-if="error && filtered.length === 0" class="status-text error">
        {{ t('home.errors.prefix') }} {{ error }}
      </p>

      <div v-else class="recipe-grid">
        <p v-if="error" class="status-text error">
          {{ t('home.errors.prefix') }} {{ error }}
        </p>
        <p v-if="mealPlanMessage" class="status-text success">
          {{ mealPlanMessage }}
        </p>
        <p v-if="mealPlanError && !mealPlanModalOpen" class="status-text error">
          {{ mealPlanError }}
        </p>

        <article
          v-for="r in filtered"
          :key="`${r.source}-${r.id}`"
          class="recipe-card"
          @click="openDetails(r)"
        >
          <div v-if="r.imageUrl" class="image-wrap">
            <img :src="r.imageUrl" :alt="r.title" />
          </div>

          <div class="card-content">
            <h3 class="card-title">{{ r.title }}</h3>
            <button
              v-if="r.source === 'external'"
              type="button"
              class="favorite-button"
              :aria-pressed="isExternalFavorite(r)"
              @click.stop="toggleExternalFavorite(r)"
            >
              {{ isExternalFavorite(r) ? '♥ Favorit' : '♡ Favorit' }}
            </button>

            <p class="card-meta">
              <span
                class="pill source-pill"
                :class="r.source === 'dishly' ? 'source-pill-dishly' : 'source-pill-external'"
              >
                {{ r.source === 'dishly' ? t('home.source.dishly') : t('home.source.external') }}
              </span>
              <span v-if="r.category" class="pill pill-mint">{{ r.category }}</span>
              <span v-if="r.difficulty" class="pill pill-soft">{{ r.difficulty }}</span>
              <span v-if="r.rating" class="pill pill-rating">
                {{ t('home.meta.rating', { rating: r.rating.toFixed(1) }) }}
              </span>
            </p>

            <p class="card-times">
              <span v-if="r.prepTimeMinutes || r.cookTimeMinutes">
                {{ t('home.meta.minutes', { minutes: r.prepTimeMinutes + r.cookTimeMinutes }) }}
              </span>
              <span v-if="r.servings"> · {{ t('home.meta.servings', { count: r.servings }) }}</span>
            </p>

            <p class="card-ingredients">
              {{ r.ingredients }}
            </p>

            <button type="button" class="meal-plan-card-button" @click.stop="openMealPlanModal(r)">
              Zum Wochenplan hinzufügen
            </button>

            <ul v-if="r.recommendationReasons.length" class="reason-list">
              <li v-for="reason in r.recommendationReasons" :key="reason">{{ reason }}</li>
            </ul>
          </div>
        </article>

        <p v-if="!loading && filtered.length === 0" class="status-text">
          {{ t('home.empty') }}
        </p>
      </div>
    </section>

    <div v-if="mealPlanModalOpen" class="modal-backdrop" @click.self="mealPlanModalOpen = false">
      <section class="meal-plan-modal" aria-label="Zum Wochenplan hinzufügen">
        <h2>Zum Wochenplan hinzufügen</h2>
        <p v-if="mealPlanTarget">
          Wähle Tag und Slot für: <strong>{{ mealPlanTarget.title }}</strong>
        </p>
        <p v-if="mealPlanLoading" class="status-text">Wochenplan wird geladen...</p>
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
              <small v-else>Frei</small>
            </button>
          </div>
        </div>

        <button type="button" class="cancel-modal" @click="mealPlanModalOpen = false">
          Abbrechen
        </button>
      </section>
    </div>
  </section>
</template>

<style scoped>
.home-wrap {
  width: 100%;
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
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
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

.source-pill {
  font-weight: 800;
}

.source-pill-dishly {
  background: #eefaf8;
  color: #1d8e90;
  border: 1px solid #8fd5cc;
}

.source-pill-external {
  background: #fff7fb;
  color: #b96593;
  border: 1px solid #f6d9ea;
}

.card-times {
  font-size: 0.92rem;
  color: #486b68;
  margin-bottom: 6px;
}

.card-ingredients {
  font-size: 0.95rem;
  color: #324240;
  margin-top: 4px;
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
  padding: 8px 12px;
  width: fit-content;
}

.meal-plan-card-button:hover {
  background: #e0f5f2;
}

.reason-list {
  margin: 10px 0 0;
  padding-left: 18px;
  color: #2f6f62;
  font-size: 0.9rem;
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
</style>
