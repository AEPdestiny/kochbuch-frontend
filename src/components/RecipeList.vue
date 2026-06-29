<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ApiClientError, AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { favoriteApi } from '@/shared/api/favoriteApi'
import { recipeApi } from '@/shared/api/recipeApi'
import { displayCategory } from '@/shared/recipeDisplay'
import { useToastStore } from '@/stores/toastStore'
import { NAME_SUGGESTIONS, STANDARD_UNITS } from '@/shared/ingredientConstants'
import SuggestInput from '@/components/SuggestInput.vue'
import type { Recipe, RecipeRequest } from '@/types/recipe'

type IngredientRow = { name: string; quantity: string; unit: string }

function emptyIngredientRow(): IngredientRow {
  return { name: '', quantity: '', unit: '' }
}

function serializeIngredientRows(rows: IngredientRow[]): string {
  return rows
    .map(r => [r.quantity, r.unit, r.name].filter(part => part.trim()).join(' ').trim())
    .filter(Boolean)
    .join(', ')
}

function parseIngredientRows(ingredients: string, ingredientsList?: string[] | null): IngredientRow[] {
  const lines = ingredientsList && ingredientsList.length > 0
    ? ingredientsList
    : ingredients.split(',').map(s => s.trim()).filter(Boolean)

  if (lines.length === 0) {
    return [emptyIngredientRow()]
  }

  return lines.map(line => {
    const parts = line.trim().split(/\s+/)
    const firstPart = parts[0] ?? ''
    const quantity = parts.length > 1 && /^[\d.,/]+$/.test(firstPart) ? (parts.shift() ?? '') : ''
    const nextPart = parts[0] ?? ''
    const unit = quantity && parts.length > 0 && STANDARD_UNITS.includes(nextPart.toLowerCase())
      ? (parts.shift() ?? '')
      : ''
    return { quantity, unit, name: parts.join(' ') || line.trim() }
  })
}

const props = withDefaults(defineProps<{ search?: string; mode?: 'manager' | 'create' }>(), {
  mode: 'manager',
})
const { t, locale } = useI18n()
const router = useRouter()
const route = useRoute()
const toastStore = useToastStore()

const recipes = ref<Recipe[]>([])
const externalFavorites = ref<Recipe[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const loginRequired = ref(false)
const formError = ref<string | null>(null)
const editFormError = ref<string | null>(null)
const favoriteError = ref<string | null>(null)

const newTitle = ref('')
const newImageUrl = ref('')
const newPrepTime = ref<number | null>(null)
const newCookTime = ref<number | null>(null)
const newServings = ref<number | null>(null)
const newDifficulty = ref('')
const newCategory = ref('')
const newIngredientRows = ref<IngredientRow[]>([emptyIngredientRow()])
const newInstructions = ref('')
const newFavorite = ref(false)
const newPublished = ref(false)
const newImagePreviewUrl = ref('')
const editImagePreviewUrl = ref('')
const newImageUploading = ref(false)
const editImageUploading = ref(false)
const newImageUploaded = ref(false)
const editImageUploaded = ref(false)
const editIngredientRows = ref<IngredientRow[]>([emptyIngredientRow()])

const editing = ref<Recipe | null>(null)
const selectedFavorite = ref<Recipe | null>(null)
const activeTab = ref<'own' | 'favorites'>('own')

const isCreateMode = computed(() => props.mode === 'create')

const loadRecipes = async () => {
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    recipes.value = []
    error.value = t('recipes.errors.loginRequired')
    loginRequired.value = true
    loading.value = false
    return
  }

  try {
    const [ownRecipes, externalFavoriteRecipes] = await Promise.all([
      recipeApi.getMyRecipes(),
      loadExternalFavoriteRecipes(),
    ])
    recipes.value = ownRecipes
    externalFavorites.value = externalFavoriteRecipes
    openRequestedRecipeEditor()
    error.value = null
    loginRequired.value = false
  } catch (err: unknown) {
    error.value = toLoadRecipesErrorMessage(err)
    loginRequired.value = err instanceof ApiClientError && err.status === 401
  } finally {
    loading.value = false
  }
}

const loadExternalFavoriteRecipes = async (): Promise<Recipe[]> => {
  try {
    const favorites = await favoriteApi.getExternalFavorites()
    return favorites.map(favorite => ({
      id: favorite.externalRecipeId,
      externalId: favorite.externalRecipeId,
      source: (favorite.externalSource ?? 'SPOONACULAR').toLowerCase(),
      sourceName: favorite.externalSource ?? 'SPOONACULAR',
      title: favorite.externalTitle,
      imageUrl: favorite.externalImageUrl ?? '',
      prepTimeMinutes: 0,
      cookTimeMinutes: 0,
      servings: 0,
      difficulty: '',
      category: 'Extern',
      rating: 0,
      ingredients: 'Externes API-Rezept',
      instructions: '',
      favorite: true,
      published: false,
    }))
  } catch {
    return []
  }
}

const toLoadRecipesErrorMessage = (e: unknown) => {
  if (e instanceof ApiClientError) {
    if (e.status === 401) {
      return t('recipes.errors.sessionExpired')
    }
    if (!e.status) {
      return t('recipes.errors.network')
    }
  }

  return t('recipes.errors.load')
}

