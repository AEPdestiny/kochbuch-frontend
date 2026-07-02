<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { recipeApi } from '@/shared/api/recipeApi'
import { pantryApi } from '@/shared/api/pantryApi'
import { shoppingListApi } from '@/shared/api/shoppingListApi'
import { mealPlanApi } from '@/shared/api/mealPlanApi'
import { profileApi } from '@/shared/api/profileApi'
import type { Recipe } from '@/types/recipe'
import type { PantryItem } from '@/types/pantry'
import type { ShoppingListItem } from '@/types/shoppingList'
import type { MealPlanEntryResponse, MealPlanWeekResponse, MealSlot } from '@/types/mealPlan'
import type { UserPreferencesResponse } from '@/types/profile'

const { t } = useI18n()

// ── Data ──────────────────────────────────────────────────────────
const recipes = ref<Recipe[]>([])
const pantryItems = ref<PantryItem[]>([])
const shoppingListItems = ref<ShoppingListItem[]>([])
const week = ref<MealPlanWeekResponse | null>(null)
const preferences = ref<UserPreferencesResponse | null>(null)

const recipeError = ref<string | null>(null)
const pantryError = ref<string | null>(null)
const shoppingListError = ref<string | null>(null)
const mealPlanError = ref<string | null>(null)
const profileError = ref<string | null>(null)

const loading = ref(true)

// ── Date helpers ───────────────────────────────────────────────────
function todayString() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const todayDate = todayString()

const todayLabel = computed(() => {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
})

// ── Slot helpers ───────────────────────────────────────────────────
const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

function normalizedSlot(entry: MealPlanEntryResponse): MealSlot {
  if (entry.mealSlot === 'breakfast' || entry.mealSlot === 'lunch' || entry.mealSlot === 'snack') return entry.mealSlot
  return 'dinner'
}

// Same fallback chain (and same "defaults to 0" caveat) as MealPlanView.vue's
// entryCalories()/hasUnknownCalories() — kept duplicated rather than shared since the
// two views' calorie logic isn't otherwise coupled. Sums default missing kcal to 0;
// hasUnknownCalories() is the companion check for callers that must not silently treat
// "no kcal known" as "0 kcal" (e.g. the "Mahlzeiten ohne kcal-Angabe" hint below).
function entryCalories(entry: MealPlanEntryResponse) {
  return entry.calories ?? entry.recipe?.calories ?? entry.caloriesSnapshot ?? 0
}

function hasUnknownCalories(entry: MealPlanEntryResponse) {
  return entry.calories == null && entry.recipe?.calories == null && entry.caloriesSnapshot == null
}

// ── Computed ───────────────────────────────────────────────────────
const todayEntries = computed(() =>
  (week.value?.entries ?? []).filter(e => e.plannedDate === todayDate),
)

const todayEntriesBySlot = computed(() => {
  const map = new Map<MealSlot, MealPlanEntryResponse>()
  for (const entry of todayEntries.value) {
    const slot = normalizedSlot(entry)
    if (!map.has(slot)) map.set(slot, entry)
  }
  return map
})

const todayCalories = computed(() =>
  todayEntries.value.reduce((sum, e) => sum + entryCalories(e), 0),
)

const todayUnknownCaloriesCount = computed(() =>
  todayEntries.value.filter(hasUnknownCalories).length,
)

const dailyCalorieGoal = computed(() =>
  preferences.value?.dailyCalorieTarget ?? preferences.value?.calorieGoal ?? null,
)

const caloriePercent = computed(() => {
  if (!dailyCalorieGoal.value || todayCalories.value === 0) return 0
  return Math.min(100, Math.round((todayCalories.value / dailyCalorieGoal.value) * 100))
})

const calorieIsOver = computed(() =>
  !!dailyCalorieGoal.value && todayCalories.value > dailyCalorieGoal.value,
)

const openShoppingItems = computed(() => shoppingListItems.value.filter(i => !i.checked))

const weekPlanActive = computed(() => (week.value?.entries.length ?? 0) > 0)

const profileChips = computed(() => {
  const p = preferences.value
  if (!p) return []
  const chips: string[] = []
  if (p.vegan) chips.push(t('dashboard.profileVegan'))
  if (p.vegetarian) chips.push(t('dashboard.profileVegetarian'))
  if (p.glutenFree) chips.push(t('dashboard.profileGlutenFree'))
  if (p.lactoseFree) chips.push(t('dashboard.profileLactoseFree'))
  if (p.highProtein) chips.push(t('dashboard.profileHighProtein'))
  if (p.calorieConscious) chips.push(t('dashboard.profileCalorieCons'))
  if (p.likes?.length) chips.push(t('dashboard.profileLikes'))
  if (p.dislikes?.length) chips.push(t('dashboard.profileDislikes'))
  if (p.allergies?.length) chips.push(t('dashboard.profileAllergies'))
  return chips
})

