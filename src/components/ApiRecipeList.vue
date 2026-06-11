<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { pantryApi } from '@/shared/api/pantryApi'
import { profileApi } from '@/shared/api/profileApi'
import { recipeApi } from '@/shared/api/recipeApi'
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
const loading = ref(true)
const error = ref<string | null>(null)
const { t } = useI18n()
const router = useRouter()

const EXTERNAL_CHUNK = 20
const SEARCH_DEBOUNCE_MS = 400
let searchTimeout: ReturnType<typeof setTimeout> | null = null
let externalRequestCounter = 0

const filtered = computed(() => recipes.value)

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

.reason-list {
  margin: 10px 0 0;
  padding-left: 18px;
  color: #2f6f62;
  font-size: 0.9rem;
}
</style>