const hasNewIngredients = computed(() => newIngredientRows.value.some(r => r.name.trim()))

function addNewIngredientRow() {
  newIngredientRows.value.push(emptyIngredientRow())
}

function removeNewIngredientRow(index: number) {
  if (newIngredientRows.value.length <= 1) return
  newIngredientRows.value.splice(index, 1)
}

const createRecipe = async () => {
  if (newImageUploading.value) {
    formError.value = 'Bitte warte, bis das Bild hochgeladen wurde.'
    return
  }
  if (
    !newTitle.value.trim() ||
    !hasNewIngredients.value ||
    !newInstructions.value.trim()
  ) {
    formError.value = t('recipes.errors.requiredFields')
    return
  }
  formError.value = null

  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    formError.value = t('recipes.errors.createLoginRequired')
    return
  }

  try {
    const saved = await recipeApi.createRecipe({
      title: newTitle.value,
      imageUrl: newImageUrl.value,
      prepTimeMinutes: newPrepTime.value ?? 0,
      cookTimeMinutes: newCookTime.value ?? 0,
      servings: newServings.value ?? 0,
      difficulty: newDifficulty.value,
      category: newCategory.value,
      rating: 0,
      ingredients: serializeIngredientRows(newIngredientRows.value),
      instructions: newInstructions.value,
      favorite: newFavorite.value,
      published: newPublished.value,
      language: currentLanguage.value,
    })

    if (!isCreateMode.value) {
      recipes.value.push(saved)
    }
    newTitle.value = ''
    newImageUrl.value = ''
    newPrepTime.value = null
    newCookTime.value = null
    newServings.value = null
    newDifficulty.value = ''
    newCategory.value = ''
    newIngredientRows.value = [emptyIngredientRow()]
    newInstructions.value = ''
    newFavorite.value = false
    newPublished.value = false
    newImageUploaded.value = false
    clearNewImagePreview()
    error.value = null
    toastStore.addToast(t('notifications.recipeCreated'), 'success')
    if (isCreateMode.value) {
      await router.push(`/recipe/${saved.id}`)
    }
  } catch (e: unknown) {
    formError.value = toCreateRecipeErrorMessage(e)
  }
}

const toCreateRecipeErrorMessage = (e: unknown) => {
  if (e instanceof ApiClientError) {
    if (e.status === 401) {
      return t('recipes.errors.createSessionExpired')
    }
    if (e.status === 403) {
      return t('recipes.errors.createForbidden')
    }
    if (!e.status) {
      return t('recipes.errors.network')
    }
  }

  return t('recipes.errors.create')
}

const startEdit = (r: Recipe) => {
  editing.value = { ...r }
  editIngredientRows.value = parseIngredientRows(r.ingredients, r.ingredientsList)
  editImagePreviewUrl.value = ''
  editImageUploaded.value = false
  editImageUploading.value = false
}

const cancelEdit = () => {
  editing.value = null
  editIngredientRows.value = [emptyIngredientRow()]
  editImageUploaded.value = false
  editImageUploading.value = false
  clearEditImagePreview()
}

const hasEditIngredients = computed(() => editIngredientRows.value.some(r => r.name.trim()))

function addEditIngredientRow() {
  editIngredientRows.value.push(emptyIngredientRow())
}

function removeEditIngredientRow(index: number) {
  if (editIngredientRows.value.length <= 1) return
  editIngredientRows.value.splice(index, 1)
}

const updateRecipe = async () => {
  if (!editing.value) return
  if (editImageUploading.value) {
    editFormError.value = 'Bitte warte, bis das Bild hochgeladen wurde.'
    return
  }
  if (
    !editing.value.title.trim() ||
    !hasEditIngredients.value ||
    !editing.value.instructions.trim()
  ) {
    editFormError.value = t('recipes.errors.requiredFields')
    return
  }
  editFormError.value = null

  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    editFormError.value = t('recipes.errors.updateLoginRequired')
    return
  }

  editing.value.ingredients = serializeIngredientRows(editIngredientRows.value)

  try {
    const updated = await recipeApi.updateRecipe(
      editing.value.id,
      recipeRequestFrom(editing.value),
    )

    const idx = recipes.value.findIndex(r => r.id === updated.id)
    if (idx !== -1) {
      recipes.value[idx] = updated
    }

    editing.value = null
    editImageUploaded.value = false
    clearEditImagePreview()
    error.value = null
    toastStore.addToast(t('notifications.recipeUpdated'), 'success')
  } catch (e: unknown) {
    editFormError.value = toUpdateRecipeErrorMessage(e)
  }
}

const toUpdateRecipeErrorMessage = (e: unknown) => {
  if (e instanceof ApiClientError) {
    if (e.status === 401) {
      return t('recipes.errors.updateSessionExpired')
    }
    if (e.status === 403) {
      return t('recipes.errors.updateForbidden')
    }
    if (e.status === 404) {
      return t('recipes.errors.notFound')
    }
    if (!e.status) {
      return t('recipes.errors.network')
    }
  }

  return t('recipes.errors.update')
}

