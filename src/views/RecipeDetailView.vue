<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { recipeApi } from '@/shared/api/recipeApi'
import { restaurantApi } from '@/shared/api/restaurantApi'
import { shoppingListApi } from '@/shared/api/shoppingListApi'
import { mealPlanApi } from '@/shared/api/mealPlanApi'
import { AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import type {
  ExternalRecipeDetailResponse,
  ExternalRecipeIngredient,
  RecipeResponse,
} from '@/types/recipe'
import type { RestaurantResponse } from '@/types/restaurant'

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
  readyInMinutes: number
  servings: number
  tags: string[]
  ingredients: DetailIngredient[]
  instructions: string
  steps: string[]
  sourceUrl?: string | null
}

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const recipe = ref<DetailRecipe | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const shoppingMessage = ref<string | null>(null)
const shoppingError = ref<string | null>(null)
const restaurantLoading = ref(false)
const restaurantError = ref<string | null>(null)
const restaurants = ref<RestaurantResponse[]>([])
const restaurantSearched = ref(false)
const mealPlanModalOpen = ref(false)
const mealPlanError = ref<string | null>(null)
const mealPlanMessage = ref<string | null>(null)
const mealPlanLoading = ref(false)

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
  } catch {
    error.value = t('recipeDetail.errors.load')
  } finally {
    loading.value = false
  }
}

function mapExternal(response: ExternalRecipeDetailResponse): DetailRecipe {
  return {
    id: response.externalId ?? response.id,
    source: 'spoonacular',
    title: response.title,
    imageUrl: response.imageUrl,
    calories: response.calories,
    readyInMinutes: response.readyInMinutes || response.cookTimeMinutes,
    servings: response.servings,
    tags: response.tags ?? [],
    ingredients: response.ingredients.map(mapIngredient),
    instructions: response.instructions ?? '',
    steps: response.steps ?? [],
    sourceUrl: response.sourceUrl,
  }
}

function mapDishly(response: RecipeResponse): DetailRecipe {
  return {
    id: response.id,
    source: 'dishly',
    title: response.title,
    imageUrl: response.imageUrl,
    calories: response.calories,
    readyInMinutes: response.prepTimeMinutes + response.cookTimeMinutes,
    servings: response.servings,
    tags: [response.category, response.difficulty].filter(Boolean) as string[],
    ingredients: splitIngredients(response.ingredients),
    instructions: response.instructions,
    steps: response.instructions
      ? response.instructions.split(/\n+/).map(step => step.trim()).filter(Boolean)
      : [],
    sourceUrl: response.sourceUrl,
  }
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
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
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
  if (window.history.length > 1) {
    router.back()
    return
  }
  router.push('/')
}

async function addIngredientToShoppingList(ingredient: DetailIngredient) {
  if (!recipe.value) return
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    shoppingError.value = t('recipeDetail.errors.loginRequiredShopping')
    shoppingMessage.value = null
    return
  }

  try {
    await shoppingListApi.createShoppingListItem(buildShoppingListRequest(ingredient))
    shoppingMessage.value = t('recipeDetail.shopping.addedOne')
    shoppingError.value = null
  } catch {
    shoppingMessage.value = null
    shoppingError.value = t('recipeDetail.errors.shopping')
  }
}

async function addAllIngredientsToShoppingList() {
  if (!recipe.value) return
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    shoppingError.value = t('recipeDetail.errors.loginRequiredShopping')
    shoppingMessage.value = null
    return
  }

  try {
    await Promise.all(recipe.value.ingredients.map(ingredient =>
      shoppingListApi.createShoppingListItem(buildShoppingListRequest(ingredient)),
    ))
    shoppingMessage.value = t('recipeDetail.shopping.addedAll')
    shoppingError.value = null
  } catch {
    shoppingMessage.value = null
    shoppingError.value = t('recipeDetail.errors.shopping')
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

async function findNearbyRestaurants() {
  if (!recipe.value) return
  if (!navigator.geolocation) {
    restaurantError.value = t('restaurants.errors.geolocationUnsupported')
    restaurants.value = []
    return
  }

  restaurantLoading.value = true
  restaurantError.value = null
  restaurants.value = []
  restaurantSearched.value = true

  try {
    const position = await currentPosition()
    restaurants.value = await restaurantApi.searchRestaurants({
      query: recipe.value.title,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    })
  } catch (e: unknown) {
    restaurants.value = []
    restaurantError.value = geolocationDenied(e)
      ? t('restaurants.errors.locationDenied')
      : t('restaurants.errors.searchFailed')
  } finally {
    restaurantLoading.value = false
  }
}

const currentPosition = (): Promise<GeolocationPosition> => new Promise((resolve, reject) => {
  navigator.geolocation.getCurrentPosition(resolve, reject)
})

const geolocationDenied = (error: unknown) =>
  typeof error === 'object'
  && error !== null
  && 'code' in error
  && Number((error as GeolocationPositionError).code) === 1

function openMealPlanModal() {
  mealPlanMessage.value = null
  mealPlanError.value = null
  if (!recipe.value) return
  if (recipe.value.source !== 'dishly') {
    mealPlanError.value = t('recipeDetail.errors.externalMealPlan')
    return
  }
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    mealPlanError.value = t('recipeDetail.errors.loginRequiredMealPlan')
    return
  }
  mealPlanModalOpen.value = true
}

