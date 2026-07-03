<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiClientError, AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { shoppingListApi } from '@/shared/api/shoppingListApi'
import { printShoppingList } from '@/shared/printExport'
import { normalizeShoppingListItemDisplay, normalizeShoppingListItemForEdit } from '@/shared/normalizeShoppingItem'
import { useToastStore } from '@/stores/toastStore'
import { NAME_SUGGESTIONS, STANDARD_UNITS } from '@/shared/ingredientConstants'
import { isRecognizedCategoryAlias, localizedUnitOptions, resolveIngredientSuggestions } from '@/shared/ingredientCategories'
import SuggestInput from '@/components/SuggestInput.vue'
import type { ShoppingListItem, ShoppingListItemRequest } from '@/types/shoppingList'

const { t, locale } = useI18n()
const toastStore = useToastStore()

const items = ref<ShoppingListItem[]>([])
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
const newChecked = ref(false)
const editingId = ref<number | string | null>(null)
const editName = ref('')
const editNameSuggestions = computed(() => resolveIngredientSuggestions(editName.value, NAME_SUGGESTIONS, locale.value))
const editNameIsCategory = computed(() => isRecognizedCategoryAlias(editName.value))
const editQuantity = ref<number | null>(null)
const editUnit = ref('')
const editCategory = ref('')  // not shown in UI — preserved on update so existing data is not lost
const editChecked = ref(false)
const editError = ref<string | null>(null)

const sortedItems = computed(() => {
  const unchecked = items.value.filter(i => !i.checked)
  const checked = items.value.filter(i => i.checked)
  return [...unchecked, ...checked]
})

const recipeGroups = computed(() => {
  const groups = new Map<string, ShoppingListItem[]>()
  for (const item of items.value) {
    const title = item.recipeTitle?.trim()
    if (!title) continue
    groups.set(title, [...(groups.get(title) ?? []), item])
  }
  return Array.from(groups.entries()).map(([title, groupItems]) => ({ title, items: groupItems }))
})

const displayItems = computed(() =>
  sortedItems.value.map(item => ({ item, display: normalizeShoppingListItemDisplay(item) }))
)

onMounted(() => {
  loadShoppingListItems()
})

async function loadShoppingListItems() {
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    items.value = []
    error.value = t('shoppingList.errors.loginRequired')
    loginRequired.value = true
    loading.value = false
    return
  }

  try {
    items.value = await shoppingListApi.getShoppingListItems()
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
      return t('shoppingList.errors.sessionExpired')
    }
    if (!e.status) {
      return t('shoppingList.errors.network')
    }
  }

  return t('shoppingList.errors.load')
}

async function createShoppingListItem() {
  if (!newName.value.trim()) {
    formError.value = t('shoppingList.errors.nameRequired')
    return
  }
  formError.value = null

  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    error.value = t('shoppingList.errors.loginRequired')
    loginRequired.value = true
    return
  }

  try {
    const created = await shoppingListApi.createShoppingListItem({
      name: newName.value,
      quantity: newQuantity.value,
      unit: newUnit.value,
      checked: newChecked.value,
    })
    items.value.push(created)
    newName.value = ''
    newQuantity.value = null
    newUnit.value = ''
    newChecked.value = false
    formError.value = null
    error.value = null
    toastStore.addToast(t('notifications.shoppingListItemAdded'), 'success')
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
      return t('shoppingList.errors.validation')
    }
    if (e.status === 401) {
      return t('shoppingList.errors.sessionExpiredEdit')
    }
    if (!e.status) {
      return t('shoppingList.errors.network')
    }
  }

  return t('shoppingList.errors.create')
}

async function deleteShoppingListItem(id: number | string) {
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    error.value = t('shoppingList.errors.loginRequired')
    loginRequired.value = true
    return
  }

  try {
    await shoppingListApi.deleteShoppingListItem(id)
    items.value = items.value.filter(item => item.id !== id)
    error.value = null
    toastStore.addToast(t('notifications.shoppingListItemDeleted'), 'info')
  } catch (e: unknown) {
    error.value = toDeleteErrorMessage(e)
    loginRequired.value = e instanceof ApiClientError && e.status === 401
  }
}

