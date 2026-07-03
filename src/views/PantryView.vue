<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useToastStore } from '@/stores/toastStore'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType, type Result } from '@zxing/library'
import { ApiClientError, AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { pantryApi } from '@/shared/api/pantryApi'
import { printPantry } from '@/shared/printExport'
import { recipeApi } from '@/shared/api/recipeApi'
import { NAME_SUGGESTIONS, STANDARD_UNITS } from '@/shared/ingredientConstants'
import { isRecognizedCategoryAlias, localizedUnitOptions, resolveIngredientSuggestions } from '@/shared/ingredientCategories'
import SuggestInput from '@/components/SuggestInput.vue'
import type { PantryItem, PantryItemRequest } from '@/types/pantry'
import type { ExternalRecipeMatchResponse } from '@/types/recipe'

type ScannedProduct = {
  barcode: string
  name: string
  brand: string
  imageUrl: string
  category: string
}

const { t, locale } = useI18n()
const router = useRouter()
const toastStore = useToastStore()

const items = ref<PantryItem[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const formError = ref<string | null>(null)
const loginRequired = ref(false)
const newName = ref('')

// Category-aware, locale-aware ingredient/unit suggestions (e.g. "Fleisch" → Hähnchenbrust, Rinderhack, ...).
const newNameSuggestions = computed(() => resolveIngredientSuggestions(newName.value, NAME_SUGGESTIONS, locale.value))
const newNameIsCategory = computed(() => isRecognizedCategoryAlias(newName.value))
const unitSuggestions = computed(() => localizedUnitOptions(STANDARD_UNITS, locale.value))
const newQuantity = ref<number | null>(null)
const newUnit = ref('')
const editingId = ref<number | string | null>(null)
const editName = ref('')
const editNameSuggestions = computed(() => resolveIngredientSuggestions(editName.value, NAME_SUGGESTIONS, locale.value))
const editNameIsCategory = computed(() => isRecognizedCategoryAlias(editName.value))
const editQuantity = ref<number | null>(null)
const editUnit = ref('')
const editCategory = ref('')  // not shown in UI — preserved on update so existing data is not lost
const editError = ref<string | null>(null)
const barcode = ref('')
const barcodeLoading = ref(false)
const barcodeMessage = ref<string | null>(null)
const barcodeError = ref<string | null>(null)
const scannerVideo = ref<HTMLVideoElement | null>(null)
const scannerControls = ref<IScannerControls | null>(null)
const scannerActive = ref(false)
const scannerStarting = ref(false)
const scannedProduct = ref<ScannedProduct | null>(null)
const recipeMatches = ref<ExternalRecipeMatchResponse[]>([])
const recipeMatchLoading = ref(false)
const recipeMatchError = ref<string | null>(null)

onMounted(() => {
  loadPantryItems()
})

onBeforeUnmount(() => {
  stopBarcodeScanner()
})

async function loadPantryItems() {
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    items.value = []
    error.value = t('pantry.errors.loginRequired')
    loginRequired.value = true
    loading.value = false
    return
  }

  try {
    items.value = await pantryApi.getPantryItems()
    error.value = null
    loginRequired.value = false
  } catch (e: unknown) {
    error.value = toLoadErrorMessage(e)
    loginRequired.value = e instanceof ApiClientError && e.status === 401
  } finally {
    loading.value = false
  }
}

function toLoadErrorMessage(e: unknown) {
  if (e instanceof ApiClientError) {
    if (e.status === 401) {
      return t('pantry.errors.sessionExpired')
    }
    if (!e.status) {
      return t('pantry.errors.network')
    }
  }

  return t('pantry.errors.load')
}

async function createPantryItem() {
  if (!newName.value.trim()) {
    formError.value = t('pantry.errors.nameRequired')
    return
  }
  if (newQuantity.value === null || newQuantity.value === undefined) {
    formError.value = 'Bitte gib eine Menge an, z. B. 500 g, 2 Stück oder 1 Packung.'
    return
  }
  formError.value = null

  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    error.value = t('pantry.errors.loginRequired')
    loginRequired.value = true
    return
  }

  try {
    const created = await pantryApi.createPantryItem({
      name: newName.value,
      quantity: newQuantity.value,
      unit: newUnit.value,
    })
    items.value.push(created)
    newName.value = ''
    newQuantity.value = null
    newUnit.value = ''
    formError.value = null
    error.value = null
    toastStore.addToast(t('notifications.pantryItemAdded'), 'success')
  } catch (e: unknown) {
    formError.value = toCreateErrorMessage(e)
    if (e instanceof ApiClientError && e.status === 401) {
      error.value = formError.value
      loginRequired.value = true
    }
  }
}