const deleteRecipe = async (id: number | string) => {
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    error.value = t('recipes.errors.deleteLoginRequired')
    return
  }

  try {
    await recipeApi.deleteRecipe(id)
    recipes.value = recipes.value.filter(r => r.id !== id)

    if (editing.value && editing.value.id === id) {
      editing.value = null
    }
    toastStore.addToast(t('notifications.recipeDeleted'), 'info')
  } catch (e: unknown) {
    error.value = toDeleteRecipeErrorMessage(e)
  }
}

const togglePublished = async (recipe: Recipe) => {
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    error.value = t('recipes.errors.updateLoginRequired')
    return
  }

  try {
    const updated = await recipeApi.updateRecipe(
      recipe.id,
      recipeRequestFrom(recipe, { published: !recipe.published }),
    )
    const index = recipes.value.findIndex(item => item.id === updated.id)
    if (index >= 0) {
      recipes.value[index] = updated
    }
    if (editing.value?.id === updated.id) {
      editing.value = { ...updated }
    }
    error.value = null
    toastStore.addToast(
      t(updated.published ? 'notifications.publishedOn' : 'notifications.publishedOff', { title: updated.title }),
      'success',
    )
  } catch (e: unknown) {
    error.value = toUpdateRecipeErrorMessage(e)
  }
}

const toDeleteRecipeErrorMessage = (e: unknown) => {
  if (e instanceof ApiClientError) {
    if (e.status === 401) {
      return t('recipes.errors.deleteSessionExpired')
    }
    if (e.status === 403) {
      return t('recipes.errors.deleteForbidden')
    }
    if (e.status === 404) {
      return t('recipes.errors.notFound')
    }
    if (!e.status) {
      return t('recipes.errors.network')
    }
  }

  return t('recipes.errors.delete')
}

onMounted(() => {
  if (isCreateMode.value) {
    loading.value = false
    return
  }
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

const favorites = computed(() => [
  ...recipes.value.filter(r => r.favorite),
  ...externalFavorites.value,
])

const openFavoriteDetails = (r: Recipe) => {
  if (r.externalId || r.source === 'spoonacular' || r.source === 'external') {
    router.push(`/recipe/external/${r.externalId ?? r.id}`)
    return
  }
  router.push(`/recipe/${r.id}`)
}

const closeFavoriteDetails = () => {
  selectedFavorite.value = null
}

const setActiveTab = (tab: 'own' | 'favorites') => {
  activeTab.value = tab
}

const currentLanguage = computed(() => {
  const [language] = String(locale.value).split('-')
  return (language || 'de').toLowerCase()
})

function openRequestedRecipeEditor() {
  const requestedId = Array.isArray(route.query.edit) ? route.query.edit[0] : route.query.edit
  if (typeof requestedId !== 'string') {
    return
  }
  const requestedRecipe = recipes.value.find(recipe => String(recipe.id) === requestedId)
  if (requestedRecipe) {
    startEdit(requestedRecipe)
  }
}

function recipeRequestFrom(recipe: Recipe, overrides: Partial<RecipeRequest> = {}): RecipeRequest {
  return {
    title: recipe.title,
    imageUrl: recipe.imageUrl,
    prepTimeMinutes: recipe.prepTimeMinutes,
    cookTimeMinutes: recipe.cookTimeMinutes,
    servings: recipe.servings,
    difficulty: recipe.difficulty,
    category: recipe.category,
    rating: recipe.rating,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    favorite: recipe.favorite,
    published: recipe.published,
    language: recipe.language ?? currentLanguage.value,
    ...overrides,
  }
}

function visibleCategory(category?: string | null) {
  return displayCategory(category, currentLanguage.value)
}

function handleNewImageFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    void uploadNewImage(file)
  }
}

function handleEditImageFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    void uploadEditImage(file)
  }
}

function handleNewImageDrop(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    void uploadNewImage(file)
  }
}

function handleEditImageDrop(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    void uploadEditImage(file)
  }
}

async function uploadNewImage(file: File) {
  if (!file.type.startsWith('image/')) {
    formError.value = 'Bitte wähle eine Bilddatei aus.'
    return
  }
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    formError.value = 'Bitte melde dich an, um ein Bild hochzuladen.'
    return
  }
  clearNewImagePreview()
  newImagePreviewUrl.value = URL.createObjectURL(file)
  newImageUploading.value = true
  newImageUploaded.value = false
  formError.value = null

  try {
    const uploaded = await recipeApi.uploadRecipeImage(file)
    clearNewImagePreview()
    newImageUrl.value = uploaded.imageUrl
    newImageUploaded.value = true
  } catch (e: unknown) {
    formError.value = toImageUploadErrorMessage(e)
  } finally {
    newImageUploading.value = false
  }
}

async function uploadEditImage(file: File) {
  if (!file.type.startsWith('image/')) {
    editFormError.value = 'Bitte wähle eine Bilddatei aus.'
    return
  }
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    editFormError.value = 'Bitte melde dich an, um ein Bild hochzuladen.'
    return
  }
  clearEditImagePreview()
  editImagePreviewUrl.value = URL.createObjectURL(file)
  editImageUploading.value = true
  editImageUploaded.value = false
  editFormError.value = null

  try {
    const uploaded = await recipeApi.uploadRecipeImage(file)
    clearEditImagePreview()
    if (editing.value) {
      editing.value.imageUrl = uploaded.imageUrl
    }
    editImageUploaded.value = true
  } catch (e: unknown) {
    editFormError.value = toImageUploadErrorMessage(e)
  } finally {
    editImageUploading.value = false
  }
}

