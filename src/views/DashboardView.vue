<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { recipeApi } from '@/shared/api/recipeApi'
import { pantryApi } from '@/shared/api/pantryApi'
import { shoppingListApi } from '@/shared/api/shoppingListApi'
import { useAuthStore } from '@/stores/authStore'
import type { Recipe } from '@/types/recipe'
import type { PantryItem } from '@/types/pantry'
import type { ShoppingListItem } from '@/types/shoppingList'

const authStore = useAuthStore()

const recipes = ref<Recipe[]>([])
const pantryItems = ref<PantryItem[]>([])
const shoppingListItems = ref<ShoppingListItem[]>([])

const loading = ref(true)
const recipeError = ref<string | null>(null)
const pantryError = ref<string | null>(null)
const shoppingListError = ref<string | null>(null)

const ownRecipeCount = computed(() => recipes.value.length)
const publishedRecipeCount = computed(() => recipes.value.filter(recipe => recipe.published).length)
const favoriteRecipeCount = computed(() => recipes.value.filter(recipe => recipe.favorite).length)
const pantryItemCount = computed(() => pantryItems.value.length)
const shoppingListItemCount = computed(() => shoppingListItems.value.length)
const openShoppingListItemCount = computed(() =>
  shoppingListItems.value.filter(item => !item.checked).length,
)

onMounted(async () => {
  await Promise.all([
    loadRecipes(),
    loadPantryItems(),
    loadShoppingListItems(),
  ])
  loading.value = false
})

async function loadRecipes() {
  try {
    recipes.value = await recipeApi.getMyRecipes()
    recipeError.value = null
  } catch {
    recipes.value = []
    recipeError.value = 'Rezeptdaten konnten nicht geladen werden.'
  }
}

async function loadPantryItems() {
  try {
    pantryItems.value = await pantryApi.getPantryItems()
    pantryError.value = null
  } catch {
    pantryItems.value = []
    pantryError.value = 'Vorratsdaten konnten nicht geladen werden.'
  }
}

async function loadShoppingListItems() {
  try {
    shoppingListItems.value = await shoppingListApi.getShoppingListItems()
    shoppingListError.value = null
  } catch {
    shoppingListItems.value = []
    shoppingListError.value = 'Einkaufslistendaten konnten nicht geladen werden.'
  }
}
</script>

<template>
  <section class="dashboard-page">
    <header class="dashboard-header">
      <p class="eyebrow">Dashboard</p>
      <h1>Willkommen zurück, {{ authStore.user?.username ?? 'User' }}</h1>
      <p>
        Dein schneller Überblick über Rezepte, Vorrat und Einkaufsliste.
      </p>
    </header>

    <p v-if="loading" class="status-text">Dashboard wird geladen...</p>

    <div v-else class="dashboard-content">
      <section class="stats-grid" aria-label="Dishly Statistiken">
        <article class="stat-card">
          <span class="stat-label">Eigene Rezepte</span>
          <strong class="stat-value">{{ recipeError ? '–' : ownRecipeCount }}</strong>
          <small v-if="recipeError">{{ recipeError }}</small>
        </article>

        <article class="stat-card">
          <span class="stat-label">Veröffentlichte Rezepte</span>
          <strong class="stat-value">{{ recipeError ? '–' : publishedRecipeCount }}</strong>
          <small v-if="recipeError">{{ recipeError }}</small>
        </article>

        <article class="stat-card">
          <span class="stat-label">Favoriten</span>
          <strong class="stat-value">{{ recipeError ? '–' : favoriteRecipeCount }}</strong>
          <small v-if="recipeError">{{ recipeError }}</small>
        </article>

        <article class="stat-card">
          <span class="stat-label">Vorratsartikel</span>
          <strong class="stat-value">{{ pantryError ? '–' : pantryItemCount }}</strong>
          <small v-if="pantryError">{{ pantryError }}</small>
        </article>

        <article class="stat-card">
          <span class="stat-label">Einkaufslisten-Items</span>
          <strong class="stat-value">{{ shoppingListError ? '–' : shoppingListItemCount }}</strong>
          <small v-if="shoppingListError">{{ shoppingListError }}</small>
        </article>

        <article class="stat-card">
          <span class="stat-label">Noch offen</span>
          <strong class="stat-value">{{ shoppingListError ? '–' : openShoppingListItemCount }}</strong>
          <small v-if="shoppingListError">{{ shoppingListError }}</small>
        </article>
      </section>

      <section class="quick-links" aria-label="Schnellzugriffe">
        <h2>Schnellzugriffe</h2>
        <div class="quick-link-grid">
          <RouterLink to="/my-recipes" class="quick-link">Meine Rezepte</RouterLink>
          <RouterLink to="/pantry" class="quick-link">Vorrat</RouterLink>
          <RouterLink to="/shopping-list" class="quick-link">Einkaufsliste</RouterLink>
          <RouterLink to="/" class="quick-link">Externe Rezepte suchen</RouterLink>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.dashboard-page {
  width: 100%;
  max-width: 1100px;
  margin: 30px auto 40px auto;
  padding: 0 10vw;
}

.dashboard-header {
  background: #fff7fb;
  border: 1px solid #f6d9ea;
  border-radius: 22px;
  box-shadow: 0 2px 18px rgba(191, 140, 167, 0.12);
  padding: 24px 22px 20px 22px;
  margin-bottom: 22px;
}

.eyebrow {
  color: #26b6b8;
  font-weight: 800;
  margin-bottom: 4px;
}

.dashboard-header h1 {
  color: #cc7da9;
  font-size: 2rem;
  margin-bottom: 6px;
}

.dashboard-header p {
  color: #486b68;
}

.status-text {
  color: #486b68;
  text-align: center;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.stat-card {
  background: #ffffff;
  border: 1px solid #c3e7e1;
  border-radius: 12px;
  box-shadow: 0 1px 7px rgba(79, 127, 120, 0.1);
  padding: 18px;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-label {
  color: #486b68;
  font-weight: 700;
}

.stat-value {
  color: #2b1b23;
  font-size: 2rem;
  line-height: 1;
}

.stat-card small {
  color: #a14c2b;
  line-height: 1.35;
}

.quick-links {
  background: #f4fbfa;
  border: 1px solid #c3e7e1;
  border-radius: 12px;
  padding: 18px;
}

.quick-links h2 {
  color: #26b6b8;
  font-size: 1.2rem;
  margin-bottom: 12px;
}

.quick-link-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.quick-link {
  border-radius: 999px;
  background: #cc7da9;
  color: #ffffff;
  padding: 9px 16px;
  font-weight: 700;
  text-decoration: none;
}

.quick-link:hover {
  background: #b96593;
}
</style>
