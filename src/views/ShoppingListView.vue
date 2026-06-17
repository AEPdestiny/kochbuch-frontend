<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiClientError, AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { shoppingListApi } from '@/shared/api/shoppingListApi'
import type { ShoppingListItem, ShoppingListItemRequest } from '@/types/shoppingList'

const { t } = useI18n()

const items = ref<ShoppingListItem[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const formError = ref<string | null>(null)
const loginRequired = ref(false)
const newName = ref('')
const newQuantity = ref<number | null>(null)
const newUnit = ref('')
const newCategory = ref('')
const newChecked = ref(false)
const editingId = ref<number | string | null>(null)
const editName = ref('')
const editQuantity = ref<number | null>(null)
const editUnit = ref('')
const editCategory = ref('')
const editChecked = ref(false)
const editError = ref<string | null>(null)
const actionMessage = ref<string | null>(null)

const groupedItems = computed(() => {
  const groups = new Map<string, ShoppingListItem[]>()
  for (const item of items.value) {
    const groupName = item.recipeTitle?.trim() || t('shoppingList.groups.manual')
    groups.set(groupName, [...(groups.get(groupName) ?? []), item])
  }
  return Array.from(groups.entries()).map(([title, groupItems]) => ({ title, items: groupItems }))
})

const totalShoppingItems = computed(() => {
  const groups = new Map<string, ShoppingListItem[]>()
  for (const item of items.value.filter(item => !item.checked)) {
    const key = normalizeIngredientName(item.name)
    groups.set(key, [...(groups.get(key) ?? []), item])
  }

  return Array.from(groups.values()).map(groupItems => ({
    name: displayIngredientName(groupItems[0]?.name ?? ''),
    quantity: summarizeQuantity(groupItems),
    openCount: groupItems.filter(item => !item.checked).length,
    doneCount: groupItems.filter(item => item.checked).length,
  }))
})

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
      category: newCategory.value,
      checked: newChecked.value,
    })
    items.value.push(created)
    newName.value = ''
    newQuantity.value = null
    newUnit.value = ''
    newCategory.value = ''
    newChecked.value = false
    formError.value = null
    error.value = null
    actionMessage.value = null
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
    actionMessage.value = null
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
    actionMessage.value = null
  } catch (e: unknown) {
    error.value = toUpdateErrorMessage(e)
    loginRequired.value = e instanceof ApiClientError && e.status === 401
  }
}

async function markAllDone() {
  const openItems = items.value.filter(item => !item.checked)
  if (!openItems.length) {
    actionMessage.value = 'Alle Einträge sind bereits markiert.'
    return
  }

  try {
    actionMessage.value = null
    const updatedItems = await Promise.all(
      openItems.map(item => shoppingListApi.updateShoppingListItem(item.id, requestFromItem(item, true))),
    )
    items.value = items.value.map(item => updatedItems.find(updated => updated.id === item.id) ?? item)
    actionMessage.value = 'Alle offenen Einträge wurden markiert.'
  } catch (e: unknown) {
    error.value = toUpdateErrorMessage(e)
    loginRequired.value = e instanceof ApiClientError && e.status === 401
  }
}

async function deleteDoneItems() {
  const doneItems = items.value.filter(item => item.checked)
  if (!doneItems.length) {
    actionMessage.value = 'Es gibt keine erledigten Einträge zum Löschen.'
    return
  }
  if (!window.confirm('Erledigte Einträge wirklich löschen?')) {
    return
  }

  try {
    actionMessage.value = null
    await Promise.all(doneItems.map(item => shoppingListApi.deleteShoppingListItem(item.id)))
    const doneIds = new Set(doneItems.map(item => item.id))
    items.value = items.value.filter(item => !doneIds.has(item.id))
    actionMessage.value = 'Erledigte Einträge wurden gelöscht.'
  } catch (e: unknown) {
    error.value = toDeleteErrorMessage(e)
    loginRequired.value = e instanceof ApiClientError && e.status === 401
  }
}