function toCreateErrorMessage(e: unknown) {
  if (e instanceof ApiClientError) {
    if (e.status === 400) {
      return t('pantry.errors.validation')
    }
    if (e.status === 401) {
      return t('pantry.errors.sessionExpiredEdit')
    }
    if (!e.status) {
      return t('pantry.errors.network')
    }
  }

  return t('pantry.errors.create')
}

async function deletePantryItem(id: number | string) {
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    error.value = t('pantry.errors.loginRequired')
    loginRequired.value = true
    return
  }

  try {
    await pantryApi.deletePantryItem(id)
    items.value = items.value.filter(item => item.id !== id)
    error.value = null
    toastStore.addToast(t('notifications.pantryItemDeleted'), 'info')
  } catch (e: unknown) {
    error.value = toDeleteErrorMessage(e)
    loginRequired.value = e instanceof ApiClientError && e.status === 401
  }
}

function toDeleteErrorMessage(e: unknown) {
  if (e instanceof ApiClientError) {
    if (e.status === 401) {
      return t('pantry.errors.sessionExpiredEdit')
    }
    if (e.status === 403) {
      return t('pantry.errors.deleteForbidden')
    }
    if (e.status === 404) {
      return t('pantry.errors.notFound')
    }
    if (!e.status) {
      return t('pantry.errors.network')
    }
  }

  return t('pantry.errors.delete')
}

function startEdit(item: PantryItem) {
  editingId.value = item.id
  editName.value = item.name
  editQuantity.value = item.quantity ?? null
  editUnit.value = item.unit ?? ''
  editCategory.value = item.category ?? ''
  editError.value = null
}

function cancelEdit() {
  editingId.value = null
  editName.value = ''
  editQuantity.value = null
  editUnit.value = ''
  editCategory.value = ''
  editError.value = null
}

async function updatePantryItem(id: number | string) {
  if (!editName.value.trim()) {
    editError.value = t('pantry.errors.nameRequired')
    return
  }
  if (editQuantity.value === null || editQuantity.value === undefined) {
    editError.value = 'Bitte gib eine Menge an.'
    return
  }
  editError.value = null

  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    error.value = t('pantry.errors.loginRequired')
    loginRequired.value = true
    return
  }

  try {
    const request: PantryItemRequest = {
      name: editName.value,
      quantity: editQuantity.value,
      unit: editUnit.value,
      category: editCategory.value,
    }
    const updated = await pantryApi.updatePantryItem(id, request)
    const index = items.value.findIndex(item => item.id === id)
    if (index !== -1) {
      items.value[index] = updated
    }
    cancelEdit()
    error.value = null
    toastStore.addToast(t('notifications.pantryItemUpdated'), 'success')
  } catch (e: unknown) {
    editError.value = toUpdateErrorMessage(e)
    if (e instanceof ApiClientError && e.status === 401) {
      error.value = editError.value
      loginRequired.value = true
    }
  }
}

function toUpdateErrorMessage(e: unknown) {
  if (e instanceof ApiClientError) {
    if (e.status === 400) {
      return t('pantry.errors.validation')
    }
    if (e.status === 401) {
      return t('pantry.errors.sessionExpiredEdit')
    }
    if (e.status === 403) {
      return t('pantry.errors.updateForbidden')
    }
    if (e.status === 404) {
      return t('pantry.errors.notFound')
    }
    if (!e.status) {
      return t('pantry.errors.network')
    }
  }

  return t('pantry.errors.update')
}

