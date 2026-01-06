<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const props = defineProps<{ search?: string }>()

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
  favorite: boolean
  published: boolean
}

const recipes = ref<Recipe[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const newTitle = ref('')
const newImageUrl = ref('')
const newPrepTime = ref<number | null>(null)
const newCookTime = ref<number | null>(null)
const newServings = ref<number | null>(null)
const newDifficulty = ref('')
const newCategory = ref('')
const newRating = ref<number | null>(null)
const newIngredients = ref('')
const newInstructions = ref('')
const newFavorite = ref(false)
const newPublished = ref(false)

const editing = ref<Recipe | null>(null)

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
        throw new Error(`Error loading recipes: ${response.status}`)
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
      error.value = err.message ?? 'Unknown error'
    })
    .finally(() => {
      loading.value = false
    })
}
const createRecipe = async () => {
  const baseUrl = import.meta.env.VITE_BACKEND_BASE_URL ?? 'http://localhost:8080'
  if (
    !newTitle.value.trim() ||
    !newIngredients.value.trim() ||
    !newInstructions.value.trim()
  ) {
    error.value = 'Please fill in all required fields.'
    return
  }
  const endpoint = baseUrl + '/recipes'

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle.value,
        imageUrl: newImageUrl.value,
        prepTimeMinutes: newPrepTime.value ?? 0,
        cookTimeMinutes: newCookTime.value ?? 0,
        servings: newServings.value ?? 0,
        difficulty: newDifficulty.value,
        category: newCategory.value,
        rating: newRating.value ?? 0,
        ingredients: newIngredients.value,
        instructions: newInstructions.value,
        favorite: newFavorite.value,
        published: newPublished.value,
      }),
    })

    if (!res.ok) {
      throw new Error(`Error saving recipe: ${res.status}`)
    }

    const saved = (await res.json()) as Recipe
    recipes.value.push(saved)

    newTitle.value = ''
    newImageUrl.value = ''
    newPrepTime.value = null
    newCookTime.value = null
    newServings.value = null
    newDifficulty.value = ''
    newCategory.value = ''
    newRating.value = null
    newIngredients.value = ''
    newInstructions.value = ''
    newFavorite.value = false
    newPublished.value = false
    error.value = null
  } catch (e: any) {
    console.error('error', e)
    error.value = e.message ?? 'Unknown error'
  }
}

const startEdit = (r: Recipe) => {
  editing.value = { ...r }
}

const cancelEdit = () => {
  editing.value = null
}

const updateRecipe = async () => {
  const baseUrl = import.meta.env.VITE_BACKEND_BASE_URL ?? 'http://localhost:8080'
  if (!editing.value) return
  const endpoint = `${baseUrl}/recipes/${editing.value.id}`

  try {
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing.value),
    })
    if (!res.ok) {
      throw new Error(`Error updating recipe: ${res.status}`)
    }
    const updated = (await res.json()) as Recipe
    const idx = recipes.value.findIndex(r => r.id === updated.id)
    if (idx !== -1) {
      recipes.value[idx] = updated
    }
    editing.value = null
    error.value = null
  } catch (e: any) {
    console.error(e)
    error.value = e.message ?? 'Unknown error'
  }
}

