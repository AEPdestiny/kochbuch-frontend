<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ApiClientError, AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { recipeApi } from '@/shared/api/recipeApi'
import type { Recipe } from '@/types/recipe'

const props = defineProps<{ search?: string }>()

// Liste aller Rezepte, Lade-Status und Fehlermeldung
const recipes = ref<Recipe[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const loginRequired = ref(false)
// Zusätzlicher State nur für Formular-Validierungsfehler
const formError = ref<string | null>(null)
const editFormError = ref<string | null>(null)

// Form für ein neues Rezept (Create)
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

const editing = ref<Recipe | null>(null) // Referenz auf das Rezept, das aktuell bearbeitet wird (Update)

const selectedFavorite = ref<Recipe | null>(null) // Referenz auf das aktuell ausgewählte Lieblingsrezept

// Lädt die eigenen Rezepte vom Backend-Endpoint /recipes/mine
const loadRecipes = async () => {
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    recipes.value = []
    error.value = 'Bitte melde dich an, um deine Rezepte zu sehen.'
    loginRequired.value = true
    loading.value = false
    return
  }

  try {
    const result = await recipeApi.getMyRecipes()
    // Liste zunächst leeren und dann mit den geladenen Rezepten füllen
      recipes.value = []
      result.forEach(r => {
        recipes.value.push(r)
      })
      error.value = null
      loginRequired.value = false
  } catch (err: unknown) {
      // Fehlermeldung im State setzen
      error.value = toLoadRecipesErrorMessage(err)
      loginRequired.value = err instanceof ApiClientError && err.status === 401
  } finally {
      // Lade-Status immer beenden, egal ob Erfolg oder Fehler
      loading.value = false
  }
}

const toLoadRecipesErrorMessage = (e: unknown) => {
  if (e instanceof ApiClientError) {
    if (e.status === 401) {
      return 'Bitte melde dich erneut an, um deine Rezepte zu sehen.'
    }
    if (!e.status) {
      return 'Das Backend ist aktuell nicht erreichbar. Bitte versuche es erneut.'
    }
    return e.message
  }

  return e instanceof Error
    ? e.message
    : 'Deine Rezepte konnten nicht geladen werden.'
}

// Neues Rezept anlegen und ans Backend senden
const createRecipe = async () => {
  // Validierung: Pflichtfelder; hier nur formError setzen
  if (
    !newTitle.value.trim() ||
    !newIngredients.value.trim() ||
    !newInstructions.value.trim()
  ) {
    formError.value = 'Bitte fülle alle Pflichtfelder aus.'
    return
  }
  formError.value = null

  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    formError.value = 'Bitte melde dich an, um ein Rezept zu erstellen.'
    return
  }

  try {
    // POST-Request für das neue Rezept
    const saved = await recipeApi.createRecipe({
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
    })

    // Vom Backend zurückgegebenes gespeichertes Rezept in die Liste pushen
    recipes.value.push(saved)

    // Formularfelder zurücksetzen
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
  } catch (e: unknown) {
    console.error('error', e)
    formError.value = toCreateRecipeErrorMessage(e)
  }
}

const toCreateRecipeErrorMessage = (e: unknown) => {
  if (e instanceof ApiClientError) {
    if (e.status === 401) {
      return 'Bitte melde dich erneut an, um ein Rezept zu erstellen.'
    }
    if (e.status === 403) {
      return 'Du hast keine Berechtigung, dieses Rezept zu erstellen.'
    }
    if (!e.status) {
      return 'Das Backend ist aktuell nicht erreichbar. Bitte versuche es erneut.'
    }
    return e.message
  }

  return e instanceof Error
    ? e.message
    : 'Das Rezept konnte nicht gespeichert werden.'
}

// Edit-Modus starten, indem eine Kopie des Rezepts in editing gelegt wird
const startEdit = (r: Recipe) => {
  editing.value = { ...r }
}

// Edit-Vorgang abbrechen und Formular zurücksetzen
const cancelEdit = () => {
  editing.value = null
}

