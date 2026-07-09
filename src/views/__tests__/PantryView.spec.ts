import { mount, flushPromises, config } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import PantryView from '@/views/PantryView.vue'
import { pantryApi } from '@/shared/api/pantryApi'
import { ApiClientError, AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { printPantry } from '@/shared/printExport'
import { i18n, setLocale } from '@/i18n'
import type { PantryItemResponse } from '@/types/pantry'

const zxingMocks = vi.hoisted(() => ({
  decodeFromVideoDevice: vi.fn(),
  stop: vi.fn(),
}))

vi.mock('@/shared/api/pantryApi', () => ({
  pantryApi: {
    getPantryItems: vi.fn(),
    createPantryItem: vi.fn(),
    updatePantryItem: vi.fn(),
    deletePantryItem: vi.fn(),
  },
}))

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: vi.fn().mockImplementation(() => ({
    decodeFromVideoDevice: zxingMocks.decodeFromVideoDevice,
  })),
}))

vi.mock('@zxing/library', () => ({
  BarcodeFormat: {
    EAN_13: 'EAN_13',
    EAN_8: 'EAN_8',
    UPC_A: 'UPC_A',
    UPC_E: 'UPC_E',
  },
  DecodeHintType: {
    POSSIBLE_FORMATS: 'POSSIBLE_FORMATS',
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock('@/shared/printExport', () => ({
  printPantry: vi.fn(),
  printShoppingList: vi.fn(),
}))

describe('PantryView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    setLocale('de')
    const pinia = createPinia()
    setActivePinia(pinia)
    config.global.plugins = [i18n, pinia]
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([])
    vi.stubGlobal('fetch', vi.fn())
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    })
    zxingMocks.decodeFromVideoDevice.mockResolvedValue({ stop: zxingMocks.stop })
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

  it('shows pantry items without category', async () => {
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
    // Category is no longer displayed in the list
    expect(wrapper.text()).not.toContain('Grains')
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
    // Category field is no longer shown in the edit form
    expect(wrapper.find('form.edit-form input[placeholder="Vorrat"]').exists()).toBe(false)
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
    await wrapper.find('form.pantry-form').trigger('submit.prevent')
    await flushPromises()

    // Category is no longer part of the create form
    expect(pantryApi.createPantryItem).toHaveBeenCalledWith({
      name: 'Rice',
      quantity: 2,
      unit: 'kg',
    })
    expect(wrapper.text()).toContain('Rice')
    expect(inputValue(wrapper, 'input[placeholder="z.B. Reis"]')).toBe('')
    expect(inputValue(wrapper, 'input[placeholder="2"]')).toBe('')
    expect(inputValue(wrapper, 'input[placeholder="kg"]')).toBe('')
    expect(wrapper.find('input[placeholder="Vorrat"]').exists()).toBe(false)
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

    expect(wrapper.text()).toContain('Bitte gib eine Menge an')
  })

  it('rejects a quantity of 0 with a clear message and does not create an item', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([])

    const wrapper = mount(PantryView)
    await flushPromises()

    await wrapper.find('input[placeholder="z.B. Reis"]').setValue('Rice')
    await wrapper.find('input[placeholder="2"]').setValue(0)
    await wrapper.find('form.pantry-form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Die Menge muss größer als 0 sein.')
    expect(pantryApi.createPantryItem).not.toHaveBeenCalled()
  })

  it('rejects a negative quantity with a clear message and does not create an item', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([])

    const wrapper = mount(PantryView)
    await flushPromises()

    await wrapper.find('input[placeholder="z.B. Reis"]').setValue('Rice')
    await wrapper.find('input[placeholder="2"]').setValue(-3)
    await wrapper.find('form.pantry-form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Die Menge muss größer als 0 sein.')
    expect(pantryApi.createPantryItem).not.toHaveBeenCalled()
  })

  it('merges a new item into an existing one with the same normalized name and unit, summing quantities', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([
      item('Rundkornreis', 2, 'kg', ''),
    ])
    vi.mocked(pantryApi.updatePantryItem).mockResolvedValue(
      item('Rundkornreis', 4, 'kg', ''),
    )

    const wrapper = mount(PantryView)
    await flushPromises()

    await wrapper.find('input[placeholder="z.B. Reis"]').setValue('Rundkornreis')
    await wrapper.find('input[placeholder="2"]').setValue(2)
    await wrapper.find('form.pantry-form input[placeholder="kg"]').setValue('kg')
    await wrapper.find('form.pantry-form').trigger('submit.prevent')
    await flushPromises()

    expect(pantryApi.updatePantryItem).toHaveBeenCalledWith('Rundkornreis', {
      name: 'Rundkornreis',
      quantity: 4,
      unit: 'kg',
      category: '',
    })
    expect(pantryApi.createPantryItem).not.toHaveBeenCalled()
    expect(wrapper.findAll('.pantry-item')).toHaveLength(1)
    expect(wrapper.text()).toContain('4')
  })

  it('does not merge pantry items with different units', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([
      item('Rundkornreis', 2, 'kg', ''),
    ])
    vi.mocked(pantryApi.createPantryItem).mockResolvedValue(
      item('Rundkornreis', 2, 'g', ''),
    )

    const wrapper = mount(PantryView)
    await flushPromises()

    await wrapper.find('input[placeholder="z.B. Reis"]').setValue('Rundkornreis')
    await wrapper.find('input[placeholder="2"]').setValue(2)
    await wrapper.find('form.pantry-form input[placeholder="kg"]').setValue('g')
    await wrapper.find('form.pantry-form').trigger('submit.prevent')
    await flushPromises()

    expect(pantryApi.createPantryItem).toHaveBeenCalledWith({
      name: 'Rundkornreis',
      quantity: 2,
      unit: 'g',
    })
    expect(pantryApi.updatePantryItem).not.toHaveBeenCalled()
    expect(wrapper.findAll('.pantry-item')).toHaveLength(2)
  })

  it('does not show a native datalist and only suggests after typing', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(PantryView)
    await flushPromises()

    // No native <datalist> anywhere on the page
    expect(wrapper.find('datalist').exists()).toBe(false)

    const nameInput = wrapper.find('input[placeholder="z.B. Reis"]')
    expect(nameInput.exists()).toBe(true)

    // Focusing without typing shows no suggestions
    await nameInput.trigger('focus')
    expect(wrapper.find('.suggest-dropdown').exists()).toBe(false)

    // Typing shows a small custom dropdown, capped at 8 items
    // German locale is active by default, so suggestions show localized German labels.
    await nameInput.setValue('reis')
    await nameInput.trigger('focus')
    const dropdown = wrapper.find('.suggest-dropdown')
    expect(dropdown.exists()).toBe(true)
    const options = dropdown.findAll('li')
    expect(options.length).toBeGreaterThan(0)
    expect(options.length).toBeLessThanOrEqual(8)
    expect(dropdown.text()).toContain('Basmatireis')
  })

  it('selecting a name suggestion sets the value and closes the dropdown', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(PantryView)
    await flushPromises()

    const nameInput = wrapper.find('input[placeholder="z.B. Reis"]')
    await nameInput.setValue('basmati')

    const option = wrapper.findAll('.suggest-dropdown li').find(li => li.text() === 'Basmatireis')
    expect(option).toBeTruthy()
    await option!.trigger('mousedown')

    expect((wrapper.find('input[placeholder="z.B. Reis"]').element as HTMLInputElement).value).toBe('Basmatireis')
    expect(wrapper.find('.suggest-dropdown').exists()).toBe(false)
  })

  it('allows free text for name and unit', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.createPantryItem).mockResolvedValue(item('My own thing', 1, 'jar', ''))
    const wrapper = mount(PantryView)
    await flushPromises()

    await wrapper.find('input[placeholder="z.B. Reis"]').setValue('My own thing')
    await wrapper.find('input[placeholder="2"]').setValue(1)
    await wrapper.find('form.pantry-form input[placeholder="kg"]').setValue('jar')
    await wrapper.find('form.pantry-form').trigger('submit.prevent')
    await flushPromises()

    expect(pantryApi.createPantryItem).toHaveBeenCalledWith({
      name: 'My own thing',
      quantity: 1,
      unit: 'jar',
    })
  })

  it('shows all unit suggestions on focus without typing (showSuggestionsOnFocus)', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(PantryView)
    await flushPromises()

    const unitInput = wrapper.find('form.pantry-form input[placeholder="kg"]')
    await unitInput.trigger('focus')

    // Unit field opens immediately on focus, no typing required
    // German locale is active by default, so units show localized German labels.
    const dropdown = wrapper.find('.suggest-dropdown')
    expect(dropdown.exists()).toBe(true)
    expect(dropdown.text()).toContain('g')
    expect(dropdown.text()).toContain('kg')
    expect(dropdown.text()).toContain('Stück')
  })

  it('filters unit suggestions when typing in the unit field', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(PantryView)
    await flushPromises()

    const unitInput = wrapper.find('form.pantry-form input[placeholder="kg"]')
    await unitInput.setValue('p')
    await unitInput.trigger('focus')

    const dropdown = wrapper.find('.suggest-dropdown')
    expect(dropdown.exists()).toBe(true)
    expect(dropdown.text()).toContain('Packung')
    expect(dropdown.text()).toContain('Prise')
    // Other units not matching "p" are hidden
    expect(dropdown.text()).not.toContain('ml')
  })

  it('locale de: dropdown never mixes English fallback names with German names (live bug regression)', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(PantryView)
    await flushPromises()

    const nameInput = wrapper.find('input[placeholder="z.B. Reis"]')
    // "reis" matches all 10 rice suggestions once fully localized.
    await nameInput.setValue('reis')
    await nameInput.trigger('focus')

    const dropdownText = wrapper.find('.suggest-dropdown').text()
    expect(dropdownText).not.toContain('Milk rice')
    expect(dropdownText).not.toContain('Long grain rice')
    expect(dropdownText).not.toContain('Short grain rice')
    expect(dropdownText).toContain('Milchreis')
    expect(dropdownText).toContain('Langkornreis')
    expect(dropdownText).toContain('Rundkornreis')
  })

  it('locale de: bean suggestions are fully German, not a mix of translated and English', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(PantryView)
    await flushPromises()

    const nameInput = wrapper.find('input[placeholder="z.B. Reis"]')
    await nameInput.setValue('bohnen')
    await nameInput.trigger('focus')

    const dropdownText = wrapper.find('.suggest-dropdown').text()
    expect(dropdownText).not.toContain('Kidney beans')
    expect(dropdownText).not.toContain('Black beans')
    expect(dropdownText).toContain('Kidneybohnen')
    expect(dropdownText).toContain('Schwarze Bohnen')
  })

  it('shows English suggestions when locale is not German', async () => {
    setLocale('en')
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(PantryView)
    await flushPromises()

    const nameInput = wrapper.find('input[placeholder="e.g. rice"]')
    await nameInput.setValue('rice')
    await nameInput.trigger('focus')
    expect(wrapper.find('.suggest-dropdown').text()).toContain('Basmati rice')

    // Mount a fresh instance to check the unit field's dropdown without dealing with
    // the name dropdown's async blur-close timing.
    const unitWrapper = mount(PantryView)
    await flushPromises()
    const unitInput = unitWrapper.find('form.pantry-form input[placeholder="kg"]')
    await unitInput.trigger('focus')
    expect(unitWrapper.find('.suggest-dropdown').text()).toContain('piece')
  })

  it('typing category word "Fleisch" surfaces meat member ingredient suggestions', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(PantryView)
    await flushPromises()

    const nameInput = wrapper.find('input[placeholder="z.B. Reis"]')
    await nameInput.setValue('Fleisch')
    await nameInput.trigger('focus')

    const dropdown = wrapper.find('.suggest-dropdown')
    expect(dropdown.exists()).toBe(true)
    expect(dropdown.text()).toContain('Hähnchenbrust')
    expect(dropdown.text()).toContain('Rindersteak')
  })

  it('creates a pantry item with a German unit label and it is sent to the backend unchanged', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.createPantryItem).mockResolvedValue(item('Quark', 500, 'TL', ''))
    const wrapper = mount(PantryView)
    await flushPromises()

    await wrapper.find('input[placeholder="z.B. Reis"]').setValue('Quark')
    await wrapper.find('input[placeholder="2"]').setValue(500)
    await wrapper.find('form.pantry-form input[placeholder="kg"]').setValue('TL')
    await wrapper.find('form.pantry-form').trigger('submit.prevent')
    await flushPromises()

    expect(pantryApi.createPantryItem).toHaveBeenCalledWith({
      name: 'Quark',
      quantity: 500,
      unit: 'TL',
    })
  })

  it('does not show category field in add or edit form', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([
      item('Rice', 2, 'kg', 'Grains'),
    ])

    const wrapper = mount(PantryView)
    await flushPromises()

    expect(wrapper.find('input[placeholder="Vorrat"]').exists()).toBe(false)

    await wrapper.find('button.edit-btn').trigger('click')
    await flushPromises()

    expect(wrapper.find('input[placeholder="Vorrat"]').exists()).toBe(false)
  })

  it('opens the real barcode scanner through ZXing', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')

    const wrapper = mount(PantryView)
    await flushPromises()

    await findButton(wrapper, 'Barcode scannen').trigger('click')
    await flushPromises()

    expect(zxingMocks.decodeFromVideoDevice).toHaveBeenCalled()
    expect(wrapper.find('video.barcode-video').exists()).toBe(true)
    expect(wrapper.text()).toContain('Scanner stoppen')
  })

  it('detects a barcode, loads OpenFoodFacts product data and adds it to pantry', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const controls = { stop: vi.fn() }
    zxingMocks.decodeFromVideoDevice.mockImplementation(async (_deviceId, _video, callback) => {
      await callback({ getText: () => '4006381333931' }, undefined, controls)
      return controls
    })
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        product: {
          product_name: 'Nutella',
          brands: 'Ferrero',
          image_front_url: 'https://example.com/nutella.jpg',
          categories_tags: ['en:spread'],
        },
      }),
    } as Response)
    vi.mocked(pantryApi.createPantryItem).mockResolvedValue(item('Nutella', 1, 'Stück', 'spread'))

    const wrapper = mount(PantryView)
    await flushPromises()

    await findButton(wrapper, 'Barcode scannen').trigger('click')
    await flushPromises()
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith('https://world.openfoodfacts.org/api/v0/product/4006381333931.json')
    expect(wrapper.text()).toContain('Nutella')
    expect(wrapper.text()).toContain('Ferrero')
    expect(wrapper.text()).toContain('4006381333931')

    await findButton(wrapper, 'Zum Vorrat hinzufügen').trigger('click')
    await flushPromises()

    expect(pantryApi.createPantryItem).toHaveBeenCalledWith({
      name: 'Nutella',
      quantity: 1,
      unit: 'Stück',
      category: 'spread',
    })
    expect(wrapper.text()).toContain('Nutella wurde zum Vorrat')
    // Category is not displayed in the pantry list (preserved in backend only)
    expect(wrapper.find('.pantry-list').text()).not.toContain('spread')
  })

  it('shows a camera permission error when scanner startup is denied', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    zxingMocks.decodeFromVideoDevice.mockRejectedValue({ name: 'NotAllowedError' })

    const wrapper = mount(PantryView)
    await flushPromises()

    await findButton(wrapper, 'Barcode scannen').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Kamerazugriff wurde verweigert.')
  })

  it('shows product not found when OpenFoodFacts has no matching product', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 0 }),
    } as Response)

    const wrapper = mount(PantryView)
    await flushPromises()

    await wrapper.find('input[placeholder="Barcode eingeben"]').setValue('123456')
    await findButton(wrapper, 'Barcode suchen').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Produkt wurde nicht gefunden.')
  })

  it('shows OpenFoodFacts error when lookup fails', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(fetch).mockRejectedValue(new Error('offline'))

    const wrapper = mount(PantryView)
    await flushPromises()

    await wrapper.find('input[placeholder="Barcode eingeben"]').setValue('123456')
    await findButton(wrapper, 'Barcode suchen').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Open Food Facts ist gerade nicht erreichbar.')
  })

  it('shows English pantry texts after locale switch', async () => {
    setLocale('en')
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')

    const wrapper = mount(PantryView)
    await flushPromises()

    expect(wrapper.text()).toContain('Your Pantry')
    expect(wrapper.text()).toContain('Your pantry is still empty.')
    expect(wrapper.find('button[type="submit"]').text()).toBe('Add')
  })


  // ─── PDF export tests ─────────────────────────────────────────────────────

  it('shows the PDF export button in the toolbox', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([
      item('Reis', 1, 'kg', 'Getreide'),
    ])

    const wrapper = mount(PantryView)
    await flushPromises()

    const pdfBtn = wrapper.findAll('button').find(b => b.text().includes('PDF'))
    expect(pdfBtn).toBeTruthy()
  })

  it('calls printPantry with item data when PDF button is clicked', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([
      item('Mehl', 500, 'g', 'Getreide'),
      item('Olivenöl', 0.5, 'l', 'Öle'),
    ])

    const wrapper = mount(PantryView)
    await flushPromises()

    const pdfBtn = wrapper.findAll('button').find(b => b.text().includes('PDF'))!
    await pdfBtn.trigger('click')

    expect(printPantry).toHaveBeenCalledTimes(1)
    const [items] = vi.mocked(printPantry).mock.calls[0]!
    expect(items).toHaveLength(2)
    expect(items.some(i => i.name === 'Mehl' && i.quantity === 500 && i.unit === 'g')).toBe(true)
    expect(items.some(i => i.name === 'Olivenöl' && i.quantity === 0.5 && i.unit === 'l')).toBe(true)
  })

  it('passes name, quantity and unit correctly to printPantry', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([
      item('Zucker', 2, 'kg', ''),
    ])

    const wrapper = mount(PantryView)
    await flushPromises()

    const pdfBtn = wrapper.findAll('button').find(b => b.text().includes('PDF'))!
    await pdfBtn.trigger('click')

    const [items] = vi.mocked(printPantry).mock.calls[0]!
    expect(items[0]).toMatchObject({ name: 'Zucker', quantity: 2, unit: 'kg' })
  })

  it('shows error toast and does not call printPantry when pantry is empty', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(pantryApi.getPantryItems).mockResolvedValue([])

    const wrapper = mount(PantryView)
    await flushPromises()

    const pdfBtn = wrapper.findAll('button').find(b => b.text().includes('PDF'))!
    await pdfBtn.trigger('click')

    expect(printPantry).not.toHaveBeenCalled()
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

function findButton(wrapper: ReturnType<typeof mount>, text: string) {
  const button = wrapper.findAll('button').find(item => item.text().includes(text))
  if (!button) {
    throw new Error(`Button not found: ${text}`)
  }
  return button
}