async function toggleChecked(item: ShoppingListItem) {
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    error.value = t('shoppingList.errors.loginRequired')
    loginRequired.value = true
    return
  }

  try {
    const updated = await shoppingListApi.updateShoppingListItem(item.id, requestFromItem(item, !item.checked))
    items.value = items.value.map(existing => (existing.id === item.id ? updated : existing))
  } catch (e: unknown) {
    error.value = toUpdateErrorMessage(e)
    loginRequired.value = e instanceof ApiClientError && e.status === 401
  }
}

async function markAllDone() {
  const openItems = items.value.filter(item => !item.checked)
  if (!openItems.length) {
    toastStore.addToast(t('shoppingList.messages.allAlreadyDone'), 'info')
    return
  }

  try {
    const updatedItems = await Promise.all(
      openItems.map(item => shoppingListApi.updateShoppingListItem(item.id, requestFromItem(item, true))),
    )
    items.value = items.value.map(item => updatedItems.find(updated => updated.id === item.id) ?? item)
    toastStore.addToast(t('shoppingList.messages.allMarkedDone'), 'success')
  } catch (e: unknown) {
    error.value = toUpdateErrorMessage(e)
    loginRequired.value = e instanceof ApiClientError && e.status === 401
  }
}

async function deleteDoneItems() {
  const doneItems = items.value.filter(item => item.checked)
  if (!doneItems.length) {
    toastStore.addToast(t('shoppingList.messages.noDoneItems'), 'info')
    return
  }
  if (!window.confirm(t('shoppingList.actions.confirmDeleteDone'))) {
    return
  }

  try {
    await Promise.all(doneItems.map(item => shoppingListApi.deleteShoppingListItem(item.id)))
    const doneIds = new Set(doneItems.map(item => item.id))
    items.value = items.value.filter(item => !doneIds.has(item.id))
    toastStore.addToast(t('shoppingList.messages.doneDeleted'), 'success')
  } catch (e: unknown) {
    error.value = toDeleteErrorMessage(e)
    loginRequired.value = e instanceof ApiClientError && e.status === 401
  }
}

async function clearShoppingList() {
  if (!items.value.length) {
    toastStore.addToast(t('shoppingList.messages.listAlreadyEmpty'), 'info')
    return
  }
  if (!window.confirm(t('shoppingList.actions.confirmClearList'))) {
    return
  }

  try {
    await Promise.all(items.value.map(item => shoppingListApi.deleteShoppingListItem(item.id)))
    items.value = []
    toastStore.addToast(t('shoppingList.messages.listCleared'), 'success')
  } catch (e: unknown) {
    error.value = toDeleteErrorMessage(e)
    loginRequired.value = e instanceof ApiClientError && e.status === 401
  }
}

function requestFromItem(item: ShoppingListItem, checked: boolean): ShoppingListItemRequest {
  return {
    name: item.name,
    quantity: item.quantity ?? null,
    unit: item.unit ?? null,
    category: item.category ?? null,
    checked,
    recipeId: item.recipeId ?? null,
    recipeTitle: item.recipeTitle ?? null,
  }
}

function toDeleteErrorMessage(e: unknown) {
  if (e instanceof ApiClientError) {
    if (e.status === 401) {
      return t('shoppingList.errors.sessionExpiredEdit')
    }
    if (e.status === 403) {
      return t('shoppingList.errors.deleteForbidden')
    }
    if (e.status === 404) {
      return t('shoppingList.errors.notFound')
    }
    if (!e.status) {
      return t('shoppingList.errors.network')
    }
  }

  return t('shoppingList.errors.delete')
}

function startEdit(item: ShoppingListItem) {
  const normalized = normalizeShoppingListItemForEdit(item)
  editingId.value = item.id
  editName.value = normalized.name
  editQuantity.value = normalized.quantity
  editUnit.value = normalized.unit
  editCategory.value = item.category ?? ''
  editChecked.value = item.checked
  editError.value = null
}

