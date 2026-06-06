<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { mealPlanApi } from '@/shared/api/mealPlanApi'
import { recipeApi } from '@/shared/api/recipeApi'
import type { MealPlanEntryResponse, MealPlanWeekResponse } from '@/types/mealPlan'
import type { RecipeResponse } from '@/types/recipe'

type WeekDay = {
  key: string
  labelKey: string
  date: string
}

const { t } = useI18n()

const loading = ref(true)
const error = ref<string | null>(null)
const actionError = ref<string | null>(null)
const week = ref<MealPlanWeekResponse | null>(null)
const recipes = ref<RecipeResponse[]>([])
const selectedRecipeByDate = ref<Record<string, string>>({})

const dayKeys = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const weekDays = computed<WeekDay[]>(() => {
  const weekStart = week.value?.weekStart ?? formatDate(startOfCurrentWeek())
  return dayKeys.map((key, index) => ({
    key,
    labelKey: `mealPlan.days.${key}`,
    date: addDays(weekStart, index),
  }))
})

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
  } catch {
    error.value = t('mealPlan.errors.load')
  } finally {
    loading.value = false
  }
}

async function saveDay(date: string) {
  const recipeId = selectedRecipeByDate.value[date]
  if (!recipeId) {
    actionError.value = t('mealPlan.errors.noRecipeSelected')
    return
  }

  try {
    actionError.value = null
    const saved = await mealPlanApi.setDay(date, Number(recipeId))
    upsertEntry(saved)
    selectedRecipeByDate.value[date] = String(saved.recipe.id)
  } catch {
    actionError.value = t('mealPlan.errors.save')
  }
}

async function removeDay(date: string) {
  try {
    actionError.value = null
    await mealPlanApi.deleteDay(date)
    if (week.value) {
      week.value.entries = week.value.entries.filter(entry => entry.plannedDate !== date)
    }
    selectedRecipeByDate.value[date] = ''
  } catch {
    actionError.value = t('mealPlan.errors.remove')
  }
}

function entryFor(date: string) {
  return week.value?.entries.find(entry => entry.plannedDate === date)
}

function syncSelectedRecipes(entries: MealPlanEntryResponse[]) {
  selectedRecipeByDate.value = Object.fromEntries(
    entries.map(entry => [entry.plannedDate, String(entry.recipe.id)]),
  )
}

function upsertEntry(entry: MealPlanEntryResponse) {
  if (!week.value) {
    return
  }
  const existingIndex = week.value.entries.findIndex(item => item.plannedDate === entry.plannedDate)
  if (existingIndex >= 0) {
    week.value.entries.splice(existingIndex, 1, entry)
  } else {
    week.value.entries.push(entry)
  }
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

      <article v-for="day in weekDays" :key="day.date" class="day-card">
        <div class="day-card-header">
          <h2>{{ t(day.labelKey) }}</h2>
          <span>{{ day.date }}</span>
        </div>

        <div v-if="entryFor(day.date)" class="planned-recipe">
          <span class="planned-label">{{ t('mealPlan.plannedRecipe') }}</span>
          <strong>{{ entryFor(day.date)?.recipe.title }}</strong>
        </div>
        <p v-else class="empty-day">{{ t('mealPlan.empty.day') }}</p>

        <label class="recipe-select">
          <span>{{ t('mealPlan.form.recipe') }}</span>
          <select v-model="selectedRecipeByDate[day.date]" :disabled="recipes.length === 0">
            <option value="">{{ t('mealPlan.form.chooseRecipe') }}</option>
            <option v-for="recipe in recipes" :key="recipe.id" :value="String(recipe.id)">
              {{ recipe.title }}
            </option>
          </select>
        </label>

        <div class="actions">
          <button type="button" class="primary-button" :disabled="recipes.length === 0" @click="saveDay(day.date)">
            {{ entryFor(day.date) ? t('mealPlan.actions.save') : t('mealPlan.actions.add') }}
          </button>
          <button
            v-if="entryFor(day.date)"
            type="button"
            class="secondary-button"
            @click="removeDay(day.date)"
          >
            {{ t('mealPlan.actions.remove') }}
          </button>
        </div>
      </article>
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

.planned-recipe,
.empty-day {
  min-height: 56px;
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

.recipe-select select {
  min-height: 40px;
  border: 1.5px solid #c3e7e1;
  border-radius: 8px;
  padding: 8px 10px;
  background: #ffffff;
  font: inherit;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: auto;
}

.primary-button,
.secondary-button {
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

.secondary-button {
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

.full-width {
  grid-column: 1 / -1;
}
</style>