async function addToMealPlan(date: string) {
  if (!recipe.value) return
  mealPlanLoading.value = true
  mealPlanError.value = null
  try {
    await mealPlanApi.setDay(date, Number(recipe.value.id))
    mealPlanMessage.value = t('recipeDetail.mealPlan.added')
    mealPlanModalOpen.value = false
  } catch {
    mealPlanError.value = t('recipeDetail.errors.mealPlan')
  } finally {
    mealPlanLoading.value = false
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
  <section class="detail-page">
    <button type="button" class="back-button" @click="goBack">
      {{ t('recipeDetail.actions.back') }}
    </button>

    <p v-if="loading" class="status-text">{{ t('recipeDetail.loading') }}</p>
    <p v-else-if="error" class="status-text error">{{ error }}</p>

    <article v-else-if="recipe" class="detail-layout">
      <div v-if="recipe.imageUrl" class="image-panel">
        <img :src="recipe.imageUrl" :alt="recipe.title" />
      </div>

      <div class="content-panel">
        <p class="source-label">
          {{ recipe.source === 'dishly' ? t('home.source.dishly') : t('home.source.external') }}
        </p>
        <h1>{{ recipe.title }}</h1>

        <div class="meta-grid">
          <span v-if="recipe.calories">{{ t('recipeDetail.meta.calories', { calories: recipe.calories }) }}</span>
          <span v-if="recipe.readyInMinutes">{{ t('recipeDetail.meta.time', { minutes: recipe.readyInMinutes }) }}</span>
          <span v-if="recipe.servings">{{ t('recipeDetail.meta.servings', { count: recipe.servings }) }}</span>
        </div>

        <div v-if="recipe.tags.length" class="tag-list">
          <span v-for="tag in recipe.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>

        <div class="action-row">
          <button type="button" class="primary-button" @click="addAllIngredientsToShoppingList">
            {{ t('recipeDetail.actions.addAllToShoppingList') }}
          </button>
          <button type="button" class="secondary-button" @click="findNearbyRestaurants">
            {{ t('restaurants.actions.findNearby') }}
          </button>
          <button type="button" class="secondary-button" @click="openMealPlanModal">
            {{ t('recipeDetail.actions.addToMealPlan') }}
          </button>
        </div>

        <p v-if="shoppingMessage" class="status-text success">{{ shoppingMessage }}</p>
        <p v-if="shoppingError" class="status-text error">{{ shoppingError }}</p>
        <p v-if="mealPlanMessage" class="status-text success">{{ mealPlanMessage }}</p>
        <p v-if="mealPlanError" class="status-text error">{{ mealPlanError }}</p>
      </div>

      <section class="detail-section">
        <h2>{{ t('recipeDetail.ingredients.title') }}</h2>
        <ul class="ingredient-list">
          <li v-for="ingredient in recipe.ingredients" :key="ingredient.original">
            <span>{{ ingredient.original }}</span>
            <button type="button" class="small-button" @click="addIngredientToShoppingList(ingredient)">
              {{ t('recipeDetail.actions.addOne') }}
            </button>
          </li>
        </ul>
      </section>

      <section class="detail-section">
        <h2>{{ t('recipeDetail.instructions.title') }}</h2>
        <ol v-if="recipe.steps.length" class="step-list">
          <li v-for="step in recipe.steps" :key="step">{{ step }}</li>
        </ol>
        <p v-else class="instruction-text">{{ recipe.instructions || t('recipeDetail.instructions.empty') }}</p>
      </section>

      <section class="detail-section">
        <h2>{{ t('recipeDetail.restaurants.title') }}</h2>
        <p class="hint">{{ t('restaurants.disclaimer') }}</p>
        <p v-if="restaurantLoading" class="status-text">{{ t('restaurants.loading.search') }}</p>
        <p v-else-if="restaurantError" class="status-text error">{{ restaurantError }}</p>
        <p v-else-if="restaurantSearched && restaurants.length === 0" class="status-text">{{ t('restaurants.empty') }}</p>
        <ul v-if="restaurants.length" class="restaurant-list">
          <li v-for="restaurant in restaurants" :key="`${restaurant.name}-${restaurant.latitude}-${restaurant.longitude}`">
            <strong>{{ restaurant.name }}</strong>
            <span v-if="restaurant.address">{{ restaurant.address }}</span>
            <span>{{ t('restaurants.distanceMeters', { distance: restaurant.distanceMeters }) }}</span>
            <a :href="restaurant.googleMapsUrl" target="_blank" rel="noopener noreferrer">
              {{ t('restaurants.openInMaps') }}
            </a>
          </li>
        </ul>
      </section>
    </article>

    <div v-if="mealPlanModalOpen" class="modal-backdrop" @click.self="mealPlanModalOpen = false">
      <section class="meal-plan-modal" :aria-label="t('recipeDetail.mealPlan.title')">
        <h2>{{ t('recipeDetail.mealPlan.title') }}</h2>
        <p>{{ t('recipeDetail.mealPlan.subtitle') }}</p>
        <div class="day-buttons">
          <button
            v-for="day in weekDays"
            :key="day.date"
            type="button"
            class="day-button"
            :disabled="mealPlanLoading"
            @click="addToMealPlan(day.date)"
          >
            <strong>{{ day.label }}</strong>
            <span>{{ day.date }}</span>
          </button>
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
  max-width: 1100px;
  margin: 0 auto 48px auto;
  padding: 28px 20px;
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
  border: 1.5px solid #8fd5cc;
  color: #1d8e90;
  padding: 8px 16px;
  margin-bottom: 20px;
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
  grid-template-columns: minmax(280px, 440px) 1fr;
  gap: 28px;
}

.image-panel {
  border-radius: 18px;
  overflow: hidden;
  background: #f4fbfa;
  border: 1px solid #c3e7e1;
  min-height: 280px;
}

.image-panel img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.content-panel h1 {
  color: #2b1b23;
  font-size: 2.2rem;
  margin: 4px 0 14px 0;
}

.source-label {
  color: #cc7da9;
  font-weight: 900;
  text-transform: uppercase;
  font-size: 0.8rem;
}

.meta-grid,
.tag-list,
.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 14px 0;
}