function clearNewImagePreview() {
  if (newImagePreviewUrl.value) {
    URL.revokeObjectURL(newImagePreviewUrl.value)
  }
  newImagePreviewUrl.value = ''
}

function clearEditImagePreview() {
  if (editImagePreviewUrl.value) {
    URL.revokeObjectURL(editImagePreviewUrl.value)
  }
  editImagePreviewUrl.value = ''
}

function toImageUploadErrorMessage(e: unknown) {
  if (e instanceof ApiClientError) {
    if (e.status === 400) {
      return e.message || 'Das Bild konnte nicht hochgeladen werden. Bitte prüfe Dateityp und Größe.'
    }
    if (e.status === 401 || e.status === 403) {
      return 'Bitte melde dich erneut an, um ein Bild hochzuladen.'
    }
    if (e.status === 502 || e.status === 500) {
      return 'Der Bildspeicher ist aktuell nicht erreichbar. Du kannst alternativ eine Bild-URL eintragen.'
    }
    if (!e.status) {
      return 'Netzwerkfehler beim Bild-Upload. Du kannst alternativ eine Bild-URL eintragen.'
    }
  }
  return 'Das Bild konnte nicht hochgeladen werden. Du kannst alternativ eine Bild-URL eintragen.'
}

const removeFavorite = async (r: Recipe) => {
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    favoriteError.value = t('recipes.errors.sessionExpired')
    return
  }

  try {
    favoriteError.value = null
    if (r.externalId || r.source === 'spoonacular' || r.source === 'external') {
      const source = r.sourceName?.trim() || r.source?.trim() || 'SPOONACULAR'
      const externalRecipeId = String(r.externalId ?? r.id)
      await favoriteApi.removeExternalFavorite(source, externalRecipeId)
      externalFavorites.value = externalFavorites.value.filter(favorite =>
        String(favorite.externalId ?? favorite.id) !== externalRecipeId
        || (favorite.sourceName?.trim() || favorite.source?.trim() || 'SPOONACULAR').toUpperCase() !== source.toUpperCase()
      )
      if (selectedFavorite.value?.id === r.id) {
        selectedFavorite.value = null
      }
      return
    }

    const updated = await recipeApi.updateRecipe(
      r.id,
      recipeRequestFrom(r, { favorite: false }),
    )
    const index = recipes.value.findIndex(recipe => recipe.id === r.id)
    if (index >= 0) {
      recipes.value[index] = updated
    }
    if (selectedFavorite.value?.id === r.id) {
      selectedFavorite.value = null
    }
  } catch (e: unknown) {
    favoriteError.value = e instanceof ApiClientError && e.message
      ? e.message
      : 'Favorit konnte nicht entfernt werden.'
  }
}
</script>

