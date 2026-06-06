import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PantryView from '@/views/PantryView.vue'
import { pantryApi } from '@/shared/api/pantryApi'
import { ApiClientError, AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import type { PantryItemResponse } from '@/types/pantry'

vi.mock('@/shared/api/pantryApi', () => ({
  pantryApi: {
    getPantryItems: vi.fn(),
    createPantryItem: vi.fn(),
    updatePantryItem: vi.fn(),
    deletePantryItem: vi.fn(),
  },
}))

describe('PantryView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([])
  })

  it('shows login hint and link without login', async () => {
    const wrapper = mount(PantryView)

    await flushPromises()

    expect(pantryApi.getPantryItems).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Bitte melde dich an, um deinen Vorrat zu sehen.')
    const loginLink = wrapper.find('a.login-link')
    expect(loginLink.exists()).toBe(true)
    expect(loginLink.attributes('href')).toBe('/login')
    expect(loginLink.text()).toBe('Zum Login')
  })

  it('does not show create form without login', async () => {
    const wrapper = mount(PantryView)

    await flushPromises()

    expect(wrapper.find('form.pantry-form').exists()).toBe(false)
  })

  it('does not show delete buttons without login', async () => {
    const wrapper = mount(PantryView)

    await flushPromises()

    expect(wrapper.find('button.delete-btn').exists()).toBe(false)
  })

  it('does not show edit buttons without login', async () => {
    const wrapper = mount(PantryView)

    await flushPromises()

    expect(wrapper.find('button.edit-btn').exists()).toBe(false)
  })

  it('loads pantry items with login', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')

    mount(PantryView)
    await flushPromises()

    expect(pantryApi.getPantryItems).toHaveBeenCalledTimes(1)
  })

  it('shows create form with login', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')

    const wrapper = mount(PantryView)
    await flushPromises()

    expect(wrapper.find('form.pantry-form').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').text()).toBe('Hinzufügen')
  })

  it('shows empty state when pantry has no items', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([])

    const wrapper = mount(PantryView)
    await flushPromises()

    expect(wrapper.text()).toContain('Dein Vorrat ist noch leer.')
  })

  it('shows pantry items', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([
      item('Rice', 2, 'kg', 'Grains'),
      item('Milk', 1, 'l', 'Dairy'),
    ])

    const wrapper = mount(PantryView)
    await flushPromises()

    expect(wrapper.text()).toContain('Rice')
    expect(wrapper.text()).toContain('2')
    expect(wrapper.text()).toContain('kg')
    expect(wrapper.text()).toContain('Grains')
    expect(wrapper.text()).toContain('Milk')
  })

  it('shows delete button with login', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([
      item('Rice', 2, 'kg', 'Grains'),
    ])

    const wrapper = mount(PantryView)
    await flushPromises()

    expect(wrapper.find('button.delete-btn').exists()).toBe(true)
    expect(wrapper.find('button.delete-btn').text()).toBe('Löschen')
  })

  it('shows edit button with login', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([
      item('Rice', 2, 'kg', 'Grains'),
    ])

    const wrapper = mount(PantryView)
    await flushPromises()

    expect(wrapper.find('button.edit-btn').exists()).toBe(true)
    expect(wrapper.find('button.edit-btn').text()).toBe('Bearbeiten')
  })

  it('shows inline edit form when clicking edit', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([
      item('Rice', 2, 'kg', 'Grains'),
    ])

    const wrapper = mount(PantryView)
    await flushPromises()

    await wrapper.find('button.edit-btn').trigger('click')
    await flushPromises()

    expect(wrapper.find('form.edit-form').exists()).toBe(true)
    expect(inputValue(wrapper, 'form.edit-form input[placeholder="z.B. Reis"]')).toBe('Rice')
    expect(inputValue(wrapper, 'form.edit-form input[placeholder="2"]')).toBe('2')
    expect(inputValue(wrapper, 'form.edit-form input[placeholder="kg"]')).toBe('kg')
    expect(inputValue(wrapper, 'form.edit-form input[placeholder="Vorrat"]')).toBe('Grains')
  })

  it('cancels edit without API call', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([
      item('Rice', 2, 'kg', 'Grains'),
    ])

    const wrapper = mount(PantryView)
    await flushPromises()

    await wrapper.find('button.edit-btn').trigger('click')
    await flushPromises()
    await wrapper.find('button.cancel-btn').trigger('click')
    await flushPromises()

    expect(pantryApi.updatePantryItem).not.toHaveBeenCalled()
    expect(wrapper.find('form.edit-form').exists()).toBe(false)
  })

  it('updates a pantry item and closes edit form', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([
      item('Rice', 2, 'kg', 'Grains'),
    ])
    vi.mocked(pantryApi.updatePantryItem).mockResolvedValue(
      item('Basmati Rice', 1.5, 'kg', 'Grains'),
    )

    const wrapper = mount(PantryView)
    await flushPromises()

    await wrapper.find('button.edit-btn').trigger('click')
    await wrapper.find('form.edit-form input[placeholder="z.B. Reis"]').setValue('Basmati Rice')
    await wrapper.find('form.edit-form input[placeholder="2"]').setValue(1.5)
    await wrapper.find('form.edit-form').trigger('submit.prevent')
    await flushPromises()

    expect(pantryApi.updatePantryItem).toHaveBeenCalledWith('Rice', {
      name: 'Basmati Rice',
      quantity: 1.5,
      unit: 'kg',
      category: 'Grains',
    })
    expect(wrapper.text()).toContain('Basmati Rice')
    expect(wrapper.find('form.edit-form').exists()).toBe(false)
  })

  it('shows forbidden message when update returns 403', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([
      item('Rice', 2, 'kg', 'Grains'),
    ])
    vi.mocked(pantryApi.updatePantryItem).mockRejectedValue(
      new ApiClientError('Forbidden', 403),
    )

    const wrapper = mount(PantryView)
    await flushPromises()

    await wrapper.find('button.edit-btn').trigger('click')
    await wrapper.find('form.edit-form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Du darfst dieses Pantry Item nicht bearbeiten.')
  })

  it('shows not found message when update returns 404', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([
      item('Rice', 2, 'kg', 'Grains'),
    ])
    vi.mocked(pantryApi.updatePantryItem).mockRejectedValue(
      new ApiClientError('Not Found', 404),
    )

    const wrapper = mount(PantryView)
    await flushPromises()

    await wrapper.find('button.edit-btn').trigger('click')
    await wrapper.find('form.edit-form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Dieses Pantry Item wurde nicht gefunden.')
  })

  it('deletes a pantry item and removes it from the list', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([
      item('Rice', 2, 'kg', 'Grains'),
      item('Milk', 1, 'l', 'Dairy'),
    ])
    vi.mocked(pantryApi.deletePantryItem).mockResolvedValue()

    const wrapper = mount(PantryView)
    await flushPromises()

    await wrapper.find('button.delete-btn').trigger('click')
    await flushPromises()

    expect(pantryApi.deletePantryItem).toHaveBeenCalledWith('Rice')
    expect(wrapper.text()).not.toContain('Rice')
    expect(wrapper.text()).toContain('Milk')
  })

  it('shows forbidden message when delete returns 403', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([
      item('Rice', 2, 'kg', 'Grains'),
    ])
    vi.mocked(pantryApi.deletePantryItem).mockRejectedValue(
      new ApiClientError('Forbidden', 403),
    )

    const wrapper = mount(PantryView)
    await flushPromises()

    await wrapper.find('button.delete-btn').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Du darfst dieses Pantry Item nicht löschen.')
  })

  it('shows not found message when delete returns 404', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([
      item('Rice', 2, 'kg', 'Grains'),
    ])
    vi.mocked(pantryApi.deletePantryItem).mockRejectedValue(
      new ApiClientError('Not Found', 404),
    )

    const wrapper = mount(PantryView)
    await flushPromises()

    await wrapper.find('button.delete-btn').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Dieses Pantry Item wurde nicht gefunden.')
  })

  it('creates a pantry item and clears the form', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([])
    vi.mocked(pantryApi.createPantryItem).mockResolvedValue(
      item('Rice', 2, 'kg', 'Grains'),
    )

    const wrapper = mount(PantryView)
    await flushPromises()

    await wrapper.find('input[placeholder="z.B. Reis"]').setValue('Rice')
    await wrapper.find('input[placeholder="2"]').setValue(2)
    await wrapper.find('input[placeholder="kg"]').setValue('kg')
    await wrapper.find('input[placeholder="Vorrat"]').setValue('Grains')
    await wrapper.find('form.pantry-form').trigger('submit.prevent')
    await flushPromises()

    expect(pantryApi.createPantryItem).toHaveBeenCalledWith({
      name: 'Rice',
      quantity: 2,
      unit: 'kg',
      category: 'Grains',
    })
    expect(wrapper.text()).toContain('Rice')
    expect(wrapper.text()).toContain('Grains')
    expect(inputValue(wrapper, 'input[placeholder="z.B. Reis"]')).toBe('')
    expect(inputValue(wrapper, 'input[placeholder="2"]')).toBe('')
    expect(inputValue(wrapper, 'input[placeholder="kg"]')).toBe('')
    expect(inputValue(wrapper, 'input[placeholder="Vorrat"]')).toBe('')
  })

  it('shows validation message when create returns 400', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([])
    vi.mocked(pantryApi.createPantryItem).mockRejectedValue(
      new ApiClientError('Validation failed: name must not be blank', 400),
    )

    const wrapper = mount(PantryView)
    await flushPromises()

    await wrapper.find('input[placeholder="z.B. Reis"]').setValue('Rice')
    await wrapper.find('form.pantry-form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Bitte prüfe deine Eingaben für das Pantry Item.')
  })
})

function item(
  name: string,
  quantity: number,
  unit: string,
  category: string,
): PantryItemResponse {
  return {
    id: name,
    name,
    quantity,
    unit,
    category,
    createdAt: '2026-06-06T00:00:00Z',
    updatedAt: '2026-06-06T00:00:00Z',
  }
}

function inputValue(wrapper: ReturnType<typeof mount>, selector: string) {
  return (wrapper.find(selector).element as HTMLInputElement).value
}