const deleteRecipe = async (id: number | string) => {
  const baseUrl = import.meta.env.VITE_BACKEND_BASE_URL ?? 'http://localhost:8080'
  const endpoint = `${baseUrl}/recipes/${id}`

  try {
    const res = await fetch(endpoint, { method: 'DELETE' })
    if (!res.ok) {
      throw new Error(`Error deleting recipe: ${res.status}`)
    }
    recipes.value = recipes.value.filter(r => r.id !== id)
    if (editing.value && editing.value.id === id) {
      editing.value = null
    }
  } catch (e: any) {
    console.error(e)
    error.value = e.message ?? 'Unknown error'
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
const favorites = computed(() => recipes.value.filter(r => r.favorite))
</script>

<template>
  <section class="recipe-manager">
    <div class="form-card">
      <h3 class="form-title">Create a new recipe</h3>
      <p class="form-subtitle">
        All fields marked with <span class="required-star">*</span> are required.
      </p>

      <form class="new-recipe-form" @submit.prevent="createRecipe">
        <div class="form-row">
          <div class="form-field">
            <label>
              Title <span class="required-star">*</span>
            </label>
            <input
              v-model="newTitle"
              type="text"
              placeholder="e.g. Creamy Tomato Pasta"
            />
          </div>

          <div class="form-field">
            <label>Image URL</label>
            <input
              v-model="newImageUrl"
              type="url"
              placeholder="https://example.com/recipe.jpg"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-field small">
            <label>Prep time (min)</label>
            <input
              v-model.number="newPrepTime"
              type="number"
              min="0"
              placeholder="10"
            />
          </div>
          <div class="form-field small">
            <label>Cook time (min)</label>
            <input
              v-model.number="newCookTime"
              type="number"
              min="0"
              placeholder="20"
            />
          </div>
          <div class="form-field small">
            <label>Servings</label>
            <input
              v-model.number="newServings"
              type="number"
              min="0"
              placeholder="2"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label>Difficulty</label>
            <input
              v-model="newDifficulty"
              type="text"
              placeholder="e.g. easy, medium, hard"
            />
          </div>
          <div class="form-field">
            <label>Category / Cuisine</label>
            <input
              v-model="newCategory"
              type="text"
              placeholder="e.g. Italian, Dessert"
            />
          </div>
          <div class="form-field small">
            <label>Rating</label>
            <input
              v-model.number="newRating"
              type="number"
              min="0"
              max="5"
              step="0.1"
              placeholder="4.5"
            />
          </div>
        </div>

        <div class="form-field">
          <label>
            Ingredients <span class="required-star">*</span>
          </label>
          <textarea
            v-model="newIngredients"
            rows="3"
            placeholder="List your ingredients, separated by commas."
          ></textarea>
        </div>

        <div class="form-field">
          <label>
            Instructions <span class="required-star">*</span>
          </label>
          <textarea
            v-model="newInstructions"
            rows="5"
            placeholder="Write your step-by-step instructions."
          ></textarea>
        </div>

        <div class="form-toggle-row">
          <label class="toggle-item">
            <input type="checkbox" v-model="newFavorite" />
            <span>Mark as favorite</span>
          </label>
          <label class="toggle-item">
            <input type="checkbox" v-model="newPublished" />
            <span>Show on Home (published)</span>
          </label>
        </div>

        <button type="submit" class="submit-btn">
          Save recipe
        </button>

        <p v-if="error" class="error-text">
          {{ error }}
        </p>
      </form>
    </div>

    <div class="list-card">
      <h3 class="recipes-title">Your created recipes</h3>

      <p v-if="loading" class="status-text">Loading recipes…</p>
      <p v-else-if="error" class="status-text error">Error: {{ error }}</p>

      <ul v-else class="recipes">
        <li v-for="r in filtered" :key="r.id" class="recipe-card">
          <div class="recipe-header" @click="startEdit(r)">
            <div>
              <h4 class="name">
                {{ r.title }}
              </h4>
              <p class="meta">
                <span v-if="r.category">{{ r.category }}</span>
                <span v-if="r.difficulty"> • {{ r.difficulty }}</span>
                <span v-if="r.rating"> • ★ {{ r.rating.toFixed(1) }}</span>
              </p>
              <p class="meta">
                <span v-if="r.prepTimeMinutes || r.cookTimeMinutes">
                  ⏱ {{ r.prepTimeMinutes + r.cookTimeMinutes }} min
                </span>
                <span v-if="r.servings"> • 🍽 {{ r.servings }} servings</span>
              </p>
            </div>
            <div class="badge-column">
              <span v-if="r.favorite" class="badge badge-fav">★ Favorite</span>
              <span v-if="r.published" class="badge badge-published">Published on Home</span>
            </div>
          </div>

          <p class="ingredients">
            {{ r.ingredients }}
          </p>

          <div class="card-actions">
            <button class="link-btn" @click.stop="startEdit(r)">Edit</button>
            <button class="link-btn danger" @click.stop="deleteRecipe(r.id)">Delete</button>
          </div>
        </li>

        <li v-if="!loading && filtered.length === 0" class="none-found">
          No recipes found. Create your first Dishly recipe above.
        </li>
      </ul>

      <div v-if="editing" class="edit-panel">
        <h4>Edit recipe</h4>

        <div class="form-row">
          <div class="form-field">
            <label>Title</label>
            <input v-model="editing.title" type="text" />
          </div>
          <div class="form-field">
            <label>Image URL</label>
            <input v-model="editing.imageUrl" type="url" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-field small">
            <label>Prep time (min)</label>
            <input v-model.number="editing.prepTimeMinutes" type="number" min="0" />
          </div>
          <div class="form-field small">
            <label>Cook time (min)</label>
            <input v-model.number="editing.cookTimeMinutes" type="number" min="0" />
          </div>
          <div class="form-field small">
            <label>Servings</label>
            <input v-model.number="editing.servings" type="number" min="0" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label>Difficulty</label>
            <input v-model="editing.difficulty" type="text" />
          </div>
          <div class="form-field">
            <label>Category / Cuisine</label>
            <input v-model="editing.category" type="text" />
          </div>
          <div class="form-field small">
            <label>Rating</label>
            <input v-model.number="editing.rating" type="number" min="0" max="5" step="0.1" />
          </div>
        </div>

        <div class="form-field">
          <label>Ingredients</label>
          <textarea v-model="editing.ingredients" rows="3"></textarea>
        </div>

        <div class="form-field">
          <label>Instructions</label>
          <textarea v-model="editing.instructions" rows="5"></textarea>
        </div>

        <div class="form-toggle-row">
          <label class="toggle-item">
            <input type="checkbox" v-model="editing.favorite" />
            <span>Mark as favorite</span>
          </label>
          <label class="toggle-item">
            <input type="checkbox" v-model="editing.published" />
            <span>Show on Home (published)</span>
          </label>
        </div>

        <div class="edit-buttons">
          <button class="submit-btn" @click="updateRecipe">Save changes</button>
          <button class="cancel-btn" @click="cancelEdit">Cancel</button>
        </div>
      </div>

      <h3 class="favorites-title">Your favorite recipes</h3>

      <ul class="recipes favorites-list">
        <li v-for="r in favorites" :key="'fav-' + r.id" class="recipe-card">
          <div class="recipe-header">
            <div>
              <h4 class="name">
                {{ r.title }}
              </h4>
              <p class="meta">
                <span v-if="r.category">{{ r.category }}</span>
                <span v-if="r.difficulty"> • {{ r.difficulty }}</span>
                <span v-if="r.rating"> • ★ {{ r.rating.toFixed(1) }}</span>
              </p>
            </div>
            <div class="badge-column">
              <span class="badge badge-fav">★ Favorite</span>
            </div>
          </div>

          <p class="ingredients">
            {{ r.ingredients }}
          </p>

          <div class="card-actions">
            <button class="link-btn" @click.stop="startEdit(r)">Edit</button>
            <button
              class="link-btn danger"
              @click.stop="
                editing = { ...r, favorite: false };
                updateRecipe();
              "
            >
              Remove favorite
            </button>
          </div>
        </li>

        <li v-if="favorites.length === 0" class="none-found">
          You have no favorite recipes yet. Mark recipes as favorites to see them here.
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.recipe-manager {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto 40px auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-card,
.list-card {
  background: #ffffff;
  border-radius: 20px;
  border: 1px solid #f6d9ea;
  box-shadow: 0 2px 18px rgba(191, 140, 167, 0.12);
  padding: 22px 24px 20px 24px;
}

.form-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: #cc7da9;
  margin-bottom: 4px;
}

.form-subtitle {
  font-size: 0.95rem;
  color: #486b68;
  margin-bottom: 16px;
}

.required-star {
  color: #cc7da9;
  font-weight: 700;
}

.new-recipe-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.form-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-field.small {
  max-width: 160px;
}

label {
  font-size: 0.9rem;
  color: #486b68;
}

input,
textarea {
  border-radius: 10px;
  border: 1.5px solid #c3e7e1;
  padding: 9px 11px;
  font-size: 0.96rem;
  font-family: inherit;
  outline: none;
}

input:focus,
textarea:focus {
  border-color: #26b6b8;
}

textarea {
  resize: vertical;
  min-height: 60px;
}

.form-toggle-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 6px;
}

.toggle-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.94rem;
  color: #486b68;
}