.meta-grid span,
.tag {
  border-radius: 999px;
  background: #e0f5f2;
  color: #1d8e90;
  font-weight: 800;
  padding: 7px 12px;
}

.tag {
  background: #fff7fb;
  color: #b96593;
}

.primary-button {
  background: #cc7da9;
  color: #ffffff;
  padding: 10px 16px;
}

.secondary-button {
  background: #26b6b8;
  color: #ffffff;
  padding: 10px 16px;
}

.small-button {
  background: #ffffff;
  color: #26b6b8;
  border: 1px solid #8fd5cc;
  padding: 6px 12px;
}

.detail-section {
  grid-column: 1 / -1;
  background: #ffffff;
  border: 1px solid #c3e7e1;
  border-radius: 14px;
  padding: 18px;
}

.detail-section h2 {
  color: #cc7da9;
  margin-bottom: 12px;
}

.ingredient-list,
.restaurant-list {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 10px;
}

.ingredient-list li,
.restaurant-list li {
  background: #f4fbfa;
  border: 1px solid #c3e7e1;
  border-radius: 12px;
  padding: 12px;
}

.ingredient-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.step-list {
  display: grid;
  gap: 10px;
  padding-left: 22px;
}

.instruction-text,
.hint {
  color: #486b68;
  white-space: pre-line;
}

.restaurant-list li {
  display: grid;
  gap: 5px;
}

.restaurant-list a {
  color: #cc7da9;
  font-weight: 800;
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
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}

.day-button {
  border: 1px solid #c3e7e1;
  border-radius: 12px;
  background: #f4fbfa;
  color: #2b1b23;
  cursor: pointer;
  display: grid;
  gap: 4px;
  padding: 12px;
  text-align: left;
}

.day-button:hover {
  border-color: #26b6b8;
}

.day-button span {
  color: #486b68;
  font-size: 0.9rem;
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

@media (max-width: 760px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }

  .content-panel h1 {
    font-size: 1.7rem;
  }

  .ingredient-list li {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
