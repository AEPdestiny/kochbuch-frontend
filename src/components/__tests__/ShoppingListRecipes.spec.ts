import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ShoppingListRecipes from '@/components/ShoppingListRecipes.vue'
import { i18n } from '@/i18n'
import type { ShoppingListItem } from '@/types/shoppingList'

function item(overrides: Partial<ShoppingListItem>): ShoppingListItem {
  return {
    id: overrides.id ?? 'item-1',
    name: overrides.name ?? 'Tomaten',
    quantity: overrides.quantity ?? 2,
    unit: overrides.unit ?? 'Stueck',
    category: overrides.category ?? null,
    checked: overrides.checked ?? false,
    recipeId: overrides.recipeId ?? null,
    recipeTitle: overrides.recipeTitle ?? null,
    createdAt: overrides.createdAt ?? '2026-07-01T08:00:00Z',
    updatedAt: overrides.updatedAt ?? '2026-07-01T08:00:00Z',
  }
}

describe('ShoppingListRecipes.vue', () => {
  it('shows an empty state when no items belong to recipes', () => {
    const wrapper = mount(ShoppingListRecipes, {
      props: {
        items: [
          item({ id: 'manual-1', name: 'Milch', recipeTitle: null }),
        ],
      },
      global: { plugins: [i18n] },
    })

    expect(wrapper.find('.recipe-groups-empty').exists()).toBe(true)
    expect(wrapper.find('.recipe-group').exists()).toBe(false)
  })

  it('groups only recipe-backed items by recipe title', () => {
    const wrapper = mount(ShoppingListRecipes, {
      props: {
        items: [
          item({ id: 'pasta-1', name: 'Spaghetti', quantity: 500, unit: 'g', recipeTitle: 'Pasta' }),
          item({ id: 'pasta-2', name: 'Parmesan', quantity: 80, unit: 'g', recipeTitle: 'Pasta' }),
          item({ id: 'curry-1', name: 'Kokosmilch', quantity: 1, unit: 'Dose', recipeTitle: 'Curry' }),
          item({ id: 'manual-1', name: 'Milch', recipeTitle: null }),
        ],
      },
      global: { plugins: [i18n] },
    })

    const groups = wrapper.findAll('.recipe-group')
    expect(groups).toHaveLength(2)
    expect(wrapper.text()).toContain('Pasta')
    expect(wrapper.text()).toContain('Spaghetti')
    expect(wrapper.text()).toContain('Parmesan')
    expect(wrapper.text()).toContain('Curry')
    expect(wrapper.text()).toContain('Kokosmilch')
    expect(wrapper.text()).not.toContain('Milch')
  })

  it('marks checked recipe items and emits toggle for the changed item', async () => {
    const checkedItem = item({
      id: 'pasta-1',
      name: 'Spaghetti',
      checked: true,
      recipeTitle: 'Pasta',
    })
    const openItem = item({
      id: 'pasta-2',
      name: 'Parmesan',
      checked: false,
      recipeTitle: 'Pasta',
    })
    const wrapper = mount(ShoppingListRecipes, {
      props: { items: [checkedItem, openItem] },
      global: { plugins: [i18n] },
    })

    expect(wrapper.find('.recipe-item.checked').text()).toContain('Spaghetti')

    await wrapper.findAll('.item-check input[type="checkbox"]')[1]!.setValue(true)

    expect(wrapper.emitted('toggle')).toEqual([[openItem]])
  })
})