// Bestehendes Rezept per PUT beim Backend aktualisieren
const updateRecipe = async () => {
  if (!editing.value) return
  if (
    !editing.value.title.trim() ||
    !editing.value.ingredients.trim() ||
    !editing.value.instructions.trim()
  ) {
    editFormError.value = 'Bitte fülle alle Pflichtfelder aus.'
    return
  }
  editFormError.value = null

  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    editFormError.value = 'Bitte melde dich an, um ein Rezept zu bearbeiten.'
    return
  }

  try {
    const updated = await recipeApi.updateRecipe(editing.value.id, {
      title: editing.value.title,
      imageUrl: editing.value.imageUrl,
      prepTimeMinutes: editing.value.prepTimeMinutes,
      cookTimeMinutes: editing.value.cookTimeMinutes,
      servings: editing.value.servings,
      difficulty: editing.value.difficulty,
      category: editing.value.category,
      rating: editing.value.rating,
      ingredients: editing.value.ingredients,
      instructions: editing.value.instructions,
      favorite: editing.value.favorite,
      published: editing.value.published,
    })

    // Passenden Eintrag in der lokalen Liste ersetzen
    const idx = recipes.value.findIndex(r => r.id === updated.id)
    if (idx !== -1) {
      recipes.value[idx] = updated
    }

    // Edit-Modus verlassen und Fehlerzustand zurücksetzen
    editing.value = null
    error.value = null
  } catch (e: unknown) {
    console.error(e)
    editFormError.value = toUpdateRecipeErrorMessage(e)
  }
}

const toUpdateRecipeErrorMessage = (e: unknown) => {
  if (e instanceof ApiClientError) {
    if (e.status === 401) {
      return 'Bitte melde dich erneut an, um ein Rezept zu bearbeiten.'
    }
    if (e.status === 403) {
      return 'Du darfst dieses Rezept nicht bearbeiten.'
    }
    if (e.status === 404) {
      return 'Das Rezept wurde nicht gefunden.'
    }
    if (!e.status) {
      return 'Das Backend ist aktuell nicht erreichbar. Bitte versuche es erneut.'
    }
    return e.message
  }

  return e instanceof Error
    ? e.message
    : 'Das Rezept konnte nicht aktualisiert werden.'
}

// Rezept im Backend löschen und lokal entfernen
const deleteRecipe = async (id: number | string) => {
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    error.value = 'Bitte melde dich an, um ein Rezept zu löschen.'
    return
  }

  try {
    // DELETE-Request an den passenden /recipes/{id}-Endpoint
    await recipeApi.deleteRecipe(id)
    // Erfolgreich gelöscht: Rezept aus der lokalen Liste herausfiltern
    recipes.value = recipes.value.filter(r => r.id !== id)

    // Falls gerade dieses Rezept im Edit-Modus war, Edit-Zustand zurücksetzen
    if (editing.value && editing.value.id === id) {
      editing.value = null
    }
  } catch (e: unknown) {
    console.error(e)
    error.value = toDeleteRecipeErrorMessage(e)
  }
}

const toDeleteRecipeErrorMessage = (e: unknown) => {
  if (e instanceof ApiClientError) {
    if (e.status === 401) {
      return 'Bitte melde dich erneut an, um ein Rezept zu löschen.'
    }
    if (e.status === 403) {
      return 'Du darfst dieses Rezept nicht löschen.'
    }
    if (e.status === 404) {
      return 'Das Rezept wurde nicht gefunden.'
    }
    if (!e.status) {
      return 'Das Backend ist aktuell nicht erreichbar. Bitte versuche es erneut.'
    }
    return e.message
  }

  return e instanceof Error
    ? e.message
    : 'Das Rezept konnte nicht gelöscht werden.'
}

onMounted(() => {
  loadRecipes()
})

// Abgeleitete Liste, gefiltert nach Suchbegriff aus dem Prop (Titel oder Zutaten)
const filtered = computed(() => {
  if (!props.search) return recipes.value
  const q = props.search.toLowerCase().trim()
  return recipes.value.filter(r =>
    r.title.toLowerCase().includes(q) ||
    r.ingredients.toLowerCase().includes(q)
  )
})
// Abgeleitete Liste aller Rezepte, die als Favorit markiert sind
const favorites = computed(() => recipes.value.filter(r => r.favorite))

