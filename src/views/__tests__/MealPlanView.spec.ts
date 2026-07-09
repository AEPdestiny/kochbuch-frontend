import { mount, flushPromises, enableAutoUnmount, DOMWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { config } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { printMealPlan } from '@/shared/printExport'
import MealPlanView from '@/views/MealPlanView.vue'
import { mealPlanApi } from '@/shared/api/mealPlanApi'
import { recipeApi } from '@/shared/api/recipeApi'
import { profileApi } from '@/shared/api/profileApi'
import { ApiClientError, AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { i18n, setLocale } from '@/i18n'
import { useToastStore } from '@/stores/toastStore'
import type { MealPlanWeekResponse } from '@/types/mealPlan'
import type { RecipeResponse } from '@/types/recipe'

vi.mock('@/shared/api/mealPlanApi', () => ({
  mealPlanApi: {
    getWeek: vi.fn(),
    setDay: vi.fn(),
    deleteDay: vi.fn(),
    setSlot: vi.fn(),
    deleteSlot: vi.fn(),
    moveEntry: vi.fn(),
    createShoppingListFromWeek: vi.fn(),
  },
}))

vi.mock('@/shared/api/recipeApi', () => ({
  recipeApi: {
    getMyRecipes: vi.fn(),
    getPublishedRecipes: vi.fn(),
    getExternalRecipes: vi.fn(),
  },
}))

vi.mock('@/shared/api/profileApi', () => ({
  profileApi: {
    getPreferences: vi.fn(),
  },
}))

vi.mock('@/shared/printExport', () => ({
  printMealPlan: vi.fn(),
  printShoppingList: vi.fn(),
  printPantry: vi.fn(),
  openPrintWindow: vi.fn(),
}))

enableAutoUnmount(afterEach)

config.global.stubs = {
  RouterLink: {
    props: ['to'],
    template: '<a :href="typeof to === \'string\' ? to : to.path"><slot /></a>',
  },
}

// Slot editing/adding now happens in a shared modal instead of an always-visible
// inline form — click the compact trigger (empty slot) or "Bearbeiten" (filled slot)
// for the given slot-block within a day card to open it before interacting with it.
async function openSlotModal(dayCard: DOMWrapper<Element>, slotIndex: number) {
  const slotBlock = dayCard.findAll('.slot-block')[slotIndex]!
  const emptyTrigger = slotBlock.find('.slot-empty-trigger')
  if (emptyTrigger.exists()) {
    await emptyTrigger.trigger('click')
    return
  }
  const editButton = slotBlock.findAll('button').find(button => button.text().includes('Bearbeiten'))!
  await editButton.trigger('click')
}

describe('MealPlanView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setLocale('de')
    const pinia = createPinia()
    setActivePinia(pinia)
    config.global.plugins = [i18n, pinia]
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue(weekResponse())
    vi.mocked(mealPlanApi.createShoppingListFromWeek).mockResolvedValue({
      added: [],
      skippedBecauseInPantry: [],
      needsReview: [],
      alreadyOnShoppingList: [],
    })
    vi.mocked(mealPlanApi.moveEntry).mockResolvedValue(weekResponse())
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([
      recipe(1, 'Pasta'),
      recipe(2, 'Soup'),
    ])
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([])
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(99, 'Sushi Bowl', { calories: 450, imageUrl: 'https://example.com/sushi.jpg', externalId: 'ext-99', source: 'spoonacular' }),
    ])
    vi.mocked(profileApi.getPreferences).mockResolvedValue({
      likes: [],
      dislikes: [],
      allergies: [],
      vegan: false,
      vegetarian: true,
      glutenFree: true,
      lactoseFree: false,
      highProtein: false,
      calorieConscious: false,
      budgetFriendly: false,
      maxPrepTimeMinutes: 30,
      calorieGoal: null,
      dailyCalorieTarget: 2000,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders seven week cards and search fields', async () => {
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Wochenplan')
    expect(wrapper.findAll('.day-card')).toHaveLength(7)
    expect(wrapper.text()).toContain('Montag')
    expect(wrapper.text()).toContain('Sonntag')
    expect(wrapper.text()).toContain('Frühstück')
    expect(wrapper.text()).toContain('Mittagessen')
    expect(wrapper.text()).toContain('Abendessen')
    expect(wrapper.text()).toContain('Snack')

    // The search form only appears once a slot's add/edit modal is opened.
    const mondayCard = wrapper.findAll('.day-card').find(card => card.text().includes('Montag'))!
    await openSlotModal(mondayCard, 0)
    expect(wrapper.text()).toContain('Rezept suchen oder Freitext eingeben')

    expect(wrapper.text()).toContain('Manuell planen')
    expect(wrapper.text()).toContain('Swipe planen')
    expect(wrapper.text()).not.toContain('Gesamt-Kalorien')
    expect(wrapper.text()).toContain('Pasta')
    expect(wrapper.text()).toContain('600 kcal / 2000 kcal')
  })

  it('shows "{sum} kcal + 1 Mahlzeit ohne kcal-Angabe" for one known + one unknown meal', async () => {
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
      weekStart: '2026-06-01',
      weekEnd: '2026-06-07',
      entries: [
        entry('2026-06-01', recipe(1, 'Pasta', { calories: 600 }), 'dinner'),
        { id: '2', plannedDate: '2026-06-01', mealSlot: 'lunch', recipe: null, customTitle: 'Salat', calories: null, caloriesSnapshot: null },
      ],
    })

    const wrapper = mount(MealPlanView, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(wrapper.text()).toContain('600 kcal + 1 ohne Angabe / 2000 kcal')
    expect(wrapper.text()).toContain('Einige Mahlzeiten haben keine kcal-Angabe')
  })

  it('shows plural "Mahlzeiten ohne kcal-Angabe" for multiple unknown-calorie meals', async () => {
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
      weekStart: '2026-06-01',
      weekEnd: '2026-06-07',
      entries: [
        entry('2026-06-01', recipe(1, 'Pasta', { calories: 600 }), 'dinner'),
        { id: '2', plannedDate: '2026-06-01', mealSlot: 'lunch', recipe: null, customTitle: 'Salat', calories: null, caloriesSnapshot: null },
        { id: '3', plannedDate: '2026-06-01', mealSlot: 'breakfast', recipe: null, customTitle: 'Müsli', calories: null, caloriesSnapshot: null },
      ],
    })

    const wrapper = mount(MealPlanView, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(wrapper.text()).toContain('600 kcal + 2 ohne Angabe / 2000 kcal')
  })

  it('shows "{n} Mahlzeit(en) ohne kcal-Angabe" without a misleading "0 kcal +" prefix when no meal has known calories', async () => {
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
      weekStart: '2026-06-01',
      weekEnd: '2026-06-07',
      entries: [
        { id: '1', plannedDate: '2026-06-01', mealSlot: 'lunch', recipe: null, customTitle: 'Salat', calories: null, caloriesSnapshot: null },
        { id: '2', plannedDate: '2026-06-01', mealSlot: 'breakfast', recipe: null, customTitle: 'Müsli', calories: null, caloriesSnapshot: null },
      ],
    })

    const wrapper = mount(MealPlanView, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(wrapper.text()).toContain('2 ohne Angabe / 2000 kcal')
    expect(wrapper.text()).not.toContain('0 kcal +')
  })

  it('shows unchanged current behavior for a day with zero planned meals (no hint text)', async () => {
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue(emptyWeekResponse())

    const wrapper = mount(MealPlanView, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(wrapper.text()).toContain('0 kcal / 2000 kcal')
    expect(wrapper.text()).not.toContain('ohne kcal-Angabe')
    expect(wrapper.text()).not.toContain('Einige Mahlzeiten haben keine kcal-Angabe')
  })

  it('shows no weekly goal state when calorie target is zero or empty', async () => {
    vi.mocked(profileApi.getPreferences).mockResolvedValue({
      likes: [],
      dislikes: [],
      allergies: [],
      vegan: false,
      vegetarian: false,
      glutenFree: false,
      lactoseFree: false,
      highProtein: false,
      calorieConscious: false,
      budgetFriendly: false,
      maxPrepTimeMinutes: null,
      calorieGoal: 0,
      dailyCalorieTarget: 0,
    })
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
      weekStart: '2026-06-01',
      weekEnd: '2026-06-07',
      entries: [
        entry('2026-06-01', recipe(1, 'Pasta', { calories: 300 }), 'dinner'),
        entry('2026-06-02', recipe(2, 'Soup', { calories: 400 }), 'lunch'),
      ],
    })

    const wrapper = mount(MealPlanView, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Kein Wochenziel gesetzt.')
    expect(wrapper.text()).toContain('100 kcal')
    expect(wrapper.text()).not.toContain('Differenz')
    expect(wrapper.text()).not.toContain('/ 0')
    expect(wrapper.text()).not.toContain('/ 1')
    expect(wrapper.text()).not.toContain('+100 kcal')
  })

  it('does not crash for a freetext entry lacking nutrition data and keeps the kcal sum correct', async () => {
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
      weekStart: '2026-06-01',
      weekEnd: '2026-06-07',
      entries: [
        entry('2026-06-01', recipe(1, 'Pasta', { calories: 400 }), 'dinner'),
        { id: '2', plannedDate: '2026-06-01', mealSlot: 'lunch', recipe: null, customTitle: 'Freitext ohne Angabe', calories: null, caloriesSnapshot: null },
      ],
    })

    expect(() => mount(MealPlanView, { global: { plugins: [i18n] } })).not.toThrow()
    const wrapper = mount(MealPlanView, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(wrapper.text()).toContain('400 kcal + 1 ohne Angabe / 2000 kcal')
  })

  it('week header shows an unknown-kcal hint when known kcal and 1 freetext meal without kcal exist', async () => {
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
      weekStart: '2026-06-01',
      weekEnd: '2026-06-07',
      entries: [
        entry('2026-06-01', recipe(1, 'Pasta', { calories: 600 }), 'dinner'),
        { id: '2', plannedDate: '2026-06-02', mealSlot: 'lunch', recipe: null, customTitle: 'Salat', calories: null, caloriesSnapshot: null },
      ],
    })

    const wrapper = mount(MealPlanView, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Schnitt pro Tag')
    expect(wrapper.text()).toContain('1 Mahlzeit ohne kcal-Angabe ist nicht in der Summe enthalten.')
  })

  it('week header shows the correct total count across multiple days with freetext meals without kcal', async () => {
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
      weekStart: '2026-06-01',
      weekEnd: '2026-06-07',
      entries: [
        entry('2026-06-01', recipe(1, 'Pasta', { calories: 600 }), 'dinner'),
        { id: '2', plannedDate: '2026-06-02', mealSlot: 'lunch', recipe: null, customTitle: 'Salat', calories: null, caloriesSnapshot: null },
        { id: '3', plannedDate: '2026-06-03', mealSlot: 'breakfast', recipe: null, customTitle: 'Müsli', calories: null, caloriesSnapshot: null },
        { id: '4', plannedDate: '2026-06-04', mealSlot: 'snack', recipe: null, customTitle: 'Obst', calories: null, caloriesSnapshot: null },
      ],
    })

    const wrapper = mount(MealPlanView, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(wrapper.text()).toContain('3 Mahlzeiten ohne kcal-Angabe sind nicht in der Summe enthalten.')
  })

  it('week header shows unchanged behavior (no hint) when only meals with known kcal exist', async () => {
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
      weekStart: '2026-06-01',
      weekEnd: '2026-06-07',
      entries: [
        entry('2026-06-01', recipe(1, 'Pasta', { calories: 600 }), 'dinner'),
        entry('2026-06-02', recipe(2, 'Salat', { calories: 300 }), 'lunch'),
      ],
    })

    const wrapper = mount(MealPlanView, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Schnitt pro Tag')
    expect(wrapper.text()).not.toContain('ohne kcal-Angabe')
  })

  it('week header does not show a misleading pure kcal sum when only freetext meals without kcal exist', async () => {
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
      weekStart: '2026-06-01',
      weekEnd: '2026-06-07',
      entries: [
        { id: '1', plannedDate: '2026-06-01', mealSlot: 'lunch', recipe: null, customTitle: 'Salat', calories: null, caloriesSnapshot: null },
        { id: '2', plannedDate: '2026-06-02', mealSlot: 'breakfast', recipe: null, customTitle: 'Müsli', calories: null, caloriesSnapshot: null },
      ],
    })

    const wrapper = mount(MealPlanView, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(wrapper.text()).toContain('2 Mahlzeiten ohne kcal-Angabe sind nicht in der Summe enthalten.')
    // Day cards still show their own correct per-day summary alongside the week header.
    expect(wrapper.text()).toContain('1 ohne Angabe / 2000 kcal')
  })

  it('switches between manual and swipe planning', async () => {
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })

    await flushPromises()

    expect(wrapper.findAll('.day-card')).toHaveLength(7)
    expect(wrapper.find('.swipe-planner').exists()).toBe(false)

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')

    expect(wrapper.findAll('.day-card')).toHaveLength(0)
    expect(wrapper.find('.swipe-planner').exists()).toBe(true)

    await wrapper.findAll('.mode-switch button').at(0)!.trigger('click')

    expect(wrapper.findAll('.day-card')).toHaveLength(7)
    expect(wrapper.find('.swipe-planner').exists()).toBe(false)
  })

  it('shows planned recipe and empty day state', async () => {
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Geplantes Rezept')
    expect(wrapper.text()).toContain('Pasta')
    expect(wrapper.text()).toContain('Noch kein Rezept geplant.')
  })

  it('keeps planned slots compact until edit is clicked', async () => {
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })

    await flushPromises()

    const mondayCard = wrapper.findAll('.day-card')
      .find(card => card.text().includes('Montag'))!
    const dinnerSlot = mondayCard.findAll('.slot-block')
      .find(slot => slot.text().includes('Abendessen'))!

    expect(dinnerSlot.text()).toContain('Pasta')
    expect(dinnerSlot.text()).toContain('Rezept ansehen')
    expect(dinnerSlot.text()).toContain('Bearbeiten')
    expect(dinnerSlot.find('input').exists()).toBe(false)
    expect(wrapper.find('.slot-modal').exists()).toBe(false)

    await dinnerSlot.findAll('button')
      .find(button => button.text().includes('Bearbeiten'))!
      .trigger('click')

    // Editing now happens in the shared modal, not inline inside the day card.
    expect(dinnerSlot.find('input').exists()).toBe(false)
    const modal = wrapper.find('.slot-modal')
    expect(modal.exists()).toBe(true)
    expect(modal.find('input').exists()).toBe(true)
    expect(modal.text()).toContain('Speichern')
    expect(modal.text()).toContain('Abbrechen')
    expect(modal.text()).toContain('Verschieben')
  })

  it('links planned own recipe to the recipe detail page', async () => {
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })

    await flushPromises()

    const recipeLink = wrapper.findAll('.planned-link')
      .find(link => link.text().includes('Rezept ansehen'))!
    expect(recipeLink.exists()).toBe(true)
    expect(recipeLink.attributes('href')).toBe('/recipe/1')
  })

  it('moves a planned recipe to another day and slot', async () => {
    vi.mocked(mealPlanApi.moveEntry).mockResolvedValue({
      weekStart: '2026-06-01',
      weekEnd: '2026-06-07',
      entries: [entry('2026-06-02', recipe(1, 'Pasta'), 'breakfast')],
    })
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })

    await flushPromises()

    const mondayCard = wrapper.findAll('.day-card')
      .find(card => card.text().includes('Montag'))!
    const editButton = mondayCard.findAll('button')
      .find(button => button.text().includes('Bearbeiten'))!
    await editButton.trigger('click')

    // Editing (including the move sub-form) now happens in the shared modal.
    const modal = wrapper.find('.slot-modal')
    const moveButton = modal.findAll('button')
      .find(button => button.text().includes('Verschieben'))!
    await moveButton.trigger('click')

    const selects = modal.findAll('.move-form select')
    await selects[0]!.setValue('2026-06-02')
    await selects[1]!.setValue('breakfast')
    await modal.find('.move-form').trigger('submit')
    await flushPromises()

    expect(mealPlanApi.moveEntry).toHaveBeenCalledWith('2026-06-01', {
      targetDate: '2026-06-02',
      targetSlot: 'breakfast',
      swapIfOccupied: true,
    })
    expect(mealPlanApi.setSlot).not.toHaveBeenCalled()
    expect(mealPlanApi.deleteSlot).not.toHaveBeenCalled()
    expect(useToastStore().toasts.some(t => t.type === 'success')).toBe(true)
    expect(wrapper.text()).toContain('Pasta')
  })

  it('drags a planned meal onto an empty slot and moves it there', async () => {
    vi.mocked(mealPlanApi.moveEntry).mockResolvedValue({
      weekStart: '2026-06-01',
      weekEnd: '2026-06-07',
      entries: [entry('2026-06-01', recipe(1, 'Pasta'), 'breakfast')],
    })
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const mondayCard = wrapper.findAll('.day-card').find(card => card.text().includes('Montag'))!
    const slotBlocks = mondayCard.findAll('.slot-block')
    const dinnerSlot = slotBlocks[2]! // breakfast, lunch, dinner, snack
    const breakfastSlot = slotBlocks[0]!
    const dragSource = dinnerSlot.find('.planned-recipe.compact')

    const dataTransfer = { effectAllowed: '', dropEffect: '', setData: vi.fn() }
    await dragSource.trigger('dragstart', { dataTransfer })
    expect(dragSource.classes()).toContain('dragging')

    await breakfastSlot.trigger('dragover', { dataTransfer })
    expect(breakfastSlot.classes()).toContain('drop-target-active')

    await breakfastSlot.trigger('drop', { dataTransfer })
    await flushPromises()

    expect(mealPlanApi.moveEntry).toHaveBeenCalledWith('2026-06-01', {
      targetDate: '2026-06-01',
      targetSlot: 'breakfast',
      swapIfOccupied: true,
    })
    expect(useToastStore().toasts.some(t => t.type === 'success')).toBe(true)
    expect(dragSource.classes()).not.toContain('dragging')
  })

  it('treats a successful drag swap reload as success and does not show a move error', async () => {
    const initialWeek = {
      weekStart: '2026-06-01',
      weekEnd: '2026-06-07',
      entries: [
        { ...entry('2026-06-01', recipe(1, 'Pasta'), 'dinner'), id: 'source-entry' },
        { ...entry('2026-06-02', recipe(2, 'Soup'), 'breakfast'), id: 'target-entry' },
      ],
    }
    const swappedWeek = {
      ...initialWeek,
      entries: [
        { ...entry('2026-06-02', recipe(1, 'Pasta'), 'breakfast'), id: 'source-entry' },
        { ...entry('2026-06-01', recipe(2, 'Soup'), 'dinner'), id: 'target-entry' },
      ],
    }
    vi.mocked(mealPlanApi.getWeek)
      .mockResolvedValueOnce(initialWeek)
      .mockResolvedValueOnce(swappedWeek)
    vi.mocked(mealPlanApi.moveEntry).mockRejectedValue(new Error('late network error'))

    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const mondayCard = wrapper.findAll('.day-card').find(card => card.text().includes('Montag'))!
    const tuesdayCard = wrapper.findAll('.day-card').find(card => card.text().includes('Dienstag'))!
    const dinnerSlot = mondayCard.findAll('.slot-block')[2]!
    const breakfastSlot = tuesdayCard.findAll('.slot-block')[0]!
    const dragSource = dinnerSlot.find('.planned-recipe.compact')
    const dataTransfer = { effectAllowed: '', dropEffect: '', setData: vi.fn() }

    await dragSource.trigger('dragstart', { dataTransfer })
    await breakfastSlot.trigger('drop', { dataTransfer })
    await flushPromises()

    expect(mealPlanApi.moveEntry).toHaveBeenCalledWith('source-entry', {
      targetDate: '2026-06-02',
      targetSlot: 'breakfast',
      swapIfOccupied: true,
    })
    expect(wrapper.text()).not.toContain('Der Wochenplan-Eintrag konnte nicht verschoben werden.')
    expect(useToastStore().toasts.some(t => t.type === 'success')).toBe(true)
  })

  it('does not move anything when a planned meal is dropped back onto its own slot', async () => {
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const mondayCard = wrapper.findAll('.day-card').find(card => card.text().includes('Montag'))!
    const dinnerSlot = mondayCard.findAll('.slot-block')[2]!
    const dragSource = dinnerSlot.find('.planned-recipe.compact')

    const dataTransfer = { effectAllowed: '', dropEffect: '', setData: vi.fn() }
    await dragSource.trigger('dragstart', { dataTransfer })
    await dinnerSlot.trigger('drop', { dataTransfer })
    await flushPromises()

    expect(mealPlanApi.moveEntry).not.toHaveBeenCalled()
  })

  it('sets an own recipe suggestion for a day', async () => {
    vi.useFakeTimers()
    vi.mocked(mealPlanApi.setSlot).mockResolvedValue(entry('2026-06-02', recipe(2, 'Soup', { calories: 380, protein: 18 }), 'breakfast'))
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const tuesdayCard = wrapper.findAll('.day-card')
      .find(card => card.text().includes('Dienstag'))!
    await openSlotModal(tuesdayCard, 0)
    const modal = wrapper.find('.slot-modal')
    await modal.find('input').setValue('sou')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    await modal.find('.suggestion-list button').trigger('click')
    await modal.find('.primary-button').trigger('click')
    await flushPromises()

    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-02', 'breakfast', 2)
    expect(wrapper.text()).toContain('Soup')
    expect(wrapper.text()).toContain('380 kcal / 2000 kcal')
    vi.useRealTimers()
  })

  it('sets custom title when no own recipe is selected', async () => {
    vi.mocked(mealPlanApi.setSlot).mockResolvedValue({
      id: 3,
      plannedDate: '2026-06-02',
      mealSlot: 'breakfast',
      recipe: null,
      customTitle: 'Sushi frei',
    })
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const tuesdayCard = wrapper.findAll('.day-card')
      .find(card => card.text().includes('Dienstag'))!
    await openSlotModal(tuesdayCard, 0)
    const modal = wrapper.find('.slot-modal')
    await modal.find('input').setValue('Sushi frei')
    await modal.find('.primary-button').trigger('click')
    await flushPromises()

    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-02', 'breakfast', {
      customTitle: 'Sushi frei',
      caloriesSnapshot: null,
      proteinSnapshot: null,
      imageUrlSnapshot: null,
      externalRecipeId: null,
      externalSource: null,
    })
    expect(wrapper.text()).toContain('Sushi frei')
  })

  it('shows a kcal input for freetext slots and sends caloriesSnapshot when filled', async () => {
    vi.mocked(mealPlanApi.setSlot).mockResolvedValue({
      id: 10,
      plannedDate: '2026-06-02',
      mealSlot: 'breakfast',
      recipe: null,
      customTitle: 'Pasta',
      caloriesSnapshot: 520,
    })
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const tuesdayCard = wrapper.findAll('.day-card').find(card => card.text().includes('Dienstag'))!
    await openSlotModal(tuesdayCard, 0)
    const modal = wrapper.find('.slot-modal')

    // kcal input is visible for freetext (no recipe selected)
    const caloriesInput = modal.find('input[type="number"]')
    expect(caloriesInput.exists()).toBe(true)
    expect(caloriesInput.attributes('min')).toBe('0')

    await modal.find('input[type="text"]').setValue('Pasta')
    await caloriesInput.setValue(520)
    await modal.find('.primary-button').trigger('click')
    await flushPromises()

    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-02', 'breakfast', expect.objectContaining({
      customTitle: 'Pasta',
      caloriesSnapshot: 520,
    }))
  })

  it('sends caloriesSnapshot null when kcal field is left empty', async () => {
    vi.mocked(mealPlanApi.setSlot).mockResolvedValue({
      id: 11, plannedDate: '2026-06-02', mealSlot: 'breakfast', recipe: null, customTitle: 'Pizza',
    })
    const wrapper = mount(MealPlanView, { global: { plugins: [i18n] } })
    await flushPromises()

    const tuesdayCard = wrapper.findAll('.day-card').find(c => c.text().includes('Dienstag'))!
    await openSlotModal(tuesdayCard, 0)
    const modal = wrapper.find('.slot-modal')
    await modal.find('input[type="text"]').setValue('Pizza')
    // kcal field left empty — do NOT fill the number input
    await modal.find('.primary-button').trigger('click')
    await flushPromises()

    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-02', 'breakfast', expect.objectContaining({
      customTitle: 'Pizza',
      caloriesSnapshot: null,
    }))
  })

  it('loads existing caloriesSnapshot into the kcal input when editing a freetext entry', async () => {
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
      weekStart: '2026-06-01',
      weekEnd: '2026-06-07',
      entries: [
        {
          id: 99, plannedDate: '2026-06-02', mealSlot: 'breakfast',
          recipe: null, customTitle: 'Salat', caloriesSnapshot: 180,
        },
      ],
    })
    const wrapper = mount(MealPlanView, { global: { plugins: [i18n] } })
    await flushPromises()

    const tuesdayCard = wrapper.findAll('.day-card').find(c => c.text().includes('Dienstag'))!
    // Click Bearbeiten to open the edit modal
    await tuesdayCard.find('.secondary-button').trigger('click')
    await flushPromises()

    const caloriesInput = wrapper.find('.slot-modal').find('input[type="number"]')
    expect(caloriesInput.exists()).toBe(true)
    expect((caloriesInput.element as HTMLInputElement).value).toBe('180')
  })

  it('sends caloriesSnapshot null when editing a freetext entry and clearing kcal', async () => {
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
      weekStart: '2026-06-01',
      weekEnd: '2026-06-07',
      entries: [
        {
          id: 99, plannedDate: '2026-06-02', mealSlot: 'breakfast',
          recipe: null, customTitle: 'Salat', caloriesSnapshot: 180,
        },
      ],
    })
    vi.mocked(mealPlanApi.setSlot).mockResolvedValue({
      id: 99, plannedDate: '2026-06-02', mealSlot: 'breakfast',
      recipe: null, customTitle: 'Salat', caloriesSnapshot: null,
    })
    const wrapper = mount(MealPlanView, { global: { plugins: [i18n] } })
    await flushPromises()

    const tuesdayCard = wrapper.findAll('.day-card').find(c => c.text().includes('Dienstag'))!
    await tuesdayCard.find('.secondary-button').trigger('click')
    await flushPromises()

    const modal = wrapper.find('.slot-modal')
    await modal.find('input[type="number"]').setValue('')
    await modal.find('.primary-button').trigger('click')
    await flushPromises()

    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-02', 'breakfast', expect.objectContaining({
      customTitle: 'Salat',
      caloriesSnapshot: null,
    }))
  })

  it('shows kcal in the planned slot display for freetext entries with caloriesSnapshot', async () => {
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
      weekStart: '2026-06-01',
      weekEnd: '2026-06-07',
      entries: [
        {
          id: 99, plannedDate: '2026-06-02', mealSlot: 'breakfast',
          recipe: null, customTitle: 'Lasagne', caloriesSnapshot: 650,
        },
      ],
    })
    const wrapper = mount(MealPlanView, { global: { plugins: [i18n] } })
    await flushPromises()

    const tuesdayCard = wrapper.findAll('.day-card').find(c => c.text().includes('Dienstag'))!
    expect(tuesdayCard.text()).toContain('650 kcal')
  })

  it('sets custom titles for breakfast, lunch, dinner and snack', async () => {
    vi.mocked(mealPlanApi.setSlot).mockImplementation(async (date, slot, payload) => ({
      id: `${date}-${slot}`,
      plannedDate: date,
      mealSlot: slot,
      recipe: null,
      customTitle: typeof payload === 'number' ? null : payload.customTitle,
    }))
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    let mondayCard = wrapper.findAll('.day-card')
      .find(card => card.text().includes('Montag'))!
    await openSlotModal(mondayCard, 0)
    let modal = wrapper.find('.slot-modal')
    await modal.find('input').setValue('Fruehstueck frei')
    await modal.find('.primary-button').trigger('click')
    await flushPromises()

    mondayCard = wrapper.findAll('.day-card')
      .find(card => card.text().includes('Montag'))!
    await openSlotModal(mondayCard, 1)
    modal = wrapper.find('.slot-modal')
    await modal.find('input').setValue('Lunch frei')
    await modal.find('.primary-button').trigger('click')
    await flushPromises()

    mondayCard = wrapper.findAll('.day-card')
      .find(card => card.text().includes('Montag'))!
    await openSlotModal(mondayCard, 2)
    modal = wrapper.find('.slot-modal')
    await modal.find('input').setValue('Dinner frei')
    await modal.find('.primary-button').trigger('click')
    await flushPromises()

    mondayCard = wrapper.findAll('.day-card')
      .find(card => card.text().includes('Montag'))!
    await openSlotModal(mondayCard, 3)
    modal = wrapper.find('.slot-modal')
    await modal.find('input').setValue('Snack frei')
    await modal.find('.primary-button').trigger('click')
    await flushPromises()

    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-01', 'breakfast', {
      customTitle: 'Fruehstueck frei',
      caloriesSnapshot: null,
      proteinSnapshot: null,
      imageUrlSnapshot: null,
      externalRecipeId: null,
      externalSource: null,
    })
    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-01', 'lunch', {
      customTitle: 'Lunch frei',
      caloriesSnapshot: null,
      proteinSnapshot: null,
      imageUrlSnapshot: null,
      externalRecipeId: null,
      externalSource: null,
    })
    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-01', 'dinner', {
      customTitle: 'Dinner frei',
      caloriesSnapshot: null,
      proteinSnapshot: null,
      imageUrlSnapshot: null,
      externalRecipeId: null,
      externalSource: null,
    })
    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-01', 'snack', {
      customTitle: 'Snack frei',
      caloriesSnapshot: null,
      proteinSnapshot: null,
      imageUrlSnapshot: null,
      externalRecipeId: null,
      externalSource: null,
    })
  })

  it('uses public database suggestions as real recipe links with nutrition', async () => {
    vi.useFakeTimers()
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(99, 'Sushi Bowl', {
        calories: 450,
        protein: 24,
        imageUrl: 'https://example.com/sushi.jpg',
        externalId: 'seed-99',
        source: 'dishly',
        userCreated: false,
      }),
    ])
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const tuesdayCard = wrapper.findAll('.day-card')
      .find(card => card.text().includes('Dienstag'))!
    await openSlotModal(tuesdayCard, 0)
    const modal = wrapper.find('.slot-modal')
    await modal.find('input').setValue('sushi')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    const localButton = modal.findAll('.suggestion-list button')
      .find(button => button.text().includes('Dishly-Rezept'))!
    expect(localButton.text()).toContain('450 kcal')
    expect(localButton.text()).toContain('24 g Protein')
    await localButton.trigger('click')

    expect(wrapper.text()).not.toContain('Dieser Vorschlag wird mit Kalorien/Protein als Freitext gespeichert.')
    expect((modal.find('input').element as HTMLInputElement).value).toBe('Sushi Bowl')
    vi.mocked(mealPlanApi.setSlot).mockResolvedValue({
      id: 9,
      plannedDate: '2026-06-02',
      mealSlot: 'breakfast',
      recipe: recipe(99, 'Sushi Bowl', { calories: 450, protein: 24 }),
      customTitle: null,
      calories: 450,
    })
    await modal.find('.primary-button').trigger('click')
    await flushPromises()
    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-02', 'breakfast', 99)
    expect(wrapper.text()).toContain('450 kcal / 2000 kcal')
    expect(wrapper.findAll('.planned-link').some(link => link.attributes('href') === '/recipe/99')).toBe(true)
    vi.useRealTimers()
  })

  it('loads and limits randomized German autocomplete suggestions to five', async () => {
    vi.useFakeTimers()
    const matches = Array.from({ length: 6 }, (_, index) => (
      recipe(100 + index, `Sushi ${index + 1}`, { userCreated: false, language: 'de' })
    ))
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue(matches)
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    vi.mocked(recipeApi.getPublishedRecipes).mockClear()

    await openSlotModal(wrapper.findAll('.day-card').at(1)!, 0)
    const modal = wrapper.find('.slot-modal')
    const input = modal.find('input')
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99)
    await input.setValue('sush')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    const firstSuggestions = modal.findAll('.suggestion-list button')
    expect(recipeApi.getPublishedRecipes).toHaveBeenCalledWith('de', 'sush')
    expect(firstSuggestions).toHaveLength(5)
    expect(firstSuggestions.map(button => button.text())).toEqual(expect.arrayContaining([
      expect.stringContaining('Sushi 1'),
      expect.stringContaining('Sushi 5'),
    ]))
    expect(firstSuggestions.map(button => button.text()).join(' ')).not.toContain('Sushi 6')

    randomSpy.mockReturnValue(0)
    await input.setValue('')
    await input.setValue('sush')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    const secondSuggestions = modal.findAll('.suggestion-list button')
    expect(secondSuggestions).toHaveLength(5)
    expect(secondSuggestions.map(button => button.text()).join(' ')).toContain('Sushi 6')
    expect(secondSuggestions.map(button => button.text())).not.toEqual(firstSuggestions.map(button => button.text()))
    randomSpy.mockRestore()
  })

  it('uses the English locale for autocomplete searches', async () => {
    vi.useFakeTimers()
    setLocale('en')
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(110, 'Pasta Primavera', { userCreated: false, language: 'en' }),
    ])
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    vi.mocked(recipeApi.getPublishedRecipes).mockClear()

    await openSlotModal(wrapper.findAll('.day-card').at(1)!, 0)
    const input = wrapper.find('.slot-modal').find('input')
    await input.setValue('pasta')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(recipeApi.getPublishedRecipes).toHaveBeenCalledWith('en', 'pasta')
    expect(wrapper.text()).toContain('Pasta Primavera')
  })

  it('does not search when the autocomplete query is cleared', async () => {
    vi.useFakeTimers()
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    vi.mocked(recipeApi.getPublishedRecipes).mockClear()

    await openSlotModal(wrapper.findAll('.day-card').at(1)!, 0)
    const modal = wrapper.find('.slot-modal')
    const input = modal.find('input')
    vi.mocked(recipeApi.getPublishedRecipes).mockClear()
    await input.setValue('sush')
    await input.setValue('')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(recipeApi.getPublishedRecipes).not.toHaveBeenCalledWith('de', '')
    expect(recipeApi.getPublishedRecipes).not.toHaveBeenCalledWith('de', 'sush')
    expect(modal.find('.suggestion-list').exists()).toBe(false)
  })

  it('keeps free-text planning available when autocomplete loading fails', async () => {
    vi.useFakeTimers()
    vi.mocked(recipeApi.getPublishedRecipes).mockImplementation(async (_language, search) => {
      if (search) throw new Error('search unavailable')
      return []
    })
    vi.mocked(mealPlanApi.setSlot).mockResolvedValue({
      id: 11,
      plannedDate: '2026-06-02',
      mealSlot: 'breakfast',
      recipe: null,
      customTitle: 'Sushi frei',
    })
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const tuesdayCard = wrapper.findAll('.day-card').at(1)!
    await openSlotModal(tuesdayCard, 0)
    const modal = wrapper.find('.slot-modal')
    await modal.find('input').setValue('Sushi frei')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(modal.text()).toContain('Vorschläge konnten nicht geladen werden. Freitext bleibt möglich.')
    await modal.find('.primary-button').trigger('click')
    await flushPromises()
    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-02', 'breakfast', {
      customTitle: 'Sushi frei',
      caloriesSnapshot: null,
      proteinSnapshot: null,
      imageUrlSnapshot: null,
      externalRecipeId: null,
      externalSource: null,
    })
  })

  it('loads swipe suggestions with profile filters and bucket counters', async () => {
    setLocale('en')
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(99, 'Dinner Pasta', { imageUrl: 'https://example.com/pasta.jpg', calories: 520 }),
    ])
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    await wrapper.find('.swipe-planner .primary-button').trigger('click')
    await flushPromises()

    expect(recipeApi.getExternalRecipes).toHaveBeenCalledWith(undefined, {
      vegan: undefined,
      vegetarian: true,
      glutenFree: true,
      maxPrepTime: 30,
    }, 'en')
    expect(wrapper.text()).toContain('Dinner Pasta')
    expect(wrapper.text()).toContain('1/1')
  })

  it('shows swipe suggestions even without ingredients', async () => {
    setLocale('en')
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(98, 'Invalid Local Suggestion', { ingredients: '' }),
    ])
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(99, 'Invalid External Suggestion', { ingredients: '' }),
    ])
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    await wrapper.find('.swipe-planner .primary-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Invalid Local Suggestion')
    expect(wrapper.text()).not.toContain('Keine Vorschläge gefunden.')
  })

  it('filters swipe suggestions that conflict with allergies or explicit diet flags', async () => {
    vi.mocked(profileApi.getPreferences).mockResolvedValue({
      likes: [],
      dislikes: [],
      allergies: ['Eier'],
      vegan: true,
      vegetarian: true,
      glutenFree: false,
      lactoseFree: false,
      highProtein: false,
      calorieConscious: false,
      budgetFriendly: false,
      maxPrepTimeMinutes: null,
      calorieGoal: null,
      dailyCalorieTarget: 2000,
    })
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(10, 'Vegane Bowl', { ingredients: 'Reis, Gemüse', vegan: true, vegetarian: true }),
      recipe(11, 'Eier Pasta', { ingredients: 'Ei, Nudeln', vegan: true, vegetarian: true }),
      recipe(12, 'Chicken Pasta', { ingredients: 'Huhn, Nudeln', vegan: false, vegetarian: false }),
    ])
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    await wrapper.find('.swipe-planner .primary-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Vegane Bowl')
    expect(wrapper.text()).not.toContain('Eier Pasta')
    expect(wrapper.text()).not.toContain('Chicken Pasta')
  })

  it('opens and closes bucket panels from real week state', async () => {
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    const dinnerBucket = wrapper.findAll('.bucket-card')
      .find(button => button.text().includes('Abendessen'))!
    await dinnerBucket.trigger('click')

    expect(wrapper.find('.bucket-panel').text()).toContain('Pasta')
    expect(wrapper.find('.bucket-panel').text()).toContain('Montag')
    expect(wrapper.find('.bucket-panel').text()).toContain('2026-06-01')
    expect(wrapper.find('.bucket-panel').text()).toContain('600 kcal')
    expect(wrapper.find('.bucket-panel').text()).toContain('24 g Protein')

    await dinnerBucket.trigger('click')
    expect(wrapper.find('.bucket-panel').exists()).toBe(false)

    const breakfastBucket = wrapper.findAll('.bucket-card')
      .find(button => button.text().includes('Frühstück'))!
    await breakfastBucket.trigger('click')
    expect(wrapper.find('.bucket-panel').text()).toContain('Noch keine Rezepte in diesem Bucket.')
  })

  it('removes an entry from an opened bucket panel and updates the counter', async () => {
    vi.mocked(mealPlanApi.deleteSlot).mockResolvedValue()
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    const dinnerBucket = wrapper.findAll('.bucket-card')
      .find(button => button.text().includes('Abendessen'))!
    expect(dinnerBucket.text()).toContain('1/7')
    await dinnerBucket.trigger('click')

    const removeButton = wrapper.findAll('.bucket-panel .secondary-button')
      .find(button => button.text().includes('Entfernen'))!
    await removeButton.trigger('click')
    await flushPromises()

    expect(mealPlanApi.deleteSlot).toHaveBeenCalledWith('2026-06-01', 'dinner')
    expect(useToastStore().toasts.some(t => t.type === 'info')).toBe(true)
    expect(wrapper.find('.bucket-panel').text()).toContain('Noch keine Rezepte in diesem Bucket.')
    const updatedDinnerBucket = wrapper.findAll('.bucket-card')
      .find(button => button.text().includes('Abendessen'))!
    expect(updatedDinnerBucket.text()).toContain('0/7')
  })

  it('skips to the next swipe suggestion', async () => {
    setLocale('en')
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99)
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(99, 'Pizza'),
      recipe(100, 'Burger'),
    ])
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    await wrapper.find('.swipe-planner .primary-button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Pizza')

    await wrapper.findAll('.swipe-card .secondary-button').at(0)!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Burger')
    expect(wrapper.text()).toContain('2/2')
    randomSpy.mockRestore()
  })

  it('accepts swipe suggestion as customTitle', async () => {
    setLocale('en')
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(99, 'Pizza', { calories: 700, protein: 32.4, imageUrl: 'https://example.com/pizza.jpg', externalId: 'ext-pizza', source: 'spoonacular' }),
    ])
    vi.mocked(mealPlanApi.setSlot).mockResolvedValue({
      id: 4,
      plannedDate: '2026-06-01',
      mealSlot: 'dinner',
      recipe: null,
      customTitle: 'Pizza',
      calories: 700,
      caloriesSnapshot: 700,
      proteinSnapshot: 32.4,
    })
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    await wrapper.find('.swipe-planner .primary-button').trigger('click')
    await flushPromises()
    await wrapper.findAll('.swipe-card .primary-button').at(0)!.trigger('click')
    await flushPromises()

    expect(mealPlanApi.setSlot).toHaveBeenCalledWith('2026-06-02', 'dinner', {
      customTitle: 'Pizza',
      caloriesSnapshot: 700,
      proteinSnapshot: 32.4,
      imageUrlSnapshot: 'https://example.com/pizza.jpg',
      externalRecipeId: 'ext-pizza',
      externalSource: 'spoonacular',
    })
    expect(wrapper.text()).toContain('32 g Protein')
    expect(useToastStore().toasts.some(t => t.type === 'success')).toBe(true)
  })

  it('keeps bucket panel closed after accepting a suggestion into a full bucket', async () => {
    setLocale('en')
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
      weekStart: '2026-06-01',
      weekEnd: '2026-06-07',
      entries: [
        entry('2026-06-01', recipe(1, 'Dinner 1'), 'dinner'),
        entry('2026-06-02', recipe(2, 'Dinner 2'), 'dinner'),
        entry('2026-06-03', recipe(3, 'Dinner 3'), 'dinner'),
        entry('2026-06-04', recipe(4, 'Dinner 4'), 'dinner'),
      ],
    })
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(99, 'Pizza', { calories: 700 }),
    ])
    vi.mocked(mealPlanApi.setSlot).mockResolvedValue({
      id: 4,
      plannedDate: '2026-06-05',
      mealSlot: 'dinner',
      recipe: null,
      customTitle: 'Pizza',
      calories: 700,
      caloriesSnapshot: 700,
    })
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    await wrapper.find('.swipe-planner .primary-button').trigger('click')
    await flushPromises()
    await wrapper.findAll('.swipe-card .primary-button').at(0)!.trigger('click')
    await flushPromises()

    expect(wrapper.find('.bucket-panel').exists()).toBe(false)
  })

  it('replaces a full bucket entry with the current swipe suggestion and advances after success', async () => {
    setLocale('en')
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99)
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
      weekStart: '2026-06-01',
      weekEnd: '2026-06-07',
      entries: [
        entry('2026-06-01', recipe(1, 'Dinner 1'), 'dinner'),
        entry('2026-06-02', recipe(2, 'Dinner 2'), 'dinner'),
        entry('2026-06-03', recipe(3, 'Dinner 3'), 'dinner'),
        entry('2026-06-04', recipe(4, 'Dinner 4'), 'dinner'),
        entry('2026-06-05', recipe(5, 'Dinner 5'), 'dinner'),
        entry('2026-06-06', recipe(6, 'Dinner 6'), 'dinner'),
      ],
    })
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(99, 'Pizza', { calories: 700 }),
      recipe(100, 'Burger', { calories: 650 }),
      recipe(101, 'Taco', { calories: 590 }),
    ])
    vi.mocked(mealPlanApi.setSlot)
      .mockResolvedValueOnce({
        id: 99,
        plannedDate: '2026-06-07',
        mealSlot: 'dinner',
        recipe: null,
        customTitle: 'Pizza',
        calories: 700,
        caloriesSnapshot: 700,
      })
      .mockResolvedValueOnce({
        id: 100,
        plannedDate: '2026-06-01',
        mealSlot: 'dinner',
        recipe: null,
        customTitle: 'Burger',
        calories: 650,
        caloriesSnapshot: 650,
      })

    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    await wrapper.find('.swipe-planner .primary-button').trigger('click')
    await flushPromises()
    await wrapper.findAll('.swipe-card .primary-button').at(0)!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Dein Abendessen-Bucket ist voll')
    const editBucketButton = wrapper.findAll('button').find(button => button.text().includes('Bucket bearbeiten'))!
    await editBucketButton.trigger('click')

    const bucketPanel = wrapper.find('.bucket-panel')
    expect(bucketPanel.text()).toContain('Aktueller Vorschlag: Burger')
    expect(bucketPanel.text()).toContain('Dinner 1')
    expect(bucketPanel.text()).toContain('Mit aktuellem Rezept ersetzen')
    expect(wrapper.text()).toContain('2/3')

    const replaceButton = wrapper.findAll('.bucket-panel .primary-button')
      .find(button => button.text().includes('Mit aktuellem Rezept ersetzen'))!
    await replaceButton.trigger('click')
    await flushPromises()
    await flushPromises()

    expect(mealPlanApi.deleteSlot).toHaveBeenCalledWith('2026-06-01', 'dinner')
    expect(mealPlanApi.setSlot).toHaveBeenLastCalledWith('2026-06-01', 'dinner', {
      customTitle: 'Burger',
      caloriesSnapshot: 650,
      proteinSnapshot: 24,
      imageUrlSnapshot: '',
      externalRecipeId: '100',
      externalSource: 'dishly-public',
    })
    expect(wrapper.find('.bucket-panel').exists()).toBe(false)
    expect(wrapper.find('.swipe-card').exists()).toBe(true)
    expect(wrapper.text()).toContain('Taco')
    expect(wrapper.text()).toContain('3/3')
    randomSpy.mockRestore()
  })

  it('uses published database recipes before calling external swipe suggestions', async () => {
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([
      recipe(88, 'DB Lunch Bowl', { category: 'lunch', calories: 530 }),
    ])
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    await wrapper.find('.swipe-planner .primary-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('DB Lunch Bowl')
    expect(recipeApi.getExternalRecipes).not.toHaveBeenCalledWith(undefined, {
      vegan: undefined,
      vegetarian: true,
      glutenFree: true,
      maxPrepTime: 30,
    })
  })

  it('shows empty state when swipe suggestions are empty', async () => {
    setLocale('en')
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([])
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    await wrapper.find('.swipe-planner .primary-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Keine Vorschläge gefunden.')
  })

  it('shows error when swipe suggestions fail', async () => {
    setLocale('en')
    vi.mocked(recipeApi.getExternalRecipes).mockRejectedValue(new Error('Spoonacular unavailable'))
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    await wrapper.find('.swipe-planner .primary-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Vorschläge konnten nicht geladen werden.')
  })

  it('does not load external swipe suggestions for German locale', async () => {
    vi.mocked(recipeApi.getPublishedRecipes).mockResolvedValue([])
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    await wrapper.find('.swipe-planner .primary-button').trigger('click')
    await flushPromises()

    expect(recipeApi.getPublishedRecipes).toHaveBeenCalledWith('de')
    expect(recipeApi.getExternalRecipes).not.toHaveBeenCalledWith(undefined, {
      vegan: undefined,
      vegetarian: true,
      glutenFree: true,
      maxPrepTime: 30,
    }, 'en')
    expect(wrapper.text()).toContain('Für diese Sprache sind noch keine lokalen Rezepte verfügbar.')
  })

  it('hides full bucket suggestions when one swipe bucket has no free date', async () => {
    setLocale('en')
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue(fullSlotWeekResponse('dinner'))
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(99, 'Dinner Pasta'),
    ])
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')
    await wrapper.find('.swipe-planner .primary-button').trigger('click')
    await flushPromises()
    expect(mealPlanApi.setSlot).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Keine Vorschläge gefunden.')
  })

  it('shows completion message when all swipe buckets are full', async () => {
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue(fullWeekResponse())
    vi.mocked(recipeApi.getExternalRecipes).mockResolvedValue([
      recipe(99, 'Dinner Pasta'),
    ])
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()
    await flushPromises()

    await wrapper.findAll('.mode-switch button').at(1)!.trigger('click')

    expect(mealPlanApi.setSlot).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Glückwunsch! Deine Woche ist vollständig geplant.')
    expect(wrapper.find('.swipe-card').exists()).toBe(false)
    expect(wrapper.text()).toContain('Rezepte verwalten')
  })

  it('clears all 28 week slots and reloads the week', async () => {
    vi.mocked(mealPlanApi.getWeek)
      .mockResolvedValueOnce(weekResponse())
      .mockResolvedValueOnce(emptyWeekResponse())
    vi.mocked(mealPlanApi.deleteSlot).mockResolvedValue()
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    await wrapper.find('.clear-week-button').trigger('click')
    await flushPromises()

    expect(mealPlanApi.deleteSlot).toHaveBeenCalledTimes(28)
    expect(mealPlanApi.deleteSlot).toHaveBeenCalledWith('2026-06-01', 'breakfast')
    expect(mealPlanApi.deleteSlot).toHaveBeenCalledWith('2026-06-01', 'lunch')
    expect(mealPlanApi.deleteSlot).toHaveBeenCalledWith('2026-06-01', 'dinner')
    expect(mealPlanApi.deleteSlot).toHaveBeenCalledWith('2026-06-07', 'snack')
    expect(mealPlanApi.getWeek).toHaveBeenLastCalledWith('2026-06-01')
    expect(useToastStore().toasts.some(t => t.message.includes('geleert') || t.type === 'info')).toBe(true)
    expect(wrapper.text()).not.toContain('Pasta')
  })

  it('creates a shopping list from the current week and shows a detailed toast', async () => {
    vi.mocked(mealPlanApi.createShoppingListFromWeek).mockResolvedValue({
      added: [{ name: 'Tomaten', quantity: 200, unit: 'g', recipeTitle: 'Pasta' }],
      skippedBecauseInPantry: [{ name: 'Eier', quantity: 2, unit: 'Stück', recipeTitle: 'Omelett' }],
      needsReview: [{ name: 'Butter', quantity: 1, unit: 'EL', recipeTitle: 'Pasta', reason: 'Einheiten sind nicht sicher vergleichbar.' }],
      alreadyOnShoppingList: [{ name: 'Reis', quantity: 200, unit: 'g', recipeTitle: 'Bowl' }],
    })
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const createButton = wrapper.findAll('button')
      .find(button => button.text().includes('Einkaufsliste aus Wochenplan erstellen'))!
    await createButton.trigger('click')
    await flushPromises()

    expect(mealPlanApi.createShoppingListFromWeek).toHaveBeenCalledWith('2026-06-01')
    const toasts = useToastStore().toasts
    expect(toasts.some(t => t.type === 'success')).toBe(true)
    const successToast = toasts.find(t => t.type === 'success')!
    expect(successToast.message).toContain('1 zur Einkaufsliste hinzugefügt')
    expect(successToast.message).toContain('1 durch Vorrat abgedeckt')
    expect(successToast.message).toContain('1 bereits auf der Einkaufsliste')
    expect(successToast.message).not.toContain('zum Prüfen')
    expect(wrapper.find('.shopping-list-result').exists()).toBe(false)
  })

  it('shows a toast with only added count when other categories are empty', async () => {
    vi.mocked(mealPlanApi.createShoppingListFromWeek).mockResolvedValue({
      added: [{ name: 'Tomaten', quantity: 200, unit: 'g', recipeTitle: 'Pasta' }],
      skippedBecauseInPantry: [],
      needsReview: [],
      alreadyOnShoppingList: [],
    })
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const createButton = wrapper.findAll('button')
      .find(button => button.text().includes('Einkaufsliste aus Wochenplan erstellen'))!
    await createButton.trigger('click')
    await flushPromises()

    const toasts = useToastStore().toasts
    const successToast = toasts.find(t => t.type === 'success')!
    expect(successToast.message).toContain('1 zur Einkaufsliste hinzugefügt')
    expect(successToast.message).not.toContain('durch Vorrat abgedeckt')
    expect(successToast.message).not.toContain('bereits auf der Einkaufsliste')
    expect(successToast.message).not.toContain('zum Prüfen')
    expect(wrapper.find('.shopping-list-result').exists()).toBe(false)
  })

  it('treats 404 while clearing already empty slots as success when the reloaded week is empty', async () => {
    vi.mocked(mealPlanApi.getWeek)
      .mockResolvedValueOnce(weekResponse())
      .mockResolvedValueOnce(emptyWeekResponse())
    vi.mocked(mealPlanApi.deleteSlot).mockImplementation(async (_date, slot) => {
      if (slot === 'breakfast' || slot === 'lunch' || slot === 'snack') {
        throw new ApiClientError('Not Found', 404)
      }
    })
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    await wrapper.find('.clear-week-button').trigger('click')
    await flushPromises()

    expect(mealPlanApi.deleteSlot).toHaveBeenCalledTimes(28)
    expect(useToastStore().toasts.some(t => t.type === 'info')).toBe(true)
    expect(wrapper.text()).not.toContain('Einige Slots konnten nicht gelöscht werden.')
    expect(wrapper.text()).not.toContain('Pasta')
  })

  it('shows a visible error when clearing the week fails', async () => {
    vi.mocked(mealPlanApi.deleteSlot).mockRejectedValue(new Error('delete failed'))
    vi.mocked(mealPlanApi.getWeek).mockResolvedValue(weekResponse())
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    await wrapper.find('.clear-week-button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Einige Slots konnten nicht gelöscht werden.')
  })

  it('removes a planned recipe', async () => {
    vi.mocked(mealPlanApi.deleteSlot).mockResolvedValue()
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const removeButton = wrapper.findAll('button')
      .find(button => button.text().includes('Entfernen'))!
    await removeButton.trigger('click')
    await flushPromises()

    expect(mealPlanApi.deleteSlot).toHaveBeenCalledWith('2026-06-01', 'dinner')
    expect(wrapper.findAll('button').some(button => button.text().includes('Entfernen'))).toBe(false)
  })

  it('shows empty state when no own recipes exist', async () => {
    vi.mocked(recipeApi.getMyRecipes).mockResolvedValue([])
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Du hast noch keine eigenen Rezepte zum Planen.')
  })

  it('renders English labels', async () => {
    setLocale('en')
    const wrapper = mount(MealPlanView, {
      global: { plugins: [i18n] },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Meal Plan')
    expect(wrapper.text()).toContain('Monday')

    const mondayCard = wrapper.findAll('.day-card').find(card => card.text().includes('Monday'))!
    await openSlotModal(mondayCard, 0)
    expect(wrapper.text()).toContain('Rezept suchen oder Freitext eingeben')
  })

  // ─── PDF export / totalCalories tests ────────────────────────────────────────

  it('PDF button is visible when week is loaded', async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
    const wrapper = mount(MealPlanView)
    await flushPromises()

    const pdfBtn = wrapper.findAll('button').find(b => b.text().includes('PDF'))
    expect(pdfBtn).toBeTruthy()
  })

  it('uses backend totalCalories when positive', async () => {
    vi.useFakeTimers()
    try {
      sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
      vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
        weekStart: '2026-06-01',
        weekEnd: '2026-06-07',
        entries: [entry('2026-06-01', recipe(1, 'Pasta', { calories: 500 }), 'dinner')],
        totalCalories: 1200,
      })

      const wrapper = mount(MealPlanView)
      await flushPromises()

      const pdfBtn = wrapper.findAll('button').find(b => b.text().includes('PDF'))!
      await pdfBtn.trigger('click')
      vi.runAllTimers()

      expect(vi.mocked(printMealPlan)).toHaveBeenCalledTimes(1)
      const [, totalCal] = vi.mocked(printMealPlan).mock.calls[0]!
      expect(totalCal).toBe(1200)
    } finally {
      vi.useRealTimers()
    }
  })

  it('falls back to sum of day totals when backend totalCalories is 0', async () => {
    vi.useFakeTimers()
    try {
      sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
      vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
        weekStart: '2026-06-01',
        weekEnd: '2026-06-07',
        entries: [
          entry('2026-06-01', recipe(1, 'Pasta', { calories: 523 }), 'dinner'),
          entry('2026-06-02', recipe(2, 'Salad', { calories: 1447 }), 'lunch'),
        ],
        totalCalories: 0,
      })

      const wrapper = mount(MealPlanView)
      await flushPromises()

      const pdfBtn = wrapper.findAll('button').find(b => b.text().includes('PDF'))!
      await pdfBtn.trigger('click')
      vi.runAllTimers()

      expect(vi.mocked(printMealPlan)).toHaveBeenCalledTimes(1)
      const [days, totalCal] = vi.mocked(printMealPlan).mock.calls[0]!
      expect(totalCal).toBe(1970)
      expect(days.some(d => d.totalCalories != null && d.totalCalories > 0)).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('falls back to sum of entry calories when day totals are also 0', async () => {
    vi.useFakeTimers()
    try {
      sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
      vi.mocked(mealPlanApi.getWeek).mockResolvedValue({
        weekStart: '2026-06-01',
        weekEnd: '2026-06-07',
        entries: [
          { id: '1', plannedDate: '2026-06-01', mealSlot: 'dinner', recipe: recipe(1, 'Pasta', { calories: 300 }), calories: 300, caloriesSnapshot: 300 },
        ],
        totalCalories: 0,
        caloriesByDate: {},
      })

      const wrapper = mount(MealPlanView)
      await flushPromises()

      const pdfBtn = wrapper.findAll('button').find(b => b.text().includes('PDF'))!
      await pdfBtn.trigger('click')
      vi.runAllTimers()

      expect(vi.mocked(printMealPlan)).toHaveBeenCalledTimes(1)
      const [, totalCal] = vi.mocked(printMealPlan).mock.calls[0]!
      expect(totalCal).toBeGreaterThan(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('passes null totalCalories when no calorie data exists', async () => {
    vi.useFakeTimers()
    try {
      sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'jwt-token')
      vi.mocked(mealPlanApi.getWeek).mockResolvedValue(emptyWeekResponse())

      const wrapper = mount(MealPlanView)
      await flushPromises()

      const pdfBtn = wrapper.findAll('button').find(b => b.text().includes('PDF'))!
      await pdfBtn.trigger('click')
      vi.runAllTimers()

      expect(vi.mocked(printMealPlan)).toHaveBeenCalledTimes(1)
      const [, totalCal] = vi.mocked(printMealPlan).mock.calls[0]!
      expect(totalCal).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

function weekResponse(): MealPlanWeekResponse {
  return {
    weekStart: '2026-06-01',
    weekEnd: '2026-06-07',
    entries: [entry('2026-06-01', recipe(1, 'Pasta'), 'dinner')],
  }
}

function emptyWeekResponse(): MealPlanWeekResponse {
  return {
    weekStart: '2026-06-01',
    weekEnd: '2026-06-07',
    entries: [],
  }
}

function fullSlotWeekResponse(mealSlot = 'dinner'): MealPlanWeekResponse {
  const dates = [
    '2026-06-01',
    '2026-06-02',
    '2026-06-03',
    '2026-06-04',
    '2026-06-05',
    '2026-06-06',
    '2026-06-07',
  ]
  return {
    weekStart: '2026-06-01',
    weekEnd: '2026-06-07',
    entries: dates.map((date, index) => entry(date, recipe(200 + index, `Dinner ${index}`), mealSlot)),
  }
}

function fullWeekResponse(): MealPlanWeekResponse {
  const dates = [
    '2026-06-01',
    '2026-06-02',
    '2026-06-03',
    '2026-06-04',
    '2026-06-05',
    '2026-06-06',
    '2026-06-07',
  ]
  const slots = ['breakfast', 'lunch', 'dinner', 'snack']
  return {
    weekStart: '2026-06-01',
    weekEnd: '2026-06-07',
    entries: slots.flatMap((slot, slotIndex) => (
      dates.map((date, index) => entry(date, recipe(300 + slotIndex * 10 + index, `${slot} ${index}`), slot))
    )),
  }
}

function entry(plannedDate: string, recipeResponse: RecipeResponse, mealSlot = 'dinner') {
  return {
    id: plannedDate,
    plannedDate,
    mealSlot,
    recipe: recipeResponse,
    calories: recipeResponse.calories,
  }
}

function recipe(id: number, title: string, overrides: Partial<RecipeResponse> = {}): RecipeResponse {
  return {
    id,
    title,
    imageUrl: '',
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    servings: 2,
    difficulty: 'easy',
    category: 'Italian',
    rating: 4.5,
    ingredients: 'noodles',
    instructions: 'cook',
    favorite: false,
    published: true,
    calories: 600,
    protein: 24,
    ...overrides,
  }
}
