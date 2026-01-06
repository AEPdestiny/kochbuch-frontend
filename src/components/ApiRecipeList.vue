<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

type Recipe = {
  id: number | string
  title: string
  imageUrl: string
  prepTimeMinutes: number
  cookTimeMinutes: number
  servings: number
  difficulty: string
  category: string
  rating: number
  ingredients: string
  instructions: string
  favorite?: boolean
  published?: boolean
}

const search = ref('')
const recipes = ref<Recipe[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const selected = ref<Recipe | null>(null)
const togglingFavorite = ref<string | number | null>(null)

const baseUrl = import.meta.env.VITE_BACKEND_BASE_URL ?? 'http://localhost:8080'

onMounted(async () => {
  try {
    const [extRes, ownRes] = await Promise.all([
      fetch(baseUrl + '/recipes/external'),
      fetch(baseUrl + '/recipes'),
    ])

    if (!extRes.ok || !ownRes.ok) {
      throw new Error('Error while loading recipes')
    }

    const external: Recipe[] = await extRes.json()
    const own: Recipe[] = await ownRes.json()

    recipes.value = [
      ...external,
      ...own.filter(r => r.published),
    ]
    error.value = null
  } catch (e: any) {
    error.value = e.message ?? 'Unknown error'
  } finally {
    loading.value = false
  }
})

const filtered = computed(() => {
  const q = search.value.toLowerCase().trim()
  if (!q) return recipes.value
  return recipes.value.filter(r =>
    r.title.toLowerCase().includes(q) ||
    r.ingredients.toLowerCase().includes(q) ||
    r.category.toLowerCase().includes(q)
  )
})

const openDetails = (recipe: Recipe) => {
  selected.value = recipe
}

const closeDetails = () => {
  selected.value = null
}

const toggleFavorite = async (r: Recipe) => {
  if (typeof r.id === 'string' && r.id.toString().startsWith('ext-')) {
    r.favorite = !r.favorite
    return
  }

  togglingFavorite.value = r.id
  try {
    const res = await fetch(`${baseUrl}/recipes/${r.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...r, favorite: !r.favorite }),
    })
    if (!res.ok) {
      throw new Error(`Error updating favorite: ${res.status}`)
    }
    const updated = (await res.json()) as Recipe
    const idx = recipes.value.findIndex(x => x.id === updated.id)
    if (idx !== -1) recipes.value[idx] = updated
  } catch (e: any) {
    console.error(e)
    error.value = e.message ?? 'Unknown error'
  } finally {
    togglingFavorite.value = null
  }
}
</script>

<template>
  <section class="home-wrap">
    <section class="hero">
      <p class="hero-desc">
        Discover dishes from all around the world and find your next favorite recipe.
      </p>
      <input
        v-model="search"
        class="search-input"
        type="search"
        placeholder="Search by title, cuisine or ingredients"
        aria-label="Search recipes by title, cuisine or ingredients"
      />
    </section>

    <section class="list-wrap">
      <p v-if="loading" class="status-text">Loading recipes…</p>
      <p v-else-if="error" class="status-text error">Error: {{ error }}</p>

      <div v-else class="recipe-grid">
        <article
          v-for="r in filtered"
          :key="r.id"
          class="recipe-card"
          @click="openDetails(r)"
        >
          <div class="image-wrap" v-if="r.imageUrl">
            <img :src="r.imageUrl" :alt="r.title" />
          </div>

          <div class="card-content">
            <h3 class="card-title">{{ r.title }}</h3>

            <p class="card-meta">
              <span v-if="r.category" class="pill pill-mint">{{ r.category }}</span>
              <span v-if="r.difficulty" class="pill pill-soft">{{ r.difficulty }}</span>
              <span v-if="r.rating" class="pill pill-rating">
                ★ {{ r.rating.toFixed(1) }}
              </span>
            </p>

            <p class="card-times">
              <span v-if="r.prepTimeMinutes || r.cookTimeMinutes">
                ⏱ {{ r.prepTimeMinutes + r.cookTimeMinutes }} min
              </span>
              <span v-if="r.servings"> • 🍽 {{ r.servings }} servings</span>
            </p>

            <p class="card-ingredients">
              {{ r.ingredients }}
            </p>

            <div class="card-actions">
              <button
                class="fav-btn"
                @click.stop="toggleFavorite(r)"
                :disabled="togglingFavorite === r.id"
              >
                <span v-if="r.favorite">★ Remove favorite</span>
                <span v-else>☆ Mark as favorite</span>
              </button>
            </div>
          </div>
        </article>

        <p v-if="!loading && filtered.length === 0" class="status-text">
          No matching recipes found.
        </p>
      </div>
    </section>

    <div v-if="selected" class="overlay" @click.self="closeDetails">
      <div class="overlay-card">
        <button class="overlay-close" @click="closeDetails">×</button>

        <h3 class="overlay-title">{{ selected.title }}</h3>

        <p class="overlay-meta">
          <span v-if="selected.category">{{ selected.category }}</span>
          <span v-if="selected.difficulty"> • {{ selected.difficulty }}</span>
          <span v-if="selected.rating"> • ★ {{ selected.rating.toFixed(1) }}</span>
        </p>

        <p class="overlay-meta">
          <span v-if="selected.prepTimeMinutes || selected.cookTimeMinutes">
            ⏱ {{ selected.prepTimeMinutes + selected.cookTimeMinutes }} min
          </span>
          <span v-if="selected.servings"> • 🍽 {{ selected.servings }} servings</span>
        </p>

        <h4 class="overlay-subtitle">Ingredients</h4>
        <p class="overlay-text">{{ selected.ingredients }}</p>

        <h4 class="overlay-subtitle">Instructions</h4>
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
  margin: 30px 0 34px 0;
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

.card-actions {
  margin-top: 6px;
}

.fav-btn {
  border: none;
  background: transparent;
  color: #cc7da9;
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0;
}

.fav-btn:disabled {
  opacity: 0.6;
  cursor: wait;
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