const entryTitle = (e: MealPlanEntryResponse) => e.recipe?.title ?? e.customTitle ?? ''

// ── Load ───────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([
    loadRecipes(),
    loadPantryItems(),
    loadShoppingListItems(),
    loadMealPlan(),
    loadProfile(),
  ])
  loading.value = false
})

async function loadRecipes() {
  try { recipes.value = await recipeApi.getMyRecipes(); recipeError.value = null }
  catch { recipes.value = []; recipeError.value = t('dashboard.recipeError') }
}
async function loadPantryItems() {
  try { pantryItems.value = await pantryApi.getPantryItems(); pantryError.value = null }
  catch { pantryItems.value = []; pantryError.value = t('dashboard.pantryError') }
}
async function loadShoppingListItems() {
  try { shoppingListItems.value = await shoppingListApi.getShoppingListItems(); shoppingListError.value = null }
  catch { shoppingListItems.value = []; shoppingListError.value = t('dashboard.shoppingListError') }
}
async function loadMealPlan() {
  try { week.value = await mealPlanApi.getWeek(); mealPlanError.value = null }
  catch { week.value = null; mealPlanError.value = t('dashboard.mealPlanError') }
}
async function loadProfile() {
  try { preferences.value = await profileApi.getPreferences(); profileError.value = null }
  catch { preferences.value = null; profileError.value = t('dashboard.profileError') }
}
</script>