// Öffnet Detailansicht für ein ausgewähltes Lieblingsrezept
const openFavoriteDetails = (r: Recipe) => {
  selectedFavorite.value = r
}

// Schließt die Detailansicht des Lieblingsrezepts wieder
const closeFavoriteDetails = () => {
  selectedFavorite.value = null
}
</script>

<template>
  <!-- Gesamter Bereich zum Verwalten der eigenen Rezepte -->
  <section class="recipe-manager">
    <!-- Karte mit Formular zum Anlegen eines neuen Rezepts -->
    <div class="form-card">
      <h3 class="form-title">Neues Rezept erstellen</h3>
      <p class="form-subtitle">
        Alle mit <span class="required-star">*</span> markierten Felder sind Pflichtfelder.
      </p>

      <!-- Neues Rezept wird per createRecipe() gespeichert -->
      <form class="new-recipe-form" @submit.prevent="createRecipe">
        <!-- Erste Zeile: Titel + Bild-URL -->
        <div class="form-row">
          <div class="form-field">
            <label>
              Titel <span class="required-star">*</span>
            </label>
            <input
              v-model="newTitle"
              type="text"
              placeholder="z. B. Cremige Tomatenpasta"
            />
          </div>

          <div class="form-field">
            <label>Bild-URL</label>
            <input
              v-model="newImageUrl"
              type="url"
              placeholder="https://example.com/recipe.jpg"
            />
          </div>
        </div>

        <!-- Zweite Zeile: Zeiten + Portionen -->
        <div class="form-row">
          <div class="form-field small">
            <label>Vorbereitungszeit (Min.)</label>
            <input
              v-model.number="newPrepTime"
              type="number"
              min="0"
              placeholder="10"
            />
          </div>
          <div class="form-field small">
            <label>Kochzeit (Min.)</label>
            <input
              v-model.number="newCookTime"
              type="number"
              min="0"
              placeholder="20"
            />
          </div>
          <div class="form-field small">
            <label>Portionen</label>
            <input
              v-model.number="newServings"
              type="number"
              min="0"
              placeholder="2"
            />
          </div>
        </div>

        <!-- Dritte Zeile: Difficulty, Kategorie, Rating -->
        <div class="form-row">
          <div class="form-field">
            <label>Schwierigkeit</label>
            <input
              v-model="newDifficulty"
              type="text"
              placeholder="z. B. einfach, mittel, schwer"
            />
          </div>
          <div class="form-field">
            <label>Kategorie / Küche</label>
            <input
              v-model="newCategory"
              type="text"
              placeholder="z. B. Italienisch, Dessert"
            />
          </div>
          <div class="form-field small">
            <label>Bewertung</label>
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

        <!-- Zutaten-Eingabe -->
        <div class="form-field">
          <label>
            Zutaten <span class="required-star">*</span>
          </label>
          <textarea
            v-model="newIngredients"
            rows="3"
            placeholder="Zutaten mit Kommas getrennt eintragen."
          ></textarea>
        </div>

        <!-- Anweisungen-Eingabe -->
        <div class="form-field">
          <label>
            Zubereitung <span class="required-star">*</span>
          </label>
          <textarea
            v-model="newInstructions"
            rows="5"
            placeholder="Beschreibe die Zubereitung Schritt für Schritt."
          ></textarea>
        </div>

        <!-- Schalter: Favorit und auf Home anzeigen -->
        <div class="form-toggle-row">
          <label class="toggle-item">
            <input type="checkbox" v-model="newFavorite" />
            <span>Als Favorit markieren</span>
          </label>
          <label class="toggle-item">
            <input type="checkbox" v-model="newPublished" />
            <span>Auf Startseite anzeigen</span>
          </label>
        </div>

        <!-- Submit-Button -->
        <button type="submit" class="submit-btn">
          Rezept speichern
        </button>

        <!-- nur die Formular-Fehlermeldung anzeigen -->
        <p v-if="formError" class="error-text">
          {{ formError }}
        </p>
      </form>
    </div>

    <!-- Karte mit Liste der selbst erstellten Rezepte + Edit-Panel -->
    <div class="list-card">
      <h3 class="recipes-title">Deine erstellten Rezepte</h3>

      <p v-if="loading" class="status-text">Rezepte werden geladen...</p>
      <div v-else-if="error" class="status-text error">
        <p>Fehler: {{ error }}</p>
        <a v-if="loginRequired" href="/login" class="login-link">
          Zum Login
        </a>
      </div>

      <!-- Wenn geladen und kein Fehler: Liste der gefilterten Rezepte -->
      <ul v-else class="recipes">
        <li v-for="r in filtered" :key="r.id" class="recipe-card">
          <div class="recipe-row">
            <div class="image-wrap" v-if="r.imageUrl">
              <img :src="r.imageUrl" :alt="r.title" />
            </div>

            <div class="recipe-main">
              <!-- Klick auf Header öffnet Edit-Panel für dieses Rezept -->
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
                    <span v-if="r.servings"> • 🍽 {{ r.servings }} Portionen</span>
                  </p>
                </div>
                <!-- Badges für Favorit / veröffentlicht -->
                <div class="badge-column">
                  <span v-if="r.favorite" class="badge badge-fav">★ Favorit</span>
                  <span v-if="r.published" class="badge badge-published">Auf Startseite sichtbar</span>
                </div>
              </div>

              <!-- Kurzansicht der Zutaten -->
              <p class="ingredients">
                {{ r.ingredients }}
              </p>

              <!-- Aktionen: Edit und Delete -->
              <div class="card-actions">
                <button class="link-btn" @click.stop="startEdit(r)">Bearbeiten</button>
                <button class="link-btn danger" @click.stop="deleteRecipe(r.id)">Löschen</button>
              </div>
            </div>
          </div>
        </li>

        <!-- Hinweis, wenn kein Rezept zur Suche passt -->
        <li v-if="!loading && filtered.length === 0" class="none-found">
          Keine Rezepte gefunden. Erstelle oben dein erstes Dishly-Rezept.
        </li>
      </ul>

      <!-- Seitliches Bearbeitungs-Panel für das aktuell ausgewählte Rezept -->
      <div class="edit-panel" v-if="editing">
        <h4>Rezept bearbeiten</h4>

        <div class="form-row">
          <div class="form-field">
            <label>Titel</label>
            <input v-model="editing.title" type="text" />
          </div>
          <div class="form-field">
            <label>Bild-URL</label>
            <input v-model="editing.imageUrl" type="url" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-field small">
            <label>Vorbereitungszeit (Min.)</label>
            <input v-model.number="editing.prepTimeMinutes" type="number" min="0" />
          </div>
          <div class="form-field small">
            <label>Kochzeit (Min.)</label>
            <input v-model.number="editing.cookTimeMinutes" type="number" min="0" />
          </div>
          <div class="form-field small">
            <label>Portionen</label>
            <input v-model.number="editing.servings" type="number" min="0" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label>Schwierigkeit</label>
            <input v-model="editing.difficulty" type="text" />
          </div>
          <div class="form-field">
            <label>Kategorie / Küche</label>
            <input v-model="editing.category" type="text" />
          </div>
          <div class="form-field small">
            <label>Bewertung</label>
            <input v-model.number="editing.rating" type="number" min="0" max="5" step="0.1" />
          </div>
        </div>

        <div class="form-field">
          <label>Zutaten</label>
          <textarea v-model="editing.ingredients" rows="3"></textarea>
        </div>

        <div class="form-field">
          <label>Zubereitung</label>
          <textarea v-model="editing.instructions" rows="5"></textarea>
        </div>

        <div class="form-toggle-row">
          <label class="toggle-item">
            <input type="checkbox" v-model="editing.favorite" />
            <span>Als Favorit markieren</span>
          </label>
          <label class="toggle-item">
            <input type="checkbox" v-model="editing.published" />
            <span>Auf Startseite anzeigen</span>
          </label>
        </div>

        <!-- Buttons zum Speichern und Abbrechen -->
        <div class="edit-buttons">
          <button class="submit-btn" @click="updateRecipe">Änderungen speichern</button>
          <button class="cancel-btn" @click="cancelEdit">Abbrechen</button>
        </div>
        <p v-if="editFormError" class="error-text">
          {{ editFormError }}
        </p>
      </div>
    </div>

    <!-- Zweite Karte: Grid mit allen Favoriten + Overlay-Details -->
    <div class="list-card">
      <h3 class="recipes-title">Deine Favoriten</h3>

      <p v-if="loading" class="status-text">Rezepte werden geladen...</p>
      <div v-else-if="error" class="status-text error">
        <p>Fehler: {{ error }}</p>
        <a v-if="loginRequired" href="/login" class="login-link">
          Zum Login
        </a>
      </div>

      <div v-else class="recipe-grid">
        <article
          v-for="r in favorites"
          :key="'fav-' + r.id"
          class="recipe-card"
          @click="openFavoriteDetails(r)"
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
              <span v-if="r.servings"> • 🍽 {{ r.servings }} Portionen</span>
            </p>

            <p class="card-ingredients">
              {{ r.ingredients }}
            </p>
          </div>
        </article>

        <!-- Hinweis, falls noch keine Favoriten markiert wurden -->
        <p v-if="favorites.length === 0" class="status-text">
          Du hast noch keine Favoriten. Markiere Rezepte als Favoriten, um sie hier zu sehen.
        </p>
      </div>
    </div>

    <!-- Overlay mit Detailansicht für ausgewähltes Lieblingsrezept -->
    <div v-if="selectedFavorite" class="overlay" @click.self="closeFavoriteDetails">
      <div class="overlay-card">
        <button class="overlay-close" @click="closeFavoriteDetails">×</button>

        <h3 class="overlay-title">{{ selectedFavorite.title }}</h3>

        <p class="overlay-meta">
          <span v-if="selectedFavorite.category">{{ selectedFavorite.category }}</span>
          <span v-if="selectedFavorite.difficulty"> • {{ selectedFavorite.difficulty }}</span>
          <span v-if="selectedFavorite.rating"> • ★ {{ selectedFavorite.rating.toFixed(1) }}</span>
        </p>

        <p class="overlay-meta">
          <span v-if="selectedFavorite.prepTimeMinutes || selectedFavorite.cookTimeMinutes">
            ⏱ {{ selectedFavorite.prepTimeMinutes + selectedFavorite.cookTimeMinutes }} min
          </span>
          <span v-if="selectedFavorite.servings">
            • 🍽 {{ selectedFavorite.servings }} Portionen
          </span>
        </p>

        <h4 class="overlay-subtitle">Zutaten</h4>
        <p class="overlay-text">{{ selectedFavorite.ingredients }}</p>

        <h4 class="overlay-subtitle">Zubereitung</h4>
        <p class="overlay-text">{{ selectedFavorite.instructions }}</p>
      </div>
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

/* Fokuszustand hebt das aktive Feld farblich hervor */
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

/* Checkbox selbst nicht auf volle Breite ziehen */
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

/* Hover-Effekt für Submit-Button */
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

.status-text.error p {
  margin-bottom: 10px;
}

.login-link {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: #cc7da9;
  color: #ffffff;
  padding: 8px 16px;
  font-size: 0.94rem;
  font-weight: 700;
  text-decoration: none;
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

.recipe-row {
  display: flex;
  gap: 12px;
}

.image-wrap {
  width: 120px;
  height: 90px;
  overflow: hidden;
  flex-shrink: 0;
  border-radius: 10px;
}

.image-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.recipe-main {
  flex: 1;
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
.recipe-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 22px;
  margin-top: 12px;
}

.card-content {
  padding: 10px 4px 4px 4px;
}

.card-title {
  font-size: 1.1rem;
  font-weight: 800;
  color: #2b1b23;
  margin-bottom: 4px;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;
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
  font-size: 0.9rem;
  color: #486b68;
  margin-bottom: 4px;
}

.card-ingredients {
  font-size: 0.9rem;
  color: #324240;
  margin-top: 2px;
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