function cancelEdit() {
  editingId.value = null
  editName.value = ''
  editQuantity.value = null
  editUnit.value = ''
  editCategory.value = ''
  editChecked.value = false
  editError.value = null
}

async function updateShoppingListItem(id: number | string) {
  if (!editName.value.trim()) {
    editError.value = t('shoppingList.errors.nameRequired')
    return
  }

  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    error.value = t('shoppingList.errors.loginRequired')
    loginRequired.value = true
    return
  }

  const existing = items.value.find(item => item.id === id)
  const request: ShoppingListItemRequest = {
    name: editName.value,
    quantity: editQuantity.value,
    unit: editUnit.value,
    category: editCategory.value,
    checked: editChecked.value,
  }
  if (existing?.recipeId) {
    request.recipeId = existing.recipeId
  }
  if (existing?.recipeTitle) {
    request.recipeTitle = existing.recipeTitle
  }

  try {
    const updated = await shoppingListApi.updateShoppingListItem(id, request)
    items.value = items.value.map(item => (item.id === id ? updated : item))
    cancelEdit()
    error.value = null
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
      return t('shoppingList.errors.validation')
    }
    if (e.status === 401) {
      return t('shoppingList.errors.sessionExpiredEdit')
    }
    if (e.status === 403) {
      return t('shoppingList.errors.updateForbidden')
    }
    if (e.status === 404) {
      return t('shoppingList.errors.notFound')
    }
    if (!e.status) {
      return t('shoppingList.errors.network')
    }
  }

  return t('shoppingList.errors.update')
}

function exportShoppingListAsPdf() {
  const now = new Date()
  const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  toastStore.addToast(t('notifications.shoppingListPdfReady'), 'success')
  printShoppingList(
    items.value.map(i => {
      const d = normalizeShoppingListItemDisplay(i)
      return { name: d.displayName, quantity: d.displayQuantity || null, unit: d.displayUnit, checked: i.checked }
    }),
    {
      appTitle: t('print.appTitle'),
      listTitle: t('print.shoppingListTitle'),
      createdAt: `${t('print.createdAt')}: ${dateStr}`,
      openSection: t('print.openSection'),
      doneSection: t('print.doneSection'),
      quantityHeader: t('print.quantityHeader'),
      unitHeader: t('print.unitHeader'),
      emptyMessage: t('print.emptyList'),
    },
  )
}
</script>