<template>
  <section class="dashboard-page">

    <!-- ── Header ────────────────────────────────────────────────── -->
    <header class="dash-header">
      <div class="dash-header-text">
        <p class="eyebrow">{{ t('dashboard.eyebrow') }}</p>
        <h1>{{ t('dashboard.title') }}</h1>
        <p class="dash-date">{{ todayLabel }}</p>
        <p class="dash-subtitle">{{ t('dashboard.subtitle') }}</p>
      </div>
      <div class="dash-chips">
        <span v-if="weekPlanActive" class="chip chip-green">{{ t('dashboard.chipWeekPlan') }}</span>
        <span v-if="dailyCalorieGoal" class="chip chip-pink">{{ t('dashboard.chipCalorieGoal') }}</span>
      </div>
    </header>

    <p v-if="loading" class="status-text">{{ t('dashboard.loading') }}</p>

    <div v-else class="dash-grid">

      <!-- ── 1. Today's plan ────────────────────────────────────── -->
      <article class="dash-card card-today" aria-labelledby="card-today-title">
        <div class="card-head">
          <h2 id="card-today-title">{{ t('dashboard.todayTitle') }}</h2>
          <RouterLink to="/meal-plan" class="card-link">{{ t('dashboard.todayOpenPlan') }}</RouterLink>
        </div>

        <p v-if="mealPlanError" class="card-error">{{ mealPlanError }}</p>

        <template v-else-if="todayEntries.length === 0">
          <p class="card-empty">{{ t('dashboard.todayEmpty') }}</p>
        </template>

        <ul v-else class="today-slots">
          <li v-for="slot in SLOTS" :key="slot" class="today-slot" :class="{ 'slot-empty': !todayEntriesBySlot.has(slot) }">
            <span class="slot-label">{{ t('mealPlan.slots.' + slot) }}</span>
            <template v-if="todayEntriesBySlot.has(slot)">
              <span class="slot-title">{{ entryTitle(todayEntriesBySlot.get(slot)!) }}</span>
              <span v-if="entryCalories(todayEntriesBySlot.get(slot)!)" class="slot-kcal">
                {{ entryCalories(todayEntriesBySlot.get(slot)!) }} kcal
              </span>
            </template>
            <span v-else class="slot-none">–</span>
          </li>
        </ul>
      </article>

      <!-- ── 2. Daily calories ──────────────────────────────────── -->
      <article class="dash-card card-calories" aria-labelledby="card-cal-title">
        <div class="card-head">
          <h2 id="card-cal-title">{{ t('dashboard.caloriesTitle') }}</h2>
          <RouterLink to="/profile" class="card-link">{{ t('dashboard.profileEdit') }}</RouterLink>
        </div>

        <template v-if="dailyCalorieGoal">
          <p class="cal-value" :class="{ 'cal-over': calorieIsOver }">
            {{ t('dashboard.caloriesProgress', { planned: todayCalories, goal: dailyCalorieGoal }) }}
          </p>
          <div class="cal-bar-bg" role="progressbar" :aria-valuenow="caloriePercent" aria-valuemin="0" aria-valuemax="100">
            <div class="cal-bar-fill" :class="{ 'bar-over': calorieIsOver }" :style="{ width: caloriePercent + '%' }"></div>
          </div>
          <p v-if="calorieIsOver" class="cal-over-label">{{ t('dashboard.caloriesOver') }}</p>
          <p v-else-if="todayUnknownCaloriesCount === 0 && todayCalories === 0" class="card-empty">{{ t('dashboard.caloriesNoCalories') }}</p>
          <p v-if="todayUnknownCaloriesCount > 0" class="hint cal-unknown-hint">
            {{ todayUnknownCaloriesCount === 1 ? t('dashboard.caloriesUnknownHintOne', { count: todayUnknownCaloriesCount }) : t('dashboard.caloriesUnknownHint', { count: todayUnknownCaloriesCount }) }}
          </p>
        </template>

        <template v-else>
          <p class="card-empty">{{ t('dashboard.caloriesNoGoal') }}</p>
          <RouterLink to="/profile" class="card-btn-secondary">{{ t('dashboard.caloriesSetGoal') }}</RouterLink>
        </template>
      </article>

      <!-- ── 3. Shopping list ───────────────────────────────────── -->
      <article class="dash-card" aria-labelledby="card-shop-title">
        <div class="card-head">
          <h2 id="card-shop-title">{{ t('dashboard.shoppingTitle') }}</h2>
          <RouterLink to="/shopping-list" class="card-link">{{ t('dashboard.shoppingOpenList') }}</RouterLink>
        </div>

        <p v-if="shoppingListError" class="card-error">{{ shoppingListError }}</p>

        <template v-else>
          <p class="card-count">
            <span class="count-badge">{{ t('dashboard.shoppingOpen', { count: openShoppingItems.length }) }}</span>
          </p>
          <ul v-if="openShoppingItems.length" class="item-list">
            <li v-for="item in openShoppingItems.slice(0, 5)" :key="item.id" class="item-row">
              <span class="item-name">{{ item.name }}</span>
              <span v-if="item.quantity || item.unit" class="item-meta">
                {{ item.quantity }} {{ item.unit }}
              </span>
            </li>
          </ul>
          <p v-if="openShoppingItems.length > 5" class="preview-hint">
            {{ t('dashboard.previewShown', { shown: 5, total: openShoppingItems.length }) }}
          </p>
          <p v-else-if="!openShoppingItems.length" class="card-empty">{{ t('dashboard.shoppingEmpty') }}</p>
        </template>
      </article>

      <!-- ── 4. Pantry ──────────────────────────────────────────── -->
      <article class="dash-card" aria-labelledby="card-pantry-title">
        <div class="card-head">
          <h2 id="card-pantry-title">{{ t('dashboard.pantryTitle') }}</h2>
          <RouterLink to="/pantry" class="card-link">{{ t('dashboard.pantryOpen') }}</RouterLink>
        </div>

        <p v-if="pantryError" class="card-error">{{ pantryError }}</p>

        <template v-else>
          <p class="card-count">
            <span class="count-badge">{{ t('dashboard.pantryItems', { count: pantryItems.length }) }}</span>
          </p>
          <ul v-if="pantryItems.length" class="item-list">
            <li v-for="item in pantryItems.slice(0, 5)" :key="item.id" class="item-row">
              <span class="item-name">{{ item.name }}</span>
              <span v-if="item.quantity || item.unit" class="item-meta">
                {{ item.quantity }} {{ item.unit }}
              </span>
            </li>
          </ul>
          <p v-if="pantryItems.length > 5" class="preview-hint">
            {{ t('dashboard.previewShown', { shown: 5, total: pantryItems.length }) }}
          </p>
          <p v-else-if="!pantryItems.length" class="card-empty">{{ t('dashboard.pantryEmpty') }}</p>
        </template>
      </article>

      <!-- ── 5. My Recipes ─────────────────────────────────────── -->
      <article class="dash-card" aria-labelledby="card-recipes-title">
        <div class="card-head">
          <h2 id="card-recipes-title">{{ t('dashboard.recipesTitle') }}</h2>
          <RouterLink to="/my-recipes" class="card-link">{{ t('dashboard.recipesOpen') }}</RouterLink>
        </div>

        <p v-if="recipeError" class="card-error">{{ recipeError }}</p>

        <template v-else>
          <p class="card-count">
            <span class="count-badge">{{ t('dashboard.recipesCount', { count: recipes.length }) }}</span>
          </p>
          <ul v-if="recipes.length" class="item-list">
            <li v-for="recipe in recipes.slice(0, 3)" :key="recipe.id" class="item-row">
              <RouterLink :to="`/recipe/${recipe.id}`" class="recipe-link">{{ recipe.title }}</RouterLink>
            </li>
          </ul>
          <p v-if="recipes.length > 3" class="preview-hint">
            {{ t('dashboard.previewShown', { shown: 3, total: recipes.length }) }}
          </p>
          <p v-else-if="!recipes.length" class="card-empty">{{ t('dashboard.recipesEmpty') }}</p>
        </template>
      </article>

      <!-- ── 6. Profile ─────────────────────────────────────────── -->
      <article class="dash-card card-profile" aria-labelledby="card-profile-title">
        <div class="card-head">
          <h2 id="card-profile-title">{{ t('dashboard.profileTitle') }}</h2>
          <RouterLink to="/profile" class="card-link">{{ t('dashboard.profileEdit') }}</RouterLink>
        </div>

        <p v-if="profileError" class="card-error">{{ profileError }}</p>

        <template v-else>
          <div v-if="profileChips.length" class="profile-chips">
            <span v-for="chip in profileChips" :key="chip" class="chip chip-green">{{ chip }}</span>
          </div>
          <p v-else class="card-empty">{{ t('dashboard.profileNoValues') }}</p>
          <p class="profile-hint">{{ t('dashboard.profileHint') }}</p>
        </template>
      </article>

    </div>

    <!-- ── Quick actions ─────────────────────────────────────────── -->
    <section class="quick-actions" :aria-label="t('dashboard.quickActionsTitle')">
      <h2>{{ t('dashboard.quickActionsTitle') }}</h2>
      <div class="quick-link-grid">
        <RouterLink to="/" class="quick-link">{{ t('dashboard.externalSearch') }}</RouterLink>
        <RouterLink to="/meal-plan" class="quick-link">{{ t('navigation.mealPlan') }}</RouterLink>
        <RouterLink to="/shopping-list" class="quick-link">{{ t('navigation.shoppingList') }}</RouterLink>
        <RouterLink to="/my-recipes" class="quick-link">{{ t('navigation.myRecipes') }}</RouterLink>
        <RouterLink to="/pantry" class="quick-link">{{ t('navigation.pantry') }}</RouterLink>
      </div>
    </section>

  </section>
