<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import ShoppingListRecipes from '@/components/ShoppingListRecipes.vue'
import { ApiClientError, AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { shoppingListApi } from '@/shared/api/shoppingListApi'
import type { ShoppingListItem } from '@/types/shoppingList'

const { t } = useI18n()

const items = ref<ShoppingListItem[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const loginRequired = ref(false)

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

async function toggleChecked(item: ShoppingListItem) {
  const updated = await shoppingListApi.updateShoppingListItem(item.id, {
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    category: item.category,
    recipeId: item.recipeId,
    recipeTitle: item.recipeTitle,
    checked: !item.checked,
  })
  const index = items.value.findIndex(i => i.id === item.id)
  if (index !== -1) {
    items.value[index] = updated
  }
}
</script>

<template>
  <section class="shopping-list-page">
    <div class="shopping-list-header">
      <h1>{{ t('shoppingList.recipeGroups.title') }}</h1>
      <p>{{ t('shoppingList.subtitle') }}</p>
      <RouterLink to="/shopping-list" class="back-link">
        {{ t('shoppingList.recipeGroups.backToList') }}
      </RouterLink>
    </div>

    <p v-if="loading" class="status-text">{{ t('shoppingList.loading') }}</p>

    <div v-else-if="error" class="status-text error">
      <p>{{ error }}</p>
      <a v-if="loginRequired" href="/login" class="login-link">{{ t('shoppingList.actions.login') }}</a>
    </div>

    <ShoppingListRecipes
      v-else
      :items="items"
      @toggle="toggleChecked"
    />
  </section>
</template>

<style scoped>
.shopping-list-page {
  box-sizing: border-box;
  margin: 0 auto 48px auto;
  max-width: 980px;
  padding: 36px 40px;
  width: 100%;
}

.shopping-list-header {
  background: var(--pink-bg, #fdf1f5);
  border-radius: var(--radius-card, 18px);
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  margin-bottom: 26px;
  padding: 26px 32px;
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

.back-link {
  align-items: center;
  background: #ffffff;
  border: 1.5px solid var(--mint, #5ecbb5);
  border-radius: var(--radius-pill, 999px);
  color: var(--mint-darker, #2b8c7b);
  display: inline-flex;
  font-weight: 700;
  margin-top: 16px;
  min-height: 42px;
  padding: 8px 16px;
  text-decoration: none;
  transition: background 0.16s ease, color 0.16s ease;
}

.back-link:hover {
  background: var(--mint, #5ecbb5);
  color: #ffffff;
}

.status-text.error {
  color: var(--pink-dark, #d44488);
  font-weight: 600;
}

.login-link {
  align-items: center;
  background: var(--pink, #e85a9b);
  border-radius: var(--radius-pill, 999px);
  color: #ffffff;
  display: inline-flex;
  font-size: 0.94rem;
  font-weight: 700;
  padding: 8px 16px;
  text-decoration: none;
}

@media (max-width: 760px) {
  .shopping-list-page {
    padding: 28px 16px;
  }

  .shopping-list-header {
    padding: 22px 20px;
  }
}
</style>