<template>
  <section class="recipe-manager">
    <div v-if="isCreateMode" class="form-card">
      <h3 class="form-title">{{ t('recipes.my.createTitle') }}</h3>
      <p class="form-subtitle">
        {{ t('recipes.my.requiredHintStart') }} <span class="required-star">*</span> {{ t('recipes.my.requiredHintEnd') }}
      </p>

      <form class="new-recipe-form" @submit.prevent="createRecipe">
        <div class="form-row">
          <div class="form-field">
            <label>
              {{ t('recipes.form.title') }} <span class="required-star">*</span>
            </label>
            <input
              v-model="newTitle"
              type="text"
              :placeholder="t('recipes.form.titlePlaceholder')"
            />
          </div>

          <div class="form-field">
            <label>{{ t('recipes.form.imageUrl') }}</label>
            <input
              v-model="newImageUrl"
              type="url"
              :placeholder="t('recipes.form.imageUrlPlaceholder', { protocol: 'https://' })"
            />
            <label class="image-upload-box" @dragover.prevent @drop.prevent="handleNewImageDrop">
              <span>Bild hochladen oder hier ablegen</span>
              <input type="file" accept="image/*" capture="environment" @change="handleNewImageFile" />
            </label>
            <img
              v-if="newImagePreviewUrl || newImageUrl"
              class="image-preview"
              :src="newImagePreviewUrl || newImageUrl"
              alt="Bildvorschau"
            />
            <small v-if="newImagePreviewUrl" class="upload-note">
              Lokale Vorschau. Das Bild wird gerade dauerhaft gespeichert.
            </small>
            <small v-else-if="newImageUploading" class="upload-note">
              Bild wird hochgeladen...
            </small>
            <small v-else-if="newImageUploaded" class="upload-note">
              Bild wurde dauerhaft gespeichert.
            </small>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field small">
            <label>{{ t('recipes.form.prepTime') }}</label>
            <input
              v-model.number="newPrepTime"
              type="number"
              min="0"
              :placeholder="t('recipes.form.prepTimePlaceholder')"
            />
          </div>
          <div class="form-field small">
            <label>{{ t('recipes.form.cookTime') }}</label>
            <input
              v-model.number="newCookTime"
              type="number"
              min="0"
              :placeholder="t('recipes.form.cookTimePlaceholder')"
            />
          </div>
          <div class="form-field small">
            <label>{{ t('recipes.form.servings') }}</label>
            <input
              v-model.number="newServings"
              type="number"
              min="0"
              :placeholder="t('recipes.form.servingsPlaceholder')"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label>{{ t('recipes.form.difficulty') }}</label>
            <input
              v-model="newDifficulty"
              type="text"
              :placeholder="t('recipes.form.difficultyPlaceholder')"
            />
          </div>
          <div class="form-field">
            <label>{{ t('recipes.form.category') }}</label>
            <input
              v-model="newCategory"
              type="text"
              :placeholder="t('recipes.form.categoryPlaceholder')"
            />
          </div>
        </div>

        <div class="form-field">
          <label>
            {{ t('recipes.form.ingredients') }} <span class="required-star">*</span>
          </label>
          <div class="ingredient-rows">
            <div v-for="(row, index) in newIngredientRows" :key="index" class="ingredient-row">
              <SuggestInput v-model="row.name" :suggestions="NAME_SUGGESTIONS" :placeholder="t('recipes.form.ingredientName')" />
              <input v-model="row.quantity" type="text" class="ingredient-quantity" :placeholder="t('recipes.form.ingredientQuantity')" />
              <SuggestInput v-model="row.unit" :suggestions="STANDARD_UNITS" :placeholder="t('recipes.form.ingredientUnit')" />
              <button
                type="button"
                class="ingredient-remove-btn"
                :disabled="newIngredientRows.length <= 1"
                :aria-label="t('recipes.form.removeIngredient')"
                @click="removeNewIngredientRow(index)"
              >
                −
              </button>
            </div>
          </div>
          <button type="button" class="ingredient-add-btn" @click="addNewIngredientRow">
            + {{ t('recipes.form.addIngredient') }}
          </button>
        </div>

        <div class="form-field">
          <label>
            {{ t('recipes.form.instructions') }} <span class="required-star">*</span>
          </label>
          <textarea
            v-model="newInstructions"
            rows="5"
            :placeholder="t('recipes.form.instructionsPlaceholder')"
          ></textarea>
        </div>

        <div class="form-toggle-row">
          <label class="toggle-item">
            <input type="checkbox" v-model="newFavorite" />
            <span>{{ t('recipes.status.favorite') }}</span>
          </label>
          <label class="toggle-item">
            <input type="checkbox" v-model="newPublished" />
            <span>{{ t('recipes.status.showOnHome') }}</span>
          </label>
        </div>

        <button type="submit" class="submit-btn" :disabled="newImageUploading">
          {{ newImageUploading ? 'Bild wird hochgeladen...' : t('recipes.actions.save') }}
        </button>

        <p v-if="formError" class="error-text">
          {{ formError }}
        </p>
      </form>
    </div>

    <div v-if="!isCreateMode" class="recipe-tabs" role="tablist" aria-label="Rezeptbereiche">
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'own'"
        :class="{ active: activeTab === 'own' }"
        @click="setActiveTab('own')"
      >
        {{ t('recipes.my.createdTitle') }}
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'favorites'"
        :class="{ active: activeTab === 'favorites' }"
        @click="setActiveTab('favorites')"
      >
        {{ t('recipes.my.favoritesTitle') }}
      </button>
    </div>

    <div v-if="!isCreateMode && activeTab === 'own'" class="list-card">
      <h3 class="recipes-title">{{ t('recipes.my.createdTitle') }}</h3>

      <p v-if="loading" class="status-text">{{ t('recipes.loading') }}</p>
      <div v-else-if="error" class="status-text error">
        <p>{{ t('recipes.errors.prefix') }} {{ error }}</p>
        <a v-if="loginRequired" href="/login" class="login-link">
          {{ t('recipes.actions.login') }}
        </a>
      </div>

      <ul v-else class="recipes">
        <li v-for="r in filtered" :key="r.id" class="recipe-card">
          <div class="recipe-row">
            <div class="image-wrap" v-if="r.imageUrl">
              <img :src="r.imageUrl" :alt="r.title" />
            </div>

            <div class="recipe-main">
              <div class="recipe-header" @click="startEdit(r)">
                <div>
                  <h4 class="name">
                    {{ r.title }}
                  </h4>
                  <p class="meta">
                    <span v-if="r.category">{{ visibleCategory(r.category) }}</span>
                    <span v-if="r.difficulty"> - {{ r.difficulty }}</span>
                    <span v-if="r.rating"> - {{ t('recipes.status.rating', { rating: r.rating.toFixed(1) }) }}</span>
                  </p>
                  <p class="meta">
                    <span v-if="r.prepTimeMinutes || r.cookTimeMinutes">
                      {{ t('recipes.status.totalTime', { minutes: r.prepTimeMinutes + r.cookTimeMinutes }) }}
                    </span>
                    <span v-if="r.servings"> - {{ t('recipes.status.servings', { count: r.servings }) }}</span>
                  </p>
                </div>
                <div class="badge-column">
                  <span v-if="r.favorite" class="badge badge-fav">{{ t('recipes.status.favoriteBadge') }}</span>
                  <span v-if="r.published" class="badge badge-published">{{ t('recipes.status.publishedBadge') }}</span>
                  <span v-else class="badge badge-private">{{ t('recipes.status.privateBadge') }}</span>
                </div>
              </div>

              <p class="ingredients">
                {{ r.ingredients }}
              </p>

              <div class="card-actions">
                <RouterLink class="link-btn detail-link" :to="`/recipe/${r.id}`">
                  {{ t('recipes.actions.view') }}
                </RouterLink>
                <button class="link-btn" @click.stop="startEdit(r)">{{ t('recipes.actions.edit') }}</button>
                <button class="link-btn danger" @click.stop="deleteRecipe(r.id)">{{ t('recipes.actions.delete') }}</button>
                <label class="publish-toggle" @click.stop>
                  <input
                    type="checkbox"
                    :checked="r.published"
                    @change.stop="togglePublished(r)"
                  />
                  <span>{{ t('recipes.status.showOnHome') }}</span>
                </label>
              </div>
            </div>
          </div>
        </li>

        <li v-if="!loading && filtered.length === 0" class="none-found">
          <p>{{ t('recipes.empty.created') }}</p>
          <RouterLink to="/recipes/new" class="empty-action">
            {{ t('recipes.actions.createFirst') }}
          </RouterLink>
        </li>
      </ul>

      <div class="edit-panel" v-if="editing">
        <h4>{{ t('recipes.my.editTitle') }}</h4>

        <div class="form-row">
          <div class="form-field">
            <label>{{ t('recipes.form.title') }}</label>
            <input v-model="editing.title" type="text" />
          </div>
          <div class="form-field">
            <label>{{ t('recipes.form.imageUrl') }}</label>
            <input v-model="editing.imageUrl" type="url" />
            <label class="image-upload-box" @dragover.prevent @drop.prevent="handleEditImageDrop">
              <span>Bild hochladen oder hier ablegen</span>
              <input type="file" accept="image/*" capture="environment" @change="handleEditImageFile" />
            </label>
            <img
              v-if="editImagePreviewUrl || editing.imageUrl"
              class="image-preview"
              :src="editImagePreviewUrl || editing.imageUrl"
              alt="Bildvorschau"
            />
            <small v-if="editImagePreviewUrl" class="upload-note">
              Lokale Vorschau. Das Bild wird gerade dauerhaft gespeichert.
            </small>
            <small v-else-if="editImageUploading" class="upload-note">
              Bild wird hochgeladen...
            </small>
            <small v-else-if="editImageUploaded" class="upload-note">
              Bild wurde dauerhaft gespeichert.
            </small>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field small">
            <label>{{ t('recipes.form.prepTime') }}</label>
            <input v-model.number="editing.prepTimeMinutes" type="number" min="0" />
          </div>
          <div class="form-field small">
            <label>{{ t('recipes.form.cookTime') }}</label>
            <input v-model.number="editing.cookTimeMinutes" type="number" min="0" />
          </div>
          <div class="form-field small">
            <label>{{ t('recipes.form.servings') }}</label>
            <input v-model.number="editing.servings" type="number" min="0" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label>{{ t('recipes.form.difficulty') }}</label>
            <input v-model="editing.difficulty" type="text" />
          </div>
          <div class="form-field">
            <label>{{ t('recipes.form.category') }}</label>
            <input v-model="editing.category" type="text" />
          </div>
        </div>

        <div class="form-field">
          <label>{{ t('recipes.form.ingredients') }}</label>
          <div class="ingredient-rows">
            <div v-for="(row, index) in editIngredientRows" :key="index" class="ingredient-row">
              <SuggestInput v-model="row.name" :suggestions="NAME_SUGGESTIONS" :placeholder="t('recipes.form.ingredientName')" />
              <input v-model="row.quantity" type="text" class="ingredient-quantity" :placeholder="t('recipes.form.ingredientQuantity')" />
              <SuggestInput v-model="row.unit" :suggestions="STANDARD_UNITS" :placeholder="t('recipes.form.ingredientUnit')" />
              <button
                type="button"
                class="ingredient-remove-btn"
                :disabled="editIngredientRows.length <= 1"
                :aria-label="t('recipes.form.removeIngredient')"
                @click="removeEditIngredientRow(index)"
              >
                −
              </button>
            </div>
          </div>
          <button type="button" class="ingredient-add-btn" @click="addEditIngredientRow">
            + {{ t('recipes.form.addIngredient') }}
          </button>
        </div>

        <div class="form-field">
          <label>{{ t('recipes.form.instructions') }}</label>
          <textarea v-model="editing.instructions" rows="5"></textarea>
        </div>

        <div class="form-toggle-row">
          <label class="toggle-item">
            <input type="checkbox" v-model="editing.favorite" />
            <span>{{ t('recipes.status.favorite') }}</span>
          </label>
          <label class="toggle-item">
            <input type="checkbox" v-model="editing.published" />
            <span>{{ t('recipes.status.showOnHome') }}</span>
          </label>
        </div>

        <div class="edit-buttons">
          <button class="submit-btn" :disabled="editImageUploading" @click="updateRecipe">
            {{ editImageUploading ? 'Bild wird hochgeladen...' : t('recipes.actions.saveChanges') }}
          </button>
          <button class="cancel-btn" @click="cancelEdit">{{ t('recipes.actions.cancel') }}</button>
        </div>
        <p v-if="editFormError" class="error-text">
          {{ editFormError }}
        </p>
      </div>
    </div>

    <div v-if="!isCreateMode && activeTab === 'favorites'" class="list-card">
      <h3 class="recipes-title">{{ t('recipes.my.favoritesTitle') }}</h3>

      <p v-if="loading" class="status-text">{{ t('recipes.loading') }}</p>
      <div v-else-if="error" class="status-text error">
        <p>{{ t('recipes.errors.prefix') }} {{ error }}</p>
        <a v-if="loginRequired" href="/login" class="login-link">
          {{ t('recipes.actions.login') }}
        </a>
      </div>

      <div v-else class="recipe-grid">
        <p v-if="favoriteError" class="status-text error favorite-error">
          {{ t('recipes.errors.prefix') }} {{ favoriteError }}
        </p>
        <article
          v-for="r in favorites"
          :key="'fav-' + r.id"
          class="recipe-card"
          @click="openFavoriteDetails(r)"
        >
          <button
            type="button"
            class="favorite-remove-button"
            :aria-label="t('recipes.actions.removeFavorite')"
            @click.stop="removeFavorite(r)"
          >
            -
          </button>
          <div class="image-wrap" v-if="r.imageUrl">
            <img :src="r.imageUrl" :alt="r.title" />
          </div>

          <div class="card-content">
            <h3 class="card-title">{{ r.title }}</h3>

            <p class="card-meta">
              <span v-if="r.category" class="pill pill-mint">{{ visibleCategory(r.category) }}</span>
              <span v-if="r.difficulty" class="pill pill-soft">{{ r.difficulty }}</span>
              <span v-if="r.rating" class="pill pill-rating">
                {{ t('recipes.status.rating', { rating: r.rating.toFixed(1) }) }}
              </span>
            </p>

            <p class="card-times">
              <span v-if="r.prepTimeMinutes || r.cookTimeMinutes">
                {{ t('recipes.status.totalTime', { minutes: r.prepTimeMinutes + r.cookTimeMinutes }) }}
              </span>
              <span v-if="r.servings"> - {{ t('recipes.status.servings', { count: r.servings }) }}</span>
            </p>

            <p class="card-ingredients">
              {{ r.ingredients }}
            </p>
          </div>
        </article>

        <p v-if="favorites.length === 0" class="status-text empty-favorites">
          <span>{{ t('recipes.empty.favorites') }}</span>
          <RouterLink to="/" class="empty-action">
            {{ t('recipes.actions.discover') }}
          </RouterLink>
        </p>
      </div>
    </div>

    <div v-if="selectedFavorite" class="overlay" @click.self="closeFavoriteDetails">
      <div class="overlay-card">
        <button class="overlay-close" @click="closeFavoriteDetails">x</button>

        <h3 class="overlay-title">{{ selectedFavorite.title }}</h3>

        <p class="overlay-meta">
          <span v-if="selectedFavorite.category">{{ visibleCategory(selectedFavorite.category) }}</span>
          <span v-if="selectedFavorite.difficulty"> - {{ selectedFavorite.difficulty }}</span>
          <span v-if="selectedFavorite.rating"> - {{ t('recipes.status.rating', { rating: selectedFavorite.rating.toFixed(1) }) }}</span>
        </p>

        <p class="overlay-meta">
          <span v-if="selectedFavorite.prepTimeMinutes || selectedFavorite.cookTimeMinutes">
            {{ t('recipes.status.totalTime', { minutes: selectedFavorite.prepTimeMinutes + selectedFavorite.cookTimeMinutes }) }}
          </span>
          <span v-if="selectedFavorite.servings">
            - {{ t('recipes.status.servings', { count: selectedFavorite.servings }) }}
          </span>
        </p>

        <h4 class="overlay-subtitle">{{ t('recipes.form.ingredients') }}</h4>
        <p class="overlay-text">{{ selectedFavorite.ingredients }}</p>

        <h4 class="overlay-subtitle">{{ t('recipes.form.instructions') }}</h4>
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
  box-sizing: border-box;
}

