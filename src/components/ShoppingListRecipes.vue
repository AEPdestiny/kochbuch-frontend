<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { displayUnitForLocale } from '@/shared/normalizeShoppingItem'
import type { ShoppingListItem } from '@/types/shoppingList'

const props = defineProps<{
  items: ShoppingListItem[]
}>()

const emit = defineEmits<{
  toggle: [item: ShoppingListItem]
}>()

const { t, locale } = useI18n()

function displayUnit(unit: string | null | undefined) {
  return displayUnitForLocale(unit, locale.value)
}

function displayQuantity(item: ShoppingListItem) {
  const quantity = item.quantity !== null && item.quantity !== undefined ? String(item.quantity) : ''
  return [quantity, displayUnit(item.unit)].filter(Boolean).join(' ')
}

const recipeGroups = computed(() => {
  const groups = new Map<string, ShoppingListItem[]>()
  for (const item of props.items) {
    const title = item.recipeTitle?.trim()
    if (!title) continue
    groups.set(title, [...(groups.get(title) ?? []), item])
  }
  return Array.from(groups.entries()).map(([title, groupItems]) => ({ title, items: groupItems }))
})
</script>

<template>
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
                @change="emit('toggle', groupItem)"
              />
            </label>
            <span class="recipe-item-name">{{ groupItem.name }}</span>
            <span class="recipe-item-quantity">{{ displayQuantity(groupItem) }}</span>
          </li>
        </ul>
      </details>
    </div>
  </section>
</template>

<style scoped>
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

.status-text {
  color: var(--text-gray, #6b7478);
  font-size: 1rem;
}

.recipe-groups-section {
  margin-top: 2px;
}

.recipe-groups-empty {
  margin: 0;
}

.recipe-groups {
  display: grid;
  gap: 12px;
}

.recipe-group {
  background: #ffffff;
  border-radius: var(--radius-card, 18px);
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  overflow: hidden;
}

.recipe-group-summary {
  color: var(--text-dark, #2e3437);
  cursor: pointer;
  font-weight: 800;
  list-style: none;
  padding: 16px 18px;
}

.recipe-group-summary::-webkit-details-marker {
  display: none;
}

.recipe-group-summary::after {
  content: '+';
  float: right;
  color: var(--mint-darker, #2b8c7b);
}

.recipe-group[open] .recipe-group-summary::after {
  content: '-';
}

.recipe-item-list {
  border-top: 1px solid var(--line, #e6ecea);
  display: grid;
  gap: 0;
  list-style: none;
  margin: 0;
  padding: 0;
}

.recipe-item {
  align-items: center;
  display: grid;
  gap: 12px;
  grid-template-columns: auto 1fr auto;
  padding: 12px 18px;
}

.recipe-item + .recipe-item {
  border-top: 1px solid var(--line, #e6ecea);
}

.recipe-item.checked {
  opacity: 0.7;
}

.recipe-item-name {
  color: var(--text-dark, #2e3437);
  font-weight: 700;
  overflow-wrap: anywhere;
}

.recipe-item.checked .recipe-item-name {
  text-decoration: line-through;
}

.recipe-item-quantity {
  color: var(--text-gray, #6b7478);
  white-space: nowrap;
}

.item-check input {
  accent-color: var(--mint, #5ecbb5);
  height: 18px;
  width: 18px;
}
</style>
