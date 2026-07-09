import { mount, flushPromises, config } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import RecipeList from '@/components/RecipeList.vue'
import { recipeApi } from '@/shared/api/recipeApi'
import { favoriteApi } from '@/shared/api/favoriteApi'
import { ApiClientError, AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { i18n, setLocale } from '@/i18n'

const push = vi.fn()
let routeQuery = {}

vi.mock('vue-router', () => ({
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a :href="href"><slot /></a>',
    computed: {
      href() {
        return typeof this.to === 'string' ? this.to : this.to?.path || '/'
      },
    },
  },
  useRouter: () => ({ push }),
  useRoute: () => ({ query: routeQuery }),
}))

vi.mock('@/shared/api/recipeApi', () => ({
  recipeApi: {
    getRecipes: vi.fn(),
    getMyRecipes: vi.fn(),
    createRecipe: vi.fn(),
    updateRecipe: vi.fn(),
    deleteRecipe: vi.fn(),
    uploadRecipeImage: vi.fn(),
  },
}))

vi.mock('@/shared/api/favoriteApi', () => ({
  favoriteApi: {
    getExternalFavorites: vi.fn(),
    removeExternalFavorite: vi.fn(),
  },
}))

describe('RecipeList.vue', () => {
  // Vor jedem Test Mocks zurücksetzen, damit Tests unabhängig bleiben
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    push.mockClear()
    routeQuery = {}
    sessionStorage.clear()
    setLocale('de')
    const pinia = createPinia()
    setActivePinia(pinia)
    config.global.plugins = [i18n, pinia]
    vi.mocked(recipeApi.getRecipes).mockResolvedValue([])
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([])
    vi.mocked(recipeApi.uploadRecipeImage).mockResolvedValue({
      imageUrl: 'https://example.supabase.co/storage/v1/object/public/recipe-images/recipes/1/uploaded.png',
    })
    vi.mocked(favoriteApi.getExternalFavorites).mockResolvedValue([])
    vi.mocked(favoriteApi.removeExternalFavorite).mockResolvedValue()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:image-preview'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
  })

  it('loads /recipes/mine and shows "Deine erstellten Rezepte" with items for logged-in users', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    // Fake-Daten für initiales GET /recipes/mine
    const fakeRecipes = [
      {
        id: 1,
        title: 'Test Pasta',
        imageUrl: '',
        prepTimeMinutes: 5,
        cookTimeMinutes: 10,
        servings: 2,
        difficulty: 'easy',
        category: 'Italian',
        rating: 4.5,
        ingredients: 'noodles',
        instructions: 'cook',
        favorite: false,
        published: false,
      },
    ]

    // recipeApi so mocken, dass diese Fake-Daten zurückkommen
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue(fakeRecipes)

    const wrapper = mount(RecipeList)

    await flushPromises()

    // Erwartung: Überschrift + Rezepttitel sichtbar
    expect(recipeApi.getMyRecipes).toHaveBeenCalledTimes(1)
    expect(recipeApi.getRecipes).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Eigene Rezepte')
    expect(wrapper.text()).toContain('Test Pasta')
    expect(wrapper.find('.new-recipe-form').exists()).toBe(false)
  })

  it('uploads an image, sets imageUrl and shows persistent preview when a file is selected', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(RecipeList, { props: { mode: 'create' } })
    await flushPromises()

    const file = new File(['image'], 'rezept.png', { type: 'image/png' })
    const fileInput = wrapper.find('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', {
      configurable: true,
      value: [file],
    })

    await fileInput.trigger('change')
    expect(URL.createObjectURL).toHaveBeenCalledWith(file)

    await flushPromises()

    expect(recipeApi.uploadRecipeImage).toHaveBeenCalledWith(file)
    const imageUrlInput = wrapper.find('input[type="url"]')
    expect(imageUrlInput.element.value).toBe('https://example.supabase.co/storage/v1/object/public/recipe-images/recipes/1/uploaded.png')
    expect(wrapper.find('.image-preview').attributes('src')).toBe('https://example.supabase.co/storage/v1/object/public/recipe-images/recipes/1/uploaded.png')
    expect(wrapper.text()).toContain('Bild wurde dauerhaft gespeichert.')
  })

  it('shows an upload error and keeps manual image URL as fallback', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(recipeApi.uploadRecipeImage).mockRejectedValue(
      new ApiClientError('Only JPEG, PNG and WebP images are supported.', 400),
    )
    const wrapper = mount(RecipeList, { props: { mode: 'create' } })
    await flushPromises()

    const file = new File(['image'], 'rezept.gif', { type: 'image/gif' })
    const fileInput = wrapper.find('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', {
      configurable: true,
      value: [file],
    })

    await fileInput.trigger('change')
    await flushPromises()

    expect(recipeApi.uploadRecipeImage).toHaveBeenCalledWith(file)
    expect(wrapper.text()).toContain('Only JPEG, PNG and WebP images are supported.')
    const imageUrlInput = wrapper.find('input[type="url"]')
    await imageUrlInput.setValue('https://example.com/manual.jpg')
    expect(imageUrlInput.element.value).toBe('https://example.com/manual.jpg')
  })

  it('does not require upload when a manual image URL is used', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(RecipeList, { props: { mode: 'create' } })
    await flushPromises()

    vi.mocked(recipeApi.createRecipe).mockResolvedValue({
      id: 1,
      title: 'Manual Image Dish',
      imageUrl: 'https://example.com/manual.jpg',
      prepTimeMinutes: 0,
      cookTimeMinutes: 0,
      servings: 0,
      difficulty: '',
      category: '',
      rating: 0,
      ingredients: 'x',
      instructions: 'y',
      favorite: false,
      published: false,
      language: 'de',
    })

    await wrapper
      .find('input[placeholder="z. B. Cremige Tomatenpasta"]')
      .setValue('Manual Image Dish')
    await wrapper
      .find('input[type="url"]')
      .setValue('https://example.com/manual.jpg')
    await wrapper
      .find('.new-recipe-form input[placeholder="Zutat"]')
      .setValue('x')
    await wrapper
      .find('textarea[placeholder="Beschreibe die Zubereitung Schritt für Schritt."]')
      .setValue('y')

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(recipeApi.uploadRecipeImage).not.toHaveBeenCalled()
    expect(recipeApi.createRecipe).toHaveBeenCalledWith(expect.objectContaining({
      imageUrl: 'https://example.com/manual.jpg',
    }))
  })

  it('still shows a local image preview immediately while upload is pending', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(recipeApi.uploadRecipeImage).mockReturnValue(new Promise(() => {}))
    const wrapper = mount(RecipeList, { props: { mode: 'create' } })
    await flushPromises()

    const file = new File(['image'], 'rezept.png', { type: 'image/png' })
    const fileInput = wrapper.find('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', {
      configurable: true,
      value: [file],
    })

    await fileInput.trigger('change')

    expect(URL.createObjectURL).toHaveBeenCalledWith(file)
    expect(wrapper.find('.image-preview').attributes('src')).toBe('blob:image-preview')
    expect(wrapper.text()).toContain('Lokale Vorschau. Das Bild wird gerade dauerhaft gespeichert.')
  })

  it('does not load recipes without login and shows a hint', async () => {
    const wrapper = mount(RecipeList)

    await flushPromises()

    expect(recipeApi.getMyRecipes).not.toHaveBeenCalled()
    expect(recipeApi.getRecipes).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Bitte melde dich an, um deine Rezepte zu sehen.')
    const loginLink = wrapper.find('a.login-link')
    expect(loginLink.exists()).toBe(true)
    expect(loginLink.attributes('href')).toBe('/login')
    expect(loginLink.text()).toBe('Zum Login')
  })

  it('shows a readable message when loading my recipes returns 401', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(recipeApi.getMyRecipes).mockRejectedValue(
      new ApiClientError('Missing or invalid Bearer token.', 401),
    )

    const wrapper = mount(RecipeList)
    await flushPromises()

    expect(recipeApi.getMyRecipes).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Bitte melde dich erneut an, um deine Rezepte zu sehen.')
  })

  it('creates a recipe via form submit', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(RecipeList, { props: { mode: 'create' } })
    await flushPromises()

    // 2. Aufruf: POST /recipes -> neues Rezept wird zurückgegeben
    vi.mocked(recipeApi.createRecipe).mockResolvedValue({
        id: 1,
        title: 'New Dish',
        imageUrl: '',
        prepTimeMinutes: 0,
        cookTimeMinutes: 0,
        servings: 0,
        difficulty: '',
        category: '',
        rating: 0,
        ingredients: 'x',
        instructions: 'y',
        favorite: false,
        published: true,
        language: 'de',
    })

    // Formularfelder mit Testwerten befüllen
    await wrapper
      .find('input[placeholder="z. B. Cremige Tomatenpasta"]')
      .setValue('New Dish')
    await wrapper
      .find('.new-recipe-form input[placeholder="Zutat"]')
      .setValue('x')
    await wrapper
      .find('textarea[placeholder="Beschreibe die Zubereitung Schritt für Schritt."]')
      .setValue('y')
    const publishToggle = wrapper.findAll('.new-recipe-form .toggle-item')
      .find(label => label.text().includes('Auf Startseite anzeigen'))
    expect(publishToggle).toBeDefined()
    await publishToggle.find('input').setValue(true)

    // Formular absenden
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(recipeApi.getMyRecipes).not.toHaveBeenCalled()
    expect(recipeApi.createRecipe).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New Dish',
        ingredients: 'x',
        instructions: 'y',
        published: true,
        language: 'de',
      })
    )
    expect(push).toHaveBeenCalledWith({ path: '/recipe/1', query: { from: 'my-recipes' } })
  })

  it('does not create a recipe without login', async () => {
    const wrapper = mount(RecipeList, { props: { mode: 'create' } })
    await flushPromises()

    await wrapper
      .find('input[placeholder="z. B. Cremige Tomatenpasta"]')
      .setValue('New Dish')
    await wrapper
      .find('.new-recipe-form input[placeholder="Zutat"]')
      .setValue('x')
    await wrapper
      .find('textarea[placeholder="Beschreibe die Zubereitung Schritt für Schritt."]')
      .setValue('y')

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(recipeApi.getMyRecipes).not.toHaveBeenCalled()
    expect(recipeApi.createRecipe).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Bitte melde dich an, um ein Rezept zu erstellen.')
  })

  it('does not show a rating input field in the create form', async () => {
    const wrapper = mount(RecipeList, { props: { mode: 'create' } })
    await flushPromises()

    expect(wrapper.find('input[placeholder="4.5"]').exists()).toBe(false)
  })

  it('ingredient list starts with one row and supports add/remove', async () => {
    const wrapper = mount(RecipeList, { props: { mode: 'create' } })
    await flushPromises()

    expect(wrapper.findAll('.new-recipe-form .ingredient-row')).toHaveLength(1)

    await wrapper.find('.new-recipe-form .ingredient-add-btn').trigger('click')
    expect(wrapper.findAll('.new-recipe-form .ingredient-row')).toHaveLength(2)

    await wrapper.find('.new-recipe-form .ingredient-add-btn').trigger('click')
    expect(wrapper.findAll('.new-recipe-form .ingredient-row')).toHaveLength(3)

    await wrapper.findAll('.new-recipe-form .ingredient-remove-btn')[2].trigger('click')
    expect(wrapper.findAll('.new-recipe-form .ingredient-row')).toHaveLength(2)

    await wrapper.findAll('.new-recipe-form .ingredient-remove-btn')[1].trigger('click')
    expect(wrapper.findAll('.new-recipe-form .ingredient-row')).toHaveLength(1)

    // Cannot remove the last remaining row (button is disabled)
    expect(wrapper.find('.new-recipe-form .ingredient-remove-btn').attributes('disabled')).toBeDefined()
    await wrapper.find('.new-recipe-form .ingredient-remove-btn').trigger('click')
    expect(wrapper.findAll('.new-recipe-form .ingredient-row')).toHaveLength(1)
  })

  it('creates a recipe with structured ingredient rows converted to a string', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(RecipeList, { props: { mode: 'create' } })
    await flushPromises()

    vi.mocked(recipeApi.createRecipe).mockResolvedValue({
      id: 5,
      title: 'Salad',
      imageUrl: '',
      prepTimeMinutes: 0,
      cookTimeMinutes: 0,
      servings: 0,
      difficulty: '',
      category: '',
      rating: 0,
      ingredients: '200 g Tomatoes, Cucumber',
      instructions: 'mix',
      favorite: false,
      published: false,
    })

    await wrapper.find('input[placeholder="z. B. Cremige Tomatenpasta"]').setValue('Salad')
    await wrapper.find('.new-recipe-form .ingredient-add-btn').trigger('click')

    const rows = wrapper.findAll('.new-recipe-form .ingredient-row')
    await rows[0].find('input[placeholder="Zutat"]').setValue('Tomatoes')
    await rows[0].find('input[placeholder="Menge"]').setValue('200')
    await rows[0].find('input[placeholder="Einheit"]').setValue('g')
    await rows[1].find('input[placeholder="Zutat"]').setValue('Cucumber')

    await wrapper.find('textarea[placeholder="Beschreibe die Zubereitung Schritt für Schritt."]').setValue('mix')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(recipeApi.createRecipe).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredients: '200 g Tomatoes, Cucumber',
        rating: 0,
      })
    )
  })

  it('shows an optional kcal field in the create form', async () => {
    const wrapper = mount(RecipeList, { props: { mode: 'create' } })
    await flushPromises()

    const caloriesInput = wrapper.find('input[placeholder="z. B. 450"]')
    expect(caloriesInput.exists()).toBe(true)
    expect(caloriesInput.attributes('type')).toBe('number')
    expect(caloriesInput.attributes('min')).toBe('0')
  })

  it('creates a recipe without kcal (calories stays null)', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(RecipeList, { props: { mode: 'create' } })
    await flushPromises()

    vi.mocked(recipeApi.createRecipe).mockResolvedValue({
      id: 6, title: 'Salad', imageUrl: '', prepTimeMinutes: 0, cookTimeMinutes: 0, servings: 0,
      difficulty: '', category: '', rating: 0, ingredients: 'x', instructions: 'y',
      favorite: false, published: false, calories: null,
    })

    await wrapper.find('input[placeholder="z. B. Cremige Tomatenpasta"]').setValue('Salad')
    await wrapper.find('.new-recipe-form input[placeholder="Zutat"]').setValue('x')
    await wrapper.find('textarea[placeholder="Beschreibe die Zubereitung Schritt für Schritt."]').setValue('y')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(recipeApi.createRecipe).toHaveBeenCalledWith(
      expect.objectContaining({ calories: null })
    )
  })

  it('creates a recipe with kcal sent as a number', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(RecipeList, { props: { mode: 'create' } })
    await flushPromises()

    vi.mocked(recipeApi.createRecipe).mockResolvedValue({
      id: 7, title: 'Salad', imageUrl: '', prepTimeMinutes: 0, cookTimeMinutes: 0, servings: 0,
      difficulty: '', category: '', rating: 0, ingredients: 'x', instructions: 'y',
      favorite: false, published: false, calories: 450,
    })

    await wrapper.find('input[placeholder="z. B. Cremige Tomatenpasta"]').setValue('Salad')
    await wrapper.find('.new-recipe-form input[placeholder="Zutat"]').setValue('x')
    await wrapper.find('textarea[placeholder="Beschreibe die Zubereitung Schritt für Schritt."]').setValue('y')
    await wrapper.find('input[placeholder="z. B. 450"]').setValue(450)
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(recipeApi.createRecipe).toHaveBeenCalledWith(
      expect.objectContaining({ calories: 450 })
    )
  })

  it('shows validation error if required fields are missing', async () => {
    const wrapper = mount(RecipeList, { props: { mode: 'create' } })
    await flushPromises()

    // Ohne Eingaben Submit auslösen
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    // Erwartung: kein zusätzlicher Create-Request
    expect(recipeApi.getMyRecipes).not.toHaveBeenCalled()
    // Validierungsfehlermeldung sichtbar
    expect(wrapper.text()).toContain('Bitte fülle alle Pflichtfelder aus.')
  })

  it('updates a recipe via edit panel', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    // Startzustand mit einem vorhandenen Rezept
    const initial = [
      {
        id: 1,
        title: 'Old Title',
        imageUrl: '',
        prepTimeMinutes: 0,
        cookTimeMinutes: 0,
        servings: 0,
        difficulty: '',
        category: '',
        rating: 0,
        ingredients: 'x',
        instructions: 'y',
        favorite: false,
        published: false,
      },
    ]

    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue(initial)

    const wrapper = mount(RecipeList)
    await flushPromises()

    // Edit-Panel programmatisch öffnen (Bearbeiten-Button navigiert jetzt zur Edit-Route)
    wrapper.vm.startEdit(initial[0])
    await nextTick()

    // Update-Request liefert das aktualisierte Rezept zurück
    vi.mocked(recipeApi.updateRecipe).mockResolvedValue({
      ...initial[0],
      title: 'Updated Title',
    })

    // Titel im Edit-Panel anpassen
    const titleInput = wrapper.find('.edit-panel input[type="text"]')
    await titleInput.setValue('Updated Title')

    // Speichern-Button klicken
    const saveBtn = wrapper.find('.edit-panel .submit-btn')
    await saveBtn.trigger('click')
    await flushPromises()

    // Erwartung: PUT auf /recipes/1 wurde abgesetzt
    expect(recipeApi.getMyRecipes).toHaveBeenCalledTimes(1)
    expect(recipeApi.updateRecipe).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        title: 'Updated Title',
        ingredients: 'x',
        instructions: 'y',
      })
    )
    // Neuer Titel wird angezeigt
    expect(wrapper.text()).toContain('Updated Title')
  })

  it('loads existing calories into the kcal field when editing', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const soupRecipe = {
      id: 1, title: 'Soup', imageUrl: '', prepTimeMinutes: 0, cookTimeMinutes: 0, servings: 0,
      difficulty: '', category: '', rating: 0, ingredients: 'x', instructions: 'y',
      favorite: false, published: false, calories: 320,
    }
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([soupRecipe])

    const wrapper = mount(RecipeList)
    await flushPromises()
    wrapper.vm.startEdit(soupRecipe)
    await nextTick()

    const caloriesInput = wrapper.find('.edit-panel input[placeholder="z. B. 450"]')
    expect(caloriesInput.exists()).toBe(true)
    expect(caloriesInput.element.value).toBe('320')
  })

  it('updates a recipe with a changed kcal value', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const initial = [
      {
        id: 1, title: 'Soup', imageUrl: '', prepTimeMinutes: 0, cookTimeMinutes: 0, servings: 0,
        difficulty: '', category: '', rating: 0, ingredients: 'x', instructions: 'y',
        favorite: false, published: false, calories: 320,
      },
    ]
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue(initial)

    const wrapper = mount(RecipeList)
    await flushPromises()
    wrapper.vm.startEdit(initial[0])
    await nextTick()

    vi.mocked(recipeApi.updateRecipe).mockResolvedValue({ ...initial[0], calories: 500 })

    await wrapper.find('.edit-panel input[placeholder="z. B. 450"]').setValue(500)
    await wrapper.find('.edit-panel .submit-btn').trigger('click')
    await flushPromises()

    expect(recipeApi.updateRecipe).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ calories: 500 })
    )
  })

  it('updates a recipe with cleared kcal (sends calories null)', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const initial = [
      {
        id: 1, title: 'Soup', imageUrl: '', prepTimeMinutes: 0, cookTimeMinutes: 0, servings: 0,
        difficulty: '', category: '', rating: 0, ingredients: 'x', instructions: 'y',
        favorite: false, published: false, calories: 320,
      },
    ]
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue(initial)

    const wrapper = mount(RecipeList)
    await flushPromises()
    wrapper.vm.startEdit(initial[0])
    await nextTick()

    vi.mocked(recipeApi.updateRecipe).mockResolvedValue({ ...initial[0], calories: null })

    await wrapper.find('.edit-panel input[placeholder="z. B. 450"]').setValue('')
    await wrapper.find('.edit-panel .submit-btn').trigger('click')
    await flushPromises()

    expect(recipeApi.updateRecipe).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ calories: null })
    )
  })

  it('does not show a rating input field in the edit panel', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const ratingRecipe = { id: 1, title: 'Soup', imageUrl: '', prepTimeMinutes: 0, cookTimeMinutes: 0, servings: 0, difficulty: '', category: '', rating: 4, ingredients: 'x', instructions: 'y', favorite: false, published: false }
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([ratingRecipe])

    const wrapper = mount(RecipeList)
    await flushPromises()
    wrapper.vm.startEdit(ratingRecipe)
    await nextTick()

    expect(wrapper.find('.edit-panel input[min="0"][max="5"]').exists()).toBe(false)
  })

  it('editing a recipe loads existing ingredients into separate rows and allows add/remove', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const initial = [
      {
        id: 1,
        title: 'Salad',
        imageUrl: '',
        prepTimeMinutes: 0,
        cookTimeMinutes: 0,
        servings: 0,
        difficulty: '',
        category: '',
        rating: 0,
        ingredients: '200 g Tomatoes, 100 g Cucumber',
        instructions: 'mix',
        favorite: false,
        published: false,
      },
    ]
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue(initial)

    const wrapper = mount(RecipeList)
    await flushPromises()

    wrapper.vm.startEdit(initial[0])
    await nextTick()

    const rows = wrapper.findAll('.edit-panel .ingredient-row')
    expect(rows).toHaveLength(2)
    const nameInputs = wrapper.findAll('.edit-panel .ingredient-row input[placeholder="Zutat"]')
    expect(nameInputs[0].element.value).toBe('Tomatoes')
    expect(nameInputs[1].element.value).toBe('Cucumber')

    // Add a new ingredient row
    await wrapper.find('.edit-panel .ingredient-add-btn').trigger('click')
    expect(wrapper.findAll('.edit-panel .ingredient-row')).toHaveLength(3)
    await wrapper.findAll('.edit-panel .ingredient-row input[placeholder="Zutat"]')[2].setValue('Olive oil')

    // Remove the first ingredient row
    await wrapper.findAll('.edit-panel .ingredient-remove-btn')[0].trigger('click')
    expect(wrapper.findAll('.edit-panel .ingredient-row')).toHaveLength(2)

    vi.mocked(recipeApi.updateRecipe).mockResolvedValue({ ...initial[0], ingredients: '100 g Cucumber, Olive oil' })
    await wrapper.find('.edit-panel .submit-btn').trigger('click')
    await flushPromises()

    // The remaining Cucumber row keeps its original quantity/unit (100 g);
    // the newly added Olive oil row has none.
    expect(recipeApi.updateRecipe).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ ingredients: '100 g Cucumber, Olive oil' })
    )
  })

  it('shows private and published status and toggles publication', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const privateRecipe = {
      id: 1,
      title: 'Private Soup',
      imageUrl: '',
      prepTimeMinutes: 5,
      cookTimeMinutes: 10,
      servings: 2,
      difficulty: 'easy',
      category: 'lunch',
      rating: 4,
      ingredients: 'soup',
      instructions: 'cook',
      favorite: false,
      published: false,
      language: 'de',
    }
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([privateRecipe])
    vi.mocked(recipeApi.updateRecipe).mockResolvedValue({ ...privateRecipe, published: true })

    const wrapper = mount(RecipeList)
    await flushPromises()

    expect(wrapper.find('.badge-private').text()).toBe('Privat')
    expect(wrapper.find('.publish-toggle input').element.checked).toBe(false)
    await wrapper.find('.publish-toggle input').setValue(true)
    await flushPromises()

    expect(recipeApi.updateRecipe).toHaveBeenCalledWith(1, expect.objectContaining({
      published: true,
      language: 'de',
    }))
    expect(wrapper.find('.badge-published').text()).toBe('Auf Startseite sichtbar')
    expect(wrapper.find('.publish-toggle input').element.checked).toBe(true)
  })

  it('opens the requested owned recipe in edit mode', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    routeQuery = { edit: '7' }
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([{
      id: 7,
      title: 'Editable Soup',
      imageUrl: '',
      prepTimeMinutes: 5,
      cookTimeMinutes: 10,
      servings: 2,
      difficulty: 'easy',
      category: 'lunch',
      rating: 4,
      ingredients: 'soup',
      instructions: 'cook',
      favorite: false,
      published: true,
      language: 'de',
    }])

    const wrapper = mount(RecipeList)
    await flushPromises()

    expect(wrapper.find('.edit-panel').exists()).toBe(true)
    expect(wrapper.find('.edit-panel input[type="text"]').element.value).toBe('Editable Soup')
  })

  it('does not update a recipe without login', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const initial = [
      {
        id: 1,
        title: 'Old Title',
        imageUrl: '',
        prepTimeMinutes: 0,
        cookTimeMinutes: 0,
        servings: 0,
        difficulty: '',
        category: '',
        rating: 0,
        ingredients: 'x',
        instructions: 'y',
        favorite: false,
        published: false,
      },
    ]

    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue(initial)

    const wrapper = mount(RecipeList)
    await flushPromises()
    sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)

    wrapper.vm.startEdit(initial[0])
    await nextTick()
    const titleInput = wrapper.find('.edit-panel input[type="text"]')
    await titleInput.setValue('Updated Title')

    const saveBtn = wrapper.find('.edit-panel .submit-btn')
    await saveBtn.trigger('click')
    await flushPromises()

    expect(recipeApi.getMyRecipes).toHaveBeenCalledTimes(1)
    expect(recipeApi.updateRecipe).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Bitte melde dich an, um ein Rezept zu bearbeiten.')
  })

  it('deletes a recipe when clicking Delete', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    // Startzustand mit einem Rezept, das gelöscht werden soll
    const initial = [
      {
        id: 1,
        title: 'To Delete',
        imageUrl: '',
        prepTimeMinutes: 0,
        cookTimeMinutes: 0,
        servings: 0,
        difficulty: '',
        category: '',
        rating: 0,
        ingredients: 'x',
        instructions: 'y',
        favorite: false,
        published: false,
      },
    ]

    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue(initial)

    const wrapper = mount(RecipeList)
    await flushPromises()

    // Delete-Request erfolgreich mocken
    vi.mocked(recipeApi.deleteRecipe).mockResolvedValue()

    // Delete-Button klicken
    const deleteBtn = wrapper.find('.link-btn.danger')
    await deleteBtn.trigger('click')
    await flushPromises()

    // Erwartung: DELETE auf /recipes/1
    expect(recipeApi.getMyRecipes).toHaveBeenCalledTimes(1)
    expect(recipeApi.deleteRecipe).toHaveBeenCalledWith(1)
    expect(wrapper.text()).not.toContain('To Delete')
  })

  it('does not delete a recipe without login', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const initial = [
      {
        id: 1,
        title: 'To Delete',
        imageUrl: '',
        prepTimeMinutes: 0,
        cookTimeMinutes: 0,
        servings: 0,
        difficulty: '',
        category: '',
        rating: 0,
        ingredients: 'x',
        instructions: 'y',
        favorite: false,
        published: false,
      },
    ]

    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue(initial)

    const wrapper = mount(RecipeList)
    await flushPromises()
    sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)

    const deleteBtn = wrapper.find('.link-btn.danger')
    await deleteBtn.trigger('click')
    await flushPromises()

    expect(recipeApi.getMyRecipes).toHaveBeenCalledTimes(1)
    expect(recipeApi.deleteRecipe).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Bitte melde dich an, um ein Rezept zu löschen.')
  })

  it('shows only favorite recipes in favorites grid', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    // Zwei Rezepte: eines favorite, eines nicht
    const initial = [
      {
        id: 1,
        title: 'Fav 1',
        imageUrl: '',
        prepTimeMinutes: 0,
        cookTimeMinutes: 0,
        servings: 0,
        difficulty: '',
        category: '',
        rating: 0,
        ingredients: 'x',
        instructions: 'y',
        favorite: true,
        published: false,
      },
      {
        id: 2,
        title: 'Not Fav',
        imageUrl: '',
        prepTimeMinutes: 0,
        cookTimeMinutes: 0,
        servings: 0,
        difficulty: '',
        category: '',
        rating: 0,
        ingredients: 'x',
        instructions: 'y',
        favorite: false,
        published: false,
      },
    ]

    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue(initial)

    const wrapper = mount(RecipeList)
    await flushPromises()
    await wrapper.findAll('.recipe-tabs button')[1].trigger('click')
    await flushPromises()

    // Titel aus der Favoriten-Ansicht auslesen
    const favGrid = wrapper
      .findAll('.recipe-grid .card-title')
      .map(n => n.text())

    // Erwartung: Nur das Favorite-Rezept wird angezeigt
    expect(favGrid).toContain('Fav 1')
    expect(favGrid).not.toContain('Not Fav')
  })

  it('shows external API favorites and opens external detail route', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([])
    vi.mocked(favoriteApi.getExternalFavorites).mockResolvedValue([
      {
        id: 1,
        externalRecipeId: '716429',
        externalTitle: 'External Pasta',
        externalImageUrl: 'https://example.com/pasta.jpg',
        externalSource: 'spoonacular',
      },
    ])

    const wrapper = mount(RecipeList)
    await flushPromises()
    await wrapper.findAll('.recipe-tabs button')[1].trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('External Pasta')
    await wrapper.find('.recipe-grid .recipe-card').trigger('click')

    expect(push).toHaveBeenCalledWith('/recipe/external/716429')
  })

  it('removes external favorites directly from the favorites grid', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([])
    vi.mocked(favoriteApi.getExternalFavorites).mockResolvedValue([
      {
        id: 1,
        externalRecipeId: '716429',
        externalTitle: 'External Pasta',
        externalImageUrl: 'https://example.com/pasta.jpg',
        externalSource: 'spoonacular',
      },
    ])

    const wrapper = mount(RecipeList)
    await flushPromises()
    await wrapper.findAll('.recipe-tabs button')[1].trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('External Pasta')
    await wrapper.find('.favorite-remove-button').trigger('click')
    await flushPromises()

    expect(favoriteApi.removeExternalFavorite).toHaveBeenCalledWith('spoonacular', '716429')
    expect(wrapper.text()).not.toContain('External Pasta')
  })

  it('keeps an external favorite visible when removing it fails', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([])
    vi.mocked(favoriteApi.getExternalFavorites).mockResolvedValue([
      {
        id: 1,
        externalRecipeId: '716429',
        externalTitle: 'External Pasta',
        externalImageUrl: 'https://example.com/pasta.jpg',
        externalSource: 'spoonacular',
      },
    ])
    vi.mocked(favoriteApi.removeExternalFavorite).mockRejectedValue(new Error('delete failed'))

    const wrapper = mount(RecipeList)
    await flushPromises()
    await wrapper.findAll('.recipe-tabs button')[1].trigger('click')
    await flushPromises()

    await wrapper.find('.favorite-remove-button').trigger('click')
    await flushPromises()

    expect(favoriteApi.removeExternalFavorite).toHaveBeenCalledWith('spoonacular', '716429')
    expect(wrapper.text()).toContain('External Pasta')
    expect(wrapper.text()).toContain('Favorit konnte nicht entfernt werden.')
  })

  it('removes own favorites directly by updating the recipe', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const ownFavorite = {
      id: 1,
      title: 'Fav 1',
      imageUrl: '',
      prepTimeMinutes: 0,
      cookTimeMinutes: 0,
      servings: 0,
      difficulty: '',
      category: '',
      rating: 0,
      ingredients: 'x',
      instructions: 'y',
      favorite: true,
      published: true,
      language: 'de',
    }
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([ownFavorite])
    vi.mocked(recipeApi.updateRecipe).mockResolvedValue({ ...ownFavorite, favorite: false })

    const wrapper = mount(RecipeList)
    await flushPromises()
    await wrapper.findAll('.recipe-tabs button')[1].trigger('click')
    await flushPromises()

    await wrapper.find('.favorite-remove-button').trigger('click')
    await flushPromises()

    expect(recipeApi.updateRecipe).toHaveBeenCalledWith(1, expect.objectContaining({
      favorite: false,
      published: true,
      language: 'de',
    }))
    expect(wrapper.find('.recipe-grid').text()).not.toContain('Fav 1')
  })
  it('shows English recipe UI texts after locale switch while recipe data stays unchanged', async () => {
    setLocale('en')
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([
      {
        id: 1,
        title: 'Kartoffelsuppe',
        imageUrl: '',
        prepTimeMinutes: 5,
        cookTimeMinutes: 10,
        servings: 2,
        difficulty: 'einfach',
        category: 'Hausmannskost',
        rating: 4.5,
        ingredients: 'Kartoffeln, Lauch',
        instructions: 'Kochen',
        favorite: true,
        published: true,
      },
    ])

    const wrapper = mount(RecipeList)
    await flushPromises()

    expect(wrapper.text()).toContain('Own recipes')
    expect(wrapper.text()).toContain('Your favorite recipes')
    expect(wrapper.text()).toContain('View')
    expect(wrapper.text()).toContain('Kartoffelsuppe')
    expect(wrapper.text()).toContain('Kartoffeln, Lauch')
    expect(wrapper.text()).toContain('Hausmannskost')
  })

})