async function lookupBarcode() {
  const value = barcode.value.trim()
  if (!value) {
    barcodeError.value = 'Bitte gib einen Barcode ein oder starte den Scanner.'
    barcodeMessage.value = null
    return
  }

  await lookupProductByBarcode(value)
}

async function startBarcodeScanner() {
  if (!navigator.mediaDevices?.getUserMedia) {
    barcodeError.value = 'Kamera ist in diesem Browser nicht verfügbar.'
    barcodeMessage.value = null
    return
  }

  stopBarcodeScanner()
  scannerActive.value = true
  scannerStarting.value = true
  barcodeError.value = null
  barcodeMessage.value = null
  scannedProduct.value = null
  await nextTick()

  if (!scannerVideo.value) {
    scannerActive.value = false
    scannerStarting.value = false
    barcodeError.value = 'Scanner konnte nicht gestartet werden.'
    return
  }

  try {
    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
    ])
    const reader = new BrowserMultiFormatReader(hints)
    scannerControls.value = await reader.decodeFromVideoDevice(
      undefined,
      scannerVideo.value,
      async (result: Result | undefined, _error, controls) => {
        if (!result) {
          return
        }
        const detectedBarcode = result.getText()
        controls.stop()
        scannerControls.value = null
        scannerActive.value = false
        await lookupProductByBarcode(detectedBarcode)
      },
    )
  } catch (e: unknown) {
    scannerActive.value = false
    barcodeError.value = toCameraErrorMessage(e)
  } finally {
    scannerStarting.value = false
  }
}

function stopBarcodeScanner() {
  scannerControls.value?.stop()
  scannerControls.value = null
  scannerActive.value = false
  scannerStarting.value = false
}

function toCameraErrorMessage(e: unknown) {
  const name = e instanceof DOMException || (typeof e === 'object' && e && 'name' in e)
    ? String((e as { name?: string }).name)
    : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Kamerazugriff wurde verweigert.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'Keine Kamera gefunden.'
  }
  return 'Barcode-Scanner konnte nicht gestartet werden.'
}

