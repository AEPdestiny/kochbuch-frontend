import { describe, it, expect, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import SuggestInput from '@/components/SuggestInput.vue'

enableAutoUnmount(afterEach)

const UNITS = ['g', 'kg', 'ml', 'l', 'piece', 'tbsp', 'tsp', 'cup']
const NAMES = ['Basmati rice', 'Jasmine rice', 'Chicken breast', 'Olive oil', 'Parmesan']

describe('SuggestInput.vue', () => {
  describe('name-field mode (showSuggestionsOnFocus = false, default)', () => {
    it('shows no suggestions on initial render', () => {
      const wrapper = mount(SuggestInput, { props: { modelValue: '', suggestions: NAMES } })
      expect(wrapper.find('.suggest-dropdown').exists()).toBe(false)
    })

    it('shows no suggestions when focused without typing', async () => {
      const wrapper = mount(SuggestInput, { props: { modelValue: '', suggestions: NAMES } })
      await wrapper.find('input').trigger('focus')
      expect(wrapper.find('.suggest-dropdown').exists()).toBe(false)
    })

    it('shows filtered suggestions after typing (≥ 1 char)', async () => {
      const wrapper = mount(SuggestInput, { props: { modelValue: 'rice', suggestions: NAMES } })
      await wrapper.find('input').trigger('focus')
      const dropdown = wrapper.find('.suggest-dropdown')
      expect(dropdown.exists()).toBe(true)
      expect(dropdown.text()).toContain('Basmati rice')
      expect(dropdown.text()).toContain('Jasmine rice')
      expect(dropdown.text()).not.toContain('Olive oil')
    })

    it('hides the dropdown when query matches nothing', async () => {
      const wrapper = mount(SuggestInput, {
        props: { modelValue: 'zzznomatch', suggestions: NAMES },
      })
      await wrapper.find('input').trigger('focus')
      expect(wrapper.find('.suggest-dropdown').exists()).toBe(false)
    })

    it('emits update:modelValue on input', async () => {
      const wrapper = mount(SuggestInput, { props: { modelValue: '', suggestions: NAMES } })
      const input = wrapper.find('input')
      await input.setValue('jas')
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual(['jas'])
    })

    it('selects a suggestion via mousedown and closes the dropdown', async () => {
      const wrapper = mount(SuggestInput, {
        props: { modelValue: 'rice', suggestions: NAMES },
      })
      await wrapper.find('input').trigger('focus')
      expect(wrapper.find('.suggest-dropdown').exists()).toBe(true)

      const option = wrapper.findAll('.suggest-dropdown li').find(li => li.text() === 'Basmati rice')
      expect(option).toBeTruthy()
      await option!.trigger('mousedown')

      expect(wrapper.emitted('update:modelValue')![0]).toEqual(['Basmati rice'])
      expect(wrapper.find('.suggest-dropdown').exists()).toBe(false)
    })

    it('allows free text without forcing a suggestion', async () => {
      const wrapper = mount(SuggestInput, { props: { modelValue: '', suggestions: NAMES } })
      const input = wrapper.find('input')
      await input.setValue('My custom ingredient')
      expect(wrapper.emitted('update:modelValue')![0]).toEqual(['My custom ingredient'])
    })
  })

  describe('unit-field mode (showSuggestionsOnFocus = true)', () => {
    it('shows all suggestions immediately on focus without typing', async () => {
      const wrapper = mount(SuggestInput, {
        props: { modelValue: '', suggestions: UNITS, showSuggestionsOnFocus: true },
      })
      await wrapper.find('input').trigger('focus')
      const dropdown = wrapper.find('.suggest-dropdown')
      expect(dropdown.exists()).toBe(true)
      expect(dropdown.text()).toContain('g')
      expect(dropdown.text()).toContain('kg')
      expect(dropdown.text()).toContain('piece')
    })

    it('filters suggestions when user types in a unit field', async () => {
      const wrapper = mount(SuggestInput, {
        props: { modelValue: 'k', suggestions: UNITS, showSuggestionsOnFocus: true },
      })
      await wrapper.find('input').trigger('focus')
      const dropdown = wrapper.find('.suggest-dropdown')
      expect(dropdown.exists()).toBe(true)
      expect(dropdown.text()).toContain('kg')
      expect(dropdown.text()).not.toContain('piece')
    })

    it('still allows free text entry', async () => {
      const wrapper = mount(SuggestInput, {
        props: { modelValue: '', suggestions: UNITS, showSuggestionsOnFocus: true },
      })
      await wrapper.find('input').setValue('jar')
      expect(wrapper.emitted('update:modelValue')![0]).toEqual(['jar'])
    })
  })

  describe('maxSuggestions prop', () => {
    it('limits displayed suggestions to maxSuggestions', async () => {
      const many = Array.from({ length: 20 }, (_, i) => `item ${i}`)
      const wrapper = mount(SuggestInput, {
        props: { modelValue: 'item', suggestions: many, maxSuggestions: 5 },
      })
      await wrapper.find('input').trigger('focus')
      expect(wrapper.findAll('.suggest-dropdown li')).toHaveLength(5)
    })

    it('defaults to 8 suggestions when maxSuggestions is not set', async () => {
      const many = Array.from({ length: 20 }, (_, i) => `option ${i}`)
      const wrapper = mount(SuggestInput, {
        props: { modelValue: 'option', suggestions: many },
      })
      await wrapper.find('input').trigger('focus')
      expect(wrapper.findAll('.suggest-dropdown li').length).toBeLessThanOrEqual(8)
    })
  })

  describe('disableInternalFilter prop', () => {
    it('shows suggestions unfiltered when disableInternalFilter is true, even if modelValue does not match them', async () => {
      const members = ['Spaghetti', 'Penne', 'Fusilli']
      const wrapper = mount(SuggestInput, {
        props: { modelValue: 'Pasta', suggestions: members, disableInternalFilter: true },
      })
      await wrapper.find('input').trigger('focus')
      const dropdown = wrapper.find('.suggest-dropdown')
      expect(dropdown.exists()).toBe(true)
      expect(dropdown.text()).toContain('Spaghetti')
      expect(dropdown.text()).toContain('Penne')
      expect(dropdown.text()).toContain('Fusilli')
    })

    it('keeps existing substring filtering behavior when disableInternalFilter is false or omitted', async () => {
      const wrapper = mount(SuggestInput, {
        props: { modelValue: 'rice', suggestions: NAMES, disableInternalFilter: false },
      })
      await wrapper.find('input').trigger('focus')
      const dropdown = wrapper.find('.suggest-dropdown')
      expect(dropdown.text()).toContain('Basmati rice')
      expect(dropdown.text()).not.toContain('Olive oil')
    })
  })

  describe('input styling', () => {
    it('renders a native input element', () => {
      const wrapper = mount(SuggestInput, { props: { modelValue: '', suggestions: NAMES } })
      expect(wrapper.find('input').exists()).toBe(true)
    })

    it('passes placeholder to the input', () => {
      const wrapper = mount(SuggestInput, {
        props: { modelValue: '', suggestions: NAMES, placeholder: 'Enter a name' },
      })
      expect(wrapper.find('input').attributes('placeholder')).toBe('Enter a name')
    })

    it('disables native autocomplete', () => {
      const wrapper = mount(SuggestInput, { props: { modelValue: '', suggestions: NAMES } })
      expect(wrapper.find('input').attributes('autocomplete')).toBe('off')
    })
  })
})
