<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ApiClientError, AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { recipeApi } from '@/shared/api/recipeApi'
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
    .map(r => [r.quantity, r.unit, r.name].filter(p => p.trim()).join(' ').trim())
    .filter(Boolean)
    .join(', ')
}

function parseIngredientRows(ingredients: string, ingredientsList?: string[] | null): IngredientRow[] {
  const lines = ingredientsList?.length ? ingredientsList : ingredients.split(',').map(s => s.trim()).filter(Boolean)
  if (!lines.length) return [emptyIngredientRow()]
  return lines.map(line => {
    const parts = line.trim().split(/\s+/)
    const first = parts[0] ?? ''
    const quantity = parts.length > 1 && /^[\d.,/]+$/.test(first) ? (parts.shift() ?? '') : ''
    const next = parts[0] ?? ''
    const unit = quantity && parts.length > 0 && STANDARD_UNITS.includes(next.toLowerCase()) ? (parts.shift() ?? '') : ''
    return { quantity, unit, name: parts.join(' ') || line.trim() }
  })
}

function toCaloriesValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toastStore = useToastStore()

const recipe = ref<Recipe | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const formError = ref<string | null>(null)
const ingredientRows = ref<IngredientRow[]>([emptyIngredientRow()])
const imagePreviewUrl = ref('')
const imageUploading = ref(false)
const imageUploaded = ref(false)

onMounted(() => {
  loadRecipe()
})

async function loadRecipe() {
  loading.value = true
  error.value = null
  try {
    const id = route.params.id as string
    recipe.value = await recipeApi.getRecipe(id)
    ingredientRows.value = parseIngredientRows(recipe.value.ingredients, recipe.value.ingredientsList)
  } catch {
    error.value = t('recipes.errors.load')
  } finally {
    loading.value = false
  }
}

async function saveRecipe() {
  if (!recipe.value) return
  if (imageUploading.value) {
    formError.value = 'Bitte warte, bis das Bild hochgeladen wurde.'
    return
  }
  if (!recipe.value.title.trim() || !ingredientRows.value.some(r => r.name.trim()) || !recipe.value.instructions.trim()) {
    formError.value = t('recipes.errors.requiredFields')
    return
  }
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    formError.value = t('recipes.errors.updateLoginRequired')
    return
  }

  formError.value = null
  saving.value = true

  const request: RecipeRequest = {
    title: recipe.value.title,
    imageUrl: recipe.value.imageUrl,
    prepTimeMinutes: recipe.value.prepTimeMinutes,
    cookTimeMinutes: recipe.value.cookTimeMinutes,
    servings: recipe.value.servings,
    difficulty: recipe.value.difficulty,
    category: recipe.value.category,
    rating: recipe.value.rating,
    ingredients: serializeIngredientRows(ingredientRows.value),
    instructions: recipe.value.instructions,
    favorite: recipe.value.favorite,
    published: recipe.value.published,
    language: recipe.value.language,
    calories: toCaloriesValue(recipe.value.calories),
  }

  try {
    await recipeApi.updateRecipe(recipe.value.id, request)
    toastStore.addToast(t('notifications.recipeUpdated'), 'success')
    await router.push(`/recipe/${recipe.value.id}`)
  } catch (e: unknown) {
    if (e instanceof ApiClientError) {
      if (e.status === 400) { formError.value = t('recipes.errors.validation'); return }
      if (e.status === 401) { formError.value = t('recipes.errors.updateSessionExpired'); return }
      if (e.status === 403) { formError.value = t('recipes.errors.updateForbidden'); return }
    }
    formError.value = t('recipes.errors.update')
  } finally {
    saving.value = false
  }
}

function cancel() {
  if (recipe.value) {
    router.push(`/recipe/${recipe.value.id}`)
  } else {
    router.push('/my-recipes')
  }
}

function handleImageFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) void uploadImage(file)
}

function handleImageDrop(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0]
  if (file) void uploadImage(file)
}

async function uploadImage(file: File) {
  if (!file.type.startsWith('image/')) {
    formError.value = 'Bitte wähle eine Bilddatei aus.'
    return
  }
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    formError.value = 'Bitte melde dich an.'
    return
  }
  clearPreview()
  imagePreviewUrl.value = URL.createObjectURL(file)
  imageUploading.value = true
  imageUploaded.value = false
  formError.value = null
  try {
    const uploaded = await recipeApi.uploadRecipeImage(file)
    clearPreview()
    if (recipe.value) recipe.value.imageUrl = uploaded.imageUrl
    imageUploaded.value = true
  } catch {
    formError.value = 'Das Bild konnte nicht hochgeladen werden.'
  } finally {
    imageUploading.value = false
  }
}