</template>

<style scoped>
/* ── Page ─────────────────────────────────────────────────────── */
.dashboard-page {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
  box-sizing: border-box;
}

/* ── Header ───────────────────────────────────────────────────── */
.dash-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  background: #fff7fb;
  border: 1px solid #f6d9ea;
  border-radius: 16px;
  box-shadow: 0 2px 14px rgba(191, 140, 167, 0.12);
  padding: 1.5rem 1.75rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.dash-header-text { flex: 1; }

.eyebrow {
  color: #26b6b8;
  font-weight: 800;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0 0 0.3rem;
}

.dash-header h1 {
  color: #cc7da9;
  font-size: 1.9rem;
  font-weight: 800;
  margin: 0 0 0.3rem;
  line-height: 1.2;
}

.dash-date {
  color: #486b68;
  font-size: 0.9rem;
  margin: 0 0 0.3rem;
}

.dash-subtitle {
  color: #486b68;
  font-size: 0.95rem;
  margin: 0;
}

.dash-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: flex-start;
  padding-top: 0.25rem;
}

/* ── Grid ─────────────────────────────────────────────────────── */
.dash-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.card-today { grid-column: 1 / -1; }
.card-profile { grid-column: 1 / -1; }

/* ── Cards ────────────────────────────────────────────────────── */
.dash-card {
  background: #ffffff;
  border: 1px solid #d7e8e3;
  border-radius: 14px;
  box-shadow: 0 2px 10px rgba(36, 59, 56, 0.06);
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.card-head h2 {
  font-size: 1.05rem;
  font-weight: 700;
  color: #1a2e2b;
  margin: 0;
}

.card-link {
  font-size: 0.85rem;
  color: #2f8f7b;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.card-link:hover { text-decoration: underline; }

.card-error { color: #a14c2b; font-size: 0.9rem; margin: 0; }
.card-empty { color: #8aada9; font-size: 0.9rem; margin: 0; font-style: italic; }

.card-count { margin: 0; }

.card-btn-secondary {
  display: inline-flex;
  align-items: center;
  border: 1px solid #c7ded8;
  border-radius: 8px;
  background: #fff;
  color: #2f8f7b;
  padding: 0.45rem 0.9rem;
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  width: fit-content;
}

.card-btn-secondary:hover { background: #f0faf8; }
.mt-sm { margin-top: 0.25rem; }

/* ── Today slots ──────────────────────────────────────────────── */
.today-slots {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 6px;
}

.today-slot {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.45rem 0.75rem;
  border-radius: 8px;
  background: #f4fbfa;
  border: 1px solid #e0f2ee;
}

.today-slot.slot-empty {
  background: #fafafa;
  border-color: #eee;
  opacity: 0.6;
}

.slot-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: #486b68;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  min-width: 80px;
}

.slot-title { flex: 1; font-size: 0.95rem; color: #1a2e2b; }

.slot-kcal {
  font-size: 0.82rem;
  color: #2f8f7b;
  font-weight: 600;
  white-space: nowrap;
}

.slot-none { color: #c3d9d3; font-size: 0.9rem; }

/* ── Calories ─────────────────────────────────────────────────── */
.cal-value {
  font-size: 1.4rem;
  font-weight: 800;
  color: #2f8f7b;
  margin: 0;
}

.cal-value.cal-over { color: #a14c2b; }

.cal-bar-bg {
  width: 100%;
  height: 10px;
  background: #e8f5f2;
  border-radius: 999px;
  overflow: hidden;
}

.cal-bar-fill {
  height: 100%;
  background: #2f8f7b;
  border-radius: 999px;
  transition: width 0.4s ease;
}

.cal-bar-fill.bar-over { background: #d97042; }

.cal-over-label { color: #a14c2b; font-size: 0.88rem; margin: 0; }

/* ── Item list ────────────────────────────────────────────────── */
.item-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 4px;
}

.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0;
  border-bottom: 1px solid #eef5f3;
  font-size: 0.92rem;
}

.item-row:last-child { border-bottom: none; }
.item-name { flex: 1; color: #1a2e2b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-meta { color: #486b68; font-size: 0.82rem; white-space: nowrap; }

.recipe-link { color: #2f8f7b; text-decoration: none; font-weight: 500; }
.recipe-link:hover { text-decoration: underline; }

/* ── Profile ──────────────────────────────────────────────────── */
.profile-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.profile-hint { font-size: 0.85rem; color: #486b68; margin: 0; }

/* ── Preview hint ─────────────────────────────────────────────── */
/* Anchored to the bottom of the (flex-column) card so it lines up at the same
   position across cards, regardless of how many list items are shown above it. */
.preview-hint { font-size: 0.8rem; color: #8aada9; margin: 0; margin-top: auto; font-style: italic; }

/* ── Chips ────────────────────────────────────────────────────── */
.chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 0.8rem;
  font-weight: 600;
}

.chip-green { background: #e3f6f1; color: #2f8f7b; }
.chip-pink  { background: #fce8f3; color: #cc7da9; }
.chip-gray  { background: #f0f0f0; color: #666; }

/* ── Count badge ──────────────────────────────────────────────── */
.count-badge {
  display: inline-flex;
  align-items: center;
  background: #f4fbfa;
  border: 1px solid #c7ded8;
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 0.88rem;
  font-weight: 700;
  color: #2f8f7b;
}

/* ── Status ───────────────────────────────────────────────────── */
.status-text { color: #486b68; text-align: center; padding: 2rem 0; }

/* ── Quick actions ────────────────────────────────────────────── */
.quick-actions {
  background: #f4fbfa;
  border: 1px solid #c3e7e1;
  border-radius: 14px;
  padding: 1.25rem 1.5rem;
}

.quick-actions h2 {
  color: #26b6b8;
  font-size: 1rem;
  margin: 0 0 0.85rem;
}

.quick-link-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quick-link {
  border-radius: 999px;
  background: #cc7da9;
  color: #ffffff;
  padding: 7px 16px;
  font-size: 0.88rem;
  font-weight: 700;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  transition: background 0.15s;
}

.quick-link:hover { background: #b96593; }

/* ── Responsive ───────────────────────────────────────────────── */
@media (max-width: 640px) {
  .dashboard-page { padding: 1.25rem 0.75rem 3rem; }

  .dash-header { padding: 1.1rem 1rem; }
  .dash-header h1 { font-size: 1.5rem; }

  .dash-grid { grid-template-columns: 1fr; }
  .card-today { grid-column: 1; }
  .card-profile { grid-column: 1; }

  .today-slot { flex-wrap: wrap; }
  .slot-label { min-width: 70px; }

  .quick-link-grid { display: grid; grid-template-columns: 1fr 1fr; }
}
</style>