<template>
  <section class="shopping-list-page">
    <div class="shopping-list-header">
      <h1>{{ t('shoppingList.title') }}</h1>
      <p>{{ t('shoppingList.subtitle') }}</p>
    </div>

    <p v-if="loading" class="status-text">{{ t('shoppingList.loading') }}</p>

    <div v-else-if="error" class="status-text error">
      <p>{{ error }}</p>
      <a v-if="loginRequired" href="/login" class="login-link">{{ t('shoppingList.actions.login') }}</a>
    </div>

    <template v-else>
      <form class="shopping-list-form" @submit.prevent="createShoppingListItem">
        <div class="form-field">
          <label>{{ t('shoppingList.form.name') }}</label>
          <SuggestInput v-model="newName" :suggestions="newNameSuggestions" :disable-internal-filter="newNameIsCategory" :placeholder="t('shoppingList.form.namePlaceholder')" />
        </div>

        <div class="form-field small">
          <label>{{ t('shoppingList.form.quantity') }}</label>
          <input v-model.number="newQuantity" type="number" min="0" step="any" inputmode="decimal" :placeholder="t('shoppingList.form.quantityPlaceholder')" />
        </div>

        <div class="form-field small">
          <label>{{ t('shoppingList.form.unit') }}</label>
          <SuggestInput v-model="newUnit" :suggestions="unitSuggestions" show-suggestions-on-focus :placeholder="t('shoppingList.form.unitPlaceholder')" />
        </div>

        <button type="submit" class="submit-btn">{{ t('shoppingList.actions.create') }}</button>
      </form>

      <p v-if="formError" class="form-error">{{ formError }}</p>

      <div class="shopping-actions-bar">
        <button type="button" class="pdf-btn" @click="exportShoppingListAsPdf">{{ t('shoppingList.actions.exportPdf') }}</button>
      </div>

      <p v-if="items.length === 0" class="status-text">
        {{ t('shoppingList.empty') }}
      </p>

      <div v-else class="shopping-content">
        <div class="shopping-bulk-actions">
          <button type="button" class="bulk-btn" @click="markAllDone">{{ t('shoppingList.actions.markAllDone') }}</button>
          <button type="button" class="bulk-btn danger" @click="deleteDoneItems">{{ t('shoppingList.actions.deleteDone') }}</button>
          <button type="button" class="bulk-btn danger" @click="clearShoppingList">{{ t('shoppingList.actions.clearList') }}</button>
        </div>

        <!-- Gesamt-Einkaufsliste: flat list of all items with full CRUD -->
        <section class="shopping-section">
          <h2 class="section-title">{{ t('shoppingList.allItems.title') }}</h2>

          <ul class="shopping-list">
            <li
              v-for="{ item, display } in displayItems"
              :key="item.id"
              class="shopping-item"
              :class="{ checked: item.checked }"
            >
              <label class="item-check">
                <input
                  type="checkbox"
                  :checked="item.checked"
                  aria-label="Zutat erledigt"
                  @change="toggleChecked(item)"
                />
              </label>
              <div class="item-main">
                <h3>{{ display.displayName }}</h3>
              </div>
              <div class="item-side">
                <p class="item-quantity">
                  <span v-if="display.displayQuantity">{{ display.displayQuantity }}</span>
                  <span v-if="display.displayUnit">{{ display.displayUnit }}</span>
                </p>
                <button type="button" class="edit-btn" @click="startEdit(item)">
                  {{ t('shoppingList.actions.edit') }}
                </button>
                <button type="button" class="delete-btn" @click="deleteShoppingListItem(item.id)">
                  {{ t('shoppingList.actions.delete') }}
                </button>
              </div>

              <form
                v-if="editingId === item.id"
                class="edit-form"
                @submit.prevent="updateShoppingListItem(item.id)"
              >
                <div class="form-field">
                  <label>{{ t('shoppingList.form.name') }}</label>
                  <SuggestInput v-model="editName" :suggestions="editNameSuggestions" :disable-internal-filter="editNameIsCategory" :placeholder="t('shoppingList.form.namePlaceholder')" />
                </div>

                <div class="form-field small">
                  <label>{{ t('shoppingList.form.quantity') }}</label>
                  <input v-model.number="editQuantity" type="number" min="0" step="any" inputmode="decimal" :placeholder="t('shoppingList.form.quantityPlaceholder')" />
                </div>

                <div class="form-field small">
                  <label>{{ t('shoppingList.form.unit') }}</label>
                  <SuggestInput v-model="editUnit" :suggestions="unitSuggestions" show-suggestions-on-focus :placeholder="t('shoppingList.form.unitPlaceholder')" />
                </div>

                <label class="checkbox-field">
                  <input v-model="editChecked" type="checkbox" />
                  <span>{{ t('shoppingList.form.checked') }}</span>
                </label>

                <div class="edit-buttons">
                  <button type="submit" class="submit-btn">{{ t('shoppingList.actions.update') }}</button>
                  <button type="button" class="cancel-btn" @click="cancelEdit">{{ t('shoppingList.actions.cancel') }}</button>
                </div>

                <p v-if="editError" class="edit-error">{{ editError }}</p>
              </form>
            </li>
          </ul>
        </section>

        <!-- Rezepte mit diesen Zutaten: collapsible recipe groups, read-only view -->
        <section class="shopping-section recipe-groups-section">
          <h2 class="section-title">{{ t('shoppingList.recipeGroups.title') }}</h2>

          <p v-if="recipeGroups.length === 0" class="status-text recipe-groups-empty">
            {{ t('shoppingList.recipeGroups.empty') }}
          </p>

          <div v-else class="recipe-groups">
            <details
              v-for="group in recipeGroups"
              :key="group.title"
              class="recipe-group"
            >
              <summary class="recipe-group-summary">{{ group.title }}</summary>
              <ul class="recipe-item-list">
                <li
                  v-for="groupItem in group.items"
                  :key="groupItem.id"
                  class="recipe-item"
                  :class="{ checked: groupItem.checked }"
                >
                  <label class="item-check">
                    <input
                      type="checkbox"
                      :checked="groupItem.checked"
                      aria-label="Zutat erledigt"
                      @change="toggleChecked(groupItem)"
                    />
                  </label>
                  <span class="recipe-item-name">{{ groupItem.name }}</span>
                  <span class="recipe-item-quantity">
                    <span v-if="groupItem.quantity !== null && groupItem.quantity !== undefined">{{ groupItem.quantity }}</span>
                    <span v-if="groupItem.unit"> {{ groupItem.unit }}</span>
                  </span>
                </li>
              </ul>
            </details>
          </div>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.shopping-list-page {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto 48px auto;
  padding: 36px 24px;
  box-sizing: border-box;
}

