<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiClientError, AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { shoppingListApi } from '@/shared/api/shoppingListApi'
import { printShoppingList } from '@/shared/printExport'
import { normalizeShoppingListItemDisplay, normalizeShoppingListItemForEdit } from '@/shared/normalizeShoppingItem'
import { useToastStore } from '@/stores/toastStore'
import { NAME_SUGGESTIONS, STANDARD_UNITS } from '@/shared/ingredientConstants'
import SuggestInput from '@/components/SuggestInput.vue'
import type { ShoppingListItem, ShoppingListItemRequest } from '@/types/shoppingList'

const { t } = useI18n()
const toastStore = useToastStore()

const items = ref<ShoppingListItem[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const formError = ref<string | null>(null)
const loginRequired = ref(false)
const newName = ref('')
const newQuantity = ref<number | null>(null)
const newUnit = ref('')
const newChecked = ref(false)
const editingId = ref<number | string | null>(null)
const editName = ref('')
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
          <SuggestInput v-model="newName" :suggestions="NAME_SUGGESTIONS" :placeholder="t('shoppingList.form.namePlaceholder')" />
        </div>

        <div class="form-field small">
          <label>{{ t('shoppingList.form.quantity') }}</label>
          <input v-model.number="newQuantity" type="number" min="0" step="any" inputmode="decimal" :placeholder="t('shoppingList.form.quantityPlaceholder')" />
        </div>

        <div class="form-field small">
          <label>{{ t('shoppingList.form.unit') }}</label>
          <SuggestInput v-model="newUnit" :suggestions="STANDARD_UNITS" show-suggestions-on-focus :placeholder="t('shoppingList.form.unitPlaceholder')" />
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
                  <SuggestInput v-model="editName" :suggestions="NAME_SUGGESTIONS" :placeholder="t('shoppingList.form.namePlaceholder')" />
                </div>

                <div class="form-field small">
                  <label>{{ t('shoppingList.form.quantity') }}</label>
                  <input v-model.number="editQuantity" type="number" min="0" step="any" inputmode="decimal" :placeholder="t('shoppingList.form.quantityPlaceholder')" />
                </div>

                <div class="form-field small">
                  <label>{{ t('shoppingList.form.unit') }}</label>
                  <SuggestInput v-model="editUnit" :suggestions="STANDARD_UNITS" show-suggestions-on-focus :placeholder="t('shoppingList.form.unitPlaceholder')" />
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
  max-width: 900px;
  margin: 0 auto 40px auto;
  padding: 34px 24px;
  box-sizing: border-box;
}

.shopping-list-header {
  margin-bottom: 24px;
}

.shopping-list-header h1 {
  color: #cc7da9;
  font-size: 2rem;
  font-weight: 800;
  margin-bottom: 8px;
}

.shopping-list-header p,
.status-text {
  color: #486b68;
  font-size: 1rem;
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

.shopping-list-form {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 100px minmax(120px, 1fr) auto;
  gap: 12px;
  align-items: end;
  border: 1px solid #c3e7e1;
  border-radius: 12px;
  background: #ffffff;
  padding: 14px 16px;
  margin-bottom: 18px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-field label,
.checkbox-field {
  color: #486b68;
  font-size: 0.9rem;
  font-weight: 700;
}

.form-field input {
  border: 1.5px solid #c3e7e1;
  border-radius: 10px;
  font: inherit;
  padding: 8px 10px;
}

.checkbox-field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
}

.submit-btn {
  border: none;
  border-radius: 999px;
  background: #cc7da9;
  color: #ffffff;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  min-height: 44px;
  padding: 9px 16px;
}

.form-error {
  color: #a14c2b;
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
  gap: 12px;
}

.shopping-content {
  display: grid;
  gap: 24px;
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
  border: 1px solid #c3e7e1;
  border-radius: 999px;
  background: #ffffff;
  color: #2f6f62;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  min-height: 36px;
  padding: 6px 14px;
  font-size: 0.9rem;
}

.bulk-btn {
  border: 1px solid #c3e7e1;
  border-radius: 999px;
  background: #ffffff;
  color: #2f6f62;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  min-height: 44px;
  padding: 8px 14px;
}

.bulk-btn.danger {
  border-color: #f0c5c5;
  color: #a14c2b;
}

.shopping-section {
  display: grid;
  gap: 12px;
}

.section-title {
  color: #cc7da9;
  font-size: 1.2rem;
  font-weight: 900;
  margin: 0;
}

.shopping-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;
  border: 1px solid #c3e7e1;
  border-radius: 12px;
  background: #f4fbfa;
  padding: 14px 16px;
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
}

.shopping-item h3 {
  color: #2b1b23;
  font-size: 1.1rem;
  font-weight: 800;
  margin: 0;
  overflow-wrap: anywhere;
}

.item-quantity {
  color: #486b68;
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
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  min-height: 40px;
  padding: 6px 10px;
}

.edit-btn {
  color: #26b6b8;
}

.delete-btn,
.cancel-btn {
  color: #a14c2b;
}

.edit-btn:hover {
  background: #e0f5f2;
}

.delete-btn:hover {
  background: #fff0eb;
}

.cancel-btn:hover {
  background: #fff0eb;
}

.edit-form {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 100px minmax(120px, 1fr) auto auto;
  gap: 12px;
  align-items: end;
  border-top: 1px solid #c3e7e1;
  padding-top: 14px;
}

.edit-buttons {
  display: inline-flex;
  gap: 8px;
}

.edit-error {
  grid-column: 1 / -1;
  color: #a14c2b;
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0;
}

/* Recipe groups section */
.recipe-groups-section {
  background: #f9fcfb;
  border: 1px solid #d6eee9;
  border-radius: 14px;
  padding: 16px;
}

.recipe-groups-empty {
  font-size: 0.95rem;
  margin: 0;
}

.recipe-groups {
  display: grid;
  gap: 8px;
}

.recipe-group {
  background: #ffffff;
  border: 1px solid #c3e7e1;
  border-radius: 10px;
  overflow: hidden;
}

.recipe-group-summary {
  align-items: center;
  color: #2b1b23;
  cursor: pointer;
  display: flex;
  font-size: 1rem;
  font-weight: 800;
  justify-content: space-between;
  list-style: none;
  min-height: 44px;
  padding: 10px 14px;
}

.recipe-group-summary::-webkit-details-marker {
  display: none;
}

.recipe-group[open] .recipe-group-summary {
  border-bottom: 1px solid #edf6f4;
}

.recipe-group-summary::after {
  content: '▾';
  color: #486b68;
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
  padding: 10px 14px 12px;
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
  color: #2b1b23;
  font-size: 0.95rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.recipe-item-quantity {
  color: #486b68;
  font-size: 0.9rem;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .shopping-list-page {
    padding: 22px 12px 32px;
  }

  .shopping-list-header h1 {
    font-size: 1.55rem;
    line-height: 1.2;
  }

  .shopping-list-form,
  .edit-form {
    grid-template-columns: 1fr;
    padding: 14px;
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