async function lookupProductByBarcode(value: string) {
  barcodeLoading.value = true
  barcodeError.value = null
  barcodeMessage.value = null
  scannedProduct.value = null
  barcode.value = value
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(value)}.json`)
    if (!response.ok) {
      throw new Error('OpenFoodFacts unavailable')
    }
    const data = await response.json()
    const productName = data?.product?.product_name || data?.product?.generic_name
    if (!productName) {
      barcodeError.value = 'Produkt wurde nicht gefunden.'
      return
    }
    const category = data?.product?.categories_tags?.[0]?.replace(/^en:/, '') ?? ''
    scannedProduct.value = {
      barcode: value,
      name: productName,
      brand: data?.product?.brands ?? '',
      imageUrl: data?.product?.image_front_url ?? data?.product?.image_url ?? '',
      category,
    }
    barcodeMessage.value = `Produkt gefunden: ${productName}`
  } catch {
    barcodeError.value = 'Open Food Facts ist gerade nicht erreichbar.'
  } finally {
    barcodeLoading.value = false
  }
}

async function addScannedProductToPantry() {
  if (!scannedProduct.value) {
    return
  }

  try {
    barcodeError.value = null
    barcodeMessage.value = null
    const created = await pantryApi.createPantryItem({
      name: scannedProduct.value.name,
      quantity: 1,
      unit: 'Stück',
      category: scannedProduct.value.category || 'Barcode',
    })
    items.value.push(created)
    barcodeMessage.value = `${scannedProduct.value.name} wurde zum Vorrat hinzugefügt.`
    scannedProduct.value = null
    barcode.value = ''
  } catch (e: unknown) {
    barcodeError.value = toCreateErrorMessage(e)
    if (e instanceof ApiClientError && e.status === 401) {
      error.value = barcodeError.value
      loginRequired.value = true
    }
  }
}

async function findRecipesWithPantryItems() {
  const ingredients = items.value.map(item => item.name).filter(Boolean)
  if (!ingredients.length) {
    recipeMatchError.value = t('pantry.recipeSearch.errors.noIngredients')
    recipeMatches.value = []
    return
  }

  recipeMatchLoading.value = true
  recipeMatchError.value = null
  try {
    recipeMatches.value = await recipeApi.findExternalRecipesByIngredients(ingredients)
  } catch {
    recipeMatchError.value = t('pantry.recipeSearch.errors.load')
    recipeMatches.value = []
  } finally {
    recipeMatchLoading.value = false
  }
}

function openRecipe(match: ExternalRecipeMatchResponse) {
  router.push(`/recipe/external/${match.externalId ?? match.id}`)
}

function exportPantryAsPdf() {
  if (items.value.length === 0) {
    toastStore.addToast(t('notifications.pdfEmptyList'), 'error')
    return
  }
  const now = new Date()
  const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  toastStore.addToast(t('notifications.pantryPdfReady'), 'success')
  printPantry(
    items.value.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit })),
    {
      appTitle: t('print.appTitle'),
      listTitle: t('print.pantryTitle'),
      createdAt: `${t('print.createdAt')}: ${dateStr}`,
      quantityHeader: t('print.quantityHeader'),
      unitHeader: t('print.unitHeader'),
      emptyMessage: t('print.emptyList'),
    },
  )
}
</script>

<template>
  <section class="pantry-page">
    <div class="pantry-header">
      <h1>{{ t('pantry.title') }}</h1>
      <p>{{ t('pantry.subtitle') }}</p>
    </div>

    <p v-if="loading" class="status-text">{{ t('pantry.loading') }}</p>

    <div v-else-if="error" class="status-text error">
      <p>{{ error }}</p>
      <a v-if="loginRequired" href="/login" class="login-link">{{ t('pantry.actions.login') }}</a>
    </div>

    <template v-else>
      <section class="pantry-toolbox">
        <div class="tool-card">
          <h2>{{ t('pantry.barcode.title') }}</h2>
          <p>{{ t('pantry.barcode.subtitle') }}</p>
          <div class="scanner-actions">
            <button
              v-if="!scannerActive"
              type="button"
              class="submit-btn"
              :disabled="barcodeLoading || scannerStarting"
              @click="startBarcodeScanner"
            >
              {{ scannerStarting ? 'Scanner startet...' : 'Barcode scannen' }}
            </button>
            <button v-else type="button" class="cancel-btn" @click="stopBarcodeScanner">
              Scanner stoppen
            </button>
          </div>
          <video
            v-show="scannerActive"
            ref="scannerVideo"
            class="barcode-video"
            autoplay
            muted
            playsinline
          ></video>
          <div class="barcode-row">
            <input v-model="barcode" type="text" :placeholder="t('pantry.barcode.placeholder')" />
            <button type="button" class="submit-btn" :disabled="barcodeLoading" @click="lookupBarcode">
              {{ barcodeLoading ? t('pantry.barcode.loading') : t('pantry.barcode.action') }}
            </button>
          </div>
          <article v-if="scannedProduct" class="scanned-product">
            <img v-if="scannedProduct.imageUrl" :src="scannedProduct.imageUrl" :alt="scannedProduct.name" />
            <div>
              <h3>{{ scannedProduct.name }}</h3>
              <p v-if="scannedProduct.brand">Marke: {{ scannedProduct.brand }}</p>
              <p>Barcode: {{ scannedProduct.barcode }}</p>
              <button type="button" class="submit-btn" @click="addScannedProductToPantry">
                Zum Vorrat hinzufügen
              </button>
            </div>
          </article>
          <p v-if="barcodeMessage" class="form-success">{{ barcodeMessage }}</p>
          <p v-if="barcodeError" class="form-error">{{ barcodeError }}</p>
        </div>

        <div class="tool-card">
          <h2>{{ t('pantry.recipeSearch.title') }}</h2>
          <p>{{ t('pantry.recipeSearch.subtitle') }}</p>
          <button type="button" class="submit-btn" :disabled="recipeMatchLoading" @click="findRecipesWithPantryItems">
            {{ recipeMatchLoading ? t('pantry.recipeSearch.loading') : t('pantry.recipeSearch.action') }}
          </button>
          <p v-if="recipeMatchError" class="form-error">{{ recipeMatchError }}</p>
        </div>

        <div class="tool-card">
          <h2>{{ t('print.pantryTitle') }}</h2>
          <p>{{ t('pantry.actions.exportPdf') }}</p>
          <button type="button" class="submit-btn" @click="exportPantryAsPdf">
            {{ t('pantry.actions.exportPdf') }}
          </button>
        </div>
      </section>

      <section v-if="recipeMatches.length" class="recipe-matches">
        <h2>{{ t('pantry.recipeSearch.results') }}</h2>
        <article v-for="match in recipeMatches" :key="match.id" class="recipe-match">
          <img v-if="match.imageUrl" :src="match.imageUrl" :alt="match.title" />
          <div>
            <h3>{{ match.title }}</h3>
            <p>
              {{ t('pantry.recipeSearch.match', { used: match.usedIngredientCount, missed: match.missedIngredientCount }) }}
            </p>
            <p v-if="match.usedIngredients.length">
              <strong>{{ t('pantry.recipeSearch.used') }}:</strong> {{ match.usedIngredients.join(', ') }}
            </p>
            <p v-if="match.missedIngredients.length">
              <strong>{{ t('pantry.recipeSearch.missing') }}:</strong> {{ match.missedIngredients.join(', ') }}
            </p>
            <button type="button" class="edit-btn" @click="openRecipe(match)">
              {{ t('pantry.recipeSearch.open') }}
            </button>
          </div>
        </article>
      </section>

      <form class="pantry-form" @submit.prevent="createPantryItem">
        <div class="form-field">
          <label>{{ t('pantry.form.name') }}</label>
          <SuggestInput v-model="newName" :suggestions="newNameSuggestions" :disable-internal-filter="newNameIsCategory" :placeholder="t('pantry.form.namePlaceholder')" />
        </div>

        <div class="form-field small">
          <label>{{ t('pantry.form.quantity') }}</label>
          <input v-model.number="newQuantity" type="number" min="0" step="any" inputmode="decimal" :placeholder="t('pantry.form.quantityPlaceholder')" />
        </div>

        <div class="form-field small">
          <label>{{ t('pantry.form.unit') }}</label>
          <SuggestInput v-model="newUnit" :suggestions="unitSuggestions" show-suggestions-on-focus :placeholder="t('pantry.form.unitPlaceholder')" />
        </div>

        <button type="submit" class="submit-btn">{{ t('pantry.actions.create') }}</button>
      </form>

      <p v-if="formError" class="form-error">{{ formError }}</p>

      <p v-if="items.length === 0" class="status-text">
        {{ t('pantry.empty') }}
      </p>

      <ul v-else class="pantry-list">
        <li v-for="item in items" :key="item.id" class="pantry-item">
          <div>
            <h2>{{ item.name }}</h2>
          </div>
          <div class="item-actions">
            <p class="item-quantity">
              <span v-if="item.quantity !== null && item.quantity !== undefined">
                {{ item.quantity }}
              </span>
              <span v-if="item.unit">{{ item.unit }}</span>
            </p>
            <button type="button" class="edit-btn" @click="startEdit(item)">
              {{ t('pantry.actions.edit') }}
            </button>
            <button type="button" class="delete-btn" @click="deletePantryItem(item.id)">
              {{ t('pantry.actions.delete') }}
            </button>
          </div>
          <form
            v-if="editingId === item.id"
            class="edit-form"
            @submit.prevent="updatePantryItem(item.id)"
          >
            <div class="form-field">
              <label>{{ t('pantry.form.name') }}</label>
              <SuggestInput v-model="editName" :suggestions="editNameSuggestions" :disable-internal-filter="editNameIsCategory" :placeholder="t('pantry.form.namePlaceholder')" />
            </div>
            <div class="form-field small">
              <label>{{ t('pantry.form.quantity') }}</label>
              <input v-model.number="editQuantity" type="number" min="0" step="any" inputmode="decimal" :placeholder="t('pantry.form.quantityPlaceholder')" />
            </div>
            <div class="form-field small">
              <label>{{ t('pantry.form.unit') }}</label>
              <SuggestInput v-model="editUnit" :suggestions="unitSuggestions" :placeholder="t('pantry.form.unitPlaceholder')" />
            </div>
            <div class="edit-buttons">
              <button type="submit" class="submit-btn">{{ t('pantry.actions.update') }}</button>
              <button type="button" class="cancel-btn" @click="cancelEdit">{{ t('pantry.actions.cancel') }}</button>
            </div>
            <p v-if="editError" class="form-error edit-error">{{ editError }}</p>
          </form>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.pantry-page {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto 48px auto;
  padding: 36px 24px;
  box-sizing: border-box;
}

.pantry-header {
  background: var(--pink-bg, #fdf1f5);
  border-radius: var(--radius-card, 18px);
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  padding: 26px 32px;
  margin-bottom: 26px;
}

.pantry-header h1 {
  color: var(--pink-dark, #d44488);
  font-size: 2rem;
  font-weight: 800;
  margin-bottom: 8px;
}

.pantry-header p,
.status-text {
  color: var(--text-gray, #6b7478);
  font-size: 1rem;
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

.pantry-form {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 100px minmax(120px, 1fr) auto;
  gap: 14px;
  align-items: end;
  background: #ffffff;
  border-radius: var(--radius-card, 18px);
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  padding: 22px 24px;
  margin-bottom: 22px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-field label {
  color: var(--text-gray, #6b7478);
  font-size: 0.9rem;
  font-weight: 700;
}

.form-field input {
  border: 1.5px solid var(--line, #e6ecea);
  border-radius: 10px;
  font: inherit;
  padding: 8px 10px;
  outline: none;
  transition: border-color 0.16s ease;
}

.form-field input:focus {
  border-color: var(--mint, #5ecbb5);
}

.submit-btn {
  border: none;
  border-radius: var(--radius-pill, 999px);
  background: var(--pink, #e85a9b);
  color: #ffffff;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  min-height: 44px;
  padding: 11px 20px;
  transition: background 0.16s ease, transform 0.16s ease;
}

.submit-btn:hover:not(:disabled) {
  background: var(--pink-dark, #d44488);
  transform: translateY(-1px);
}

.submit-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.form-error {
  color: var(--pink-dark, #d44488);
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 14px;
}

.form-success {
  color: var(--mint-darker, #2b8c7b);
  font-size: 0.95rem;
  font-weight: 700;
  margin-top: 10px;
}

.pantry-toolbox {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin-bottom: 24px;
}

.tool-card,
.recipe-match {
  background: #ffffff;
  border-radius: var(--radius-card, 18px);
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  padding: 22px 24px;
}

.tool-card h2,
.recipe-matches h2 {
  color: var(--pink-dark, #d44488);
  font-size: 1.1rem;
  margin-bottom: 6px;
}

.tool-card p,
.recipe-match p {
  color: var(--text-gray, #6b7478);
  font-size: 0.95rem;
}

.barcode-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
  align-items: center;
}

.barcode-row input {
  border: 1.5px solid var(--line, #e6ecea);
  border-radius: 10px;
  flex: 1 1 180px;
  min-width: 0;
  font: inherit;
  padding: 8px 10px;
  outline: none;
  transition: border-color 0.16s ease;
}

.barcode-row input:focus {
  border-color: var(--mint, #5ecbb5);
}

.barcode-row .submit-btn {
  flex-shrink: 0;
  white-space: nowrap;
}

.scanner-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.barcode-video {
  background: #16302f;
  border-radius: var(--radius-card, 18px);
  margin-top: 12px;
  min-height: 220px;
  object-fit: cover;
  width: 100%;
}

.scanned-product {
  align-items: center;
  background: var(--mint-bg, #ecfaf6);
  border-radius: 14px;
  display: grid;
  gap: 12px;
  grid-template-columns: 86px 1fr;
  margin-top: 12px;
  padding: 14px;
}

.scanned-product img {
  border-radius: 10px;
  height: 86px;
  object-fit: cover;
  width: 86px;
}

.scanned-product h3 {
  color: var(--text-dark, #2e3437);
  margin: 0 0 4px 0;
}

.recipe-matches {
  display: grid;
  gap: 16px;
  margin-bottom: 22px;
}

.recipe-match {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 14px;
  min-width: 0;
}

.recipe-match img {
  width: 110px;
  height: 90px;
  object-fit: cover;
  border-radius: 10px;
}

.recipe-match h3 {
  color: var(--text-dark, #2e3437);
  margin-bottom: 4px;
}

.pantry-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pantry-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  background: #ffffff;
  border-radius: var(--radius-card, 18px);
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  padding: 20px 22px;
  min-width: 0;
}

.pantry-item h2 {
  color: var(--text-dark, #2e3437);
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0 0 4px 0;
  overflow-wrap: anywhere;
}

.item-meta,
.item-quantity {
  color: var(--text-gray, #6b7478);
  font-size: 0.95rem;
}

.item-actions {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.item-quantity {
  display: inline-flex;
  gap: 4px;
  white-space: nowrap;
}

.edit-btn {
  border: none;
  border-radius: var(--radius-pill, 999px);
  background: transparent;
  color: var(--mint-darker, #2b8c7b);
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  min-height: 40px;
  padding: 6px 10px;
  transition: background 0.16s ease;
}

.edit-btn:hover {
  background: var(--mint-bg, #ecfaf6);
}

.delete-btn {
  border: none;
  border-radius: var(--radius-pill, 999px);
  background: transparent;
  color: var(--pink-dark, #d44488);
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  min-height: 40px;
  padding: 6px 10px;
  transition: background 0.16s ease;
}

.delete-btn:hover {
  background: var(--pink-light, #fdeef5);
}

.edit-form {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 100px minmax(120px, 1fr) auto;
  gap: 12px;
  align-items: end;
  border-top: 1px solid var(--line, #e6ecea);
  padding-top: 14px;
}

.edit-buttons {
  display: inline-flex;
  gap: 8px;
}

.cancel-btn {
  border: 1.5px solid var(--line, #e6ecea);
  border-radius: var(--radius-pill, 999px);
  background: #ffffff;
  color: var(--text-gray, #6b7478);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  min-height: 44px;
  padding: 9px 16px;
  transition: border-color 0.16s ease, color 0.16s ease;
}

.cancel-btn:hover {
  border-color: var(--mint, #5ecbb5);
  color: var(--mint-darker, #2b8c7b);
}

.edit-error {
  grid-column: 1 / -1;
  margin-bottom: 0;
}

@media (max-width: 1000px) {
  .pantry-toolbox {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 760px) {
  .pantry-page {
    padding: 22px 12px 32px;
  }

  .pantry-header {
    padding: 20px 18px;
  }

  .pantry-header h1 {
    font-size: 1.55rem;
    line-height: 1.2;
  }

  .pantry-toolbox {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .tool-card {
    padding: 18px 16px;
  }

  .pantry-form,
  .edit-form {
    grid-template-columns: 1fr;
    padding: 14px;
  }

  .barcode-row,
  .recipe-match {
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .recipe-match img {
    height: auto;
    max-height: 180px;
    width: 100%;
  }

  .scanned-product {
    grid-template-columns: 1fr;
  }

  .pantry-item {
    grid-template-columns: 1fr;
  }

  .item-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .submit-btn,
  .cancel-btn {
    width: 100%;
  }

  .edit-buttons {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