function clearPreview() {
  if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
  imagePreviewUrl.value = ''
}

function addIngredientRow() { ingredientRows.value.push(emptyIngredientRow()) }
function removeIngredientRow(index: number) {
  if (ingredientRows.value.length > 1) ingredientRows.value.splice(index, 1)
}
</script>

<template>
  <main class="edit-recipe-page">
    <section class="page-header">
      <p class="eyebrow">{{ t('recipes.my.editTitle') }}</p>
      <h1 class="page-title">{{ recipe?.title || t('recipes.my.editTitle') }}</h1>
      <p class="page-subtitle">Passe Zutaten, Zeiten und Beschreibung deines Rezeptes an.</p>
    </section>

    <p v-if="loading" class="status-text">{{ t('recipes.loading') }}</p>
    <p v-else-if="error" class="error-text" role="alert">{{ error }}</p>

    <form v-else-if="recipe" class="edit-form" @submit.prevent="saveRecipe">
      <div class="form-row">
        <div class="form-field">
          <label>{{ t('recipes.form.title') }} <span class="required-star">*</span></label>
          <input v-model="recipe.title" type="text" :placeholder="t('recipes.form.titlePlaceholder')" />
        </div>
        <div class="form-field">
          <label>{{ t('recipes.form.imageUrl') }}</label>
          <input v-model="recipe.imageUrl" type="url" :placeholder="t('recipes.form.imageUrlPlaceholder', { protocol: 'https://' })" />
          <label class="image-upload-box" @dragover.prevent @drop.prevent="handleImageDrop">
            <span>Bild hochladen oder hier ablegen</span>
            <input type="file" accept="image/*" @change="handleImageFile" />
          </label>
          <img v-if="imagePreviewUrl || recipe.imageUrl" class="image-preview" :src="imagePreviewUrl || recipe.imageUrl" alt="Vorschau" />
          <small v-if="imageUploading" class="upload-note">Bild wird hochgeladen...</small>
          <small v-else-if="imageUploaded" class="upload-note">Bild wurde gespeichert.</small>
        </div>
      </div>

      <div class="form-row">
        <div class="form-field small">
          <label>{{ t('recipes.form.prepTime') }}</label>
          <input v-model.number="recipe.prepTimeMinutes" type="number" min="0" :placeholder="t('recipes.form.prepTimePlaceholder')" />
        </div>
        <div class="form-field small">
          <label>{{ t('recipes.form.cookTime') }}</label>
          <input v-model.number="recipe.cookTimeMinutes" type="number" min="0" :placeholder="t('recipes.form.cookTimePlaceholder')" />
        </div>
        <div class="form-field small">
          <label>{{ t('recipes.form.servings') }}</label>
          <input v-model.number="recipe.servings" type="number" min="0" :placeholder="t('recipes.form.servingsPlaceholder')" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label>{{ t('recipes.form.difficulty') }}</label>
          <input v-model="recipe.difficulty" type="text" :placeholder="t('recipes.form.difficultyPlaceholder')" />
        </div>
        <div class="form-field">
          <label>{{ t('recipes.form.category') }}</label>
          <input v-model="recipe.category" type="text" :placeholder="t('recipes.form.categoryPlaceholder')" />
        </div>
        <div class="form-field small">
          <label>{{ t('recipes.form.calories') }}</label>
          <input v-model.number="recipe.calories" type="number" min="0" :placeholder="t('recipes.form.caloriesPlaceholder')" />
        </div>
      </div>

      <div class="form-field">
        <label>{{ t('recipes.form.ingredients') }} <span class="required-star">*</span></label>
        <div class="ingredient-rows">
          <div class="ingredient-row-header" aria-hidden="true">
            <span>{{ t('recipes.form.ingredientName') }}</span>
            <span>{{ t('recipes.form.ingredientQuantity') }}</span>
            <span>{{ t('recipes.form.ingredientUnit') }}</span>
            <span></span>
          </div>
          <div v-for="(row, index) in ingredientRows" :key="index" class="ingredient-row">
            <SuggestInput v-model="row.name" :suggestions="NAME_SUGGESTIONS" :placeholder="t('recipes.form.ingredientName')" />
            <input v-model="row.quantity" type="text" class="ingredient-quantity" :placeholder="t('recipes.form.ingredientQuantity')" />
            <SuggestInput v-model="row.unit" :suggestions="STANDARD_UNITS" show-suggestions-on-focus :placeholder="t('recipes.form.ingredientUnit')" />
            <button type="button" class="ingredient-remove-btn" :disabled="ingredientRows.length <= 1" :aria-label="t('recipes.form.removeIngredient')" @click="removeIngredientRow(index)">−</button>
          </div>
        </div>
        <button type="button" class="ingredient-add-btn" @click="addIngredientRow">+ {{ t('recipes.form.addIngredient') }}</button>
      </div>

      <div class="form-field">
        <label>{{ t('recipes.form.instructions') }} <span class="required-star">*</span></label>
        <textarea v-model="recipe.instructions" rows="5" :placeholder="t('recipes.form.instructionsPlaceholder')"></textarea>
      </div>

      <div class="form-toggle-row">
        <label class="toggle-item">
          <input type="checkbox" v-model="recipe.favorite" />
          <span>{{ t('recipes.status.favorite') }}</span>
        </label>
        <label class="toggle-item">
          <input type="checkbox" v-model="recipe.published" />
          <span>{{ t('recipes.status.showOnHome') }}</span>
        </label>
      </div>

      <p v-if="formError" class="error-text" role="alert">{{ formError }}</p>

      <div class="form-actions">
        <button type="submit" class="submit-btn" :disabled="saving || imageUploading">
          {{ saving ? t('recipes.actions.saving') || t('recipes.actions.saveChanges') : t('recipes.actions.saveChanges') }}
        </button>
        <button type="button" class="cancel-btn" @click="cancel">{{ t('recipes.actions.cancel') }}</button>
      </div>
    </form>
  </main>
