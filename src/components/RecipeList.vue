<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const props = defineProps<{ search?: string }>()

type Recipe = {
  id: string
  title: string
  ingredients: string
  favorite: boolean
}

const recipes = ref<Recipe[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const newTitle = ref('')
const newIngredients = ref('')
const newFavorite = ref(false)

const loadRecipes = () => {
  const baseUrl = import.meta.env.VITE_BACKEND_BASE_URL ?? 'http://localhost:8080'
  const endpoint = baseUrl + '/recipes'

  const requestOptions: RequestInit = {
    method: 'GET',
    redirect: 'follow',
  }

  fetch(endpoint, requestOptions)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Fehler beim Laden: ${response.status}`)
      }
      return response.json()
    })
    .then((result: Recipe[]) => {
      recipes.value = []
      result.forEach(r => {
        recipes.value.push(r)
      })
      error.value = null
    })
    .catch(err => {
      console.log('error', err)
      error.value = err.message ?? 'Unbekannter Fehler'
    })
    .finally(() => {
      loading.value = false
    })
}
const createRecipe = async () => {
  const baseUrl = import.meta.env.VITE_BACKEND_BASE_URL ?? 'http://localhost:8080'
  const endpoint = baseUrl + '/recipes'

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle.value,
        ingredients: newIngredients.value,
        favorite: newFavorite.value,
      }),
    })

    if (!res.ok) {
      throw new Error(`Fehler beim Speichern: ${res.status}`)
    }

    const saved = (await res.json()) as Recipe
    recipes.value.push(saved)

    newTitle.value = ''
    newIngredients.value = ''
    newFavorite.value = false
    error.value = null
  } catch (e: any) {
    console.error('error', e)
    error.value = e.message ?? 'Unbekannter Fehler'
  }
}

onMounted(() => {
  loadRecipes()
})

const filtered = computed(() => {
  if (!props.search) return recipes.value
  const q = props.search.toLowerCase().trim()
  return recipes.value.filter(r =>
    r.title.toLowerCase().includes(q) ||
    r.ingredients.toLowerCase().includes(q)
  )
})
</script>


<template>
  <section class="recipe-list">
    <h3 class="recipes-title">Rezepte des Tages</h3>

    <form class="new-recipe-form" @submit.prevent="createRecipe">
      <input
        v-model="newTitle"
        type="text"
        placeholder="Titel"
        required
      />
      <input
        v-model="newIngredients"
        type="text"
        placeholder="Zutaten"
        required
      />
      <label>
        <input type="checkbox" v-model="newFavorite" />
        Favorit
      </label>
      <button type="submit">Rezept speichern</button>
    </form>

    <p v-if="loading">Lade Rezepte …</p>
    <p v-else-if="error">Fehler: {{ error }}</p>

    <ul v-else class="recipes">
      <li v-for="r in filtered" :key="r.id" class="recipe-card">
        <div class="main-row">
          <span class="name">
            {{ r.title }}
            <span v-if="r.favorite" class="star" aria-label="Favorit">★ Favorit</span>
          </span>
        </div>
        <span class="ingredients">{{ r.ingredients }}</span>
      </li>
      <li v-if="filtered.length === 0" class="none-found">
        Keine passenden Rezepte gefunden.
      </li>
    </ul>
  </section>
</template>

<style scoped>
.recipe-list {
  width: 100%;
  max-width: 1000px;
  margin: 0 auto 40px auto;
  padding: 29px 10vw 22px 10vw;
  background: #fff;
}
.recipes-title {
  text-align: left;
  font-size: 1.46rem;
  font-weight: 800;
  color: #198a49;
  margin-bottom: 25px;
  padding-left: 0.25em;
}
.recipes {
  list-style: none;
  padding: 0;
  margin: 0;
}
.recipe-card {
  background: #ecfbee;
  border-radius: 12px;
  margin-bottom: 20px;
  box-shadow: 0 1px 7px 0 rgba(33,120,54,0.08);
  padding: 17px 28px 14px 28px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  border: 1.5px solid #e3f6e8;
  min-width: 0;
}
.recipe-card:hover {
  box-shadow: 0 4px 18px 0 rgba(33,120,54,0.16);
  background: #e5fbe8;
}
.main-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}
.name {
  font-size: 1.24rem;
  font-weight: 700;
  color: #198a49;
  display: inline-flex;
  align-items: center;
  gap: 9px;
}
.star {
  color: #ffd800;
  font-weight: bold;
  font-size:1.03em;
  margin-left: 7px;
  text-shadow: 1px 1px 1px #eec330;
}
.ingredients {
  color: #324240;
  font-size: 1.13rem;
  margin-top: 4px;
}
.none-found {
  color: #a14c2b;
  font-weight: 700;
  opacity: 0.88;
  padding-top: 18px;
  font-size: 1.11rem;
  text-align: center;
}
</style>
