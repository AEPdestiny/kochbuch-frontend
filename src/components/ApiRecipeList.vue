/**Zeigt auf der Startseite öffentliche API-Rezepte plus eigene veröffentlichte Rezepte.*/

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { recipeApi } from '@/shared/api/recipeApi'
import type { Recipe } from '@/types/recipe'

type RecipeSource = 'external' | 'dishly'
type DisplayRecipe = Recipe & {
  source: RecipeSource
}

const search = ref('') // Suchtext für das Input-Feld
const recipes = ref<DisplayRecipe[]>([]) // kombinierte Liste, die im Grid angezeigt wird
const allExternal = ref<Recipe[]>([]) // alle geladenen externen API-Rezepte
const ownPublished = ref<Recipe[]>([]) // eigene veröffentlichte Rezepte aus dem Backend

// Laden/Fehler/ausgewähltes Rezept
const loading = ref(true)
const error = ref<string | null>(null)
const selected = ref<DisplayRecipe | null>(null)
const { t } = useI18n()

const EXTERNAL_CHUNK = 20// wie viele API-Rezepte gleichzeitig anzeigen
const SEARCH_DEBOUNCE_MS = 400
let searchTimeout: ReturnType<typeof setTimeout> | null = null
let externalRequestCounter = 0

//erstellt eine zufällige Reihenfolge der übergebenen Rezepte
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

// Baut die aktuell sichtbare Liste aus zufälligen externen Rezepten + eigenen veröffentlichten
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

const toDisplayRecipe = (recipe: Recipe, source: RecipeSource): DisplayRecipe => ({
  ...recipe,
  source,
})

// Lädt externe und eigene veröffentlichte Rezepte parallel vom Backend
const loadRecipes = async () => {
  loading.value = true
  try {
    const [external, own] = await Promise.all([
      recipeApi.getExternalRecipes(),
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

onMounted(() => {
  loadRecipes()
})

watch(search, value => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  const query = value.trim()
  if (query.length > 0 && query.length < 2) {
    buildView()
    return
  }

  searchTimeout = setTimeout(() => {
    loadExternalRecipes(query)
  }, SEARCH_DEBOUNCE_MS)
})

const loadExternalRecipes = async (query: string) => {
  const requestId = ++externalRequestCounter
  try {
    const external = query
      ? await recipeApi.getExternalRecipes(query)
      : await recipeApi.getExternalRecipes()
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

const filtered = computed(() => recipes.value)

const filterRecipes = (items: Recipe[], q: string) => {
  if (!q) return items
  return items.filter(r =>
    r.title.toLowerCase().includes(q) ||
    r.ingredients.toLowerCase().includes(q) ||
    r.category.toLowerCase().includes(q)
  )
}

// Öffnet das Detail-Overlay für ein ausgewähltes Rezept
const openDetails = (recipe: DisplayRecipe) => {
  selected.value = recipe
}
// Schließt das Detail-Overlay wieder
const closeDetails = () => {
  selected.value = null
}
// Mischt die externen Rezepte neu und baut die Ansicht erneut auf
const shuffleRecipes = () => {
  if (!allExternal.value.length) return
  buildView()
}

</script>

<template>
  <!-- Gesamte Home-Sektion mit Suchfeld, Shuffle-Button und Rezeptliste -->
  <section class="home-wrap">
    <!-- Hero-Bereich mit Intro-Text und Suche -->
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
    </section>

    <!-- Shuffle-Button zum Neu-Mischen der externen Rezepte -->
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

        <!-- Karten für alle gefilterten Rezepte -->
        <article
          v-for="r in filtered"
          :key="`${r.title}-${r.id}`"
          class="recipe-card"
          @click="openDetails(r)"
        >
          <div class="image-wrap" v-if="r.imageUrl">
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
          </div>
        </article>

        <!-- Hinweis, wenn kein Treffer zur Suche passt -->
        <p v-if="!loading && filtered.length === 0" class="status-text">
          {{ t('home.empty') }}
        </p>
      </div>
    </section>

    <!-- Overlay mit Detailansicht zum ausgewählten Rezept -->
    <div v-if="selected" class="overlay" @click.self="closeDetails">
      <div class="overlay-card">
        <button class="overlay-close" :aria-label="t('home.overlay.close')" @click="closeDetails">x</button>

        <h3 class="overlay-title">{{ selected.title }}</h3>

        <p class="overlay-meta">
          <span v-if="selected.category">{{ selected.category }}</span>
          <span v-if="selected.difficulty"> · {{ selected.difficulty }}</span>
          <span v-if="selected.rating"> · {{ t('home.meta.rating', { rating: selected.rating.toFixed(1) }) }}</span>
        </p>

        <p class="overlay-meta">
          <span v-if="selected.prepTimeMinutes || selected.cookTimeMinutes">
            {{ t('home.meta.minutes', { minutes: selected.prepTimeMinutes + selected.cookTimeMinutes }) }}
          </span>
          <span v-if="selected.servings"> · {{ t('home.meta.servings', { count: selected.servings }) }}</span>
        </p>

        <p class="overlay-meta">
          <strong>{{ t('home.overlay.source') }}:</strong>
          <span>{{ selected.source === 'dishly' ? t('home.source.dishly') : t('home.source.external') }}</span>
        </p>

        <h4 class="overlay-subtitle">{{ t('home.overlay.ingredients') }}</h4>
        <p class="overlay-text">{{ selected.ingredients }}</p>

        <h4 class="overlay-subtitle">{{ t('home.overlay.instructions') }}</h4>
        <p class="overlay-text">{{ selected.instructions }}</p>
      </div>
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

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 20, 25, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
}

.overlay-card {
  max-width: 700px;
  width: 90%;
  max-height: 85vh;
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28);
  padding: 22px 24px 20px 24px;
  overflow-y: auto;
}

.overlay-close {
  border: none;
  background: transparent;
  font-size: 1.6rem;
  line-height: 1;
  float: right;
  cursor: pointer;
  color: #486b68;
}

.overlay-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: #cc7da9;
  margin: 4px 0 6px 0;
}

.overlay-meta {
  font-size: 0.95rem;
  color: #486b68;
  margin-bottom: 6px;
}

.overlay-subtitle {
  font-size: 1.05rem;
  font-weight: 700;
  color: #26b6b8;
  margin-top: 14px;
  margin-bottom: 6px;
}

.overlay-text {
  font-size: 0.95rem;
  color: #2b1b23;
  white-space: pre-line;
}
</style>