</template>

<style scoped>
.edit-recipe-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 36px 24px 48px;
  color: var(--text-dark, #2e3437);
  box-sizing: border-box;
}

/* ── Page header ──────────────────────────────────── */
.page-header {
  background: var(--pink-bg, #fdf1f5);
  border-radius: var(--radius-card, 18px);
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  padding: 26px 32px;
  margin-bottom: 26px;
}

.eyebrow {
  margin: 0 0 0.4rem;
  color: var(--pink, #e85a9b);
  font-weight: 700;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.page-title {
  margin: 0 0 0.4rem;
  font-size: 1.9rem;
  font-weight: 800;
  color: var(--pink-dark, #d44488);
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.page-subtitle {
  margin: 0;
  color: var(--text-gray, #6b7478);
  font-size: 0.97rem;
}

/* ── Form card ────────────────────────────────────── */
.edit-form {
  display: grid;
  gap: 1.25rem;
  background: #ffffff;
  border-radius: var(--radius-card, 18px);
  padding: 26px 28px;
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
  gap: 1rem;
  /* Without this, grid's default stretch makes a short field (e.g. title) match
     the height of a much taller sibling (e.g. the image upload column with its
     dropzone/preview), leaving a huge empty area around a single-line input. */
  align-items: start;
}

.form-field {
  display: grid;
  gap: 0.45rem;
  font-weight: 700;
  font-size: 0.92rem;
}

.form-field.small { max-width: 160px; }

.form-field input,
.form-field textarea {
  width: 100%;
  border: 1.5px solid var(--line, #e6ecea);
  border-radius: 10px;
  padding: 0.7rem 0.85rem;
  font: inherit;
  color: var(--text-dark, #2e3437);
  background: #ffffff;
  transition: border-color 0.16s ease;
}

.form-field input:focus,
.form-field textarea:focus {
  outline: none;
  border-color: var(--mint, #5ecbb5);
}

.form-field textarea {
  min-height: 120px;
  resize: vertical;
}

/* ── Image upload ─────────────────────────────────── */
.image-upload-box {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px dashed var(--mint, #5ecbb5);
  border-radius: 10px;
  padding: 0.7rem;
  cursor: pointer;
  font-weight: 500;
  color: var(--text-gray, #6b7478);
  font-size: 0.88rem;
  margin-top: 0.4rem;
  background: var(--mint-bg, #ecfaf6);
  transition: background 0.16s ease;
}

.image-upload-box:hover {
  background: var(--mint, #5ecbb5);
  color: #ffffff;
}

.image-upload-box input { display: none; }

.image-preview {
  max-height: 140px;
  border-radius: 10px;
  object-fit: cover;
  margin-top: 0.45rem;
  border: 1px solid var(--line, #e6ecea);
}

.upload-note {
  color: var(--text-gray, #6b7478);
  font-size: 0.83rem;
  font-weight: 500;
  margin-top: 0.25rem;
}

/* ── Ingredients ──────────────────────────────────── */
.ingredient-rows { display: grid; gap: 6px; }

.ingredient-row-header,
.ingredient-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 36px;
  gap: 6px;
  align-items: center;
}

.ingredient-row-header {
  font-size: 0.8rem;
  color: var(--text-light, #9aa2a5);
  font-weight: 600;
}

.ingredient-quantity { min-width: 0; }

.ingredient-remove-btn {
  width: 32px;
  height: 32px;
  border: 1.5px solid var(--pink-light, #fdeef5);
  border-radius: 50%;
  background: var(--pink-light, #fdeef5);
  cursor: pointer;
  font-size: 1.1rem;
  color: var(--pink-dark, #d44488);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.16s ease, color 0.16s ease;
}

.ingredient-remove-btn:hover:not(:disabled) {
  background: var(--pink, #e85a9b);
  color: #ffffff;
}

.ingredient-remove-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.ingredient-add-btn {
  margin-top: 8px;
  background: #ffffff;
  border: 1.5px solid var(--mint, #5ecbb5);
  border-radius: var(--radius-pill, 999px);
  padding: 8px 16px;
  cursor: pointer;
  color: var(--mint-darker, #2b8c7b);
  font-weight: 700;
  font-size: 0.88rem;
  transition: background 0.16s ease, color 0.16s ease;
}

.ingredient-add-btn:hover {
  background: var(--mint, #5ecbb5);
  color: #ffffff;
}

/* ── Toggles ──────────────────────────────────────── */
.form-toggle-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.toggle-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.9rem;
  border: 1.5px solid var(--line, #e6ecea);
  border-radius: var(--radius-pill, 999px);
  padding: 0.65rem 1rem;
  cursor: pointer;
  color: var(--text-gray, #6b7478);
  transition: border-color 0.16s ease;
}

.toggle-item:hover {
  border-color: var(--mint, #5ecbb5);
}

/* ── Form footer ──────────────────────────────────── */
.form-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding-top: 0.5rem;
  border-top: 1px solid var(--line, #e6ecea);
}

.submit-btn {
  border: 0;
  border-radius: var(--radius-pill, 999px);
  background: var(--pink, #e85a9b);
  color: #ffffff;
  padding: 0.75rem 1.4rem;
  font-weight: 700;
  min-height: 44px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: background 0.16s ease, transform 0.16s ease;
}

.submit-btn:hover:not(:disabled) {
  background: var(--pink-dark, #d44488);
  transform: translateY(-1px);
}
.submit-btn:disabled { cursor: wait; opacity: 0.7; }

.cancel-btn {
  border: 1.5px solid var(--line, #e6ecea);
  border-radius: var(--radius-pill, 999px);
  background: #ffffff;
  color: var(--text-gray, #6b7478);
  padding: 0.75rem 1.15rem;
  font-weight: 600;
  min-height: 44px;
  cursor: pointer;
  transition: border-color 0.16s ease, color 0.16s ease;
}

.cancel-btn:hover {
  border-color: var(--mint, #5ecbb5);
  color: var(--mint-darker, #2b8c7b);
}

/* ── Misc ─────────────────────────────────────────── */
.required-star { color: var(--pink, #e85a9b); }

.status-text {
  padding: 1rem;
  background: var(--mint-bg, #ecfaf6);
  border-radius: 12px;
  color: var(--text-gray, #6b7478);
}

.error-text {
  padding: 0.8rem 1rem;
  background: var(--pink-light, #fdeef5);
  color: var(--pink-dark, #d44488);
  border-radius: 12px;
  margin: 0;
}

@media (max-width: 640px) {
  .edit-recipe-page { padding: 22px 12px 32px; }
  .page-header { padding: 20px 18px; }
  .page-title { font-size: 1.5rem; }
  .edit-form { padding: 18px 16px; }
  .form-actions { justify-content: stretch; }
  .submit-btn, .cancel-btn { flex: 1; text-align: center; justify-content: center; }
}
</style>