.toggle-item input {
  width: auto;
}

.submit-btn {
  align-self: flex-start;
  margin-top: 6px;
  background: #cc7da9;
  color: #ffffff;
  border: none;
  border-radius: 999px;
  padding: 9px 20px;
  font-size: 0.98rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, box-shadow 0.15s ease;
}

.submit-btn:hover {
  background: #b96593;
  box-shadow: 0 3px 12px rgba(191, 140, 167, 0.5);
}

.cancel-btn {
  border-radius: 999px;
  border: 1px solid #c3e7e1;
  background: #ffffff;
  color: #486b68;
  padding: 8px 16px;
  font-size: 0.95rem;
  cursor: pointer;
}

.error-text {
  margin-top: 8px;
  color: #a14c2b;
  font-size: 0.92rem;
}

.recipes-title {
  font-size: 1.3rem;
  font-weight: 800;
  color: #26b6b8;
  margin-bottom: 12px;
}

.status-text {
  color: #486b68;
  font-size: 0.95rem;
}

.status-text.error {
  color: #a14c2b;
  font-weight: 600;
}

.recipes {
  list-style: none;
  padding: 0;
  margin: 12px 0 0 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recipe-card {
  background: #f4fbfa;
  border-radius: 14px;
  border: 1px solid #c3e7e1;
  padding: 12px 14px 10px 14px;
  box-shadow: 0 1px 7px rgba(79, 127, 120, 0.1);
}

.recipe-header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
  cursor: pointer;
}

.name {
  font-size: 1.1rem;
  font-weight: 700;
  color: #2b1b23;
}

.meta {
  font-size: 0.9rem;
  color: #486b68;
}

.badge-column {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
}

.badge {
  border-radius: 999px;
  padding: 3px 9px;
  font-size: 0.76rem;
  font-weight: 600;
}

.badge-fav {
  background: #fff5c7;
  color: #b38700;
}

.badge-published {
  background: #e0f5f2;
  color: #26b6b8;
}

.ingredients {
  margin-top: 4px;
  font-size: 0.94rem;
  color: #324240;
}

.card-actions {
  margin-top: 6px;
  display: flex;
  gap: 10px;
}

.link-btn {
  background: transparent;
  border: none;
  color: #26b6b8;
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0;
}

.link-btn.danger {
  color: #a14c2b;
}

.none-found {
  color: #486b68;
  font-size: 0.95rem;
  text-align: center;
  padding-top: 8px;
}

.edit-panel {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid #f0e1eb;
}

.edit-buttons {
  margin-top: 10px;
  display: flex;
  gap: 10px;
}
</style>