.form-card,
.list-card {
  background: #ffffff;
  border-radius: 20px;
  border: 1px solid #f6d9ea;
  box-shadow: 0 2px 18px rgba(191, 140, 167, 0.12);
  padding: 22px 24px 20px 24px;
}

.recipe-tabs {
  background: #ffffff;
  border: 1px solid #c3e7e1;
  border-radius: 999px;
  display: flex;
  gap: 6px;
  padding: 6px;
  width: fit-content;
}

.recipe-tabs button {
  background: transparent;
  border: none;
  border-radius: 999px;
  color: #486b68;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  min-height: 42px;
  padding: 8px 18px;
}

.recipe-tabs button.active {
  background: #cc7da9;
  color: #ffffff;
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
  min-width: 0;
}

.form-field.small {
  max-width: 160px;
}

.ingredient-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ingredient-row {
  display: grid;
  grid-template-columns: minmax(140px, 2fr) 90px minmax(90px, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.ingredient-quantity {
  width: 100%;
  box-sizing: border-box;
}

.ingredient-remove-btn {
  border: 1.5px solid #c3e7e1;
  border-radius: 8px;
  background: #ffffff;
  color: #a14c2b;
  cursor: pointer;
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1;
  min-height: 38px;
  min-width: 38px;
}

.ingredient-remove-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.ingredient-remove-btn:hover:not(:disabled) {
  background: #fff0eb;
}

.ingredient-add-btn {
  align-self: flex-start;
  margin-top: 6px;
  border: 1.5px dashed #8fd5cc;
  border-radius: 999px;
  background: #ffffff;
  color: #1d8e90;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  padding: 7px 14px;
}

.ingredient-add-btn:hover {
  background: #e0f5f2;
}

@media (max-width: 640px) {
  .ingredient-row {
    grid-template-columns: 1fr;
  }
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

.image-upload-box {
  align-items: center;
  background: #f4fbfa;
  border: 1.5px dashed #8fd5cc;
  border-radius: 10px;
  color: #486b68;
  cursor: pointer;
  display: flex;
  justify-content: center;
  min-height: 72px;
  padding: 10px;
  text-align: center;
}

.image-upload-box input {
  display: none;
}

.image-preview {
  border-radius: 10px;
  border: 1px solid #c3e7e1;
  max-height: 180px;
  object-fit: cover;
  width: 100%;
}

.upload-note {
  color: #486b68;
  font-size: 0.82rem;
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
  min-height: 44px;
  cursor: pointer;
  transition: background 0.15s ease, box-shadow 0.15s ease;
}

.submit-btn:hover {
  background: #b96593;
  box-shadow: 0 3px 12px rgba(191, 140, 167, 0.5);
}

.submit-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.cancel-btn {
  border-radius: 999px;
  border: 1px solid #c3e7e1;
  background: #ffffff;
  color: #486b68;
  padding: 8px 16px;
  font-size: 0.95rem;
  min-height: 44px;
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
  position: relative;
  background: #f4fbfa;
  border-radius: 14px;
  border: 1px solid #c3e7e1;
  padding: 12px 14px 10px 14px;
  box-shadow: 0 1px 7px rgba(79, 127, 120, 0.1);
  min-width: 0;
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
  overflow-wrap: anywhere;
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
  color: #16766c;
}

.badge-private {
  background: #f1f1f1;
  color: #5f6665;
}

.ingredients {
  margin-top: 4px;
  font-size: 0.94rem;
  color: #324240;
  overflow-wrap: anywhere;
}

.favorite-remove-button {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 1;
  width: 2rem;
  height: 2rem;
  border: 1px solid #f2b6c9;
  border-radius: 999px;
  background: #fff7fb;
  color: #9d174d;
  font-weight: 800;
  cursor: pointer;
}

.card-actions {
  margin-top: 6px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.publish-toggle {
  align-items: center;
  color: #486b68;
  cursor: pointer;
  display: inline-flex;
  font-size: 0.86rem;
  gap: 5px;
}

.publish-toggle input {
  width: auto;
}

.link-btn {
  background: transparent;
  border: none;
  color: #26b6b8;
  font-size: 0.9rem;
  min-height: 40px;
  cursor: pointer;
  padding: 0;
}

.detail-link {
  align-items: center;
  display: inline-flex;
  text-decoration: none;
}

.link-btn.danger {
  color: #a14c2b;
}

.none-found {
  color: #486b68;
  font-size: 0.95rem;
  text-align: center;
  padding: 18px 8px 8px;
}

.none-found p,
.empty-favorites span {
  display: block;
  margin-bottom: 12px;
}

.empty-action {
  align-items: center;
  background: #cc7da9;
  border-radius: 999px;
  color: #ffffff;
  display: inline-flex;
  font-weight: 800;
  min-height: 42px;
  padding: 8px 16px;
  text-decoration: none;
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
  grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
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
  overflow-wrap: anywhere;
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
  padding: 18px;
}

.overlay-card {
  max-width: 700px;
  width: min(700px, 100%);
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
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .recipe-manager {
    gap: 16px;
  }

  .form-card,
  .list-card {
    border-radius: 16px;
    padding: 18px 14px;
  }

  .recipe-tabs {
    border-radius: 16px;
    display: grid;
    grid-template-columns: 1fr;
    width: 100%;
  }

  .form-title {
    font-size: 1.25rem;
    line-height: 1.2;
  }

  .form-row,
  .form-toggle-row,
  .edit-buttons,
  .card-actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .form-field.small {
    max-width: none;
  }

  .submit-btn,
  .cancel-btn,
  .login-link,
  .link-btn,
  .empty-action {
    justify-content: center;
    text-align: center;
    width: 100%;
  }

  .recipe-row,
  .recipe-header {
    flex-direction: column;
  }

  .image-wrap {
    height: auto;
    aspect-ratio: 16 / 10;
    width: 100%;
  }

  .badge-column {
    align-items: flex-start;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .recipe-grid {
    grid-template-columns: 1fr;
  }

  .overlay {
    align-items: flex-end;
    padding: 10px;
  }

  .overlay-card {
    border-radius: 18px 18px 0 0;
    max-height: 92vh;
    padding: 18px 14px;
  }

  .overlay-title {
    font-size: 1.3rem;
    line-height: 1.2;
  }
}
</style>