.shopping-list-header {
  background: var(--pink-bg, #fdf1f5);
  border-radius: var(--radius-card, 18px);
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  padding: 26px 32px;
  margin-bottom: 26px;
}

.shopping-list-header h1 {
  color: var(--pink-dark, #d44488);
  font-size: 2rem;
  font-weight: 800;
  margin-bottom: 8px;
}

.shopping-list-header p,
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

.shopping-list-form {
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

.form-field label,
.checkbox-field {
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

.checkbox-field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
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

.submit-btn:hover {
  background: var(--pink-dark, #d44488);
  transform: translateY(-1px);
}

.form-error {
  color: var(--pink-dark, #d44488);
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 14px;
}

.shopping-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.shopping-content {
  display: grid;
  gap: 26px;
}

.shopping-bulk-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.shopping-actions-bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.5rem;
}

.pdf-btn {
  border: 1.5px solid var(--mint, #5ecbb5);
  border-radius: var(--radius-pill, 999px);
  background: #ffffff;
  color: var(--mint-darker, #2b8c7b);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  min-height: 36px;
  padding: 8px 16px;
  font-size: 0.9rem;
  transition: background 0.16s ease, color 0.16s ease;
}

.pdf-btn:hover {
  background: var(--mint, #5ecbb5);
  color: #ffffff;
}

.bulk-btn {
  border: 1.5px solid var(--mint, #5ecbb5);
  border-radius: var(--radius-pill, 999px);
  background: #ffffff;
  color: var(--mint-darker, #2b8c7b);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  min-height: 44px;
  padding: 8px 16px;
  transition: background 0.16s ease, color 0.16s ease;
}

.bulk-btn:hover {
  background: var(--mint, #5ecbb5);
  color: #ffffff;
}

.bulk-btn.danger {
  border-color: var(--pink-light, #fdeef5);
  color: var(--pink-dark, #d44488);
}

.bulk-btn.danger:hover {
  background: var(--pink, #e85a9b);
  border-color: var(--pink, #e85a9b);
  color: #ffffff;
}

.shopping-section {
  display: grid;
  gap: 14px;
}

.section-title {
  color: var(--pink-dark, #d44488);
  font-size: 1.2rem;
  font-weight: 800;
  margin: 0;
}

.shopping-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;
  background: #ffffff;
  border-radius: var(--radius-card, 18px);
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  padding: 18px 20px;
  min-width: 0;
}

.shopping-item.checked {
  opacity: 0.72;
}

.shopping-item.checked h3 {
  text-decoration: line-through;
}

.item-check {
  align-self: start;
  padding-top: 4px;
}

.item-check input {
  width: 18px;
  height: 18px;
  accent-color: var(--mint, #5ecbb5);
}

.shopping-item h3 {
  color: var(--text-dark, #2e3437);
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
  overflow-wrap: anywhere;
}

.item-quantity {
  color: var(--text-gray, #6b7478);
  font-size: 0.95rem;
  display: inline-flex;
  gap: 4px;
  white-space: nowrap;
}

.item-side {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.edit-btn,
.delete-btn,
.cancel-btn {
  border: none;
  border-radius: var(--radius-pill, 999px);
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  min-height: 40px;
  padding: 6px 10px;
  transition: background 0.16s ease;
}

.edit-btn {
  color: var(--mint-darker, #2b8c7b);
}

.delete-btn,
.cancel-btn {
  color: var(--pink-dark, #d44488);
}

.edit-btn:hover {
  background: var(--mint-bg, #ecfaf6);
}

.delete-btn:hover {
  background: var(--pink-light, #fdeef5);
}

.cancel-btn:hover {
  background: var(--pink-light, #fdeef5);
}

.edit-form {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 100px minmax(120px, 1fr) auto auto;
  gap: 12px;
  align-items: end;
  border-top: 1px solid var(--line, #e6ecea);
  padding-top: 14px;
}

.edit-buttons {
  display: inline-flex;
  gap: 8px;
}

.edit-error {
  grid-column: 1 / -1;
  color: var(--pink-dark, #d44488);
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0;
}

/* Recipe groups section */
.recipe-groups-section {
  background: var(--mint-bg, #ecfaf6);
  border-radius: var(--radius-card, 18px);
  padding: 22px 24px;
}

.recipe-groups-empty {
  font-size: 0.95rem;
  margin: 0;
}

.recipe-groups {
  display: grid;
  gap: 10px;
}

.recipe-group {
  background: #ffffff;
  border-radius: 14px;
  box-shadow: var(--shadow-sm, 0 2px 10px rgba(61, 174, 155, 0.06));
  overflow: hidden;
}

.recipe-group-summary {
  align-items: center;
  color: var(--text-dark, #2e3437);
  cursor: pointer;
  display: flex;
  font-size: 1rem;
  font-weight: 700;
  justify-content: space-between;
  list-style: none;
  min-height: 44px;
  padding: 10px 16px;
}

.recipe-group-summary::-webkit-details-marker {
  display: none;
}

.recipe-group[open] .recipe-group-summary {
  border-bottom: 1px solid var(--line, #e6ecea);
}

.recipe-group-summary::after {
  content: '▾';
  color: var(--mint-darker, #2b8c7b);
  font-size: 0.9rem;
}

.recipe-group[open] .recipe-group-summary::after {
  content: '▴';
}

.recipe-item-list {
  display: grid;
  gap: 6px;
  list-style: none;
  margin: 0;
  padding: 10px 16px 14px;
}

.recipe-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  border-radius: 8px;
  padding: 6px 2px;
}

.recipe-item.checked .recipe-item-name {
  opacity: 0.55;
  text-decoration: line-through;
}

.recipe-item-name {
  color: var(--text-dark, #2e3437);
  font-size: 0.95rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.recipe-item-quantity {
  color: var(--text-gray, #6b7478);
  font-size: 0.9rem;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .shopping-list-page {
    padding: 22px 12px 32px;
  }

  .shopping-list-header {
    padding: 20px 18px;
  }

  .shopping-list-header h1 {
    font-size: 1.55rem;
    line-height: 1.2;
  }

  .shopping-list-form,
  .edit-form {
    grid-template-columns: 1fr;
    padding: 16px;
  }

  .shopping-item {
    grid-template-columns: 1fr;
  }

  .item-side {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .shopping-bulk-actions,
  .edit-buttons {
    display: grid;
    grid-template-columns: 1fr;
  }

  .submit-btn,
  .bulk-btn,
  .edit-btn,
  .delete-btn,
  .cancel-btn {
    width: 100%;
  }
}
</style>
