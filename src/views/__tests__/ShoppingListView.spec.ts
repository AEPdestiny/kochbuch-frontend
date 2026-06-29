import { mount, flushPromises, config } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ShoppingListView from '@/views/ShoppingListView.vue'
import { shoppingListApi } from '@/shared/api/shoppingListApi'
import { ApiClientError, AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { i18n, setLocale } from '@/i18n'
import type { ShoppingListItemResponse } from '@/types/shoppingList'

vi.mock('@/shared/api/shoppingListApi', () => ({
  shoppingListApi: {
    getShoppingListItems: vi.fn(),
    createShoppingListItem: vi.fn(),
    updateShoppingListItem: vi.fn(),
    deleteShoppingListItem: vi.fn(),
  },
}))

describe('ShoppingListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    setLocale('de')
    config.global.plugins = [i18n]
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
    expect(wrapper.text()).toContain('Manuell')
    expect(wrapper.text()).toContain('Pasta')
    expect(wrapper.text()).toContain('Milk')
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
    expect(wrapper.text()).toContain('Gesamte Einkaufsliste')
    expect(wrapper.text()).toContain('10 Stück')
    expect(wrapper.text()).toContain('200 g')
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

    expect(wrapper.text()).toContain('2 Stück')
    expect(wrapper.text()).toContain('1 Dose')
  })

  it('shows item checkbox and no status text', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(shoppingListApi.getShoppingListItems).mockResolvedValue([
      item('Tomatoes', 3, 'piece', 'Vegetables', false),
      item('Milk', 1, 'l', 'Dairy', true),
    ])

    const wrapper = mount(ShoppingListView)
    await flushPromises()

    expect(wrapper.findAll('.item-check input[type="checkbox"]')).toHaveLength(2)
    const itemGroups = wrapper.findAll('.shopping-group').filter((group) => !group.classes().includes('total-shopping-list'))
    expect(itemGroups.map((group) => group.text()).join(' ')).not.toContain('Offen')
    expect(itemGroups.map((group) => group.text()).join(' ')).not.toContain('Erledigt')
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
    expect(wrapper.text()).toContain('Alle offenen')
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

    const nameInput = wrapper.find('input[placeholder="z.B. Tomaten"]')
    await nameInput.setValue('rice')
    await nameInput.trigger('focus')
    expect(wrapper.find('.suggest-dropdown').exists()).toBe(true)
    expect(wrapper.text()).toContain('Basmati rice')

    const unitInput = wrapper.find('form.shopping-list-form input[placeholder="Stück"]')
    await unitInput.setValue('p')
    await unitInput.trigger('focus')
    expect(wrapper.text()).toContain('piece')
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