async function clearShoppingList() {
  if (!items.value.length) {
    actionMessage.value = 'Die Einkaufsliste ist bereits leer.'
    return
  }
  if (!window.confirm('Wirklich die gesamte Einkaufsliste löschen?')) {
    return
  }

  try {
    actionMessage.value = null
    await Promise.all(items.value.map(item => shoppingListApi.deleteShoppingListItem(item.id)))
    items.value = []
    actionMessage.value = 'Die Einkaufsliste wurde geleert.'
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
  editingId.value = item.id
  editName.value = item.name
  editQuantity.value = item.quantity ?? null
  editUnit.value = item.unit ?? ''
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

function normalizeIngredientName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

function displayIngredientName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

function summarizeQuantity(groupItems: ShoppingListItem[]) {
  const quantityGroups = new Map<string, { amount: number; unit: string; displayUnit: string }>()
  const fallbackParts: string[] = []

  for (const item of groupItems) {
    const quantity = item.quantity
    const unit = normalizeUnit(item.unit ?? '')
    if (typeof quantity === 'number' && Number.isFinite(quantity) && unit.canAdd) {
      const existing = quantityGroups.get(unit.key) ?? {
        amount: 0,
        unit: unit.outputUnit,
        displayUnit: unit.displayUnit,
      }
      existing.amount += quantity * unit.factor
      quantityGroups.set(unit.key, existing)
      continue
    }

    fallbackParts.push(formatRawQuantity(item))
  }

  const summedParts = Array.from(quantityGroups.values()).map(group => (
    `${formatAmount(group.amount, group.unit)} ${group.displayUnit}`.trim()
  ))

  return [...summedParts, ...fallbackParts].filter(Boolean).join(' + ') || 'ohne Mengenangabe'
}

function normalizeUnit(unit: string) {
  const normalized = unit.trim().toLowerCase()
  if (!normalized) {
    return { canAdd: true, key: 'count', factor: 1, outputUnit: '', displayUnit: '' }
  }
  if (['g', 'gramm', 'gram'].includes(normalized)) {
    return { canAdd: true, key: 'weight-g', factor: 1, outputUnit: 'g', displayUnit: 'g' }
  }
  if (['kg', 'kilogramm', 'kilogram'].includes(normalized)) {
    return { canAdd: true, key: 'weight-g', factor: 1000, outputUnit: 'g', displayUnit: 'g' }
  }
  if (['ml', 'milliliter'].includes(normalized)) {
    return { canAdd: true, key: 'volume-ml', factor: 1, outputUnit: 'ml', displayUnit: 'ml' }
  }
  if (['l', 'liter'].includes(normalized)) {
    return { canAdd: true, key: 'volume-ml', factor: 1000, outputUnit: 'ml', displayUnit: 'ml' }
  }
  return { canAdd: true, key: normalized, factor: 1, outputUnit: normalized, displayUnit: unit.trim() }
}

function formatAmount(amount: number, unit: string) {
  return Number.isInteger(amount)
    ? String(amount)
    : amount.toLocaleString('de-DE', { maximumFractionDigits: 2 })
}

function formatRawQuantity(item: ShoppingListItem) {
  const quantity = item.quantity
  const unit = item.unit?.trim()
  if (typeof quantity === 'number' && Number.isFinite(quantity) && unit) {
    return `${quantity} ${unit}`
  }
  if (typeof quantity === 'number' && Number.isFinite(quantity)) {
    return String(quantity)
  }
  return unit || 'ohne Mengenangabe'
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
          <input v-model="newName" type="text" :placeholder="t('shoppingList.form.namePlaceholder')" />
        </div>

        <div class="form-field small">
          <label>{{ t('shoppingList.form.quantity') }}</label>
          <input v-model.number="newQuantity" type="number" min="0" step="0.1" :placeholder="t('shoppingList.form.quantityPlaceholder')" />
        </div>

        <div class="form-field small">
          <label>{{ t('shoppingList.form.unit') }}</label>
          <input v-model="newUnit" type="text" :placeholder="t('shoppingList.form.unitPlaceholder')" />
        </div>

        <div class="form-field">
          <label>{{ t('shoppingList.form.category') }}</label>
          <input v-model="newCategory" type="text" :placeholder="t('shoppingList.form.categoryPlaceholder')" />
        </div>

        <button type="submit" class="submit-btn">{{ t('shoppingList.actions.create') }}</button>
      </form>

      <p v-if="formError" class="form-error">{{ formError }}</p>
      <p v-if="actionMessage" class="form-success">{{ actionMessage }}</p>

      <p v-if="items.length === 0" class="status-text">
        {{ t('shoppingList.empty') }}
      </p>

      <div v-else class="shopping-groups">
        <div class="shopping-actions">
          <button type="button" class="bulk-btn" @click="markAllDone">Alle markieren</button>
          <button type="button" class="bulk-btn danger" @click="deleteDoneItems">Erledigte löschen</button>
          <button type="button" class="bulk-btn danger" @click="clearShoppingList">Liste leeren</button>
        </div>

        <section v-for="group in groupedItems" :key="group.title" class="shopping-group">
          <h2 class="group-title">{{ group.title }}</h2>

          <ul class="shopping-list">
            <li
              v-for="item in group.items"
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
              <div>
                <h3>{{ item.name }}</h3>
                <p v-if="item.category" class="item-meta">{{ item.category }}</p>
              </div>
              <div class="item-side">
                <p class="item-quantity">
                  <span v-if="item.quantity !== null && item.quantity !== undefined">
                    {{ item.quantity }}
                  </span>
                  <span v-if="item.unit">{{ item.unit }}</span>
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
                  <input v-model="editName" type="text" :placeholder="t('shoppingList.form.namePlaceholder')" />
                </div>

                <div class="form-field small">
                  <label>{{ t('shoppingList.form.quantity') }}</label>
                  <input v-model.number="editQuantity" type="number" min="0" step="0.1" :placeholder="t('shoppingList.form.quantityPlaceholder')" />
                </div>

                <div class="form-field small">
                  <label>{{ t('shoppingList.form.unit') }}</label>
                  <input v-model="editUnit" type="text" :placeholder="t('shoppingList.form.unitPlaceholder')" />
                </div>

                <div class="form-field">
                  <label>{{ t('shoppingList.form.category') }}</label>
                  <input v-model="editCategory" type="text" :placeholder="t('shoppingList.form.categoryPlaceholder')" />
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

        <section class="shopping-group total-shopping-list">
          <h2 class="group-title">Gesamte Einkaufsliste</h2>
          <ul class="shopping-list">
            <li v-for="item in totalShoppingItems" :key="item.name" class="shopping-item">
              <div>
                <h3>{{ item.name }}</h3>
                <p class="item-meta">
                  Offen: {{ item.openCount }} · Erledigt: {{ item.doneCount }}
                </p>
              </div>
              <div class="item-side">
                <p class="item-quantity">{{ item.quantity }}</p>
              </div>
            </li>
          </ul>
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
  grid-template-columns: minmax(180px, 1fr) 120px 120px minmax(160px, 1fr) auto;
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
  padding: 9px 16px;
}

.form-error {
  color: #a14c2b;
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 14px;
}

.form-success {
  color: #1d8e90;
  font-size: 0.95rem;
  font-weight: 700;
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

.shopping-groups {
  display: grid;
  gap: 18px;
}

.shopping-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.bulk-btn {
  border: 1px solid #c3e7e1;
  border-radius: 999px;
  background: #ffffff;
  color: #2f6f62;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  padding: 8px 14px;
}

.bulk-btn.danger {
  border-color: #f0c5c5;
  color: #a14c2b;
}

.shopping-group {
  display: grid;
  gap: 10px;
}

.group-title {
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
  margin: 0 0 4px 0;
}

.item-meta,
.item-quantity {
  color: #486b68;
  font-size: 0.95rem;
}

.item-side {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.item-quantity {
  display: inline-flex;
  gap: 4px;
  white-space: nowrap;
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
  grid-template-columns: minmax(180px, 1fr) 120px 120px minmax(160px, 1fr) auto auto;
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

@media (max-width: 760px) {
  .shopping-list-form,
  .edit-form {
    grid-template-columns: 1fr;
  }

  .shopping-item {
    grid-template-columns: 1fr;
  }

  .item-side {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
