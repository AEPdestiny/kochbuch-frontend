import { mount, flushPromises, config } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import ShoppingListView from '@/views/ShoppingListView.vue'
import { shoppingListApi } from '@/shared/api/shoppingListApi'
import { ApiClientError, AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { printShoppingList } from '@/shared/printExport'
import { i18n, setLocale } from '@/i18n'
import { useToastStore } from '@/stores/toastStore'
import type { ShoppingListItemResponse } from '@/types/shoppingList'

vi.mock('@/shared/api/shoppingListApi', () => ({
  shoppingListApi: {
    getShoppingListItems: vi.fn(),
    createShoppingListItem: vi.fn(),
    updateShoppingListItem: vi.fn(),
    deleteShoppingListItem: vi.fn(),
  },
}))

vi.mock('@/shared/printExport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/printExport')>()
  return {
    ...actual,
    printShoppingList: vi.fn(),
    printPantry: vi.fn(),
  }
})

describe('ShoppingListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    setLocale('de')
    const pinia = createPinia()
    setActivePinia(pinia)
    config.global.plugins = [i18n, pinia]
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([])
  })

  it('shows login hint and link without login', async () => {
    const wrapper = mount(ShoppingListView)

    await flushPromises()

    expect(shoppingListApi.getShoppingListItems).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Bitte melde dich an, um deine Einkaufsliste zu sehen.')
    const loginLink = wrapper.find('a.login-link')
    expect(loginLink.exists()).toBe(true)
    expect(loginLink.attributes('href')).toBe('/login')
    expect(loginLink.text()).toBe('Zum Login')
  })

  it('loads shopping list items with login', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')

    mount(ShoppingListView)
    await flushPromises()

    expect(shoppingListApi.getShoppingListItems).toHaveBeenCalledTimes(1)
  })

  it('shows create form with login', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    expect(wrapper.find('form.shopping-list-form').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').text()).toBe('Hinzufügen')
    expect(wrapper.find('form.shopping-list-form input[type="checkbox"]').exists()).toBe(false)
  })

  it('does not show create form without login', async () => {
    const wrapper = mount(ShoppingListView)

    await flushPromises()

    expect(wrapper.find('form.shopping-list-form').exists()).toBe(false)
  })

  it('does not show delete buttons without login', async () => {
    const wrapper = mount(ShoppingListView)

    await flushPromises()

    expect(wrapper.find('button.delete-btn').exists()).toBe(false)
  })

  it('does not show edit buttons without login', async () => {
    const wrapper = mount(ShoppingListView)

    await flushPromises()

    expect(wrapper.find('button.edit-btn').exists()).toBe(false)
  })

  it('shows empty state when shopping list has no items', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    expect(wrapper.text()).toContain('Deine Einkaufsliste ist noch leer.')
  })

  it('shows shopping list items', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Tomatoes', 3, 'piece', 'Vegetables', false),
      item('Milk', 1, 'l', 'Dairy', true),
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    expect(wrapper.text()).toContain('Tomatoes')
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain('piece')
    // Category is no longer displayed
    expect(wrapper.text()).not.toContain('Vegetables')
    expect(wrapper.text()).toContain('Milk')
  })

  it('groups shopping list items by recipe title', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      { ...item('Pasta', 2, 'cups', 'Recipe ingredient', false), recipeId: '716429', recipeTitle: 'Pasta with Garlic' },
      item('Milk', 1, 'l', 'Dairy', false),
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    expect(wrapper.text()).toContain('Pasta with Garlic')
    expect(wrapper.text()).not.toContain('Manuell')
    expect(wrapper.text()).toContain('Pasta')
    expect(wrapper.text()).toContain('Milk')
    // Milk has no recipeTitle → appears only in flat list, not in recipe groups
    expect(wrapper.find('.recipe-groups-section').text()).not.toContain('Milk')
  })

  it('keeps recipe groups and shows a combined total shopping list', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      { ...item('Eier', 4, 'Stück', 'Recipe ingredient', false), recipeId: '1', recipeTitle: 'Rezept A' },
      { ...item('eier', 6, 'Stück', 'Recipe ingredient', false), recipeId: '2', recipeTitle: 'Rezept B' },
      { ...item('Mehl', 200, 'g', 'Recipe ingredient', false), recipeId: '1', recipeTitle: 'Rezept A' },
      { ...item('Mehl', 300, 'g', 'Recipe ingredient', true), recipeId: '2', recipeTitle: 'Rezept B' },
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    expect(wrapper.text()).toContain('Rezept A')
    expect(wrapper.text()).toContain('Rezept B')
    expect(wrapper.text()).toContain('Gesamt-Einkaufsliste')
    // Items appear individually, not aggregated
    expect(wrapper.text()).not.toContain('10 Stück')
    expect(wrapper.text()).toContain('200')
    expect(wrapper.text()).not.toContain('500 g')
  })

  it('shows different units in total shopping list without unsafe calculation', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      { ...item('Tomaten', 2, 'Stück', 'Recipe ingredient', false), recipeId: '1', recipeTitle: 'Rezept A' },
      { ...item('Tomaten', 1, 'Dose', 'Recipe ingredient', false), recipeId: '2', recipeTitle: 'Rezept B' },
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    // Items with different units appear individually, not aggregated
    expect(wrapper.text()).toContain('Stück')
    expect(wrapper.text()).toContain('Dose')
  })

  it('shows item checkbox and no status text', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Tomatoes', 3, 'piece', 'Vegetables', false),
      item('Milk', 1, 'l', 'Dairy', true),
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    // Flat list has 2 checkboxes (no recipeTitle on items → no recipe group checkboxes)
    expect(wrapper.findAll('.item-check input[type="checkbox"]')).toHaveLength(2)
    // Old view had "Offen: 1" / "Erledigt: 1" status counts — these should not appear
    expect(wrapper.text()).not.toContain('Offen:')
    expect(wrapper.text()).not.toContain('Erledigt:')
    // sortedItems: unchecked (Tomatoes) first, checked (Milk) second
    expect(wrapper.findAll('.shopping-item').at(1)!.classes()).toContain('checked')
  })

  it('toggles item checkbox through update api', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Tomatoes', 3, 'piece', 'Vegetables', false),
    ])
    vi.mocked(shoppingListApi.updateShoppingListItem).mockResolvedValue(
      item('Tomatoes', 3, 'piece', 'Vegetables', true),
    )

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    await wrapper.find('.item-check input[type="checkbox"]').setValue(true)
    await flushPromises()

    expect(shoppingListApi.updateShoppingListItem).toHaveBeenCalledWith('Tomatoes', {
      name: 'Tomatoes',
      quantity: 3,
      unit: 'piece',
      category: 'Vegetables',
      checked: true,
      recipeId: null,
      recipeTitle: null,
    })
    expect(wrapper.find('.shopping-item').classes()).toContain('checked')
  })

  it('marks all open shopping list items as done', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Tomatoes', 3, 'piece', 'Vegetables', false),
      item('Milk', 1, 'l', 'Dairy', true),
    ])
    vi.mocked(shoppingListApi.updateShoppingListItem).mockImplementation(async (id, request) => ({
      ...item(String(id), request.quantity ?? 0, request.unit ?? '', request.category ?? '', request.checked ?? false),
      recipeId: request.recipeId ?? undefined,
      recipeTitle: request.recipeTitle ?? undefined,
    }))

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    await wrapper.findAll('.bulk-btn').at(0)!.trigger('click')
    await flushPromises()

    expect(shoppingListApi.updateShoppingListItem).toHaveBeenCalledTimes(1)
    expect(shoppingListApi.updateShoppingListItem).toHaveBeenCalledWith('Tomatoes', {
      name: 'Tomatoes',
      quantity: 3,
      unit: 'piece',
      category: 'Vegetables',
      checked: true,
      recipeId: null,
      recipeTitle: null,
    })
    expect(wrapper.findAll('.shopping-item.checked').length).toBeGreaterThanOrEqual(2)
    const toastStore = useToastStore()
    expect(toastStore.toasts.some(t => t.message.includes('Alle offenen'))).toBe(true)
  })

  it('deletes all done shopping list items after confirmation', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Tomatoes', 3, 'piece', 'Vegetables', false),
      item('Milk', 1, 'l', 'Dairy', true),
      item('Bread', 1, 'piece', 'Bakery', true),
    ])
    vi.mocked(shoppingListApi.deleteShoppingListItem).mockResolvedValue()

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    await wrapper.findAll('.bulk-btn').at(1)!.trigger('click')
    await flushPromises()

    expect(window.confirm).toHaveBeenCalled()
    expect(shoppingListApi.deleteShoppingListItem).toHaveBeenCalledWith('Milk')
    expect(shoppingListApi.deleteShoppingListItem).toHaveBeenCalledWith('Bread')
    expect(wrapper.text()).toContain('Tomatoes')
    expect(wrapper.text()).not.toContain('Milk')
    expect(wrapper.text()).not.toContain('Bread')
  })

  it('clears the complete shopping list after confirmation', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Tomatoes', 3, 'piece', 'Vegetables', false),
      item('Milk', 1, 'l', 'Dairy', true),
    ])
    vi.mocked(shoppingListApi.deleteShoppingListItem).mockResolvedValue()

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    await wrapper.findAll('.bulk-btn').at(2)!.trigger('click')
    await flushPromises()

    expect(shoppingListApi.deleteShoppingListItem).toHaveBeenCalledWith('Tomatoes')
    expect(shoppingListApi.deleteShoppingListItem).toHaveBeenCalledWith('Milk')
    expect(wrapper.text()).toContain('Deine Einkaufsliste ist noch leer.')
  })

  it('shows delete button with login', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Tomatoes', 3, 'piece', 'Vegetables', false),
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    expect(wrapper.find('button.delete-btn').exists()).toBe(true)
    expect(wrapper.find('button.delete-btn').text()).toBe('Löschen')
  })

  it('shows edit button with login', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Tomatoes', 3, 'piece', 'Vegetables', false),
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    expect(wrapper.find('button.edit-btn').exists()).toBe(true)
    expect(wrapper.find('button.edit-btn').text()).toBe('Bearbeiten')
  })

  it('shows inline edit form when edit is clicked', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Tomatoes', 3, 'piece', 'Vegetables', true),
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    await wrapper.find('button.edit-btn').trigger('click')

    expect(wrapper.find('form.edit-form').exists()).toBe(true)
    expect(inputValue(wrapper, 'form.edit-form input[placeholder="z.B. Tomaten"]')).toBe('Tomatoes')
    expect(inputValue(wrapper, 'form.edit-form input[placeholder="3"]')).toBe('3')
    expect(inputValue(wrapper, 'form.edit-form input[placeholder="Stück"]')).toBe('piece')
    // Category field is no longer shown in the edit form
    expect(wrapper.find('form.edit-form input[placeholder="Gemüse"]').exists()).toBe(false)
    expect(inputChecked(wrapper, 'form.edit-form input[type="checkbox"]')).toBe(true)
  })

  it('cancels inline edit without api call', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Tomatoes', 3, 'piece', 'Vegetables', false),
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    await wrapper.find('button.edit-btn').trigger('click')
    await wrapper.find('button.cancel-btn').trigger('click')

    expect(shoppingListApi.updateShoppingListItem).not.toHaveBeenCalled()
    expect(wrapper.find('form.edit-form').exists()).toBe(false)
  })

  it('updates a shopping list item and refreshes it in the list', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Tomatoes', 3, 'piece', 'Vegetables', false),
    ])
    vi.mocked(shoppingListApi.updateShoppingListItem).mockResolvedValue(
      item('Cherry Tomatoes', 5, 'piece', 'Vegetables', true),
    )

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    await wrapper.find('button.edit-btn').trigger('click')
    await wrapper.find('form.edit-form input[placeholder="z.B. Tomaten"]').setValue('Cherry Tomatoes')
    await wrapper.find('form.edit-form input[placeholder="3"]').setValue(5)
    await wrapper.find('form.edit-form input[type="checkbox"]').setValue(true)
    await wrapper.find('form.edit-form').trigger('submit.prevent')
    await flushPromises()

    expect(shoppingListApi.updateShoppingListItem).toHaveBeenCalledWith('Tomatoes', {
      name: 'Cherry Tomatoes',
      quantity: 5,
      unit: 'piece',
      category: 'Vegetables',
      checked: true,
    })
    expect(wrapper.text()).toContain('Cherry Tomatoes')
    expect(wrapper.find('.shopping-item').classes()).toContain('checked')
    expect(wrapper.find('form.edit-form').exists()).toBe(false)
  })

  it('sends changed checked value when saving inline edit', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Tomatoes', 3, 'piece', 'Vegetables', false),
    ])
    vi.mocked(shoppingListApi.updateShoppingListItem).mockResolvedValue(
      item('Tomatoes', 3, 'piece', 'Vegetables', true),
    )

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    await wrapper.find('button.edit-btn').trigger('click')
    await wrapper.find('form.edit-form input[type="checkbox"]').setValue(true)
    await wrapper.find('form.edit-form').trigger('submit.prevent')
    await flushPromises()

    expect(shoppingListApi.updateShoppingListItem).toHaveBeenCalledWith('Tomatoes', {
      name: 'Tomatoes',
      quantity: 3,
      unit: 'piece',
      category: 'Vegetables',
      checked: true,
    })
  })

  it('shows forbidden message when update returns 403', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Tomatoes', 3, 'piece', 'Vegetables', false),
    ])
    vi.mocked(shoppingListApi.updateShoppingListItem).mockRejectedValue(
      new ApiClientError('Forbidden', 403),
    )

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    await wrapper.find('button.edit-btn').trigger('click')
    await wrapper.find('form.edit-form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Du darfst dieses Shopping List Item nicht bearbeiten.')
  })

  it('shows not found message when update returns 404', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Tomatoes', 3, 'piece', 'Vegetables', false),
    ])
    vi.mocked(shoppingListApi.updateShoppingListItem).mockRejectedValue(
      new ApiClientError('Not Found', 404),
    )

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    await wrapper.find('button.edit-btn').trigger('click')
    await wrapper.find('form.edit-form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Dieses Shopping List Item wurde nicht gefunden.')
  })

  it('deletes a shopping list item and removes it from the list', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Tomatoes', 3, 'piece', 'Vegetables', false),
      item('Milk', 1, 'l', 'Dairy', false),
    ])
    vi.mocked(shoppingListApi.deleteShoppingListItem).mockResolvedValue()

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    await wrapper.find('button.delete-btn').trigger('click')
    await flushPromises()

    expect(shoppingListApi.deleteShoppingListItem).toHaveBeenCalledWith('Tomatoes')
    expect(wrapper.text()).not.toContain('Tomatoes')
    expect(wrapper.text()).toContain('Milk')
  })

  it('shows forbidden message when delete returns 403', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Tomatoes', 3, 'piece', 'Vegetables', false),
    ])
    vi.mocked(shoppingListApi.deleteShoppingListItem).mockRejectedValue(
      new ApiClientError('Forbidden', 403),
    )

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    await wrapper.find('button.delete-btn').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Du darfst dieses Shopping List Item nicht löschen.')
  })

  it('shows not found message when delete returns 404', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Tomatoes', 3, 'piece', 'Vegetables', false),
    ])
    vi.mocked(shoppingListApi.deleteShoppingListItem).mockRejectedValue(
      new ApiClientError('Not Found', 404),
    )

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    await wrapper.find('button.delete-btn').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Dieses Shopping List Item wurde nicht gefunden.')
  })

  it('shows name and unit suggestions while typing, no native datalist', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([])
    const wrapper = mount(ShoppingListView)
    await flushPromises()

    expect(wrapper.find('datalist').exists()).toBe(false)

    // German locale is active by default, so suggestions show localized German labels.
    const nameInput = wrapper.find('input[placeholder="z.B. Tomaten"]')
    await nameInput.setValue('reis')
    await nameInput.trigger('focus')
    expect(wrapper.find('.suggest-dropdown').exists()).toBe(true)
    expect(wrapper.text()).toContain('Basmatireis')

    const unitInput = wrapper.find('form.shopping-list-form input[placeholder="Stück"]')
    await unitInput.setValue('p')
    await unitInput.trigger('focus')
    expect(wrapper.text()).toContain('Packung')
  })

  it('shows all standard units on focus without typing, name field stays empty', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([])
    const wrapper = mount(ShoppingListView)
    await flushPromises()

    // Name field: focus alone shows nothing
    const nameInput = wrapper.find('input[placeholder="z.B. Tomaten"]')
    await nameInput.trigger('focus')
    expect(wrapper.find('.suggest-dropdown').exists()).toBe(false)

    // Unit field: focus alone shows all standard units
    const unitInput = wrapper.find('form.shopping-list-form input[placeholder="Stück"]')
    await unitInput.trigger('focus')
    // Capped at 8 suggestions by default (full list has 13 standard units).
    // German locale is active by default, so units show localized German labels.
    const dropdown = wrapper.find('.suggest-dropdown')
    expect(dropdown.exists()).toBe(true)
    expect(dropdown.text()).toContain('g')
    expect(dropdown.text()).toContain('kg')
    expect(dropdown.text()).toContain('Stück')
    expect(dropdown.findAll('li').length).toBeLessThanOrEqual(8)
  })

  it('shows English suggestions when locale is not German', async () => {
    setLocale('en')
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([])
    const wrapper = mount(ShoppingListView)
    await flushPromises()

    const nameInput = wrapper.find('input[placeholder="e.g. tomatoes"]')
    await nameInput.setValue('rice')
    await nameInput.trigger('focus')
    expect(wrapper.find('.suggest-dropdown').text()).toContain('Basmati rice')

    const unitWrapper = mount(ShoppingListView)
    await flushPromises()
    const unitInput = unitWrapper.find('form.shopping-list-form input[placeholder="pieces"]')
    await unitInput.trigger('focus')
    expect(unitWrapper.find('.suggest-dropdown').text()).toContain('piece')
  })

  it('typing category word "Fleisch" surfaces meat member ingredient suggestions', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([])
    const wrapper = mount(ShoppingListView)
    await flushPromises()

    const nameInput = wrapper.find('input[placeholder="z.B. Tomaten"]')
    await nameInput.setValue('Fleisch')
    await nameInput.trigger('focus')

    const dropdown = wrapper.find('.suggest-dropdown')
    expect(dropdown.exists()).toBe(true)
    expect(dropdown.text()).toContain('Hähnchenbrust')
    expect(dropdown.text()).toContain('Rindersteak')
  })

  it('creates a shopping list item with a German unit label and it is sent to the backend unchanged', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([])
    vi.mocked(shoppingListApi.createShoppingListItem).mockResolvedValue(item('Quark', 500, 'TL', '', false))
    const wrapper = mount(ShoppingListView)
    await flushPromises()

    await wrapper.find('input[placeholder="z.B. Tomaten"]').setValue('Quark')
    await wrapper.find('input[placeholder="3"]').setValue(500)
    await wrapper.find('form.shopping-list-form input[placeholder="Stück"]').setValue('TL')
    await wrapper.find('form.shopping-list-form').trigger('submit.prevent')
    await flushPromises()

    expect(shoppingListApi.createShoppingListItem).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Quark',
      quantity: 500,
      unit: 'TL',
    }))
  })

  it('creates a shopping list item and clears the form', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([])
    vi.mocked(shoppingListApi.createShoppingListItem).mockResolvedValue(
      item('Tomaten', 3, 'Stück', 'Gemüse', false),
    )

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    await wrapper.find('input[placeholder="z.B. Tomaten"]').setValue('Tomaten')
    await wrapper.find('input[placeholder="3"]').setValue(3)
    await wrapper.find('input[placeholder="Stück"]').setValue('Stück')
    await wrapper.find('form.shopping-list-form').trigger('submit.prevent')
    await flushPromises()

    // Category is no longer part of the create form
    expect(shoppingListApi.createShoppingListItem).toHaveBeenCalledWith({
      name: 'Tomaten',
      quantity: 3,
      unit: 'Stück',
      checked: false,
    })
    expect(wrapper.text()).toContain('Tomaten')
    expect(inputValue(wrapper, 'input[placeholder="z.B. Tomaten"]')).toBe('')
    expect(inputValue(wrapper, 'input[placeholder="3"]')).toBe('')
    expect(inputValue(wrapper, 'input[placeholder="Stück"]')).toBe('')
    expect(wrapper.find('input[placeholder="Gemüse"]').exists()).toBe(false)
  })

  it('shows validation message when create returns 400', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([])
    vi.mocked(shoppingListApi.createShoppingListItem).mockRejectedValue(
      new ApiClientError('Validation failed: name must not be blank', 400),
    )

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    await wrapper.find('input[placeholder="z.B. Tomaten"]').setValue('Tomaten')
    await wrapper.find('form.shopping-list-form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Bitte prüfe deine Eingaben für das Shopping List Item.')
  })
  it('shows Gesamt-Einkaufsliste section with all items when list is not empty', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Milch', 1, 'l', '', false),
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    expect(wrapper.text()).toContain('Gesamt-Einkaufsliste')
    expect(wrapper.find('.shopping-section').exists()).toBe(true)
    expect(wrapper.text()).toContain('Milch')
  })

  it('shows recipe groups section with empty message when no items have recipe titles', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Milch', 1, 'l', '', false),
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    expect(wrapper.find('.recipe-groups-section').exists()).toBe(true)
    expect(wrapper.find('.recipe-groups-section').text()).toContain('Keine Rezeptzuordnung')
  })

  it('shows collapsible recipe group for items with recipe titles', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      { ...item('Pasta', 2, 'cups', '', false), recipeId: '1', recipeTitle: 'Pasta Bolognese' },
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    const details = wrapper.find('.recipe-groups-section details.recipe-group')
    expect(details.exists()).toBe(true)
    expect(details.find('summary').text()).toBe('Pasta Bolognese')
  })

  it('recipe group items have a checkbox but no edit or delete buttons', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      { ...item('Pasta', 2, 'cups', '', false), recipeId: '1', recipeTitle: 'Pasta Bolognese' },
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    const recipeSection = wrapper.find('.recipe-groups-section')
    expect(recipeSection.find('input[type="checkbox"]').exists()).toBe(true)
    expect(recipeSection.find('button.edit-btn').exists()).toBe(false)
    expect(recipeSection.find('button.delete-btn').exists()).toBe(false)
  })

  it('shows English shopping list texts after locale switch', async () => {
    setLocale('en')
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    expect(wrapper.text()).toContain('Your Shopping List')
    expect(wrapper.text()).toContain('Your shopping list is still empty.')
    expect(wrapper.find('button[type="submit"]').text()).toBe('Add')
  })

  it('renders Arabic shopping list texts without errors', async () => {
    setLocale('ar')

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    expect(wrapper.text()).toContain('يرجى تسجيل الدخول لرؤية قائمة التسوق الخاصة بك.')
    expect(wrapper.find('a.login-link').text()).toBe('إلى تسجيل الدخول')
  })

  // ─── Display normalization tests ──────────────────────────────────────────

  it('strips embedded "quantity unit" prefix from item name when quantity field is also set', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      { ...item('57 g Spargelstangen', 57, 'g', '', false) },
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    expect(wrapper.find('.item-main h3').text()).toBe('Spargelstangen')
    // quantity shown right, not repeated in name
    expect(wrapper.find('.item-quantity').text()).toContain('57')
    expect(wrapper.find('.item-quantity').text()).toContain('g')
    expect(wrapper.find('.item-main h3').text()).not.toContain('57')
  })

  it('parses embedded "quantity unit name" from name when fields are null (legacy item)', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      { ...item('41 g Butter', 0, '', '', false), quantity: null, unit: null },
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    expect(wrapper.find('.item-main h3').text()).toBe('Butter')
    expect(wrapper.find('.item-quantity').text()).toContain('41')
    expect(wrapper.find('.item-quantity').text()).toContain('g')
  })

  it('handles fractional "1/3 EL Zucker" as a legacy item', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      { ...item('1/3 EL Zucker', 0, '', '', false), quantity: null, unit: null },
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    expect(wrapper.find('.item-main h3').text()).toBe('Zucker')
    expect(wrapper.find('.item-quantity').text()).toContain('1/3')
    expect(wrapper.find('.item-quantity').text()).toContain('EL')
  })

  it('leaves a clean manual item unchanged', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Tomaten', 3, 'piece', '', false),
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    expect(wrapper.find('.item-main h3').text()).toBe('Tomaten')
    expect(wrapper.find('.item-quantity').text()).toContain('3')
    expect(wrapper.find('.item-quantity').text()).toContain('piece')
  })

  it('opens edit form with cleaned name and parsed quantity when item name has embedded prefix', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      { ...item('57 g Spargelstangen', 57, 'g', '', false) },
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    await wrapper.find('button.edit-btn').trigger('click')

    expect(inputValue(wrapper, 'form.edit-form input[placeholder="z.B. Tomaten"]')).toBe('Spargelstangen')
    expect(inputValue(wrapper, 'form.edit-form input[placeholder="3"]')).toBe('57')
  })

  it('create form quantity input has step="any" to allow decimals like 0.75', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    const qty = wrapper.find('form.shopping-list-form input[type="number"]')
    expect(qty.attributes('step')).toBe('any')
  })

  it('edit form quantity input has step="any" to allow decimals like 0.75', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Milch', 1, 'l', '', false),
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    await wrapper.find('button.edit-btn').trigger('click')

    const qty = wrapper.find('form.edit-form input[type="number"]')
    expect(qty.attributes('step')).toBe('any')
  })

  it('edit form shows 0.75 quantity without browser blocking it (step=any)', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Wasser', 0.75, 'Tasse', '', false),
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    await wrapper.find('button.edit-btn').trigger('click')

    const qty = wrapper.find('form.edit-form input[type="number"]')
    expect(qty.attributes('step')).toBe('any')
    expect(inputValue(wrapper, 'form.edit-form input[type="number"]')).toBe('0.75')
  })

  // ─── PDF export tests ─────────────────────────────────────────────────────

  it('shows the PDF export button when items are loaded', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Tomaten', 2, 'kg', '', false),
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    const pdfBtn = wrapper.findAll('button').find(b => b.text().includes('PDF'))
    expect(pdfBtn).toBeTruthy()
  })

  it('calls printShoppingList with all items when PDF button is clicked', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Tomaten', 2, 'kg', '', false),
      item('Milch', 1, 'l', '', true),
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    const pdfBtn = wrapper.findAll('button').find(b => b.text().includes('PDF'))!
    await pdfBtn.trigger('click')

    expect(printShoppingList).toHaveBeenCalledTimes(1)
    const [items] = vi.mocked(printShoppingList).mock.calls[0]!
    expect(items).toHaveLength(2)
    expect(items.some(i => i.name === 'Tomaten' && !i.checked)).toBe(true)
    expect(items.some(i => i.name === 'Milch' && i.checked)).toBe(true)
  })

  it('open and done items are correctly flagged in the PDF call', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Brot', 0, '', '', false),
      item('Käse', 200, 'g', '', true),
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    const pdfBtn = wrapper.findAll('button').find(b => b.text().includes('PDF'))!
    await pdfBtn.trigger('click')

    const [items] = vi.mocked(printShoppingList).mock.calls[0]!
    const open = items.filter(i => !i.checked)
    const done = items.filter(i => i.checked)
    expect(open).toHaveLength(1)
    expect(done).toHaveLength(1)
    expect(open[0]!.name).toBe('Brot')
    expect(done[0]!.name).toBe('Käse')
  })

  it('shows PDF button even when shopping list is empty', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    const pdfBtn = wrapper.findAll('button').find(b => b.text().includes('PDF'))
    expect(pdfBtn).toBeTruthy()
  })

  it('clicking PDF button with empty list calls printShoppingList with empty array', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    const pdfBtn = wrapper.findAll('button').find(b => b.text().includes('PDF'))!
    await pdfBtn.trigger('click')

    expect(printShoppingList).toHaveBeenCalledTimes(1)
    const [items] = vi.mocked(printShoppingList).mock.calls[0]!
    expect(items).toHaveLength(0)
  })
})

function item(
  name: string,
  quantity: number,
  unit: string,
  category: string,
  checked: boolean,
): ShoppingListItemResponse {
  return {
    id: name,
    name,
    quantity,
    unit,
    category,
    checked,
    createdAt: '2026-06-06T00:00:00Z',
    updatedAt: '2026-06-06T00:00:00Z',
  }
}

function inputValue(wrapper: ReturnType<typeof mount>, selector: string) {
  return (wrapper.find(selector).element as HTMLInputElement).value
}

function inputChecked(wrapper: ReturnType<typeof mount>, selector: string) {
  return (wrapper.find(selector).element as HTMLInputElement).checked
}
