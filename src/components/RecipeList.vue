<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ApiClientError, AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { favoriteApi } from '@/shared/api/favoriteApi'
import { recipeApi } from '@/shared/api/recipeApi'
import { displayCategory } from '@/shared/recipeDisplay'
import { useToastStore } from '@/stores/toastStore'
import { NAME_SUGGESTIONS, STANDARD_UNITS } from '@/shared/ingredientConstants'
import { exportRecipe, validateDishlyImport } from '@/shared/recipeImportExport'
import SuggestInput from '@/components/SuggestInput.vue'
import type { Recipe, RecipeRequest } from '@/types/recipe'

type IngredientRow = { name: string; quantity: string; unit: string }

function emptyIngredientRow(): IngredientRow {
  return { name: '', quantity: '', unit: '' }
}

function emptyInstructionStep(): string {
  return ''
}

function toCaloriesValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
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

function serializeInstructionRows(rows: string[]): string {
  return rows.map(step => step.trim()).filter(Boolean).join('\n')
}

function parseInstructionRows(instructions: string, instructionsList?: string[] | null): string[] {
  const lines = instructionsList && instructionsList.length > 0
    ? instructionsList
    : instructions.split(/\r?\n/)

  const steps = lines
    .map(step => step.trim())
    .filter(Boolean)

  return steps.length > 0 ? steps : [emptyInstructionStep()]
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
const newCalories = ref<number | null>(null)
const newIngredientRows = ref<IngredientRow[]>([emptyIngredientRow()])
const newInstructionRows = ref<string[]>([emptyInstructionStep()])
const newFavorite = ref(false)
const newPublished = ref(false)
const newImagePreviewUrl = ref('')
const editImagePreviewUrl = ref('')
const newImageUploading = ref(false)
const editImageUploading = ref(false)
const newImageUploaded = ref(false)
const editImageUploaded = ref(false)
const editIngredientRows = ref<IngredientRow[]>([emptyIngredientRow()])
const editInstructionRows = ref<string[]>([emptyInstructionStep()])

const editing = ref<Recipe | null>(null)
const PAGE_SIZE = 8
const ownPage = ref(1)
const favoritesPage = ref(1)
const selectedFavorite = ref<Recipe | null>(null)
const activeTab = ref<'own' | 'favorites'>(tabFromQuery(route.query.tab))

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
      id: favorite.externalRecipeId?.trim() || `favorite-${favorite.id}`,
      externalId: favorite.externalRecipeId,
      favoriteRecordId: favorite.id,
      source: (favorite.externalSource ?? 'SPOONACULAR').toLowerCase(),
      sourceName: favorite.externalSource ?? 'SPOONACULAR',
      title: favorite.externalTitle?.trim() || t('recipes.my.incompleteFavoriteTitle'),
      imageUrl: favorite.externalImageUrl ?? '',
      prepTimeMinutes: 0,
      cookTimeMinutes: 0,
      servings: 0,
      difficulty: '',
      category: '',
      rating: 0,
      ingredients: '',
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
const hasNewInstructions = computed(() => newInstructionRows.value.some(step => step.trim()))

function addNewIngredientRow() {
  newIngredientRows.value.push(emptyIngredientRow())
}

function removeNewIngredientRow(index: number) {
  if (newIngredientRows.value.length <= 1) return
  newIngredientRows.value.splice(index, 1)
}

function addNewInstructionStep() {
  newInstructionRows.value.push(emptyInstructionStep())
}

function removeNewInstructionStep(index: number) {
  if (newInstructionRows.value.length <= 1) return
  newInstructionRows.value.splice(index, 1)
}

const createRecipe = async () => {
  if (newImageUploading.value) {
    formError.value = 'Bitte warte, bis das Bild hochgeladen wurde.'
    return
  }
  if (
    !newTitle.value.trim() ||
    !hasNewIngredients.value ||
    !hasNewInstructions.value
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
      instructions: serializeInstructionRows(newInstructionRows.value),
      favorite: newFavorite.value,
      published: newPublished.value,
      language: currentLanguage.value,
      calories: toCaloriesValue(newCalories.value),
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
    newCalories.value = null
    newIngredientRows.value = [emptyIngredientRow()]
    newInstructionRows.value = [emptyInstructionStep()]
    newFavorite.value = false
    newPublished.value = false
    newImageUploaded.value = false
    clearNewImagePreview()
    error.value = null
    toastStore.addToast(t('notifications.recipeCreated'), 'success')
    if (isCreateMode.value) {
      // from=my-recipes lets the detail page's back button return to the recipe
      // list instead of back to this now-empty creation form.
      await router.push({ path: `/recipe/${saved.id}`, query: { from: 'my-recipes' } })
    }
  } catch (e: unknown) {
    formError.value = toCreateRecipeErrorMessage(e)
  }
}

const toCreateRecipeErrorMessage = (e: unknown) => {
  if (e instanceof ApiClientError) {
    if (e.status === 400) {
      return t('recipes.errors.validation')
    }
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
  editInstructionRows.value = parseInstructionRows(r.instructions, r.instructionsList)
  editImagePreviewUrl.value = ''
  editImageUploaded.value = false
  editImageUploading.value = false
}

const cancelEdit = () => {
  editing.value = null
  editIngredientRows.value = [emptyIngredientRow()]
  editInstructionRows.value = [emptyInstructionStep()]
  editImageUploaded.value = false
  editImageUploading.value = false
  clearEditImagePreview()
}

const hasEditIngredients = computed(() => editIngredientRows.value.some(r => r.name.trim()))
const hasEditInstructions = computed(() => editInstructionRows.value.some(step => step.trim()))

function addEditIngredientRow() {
  editIngredientRows.value.push(emptyIngredientRow())
}

function removeEditIngredientRow(index: number) {
  if (editIngredientRows.value.length <= 1) return
  editIngredientRows.value.splice(index, 1)
}

function addEditInstructionStep() {
  editInstructionRows.value.push(emptyInstructionStep())
}

function removeEditInstructionStep(index: number) {
  if (editInstructionRows.value.length <= 1) return
  editInstructionRows.value.splice(index, 1)
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
    !hasEditInstructions.value
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
  editing.value.instructions = serializeInstructionRows(editInstructionRows.value)

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
    if (e.status === 400) {
      return t('recipes.errors.validation')
    }
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

const ownTotalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const favoritesTotalPages = computed(() => Math.max(1, Math.ceil(favorites.value.length / PAGE_SIZE)))
const ownPageNumbers = computed(() => Array.from({ length: ownTotalPages.value }, (_, index) => index + 1))
const favoritesPageNumbers = computed(() => Array.from({ length: favoritesTotalPages.value }, (_, index) => index + 1))
const paginatedOwnRecipes = computed(() => paginate(filtered.value, ownPage.value))
const paginatedFavorites = computed(() => paginate(favorites.value, favoritesPage.value))

watch(filtered, () => {
  if (ownPage.value > ownTotalPages.value) ownPage.value = ownTotalPages.value
})

watch(favorites, () => {
  if (favoritesPage.value > favoritesTotalPages.value) favoritesPage.value = favoritesTotalPages.value
})

function paginate<T>(items: T[], page: number): T[] {
  const start = (page - 1) * PAGE_SIZE
  return items.slice(start, start + PAGE_SIZE)
}

function scrollListToTop() {
  try {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch {
    window.scrollTo(0, 0)
  }
}

function goToOwnPage(page: number) {
  if (page < 1 || page > ownTotalPages.value || page === ownPage.value) return
  ownPage.value = page
  scrollListToTop()
}

function goToFavoritesPage(page: number) {
  if (page < 1 || page > favoritesTotalPages.value || page === favoritesPage.value) return
  favoritesPage.value = page
  scrollListToTop()
}

const openFavoriteDetails = (r: Recipe) => {
  if (!canOpenFavoriteDetails(r)) {
    return
  }
  if (isExternalFavoriteRecipe(r)) {
    router.push(`/recipe/external/${r.externalId ?? r.id}`)
    return
  }
  router.push(`/recipe/${r.id}`)
}

function isExternalFavoriteRecipe(recipe: Recipe) {
  return recipe.favoriteRecordId != null || recipe.source === 'spoonacular' || recipe.source === 'external'
}

function isRoutableExternalFavorite(recipe: Recipe) {
  const source = (recipe.sourceName?.trim() || recipe.source?.trim() || '').toLowerCase()
  return Boolean(recipe.externalId) && (source === 'spoonacular' || source === 'external')
}

function canOpenFavoriteDetails(recipe: Recipe) {
  return isExternalFavoriteRecipe(recipe) ? isRoutableExternalFavorite(recipe) : true
}

const closeFavoriteDetails = () => {
  selectedFavorite.value = null
}

const setActiveTab = (tab: 'own' | 'favorites') => {
  activeTab.value = tab
  if (!isCreateMode.value) {
    router.replace({
      path: route.path,
      query: {
        ...route.query,
        tab,
      },
    })
  }
}

watch(() => route.query.tab, tab => {
  activeTab.value = tabFromQuery(tab)
})

function tabFromQuery(tab: unknown): 'own' | 'favorites' {
  const value = Array.isArray(tab) ? tab[0] : tab
  return value === 'favorites' ? 'favorites' : 'own'
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
    calories: toCaloriesValue(recipe.calories),
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

const importFileInput = ref<HTMLInputElement | null>(null)
const importing = ref(false)

function triggerImport() {
  importFileInput.value?.click()
}

async function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = ''

  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    toastStore.addToast(t('recipes.errors.importInvalid'), 'error')
    return
  }

  const result = validateDishlyImport(parsed)
  if (!result.ok) {
    const keyMap: Record<string, string> = {
      invalidJson: 'recipes.errors.importInvalid',
      notDishly: 'recipes.errors.importNotDishly',
      unsupportedVersion: 'recipes.errors.importUnsupportedVersion',
      missingRecipe: 'recipes.errors.importMissingRecipe',
      missingTitle: 'recipes.errors.importMissingTitle',
      negativeCalories: 'recipes.errors.importNegativeCalories',
    }
    toastStore.addToast(t(keyMap[result.reason] ?? 'recipes.errors.importInvalid'), 'error')
    return
  }

  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    toastStore.addToast(t('recipes.errors.createLoginRequired'), 'error')
    return
  }

  importing.value = true
  try {
    const saved = await recipeApi.createRecipe(result.request)
    recipes.value.push(saved)
    toastStore.addToast(t('notifications.recipeImported'), 'success')
  } catch (e: unknown) {
    toastStore.addToast(toCreateRecipeErrorMessage(e), 'error')
  } finally {
    importing.value = false
  }
}

function handleExportRecipe(r: Recipe) {
  exportRecipe(r)
  toastStore.addToast(t('notifications.recipeExported'), 'success')
}

const removeFavorite = async (r: Recipe) => {
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    favoriteError.value = t('recipes.errors.sessionExpired')
    return
  }

  try {
    favoriteError.value = null
    if (r.favoriteRecordId != null) {
      await favoriteApi.removeExternalFavoriteById(r.favoriteRecordId)
      externalFavorites.value = externalFavorites.value.filter(favorite =>
        favorite.favoriteRecordId !== r.favoriteRecordId
      )
      if (selectedFavorite.value?.id === r.id) {
        selectedFavorite.value = null
      }
      return
    }

    if (isExternalFavoriteRecipe(r)) {
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

    await recipeApi.removeRecipeFavorite(r.id)
    const index = recipes.value.findIndex(recipe => recipe.id === r.id)
    const existing = index >= 0 ? recipes.value[index] : null
    if (existing) {
      recipes.value[index] = { ...existing, favorite: false }
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

defineExpose({ startEdit })
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
          <div class="form-field small">
            <label>{{ t('recipes.form.calories') }}</label>
            <input
              v-model.number="newCalories"
              type="number"
              min="0"
              :placeholder="t('recipes.form.caloriesPlaceholder')"
            />
          </div>
        </div>

        <div class="form-field">
          <label>
            {{ t('recipes.form.ingredients') }} <span class="required-star">*</span>
          </label>
          <div class="ingredient-rows">
            <div class="ingredient-row-header" aria-hidden="true">
              <span>{{ t('recipes.form.ingredientName') }}</span>
              <span>{{ t('recipes.form.ingredientQuantity') }}</span>
              <span>{{ t('recipes.form.ingredientUnit') }}</span>
              <span></span>
            </div>
            <div v-for="(row, index) in newIngredientRows" :key="index" class="ingredient-row">
              <SuggestInput v-model="row.name" :suggestions="NAME_SUGGESTIONS" :placeholder="t('recipes.form.ingredientName')" />
              <input v-model="row.quantity" type="text" class="ingredient-quantity" :placeholder="t('recipes.form.ingredientQuantity')" />
              <SuggestInput v-model="row.unit" :suggestions="STANDARD_UNITS" show-suggestions-on-focus :placeholder="t('recipes.form.ingredientUnit')" />
              <button
                type="button"
                class="ingredient-remove-btn"
                :disabled="newIngredientRows.length <= 1"
                :aria-label="t('recipes.form.removeIngredient')"
                @click="removeNewIngredientRow(index)"
              >−</button>
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
          <div class="instruction-rows">
            <div v-for="(_, index) in newInstructionRows" :key="index" class="instruction-row">
              <label class="instruction-step-label" :for="`new-instruction-${index}`">
                {{ t('recipes.form.instructionStep', { number: index + 1 }) }}
              </label>
              <textarea
                :id="`new-instruction-${index}`"
                v-model="newInstructionRows[index]"
                rows="3"
                :placeholder="t('recipes.form.instructionsPlaceholder')"
              ></textarea>
              <button
                type="button"
                class="ingredient-remove-btn"
                :disabled="newInstructionRows.length <= 1"
                :aria-label="t('recipes.form.removeInstruction')"
                @click="removeNewInstructionStep(index)"
              >-</button>
            </div>
          </div>
          <button type="button" class="ingredient-add-btn" @click="addNewInstructionStep">
            + {{ t('recipes.form.addInstruction') }}
          </button>
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
      <div class="list-card-header">
        <h3 class="recipes-title">{{ t('recipes.my.createdTitle') }}</h3>
        <button type="button" class="import-btn" :disabled="importing" @click="triggerImport">
          {{ importing ? '…' : t('recipes.actions.importBtn') }}
        </button>
        <input
          ref="importFileInput"
          type="file"
          accept=".json"
          class="sr-only"
          @change="handleImportFile"
        />
      </div>

      <p v-if="loading" class="status-text">{{ t('recipes.loading') }}</p>
      <div v-else-if="error" class="status-text error">
        <p>{{ t('recipes.errors.prefix') }} {{ error }}</p>
        <a v-if="loginRequired" href="/login" class="login-link">
          {{ t('recipes.actions.login') }}
        </a>
      </div>

      <ul v-else class="recipes">
        <li v-for="r in paginatedOwnRecipes" :key="r.id" class="recipe-card">
          <div class="recipe-row">
            <div class="image-wrap" v-if="r.imageUrl">
              <img :src="r.imageUrl" :alt="r.title" />
            </div>

            <div class="recipe-main">
              <div class="recipe-header">
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
                <RouterLink class="link-btn" :to="`/my-recipes/${r.id}/edit`">{{ t('recipes.actions.edit') }}</RouterLink>
                <button class="link-btn" @click.stop="handleExportRecipe(r)">{{ t('recipes.actions.export') }}</button>
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

      <nav v-if="filtered.length > PAGE_SIZE" class="pagination" :aria-label="t('home.pagination.label')">
        <button
          type="button"
          class="pagination-btn"
          :disabled="ownPage === 1"
          @click="goToOwnPage(ownPage - 1)"
        >
          {{ t('home.pagination.previous') }}
        </button>
        <button
          v-for="page in ownPageNumbers"
          :key="`own-page-${page}`"
          type="button"
          class="pagination-btn page-number"
          :class="{ active: ownPage === page }"
          :aria-current="ownPage === page ? 'page' : undefined"
          @click="goToOwnPage(page)"
        >
          {{ page }}
        </button>
        <button
          type="button"
          class="pagination-btn"
          :disabled="ownPage === ownTotalPages"
          @click="goToOwnPage(ownPage + 1)"
        >
          {{ t('home.pagination.next') }}
        </button>
      </nav>

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
          <div class="form-field small">
            <label>{{ t('recipes.form.calories') }}</label>
            <input v-model.number="editing.calories" type="number" min="0" :placeholder="t('recipes.form.caloriesPlaceholder')" />
          </div>
        </div>

        <div class="form-field">
          <label>{{ t('recipes.form.ingredients') }}</label>
          <div class="ingredient-rows">
            <div class="ingredient-row-header" aria-hidden="true">
              <span>{{ t('recipes.form.ingredientName') }}</span>
              <span>{{ t('recipes.form.ingredientQuantity') }}</span>
              <span>{{ t('recipes.form.ingredientUnit') }}</span>
              <span></span>
            </div>
            <div v-for="(row, index) in editIngredientRows" :key="index" class="ingredient-row">
              <SuggestInput v-model="row.name" :suggestions="NAME_SUGGESTIONS" :placeholder="t('recipes.form.ingredientName')" />
              <input v-model="row.quantity" type="text" class="ingredient-quantity" :placeholder="t('recipes.form.ingredientQuantity')" />
              <SuggestInput v-model="row.unit" :suggestions="STANDARD_UNITS" show-suggestions-on-focus :placeholder="t('recipes.form.ingredientUnit')" />
              <button
                type="button"
                class="ingredient-remove-btn"
                :disabled="editIngredientRows.length <= 1"
                :aria-label="t('recipes.form.removeIngredient')"
                @click="removeEditIngredientRow(index)"
              >−</button>
            </div>
          </div>
          <button type="button" class="ingredient-add-btn" @click="addEditIngredientRow">
            + {{ t('recipes.form.addIngredient') }}
          </button>
        </div>

        <div class="form-field">
          <label>{{ t('recipes.form.instructions') }}</label>
          <div class="instruction-rows">
            <div v-for="(_, index) in editInstructionRows" :key="index" class="instruction-row">
              <label class="instruction-step-label" :for="`edit-instruction-${index}`">
                {{ t('recipes.form.instructionStep', { number: index + 1 }) }}
              </label>
              <textarea
                :id="`edit-instruction-${index}`"
                v-model="editInstructionRows[index]"
                rows="3"
                :placeholder="t('recipes.form.instructionsPlaceholder')"
              ></textarea>
              <button
                type="button"
                class="ingredient-remove-btn"
                :disabled="editInstructionRows.length <= 1"
                :aria-label="t('recipes.form.removeInstruction')"
                @click="removeEditInstructionStep(index)"
              >-</button>
            </div>
          </div>
          <button type="button" class="ingredient-add-btn" @click="addEditInstructionStep">
            + {{ t('recipes.form.addInstruction') }}
          </button>
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
          v-for="r in paginatedFavorites"
          :key="'fav-' + r.id"
          class="recipe-card"
          :class="{ 'recipe-card-disabled': !canOpenFavoriteDetails(r) }"
          :aria-disabled="!canOpenFavoriteDetails(r)"
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

      <nav v-if="favorites.length > PAGE_SIZE" class="pagination" :aria-label="t('home.pagination.label')">
        <button
          type="button"
          class="pagination-btn"
          :disabled="favoritesPage === 1"
          @click="goToFavoritesPage(favoritesPage - 1)"
        >
          {{ t('home.pagination.previous') }}
        </button>
        <button
          v-for="page in favoritesPageNumbers"
          :key="`favorites-page-${page}`"
          type="button"
          class="pagination-btn page-number"
          :class="{ active: favoritesPage === page }"
          :aria-current="favoritesPage === page ? 'page' : undefined"
          @click="goToFavoritesPage(page)"
        >
          {{ page }}
        </button>
        <button
          type="button"
          class="pagination-btn"
          :disabled="favoritesPage === favoritesTotalPages"
          @click="goToFavoritesPage(favoritesPage + 1)"
        >
          {{ t('home.pagination.next') }}
        </button>
      </nav>
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
  max-width: 1400px;
  margin: 0 auto 40px auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
  box-sizing: border-box;
}

.form-card,
.list-card {
  background: #ffffff;
  border-radius: var(--radius-card, 18px);
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  padding: 26px 28px;
}

.recipe-tabs {
  background: #ffffff;
  border: 1.5px solid var(--line, #e6ecea);
  border-radius: var(--radius-pill, 999px);
  display: flex;
  gap: 6px;
  padding: 6px;
  width: fit-content;
}

.recipe-tabs button {
  background: transparent;
  border: none;
  border-radius: var(--radius-pill, 999px);
  color: var(--text-gray, #6b7478);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  min-height: 42px;
  padding: 8px 18px;
  transition: background 0.16s ease, color 0.16s ease;
}

.recipe-tabs button:hover:not(.active) {
  background: var(--mint-bg, #ecfaf6);
  color: var(--mint-darker, #2b8c7b);
}

.recipe-tabs button.active {
  background: var(--pink, #e85a9b);
  color: #ffffff;
}

.form-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--pink-dark, #d44488);
  margin-bottom: 4px;
}

.form-subtitle {
  font-size: 0.95rem;
  color: var(--text-gray, #6b7478);
  margin-bottom: 16px;
}

.required-star {
  color: var(--pink, #e85a9b);
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
  /* Without this, flex's default stretch makes a short field (e.g. title) match
     the height of a much taller sibling (e.g. the image upload column with its
     dropzone/preview), leaving a huge empty area around a single-line input. */
  align-items: flex-start;
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
  gap: 6px;
  margin-top: 4px;
}

.instruction-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
}

.ingredient-row-header,
.ingredient-row {
  display: grid;
  grid-template-columns: minmax(140px, 2fr) 90px minmax(110px, 1fr) 40px;
  gap: 10px;
  align-items: center;
}

.instruction-row {
  align-items: start;
  display: grid;
  gap: 10px;
  grid-template-columns: 96px minmax(0, 1fr) 40px;
}

.instruction-step-label {
  color: var(--text-light, #9aa2a5);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  padding-top: 10px;
  text-transform: uppercase;
}

.instruction-row textarea {
  min-height: 76px;
}

.ingredient-row-header span {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-light, #9aa2a5);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0 2px;
}

.ingredient-quantity {
  width: 100%;
  box-sizing: border-box;
}

.ingredient-remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1.5px solid var(--pink-light, #fdeef5);
  border-radius: 50%;
  background: var(--pink-light, #fdeef5);
  color: var(--pink-dark, #d44488);
  cursor: pointer;
  font-size: 1.2rem;
  font-weight: 800;
  line-height: 1;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.ingredient-remove-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.ingredient-remove-btn:hover:not(:disabled) {
  background: var(--pink, #e85a9b);
  border-color: var(--pink, #e85a9b);
  color: #ffffff;
}

.ingredient-add-btn {
  align-self: flex-start;
  margin-top: 8px;
  border: 1.5px solid var(--mint, #5ecbb5);
  border-radius: var(--radius-pill, 999px);
  background: #ffffff;
  color: var(--mint-darker, #2b8c7b);
  cursor: pointer;
  font: inherit;
  font-size: 0.92rem;
  font-weight: 700;
  padding: 8px 16px;
  transition: background 0.15s ease, color 0.15s ease;
  min-height: 38px;
}

.ingredient-add-btn:hover {
  background: var(--mint, #5ecbb5);
  color: #ffffff;
}

@media (max-width: 640px) {
  .ingredient-row-header {
    display: none;
  }

  .ingredient-row {
    grid-template-columns: 1fr 70px 1fr 40px;
    gap: 6px;
    padding: 10px;
    background: var(--mint-bg, #ecfaf6);
    border: 1px solid var(--line, #e6ecea);
    border-radius: 10px;
  }

  .ingredient-add-btn {
    width: 100%;
    text-align: center;
  }

  .instruction-row {
    grid-template-columns: 1fr 40px;
  }

  .instruction-step-label {
    grid-column: 1 / -1;
    padding-top: 0;
  }
}

label {
  font-size: 0.9rem;
  color: var(--text-gray, #6b7478);
}

input,
textarea {
  border-radius: 10px;
  border: 1.5px solid var(--line, #e6ecea);
  padding: 9px 11px;
  font-size: 0.96rem;
  font-family: inherit;
  outline: none;
}

input:focus,
textarea:focus {
  border-color: var(--mint, #5ecbb5);
}

.image-upload-box {
  align-items: center;
  background: var(--mint-bg, #ecfaf6);
  border: 1.5px dashed var(--mint, #5ecbb5);
  border-radius: 10px;
  color: var(--text-gray, #6b7478);
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
  border: 1px solid var(--line, #e6ecea);
  max-height: 180px;
  object-fit: cover;
  width: 100%;
}

.upload-note {
  color: var(--text-gray, #6b7478);
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
  color: var(--text-gray, #6b7478);
}

.toggle-item input {
  width: auto;
}

.submit-btn {
  align-self: flex-start;
  margin-top: 6px;
  background: var(--pink, #e85a9b);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-pill, 999px);
  padding: 11px 22px;
  font-size: 0.98rem;
  font-weight: 700;
  min-height: 44px;
  cursor: pointer;
  transition: background 0.16s ease, transform 0.16s ease;
}

.submit-btn:hover {
  background: var(--pink-dark, #d44488);
  transform: translateY(-1px);
}

.submit-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.cancel-btn {
  border-radius: var(--radius-pill, 999px);
  border: 1.5px solid var(--line, #e6ecea);
  background: #ffffff;
  color: var(--text-gray, #6b7478);
  padding: 8px 16px;
  font-size: 0.95rem;
  min-height: 44px;
  cursor: pointer;
  transition: border-color 0.16s ease, color 0.16s ease;
}

.cancel-btn:hover {
  border-color: var(--mint, #5ecbb5);
  color: var(--mint-darker, #2b8c7b);
}

.error-text {
  margin-top: 8px;
  color: var(--pink-dark, #d44488);
  font-size: 0.92rem;
}

.list-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.list-card-header .recipes-title {
  margin-bottom: 0;
}

.import-btn {
  border: 1.5px solid var(--mint, #5ecbb5);
  border-radius: var(--radius-pill, 999px);
  background: #ffffff;
  color: var(--mint-darker, #2b8c7b);
  font-size: 0.88rem;
  font-weight: 700;
  padding: 8px 16px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.16s ease, color 0.16s ease;
}

.import-btn:hover:not(:disabled) {
  background: var(--mint, #5ecbb5);
  color: #ffffff;
}

.import-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.recipes-title {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--mint-darker, #2b8c7b);
  margin-bottom: 12px;
}

.status-text {
  color: var(--text-gray, #6b7478);
  font-size: 0.95rem;
}

.status-text.error {
  color: var(--pink-dark, #d44488);
  font-weight: 600;
}

.status-text.error p {
  margin-bottom: 10px;
}

.login-link {
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius-pill, 999px);
  background: var(--pink, #e85a9b);
  color: #ffffff;
  padding: 8px 16px;
  font-size: 0.94rem;
  font-weight: 700;
  text-decoration: none;
  transition: background 0.16s ease;
}

.login-link:hover {
  background: var(--pink-dark, #d44488);
}

.recipes {
  list-style: none;
  padding: 0;
  margin: 12px 0 0 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.recipe-card {
  position: relative;
  background: #ffffff;
  border-radius: var(--radius-card, 18px);
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  padding: 18px 20px;
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
}

.name {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-dark, #2e3437);
  overflow-wrap: anywhere;
}

.meta {
  font-size: 0.9rem;
  color: var(--text-gray, #6b7478);
}

.badge-column {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
}

.badge {
  border-radius: var(--radius-pill, 999px);
  padding: 3px 9px;
  font-size: 0.76rem;
  font-weight: 600;
}

.badge-fav {
  background: var(--gold-bg, #fef6e4);
  color: var(--gold, #f0b73d);
}

.badge-published {
  background: var(--mint-bg, #ecfaf6);
  color: var(--mint-darker, #2b8c7b);
}

.badge-private {
  background: #f1f1f1;
  color: #5f6665;
}

.ingredients {
  margin-top: 4px;
  font-size: 0.94rem;
  color: var(--text-dark, #2e3437);
  overflow-wrap: anywhere;
}

.favorite-remove-button {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 1;
  width: 2rem;
  height: 2rem;
  border: 1.5px solid var(--pink-light, #fdeef5);
  border-radius: var(--radius-pill, 999px);
  background: #ffffff;
  color: var(--pink-dark, #d44488);
  font-weight: 800;
  cursor: pointer;
  transition: background 0.16s ease, color 0.16s ease;
}

.favorite-remove-button:hover {
  background: var(--pink, #e85a9b);
  color: #ffffff;
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
  color: var(--text-gray, #6b7478);
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
  color: var(--mint-darker, #2b8c7b);
  font-size: 0.9rem;
  font-weight: 600;
  min-height: 40px;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  font-family: inherit;
  line-height: 1;
}

.detail-link {
  text-decoration: none;
}

.link-btn.danger {
  color: var(--pink-dark, #d44488);
}

.none-found {
  color: var(--text-gray, #6b7478);
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
  background: var(--pink, #e85a9b);
  border-radius: var(--radius-pill, 999px);
  color: #ffffff;
  display: inline-flex;
  font-weight: 700;
  min-height: 42px;
  padding: 8px 16px;
  text-decoration: none;
  transition: background 0.16s ease;
}

.empty-action:hover {
  background: var(--pink-dark, #d44488);
}

.edit-panel {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--line, #e6ecea);
}

.edit-buttons {
  margin-top: 10px;
  display: flex;
  gap: 10px;
}

.recipe-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
  gap: 26px;
  margin-top: 12px;
}

.card-content {
  padding: 10px 4px 4px 4px;
}

.card-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-dark, #2e3437);
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
  padding: 4px 10px;
  border-radius: var(--radius-pill, 999px);
  font-weight: 600;
}

.pill-mint {
  background: var(--mint-bg, #ecfaf6);
  color: var(--mint-darker, #2b8c7b);
}

.pill-soft {
  background: var(--pink-light, #fdeef5);
  color: var(--pink-dark, #d44488);
}

.pill-rating {
  background: var(--gold-bg, #fef6e4);
  color: var(--gold, #f0b73d);
}

.card-times {
  font-size: 0.9rem;
  color: var(--text-gray, #6b7478);
  margin-bottom: 4px;
}

.card-ingredients {
  font-size: 0.9rem;
  color: var(--text-dark, #2e3437);
  margin-top: 2px;
}

.pagination {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 22px;
}

.pagination-btn {
  border: 1px solid var(--border-soft, #e5e7eb);
  background: #ffffff;
  color: var(--text-dark, #2e3437);
  border-radius: 8px;
  min-width: 40px;
  min-height: 40px;
  padding: 8px 12px;
  font-weight: 700;
  cursor: pointer;
}

.pagination-btn:hover:not(:disabled),
.pagination-btn.active {
  border-color: var(--pink-dark, #d44488);
  color: var(--pink-dark, #d44488);
}

.pagination-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(46, 52, 55, 0.4);
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
  border-radius: var(--radius-card, 18px);
  box-shadow: var(--shadow-pop, 0 16px 48px rgba(46, 52, 55, 0.16));
  padding: 26px 28px;
  overflow-y: auto;
}

.overlay-close {
  border: none;
  background: transparent;
  font-size: 1.6rem;
  line-height: 1;
  float: right;
  cursor: pointer;
  color: var(--text-gray, #6b7478);
}

.overlay-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--pink-dark, #d44488);
  margin: 4px 0 6px 0;
}

.overlay-meta {
  font-size: 0.95rem;
  color: var(--text-gray, #6b7478);
  margin-bottom: 6px;
}

.overlay-subtitle {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--mint-darker, #2b8c7b);
  margin-top: 14px;
  margin-bottom: 6px;
}

.overlay-text {
  font-size: 0.95rem;
  color: var(--text-dark, #2e3437);
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

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
