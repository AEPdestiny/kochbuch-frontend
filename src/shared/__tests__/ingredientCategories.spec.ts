import { describe, expect, it } from 'vitest'
import {
  categorySearchTerms,
  INGREDIENT_LABELS_DE,
  isRecognizedCategoryAlias,
  localizedNameSuggestions,
  localizedUnitOptions,
  matchesCategoryAwareText,
  resolveIngredientSuggestions,
} from '@/shared/ingredientCategories'
import { NAME_SUGGESTIONS, STANDARD_UNITS } from '@/shared/ingredientConstants'

describe('ingredientCategories', () => {
  describe('isRecognizedCategoryAlias', () => {
    it('recognizes German and English category terms', () => {
      expect(isRecognizedCategoryAlias('Pasta')).toBe(true)
      expect(isRecognizedCategoryAlias('Nudeln')).toBe(true)
      expect(isRecognizedCategoryAlias('Meat')).toBe(true)
      expect(isRecognizedCategoryAlias('Fleisch')).toBe(true)
      expect(isRecognizedCategoryAlias('Fish')).toBe(true)
      expect(isRecognizedCategoryAlias('Fisch')).toBe(true)
      expect(isRecognizedCategoryAlias('Dairy')).toBe(true)
      expect(isRecognizedCategoryAlias('Milchprodukte')).toBe(true)
      expect(isRecognizedCategoryAlias('Käse')).toBe(true)
    })

    it('is case-insensitive and tolerates surrounding whitespace', () => {
      expect(isRecognizedCategoryAlias('  PASTA  ')).toBe(true)
      expect(isRecognizedCategoryAlias('fleisch')).toBe(true)
    })

    it('returns false for a specific ingredient name or unrelated text', () => {
      expect(isRecognizedCategoryAlias('Spaghetti')).toBe(false)
      expect(isRecognizedCategoryAlias('Tomaten')).toBe(false)
      expect(isRecognizedCategoryAlias('')).toBe(false)
    })
  })

  describe('matchesCategoryAwareText', () => {
    it('matches literal query text (exact search keeps working)', () => {
      expect(matchesCategoryAwareText('vegane pasta bowl', 'pasta')).toBe(true)
      expect(matchesCategoryAwareText('chicken tikka masala', 'chicken')).toBe(true)
    })

    it('Pasta finds a recipe that only mentions Spaghetti', () => {
      expect(matchesCategoryAwareText('spaghetti bolognese', 'pasta')).toBe(true)
    })

    it('Nudeln finds a recipe that only mentions Pasta/Spaghetti', () => {
      expect(matchesCategoryAwareText('spaghetti carbonara', 'nudeln')).toBe(true)
    })

    it('Meat finds Chicken/Beef/Pork ingredients', () => {
      expect(matchesCategoryAwareText('chicken breast with rice', 'meat')).toBe(true)
      expect(matchesCategoryAwareText('beef steak medium rare', 'meat')).toBe(true)
      expect(matchesCategoryAwareText('ground pork meatballs', 'meat')).toBe(true)
    })

    it('Fleisch matches text containing the literal word or an English member name', () => {
      expect(matchesCategoryAwareText('rindersteak mit fleisch sauce', 'fleisch')).toBe(true)
      expect(matchesCategoryAwareText('ground beef tacos', 'fleisch')).toBe(true)
    })

    it('Fish/Fisch finds Salmon/Shrimp ingredients', () => {
      expect(matchesCategoryAwareText('grilled salmon fillet', 'fish')).toBe(true)
      expect(matchesCategoryAwareText('shrimp scampi', 'fisch')).toBe(true)
      expect(matchesCategoryAwareText('mackerel with lemon', 'fisch')).toBe(true)
    })

    it('Dairy/Milchprodukte/Käse finds Yogurt/Quark/Cheese ingredients', () => {
      expect(matchesCategoryAwareText('greek yogurt bowl', 'dairy')).toBe(true)
      expect(matchesCategoryAwareText('quark mit früchten', 'milchprodukte')).toBe(true)
      expect(matchesCategoryAwareText('mozzarella caprese', 'käse')).toBe(true)
    })

    it('falls back to plain substring matching for a non-category query', () => {
      expect(matchesCategoryAwareText('chocolate cake', 'chocolate')).toBe(true)
      expect(matchesCategoryAwareText('chocolate cake', 'vanilla')).toBe(false)
    })

    it('does not produce duplicate-feeling false positives for unrelated categories', () => {
      expect(matchesCategoryAwareText('olive oil dressing', 'meat')).toBe(false)
    })
  })

  describe('categorySearchTerms', () => {
    it('returns the category matchTerms for a recognized alias', () => {
      const terms = categorySearchTerms('Pasta')
      expect(terms).toContain('pasta')
      expect(terms).toContain('nudeln')
    })

    it('returns an empty array for a non-category query', () => {
      expect(categorySearchTerms('Spaghetti Carbonara')).toEqual([])
    })
  })

  describe('resolveIngredientSuggestions', () => {
    it('returns category members (localized) when the input is a category alias', () => {
      const suggestions = resolveIngredientSuggestions('Fleisch', NAME_SUGGESTIONS, 'de')
      expect(suggestions).toContain('Hähnchenbrust')
      expect(suggestions).toContain('Rindersteak')
      expect(suggestions).not.toContain('Basmatireis')
    })

    it('returns the full localized name list when the input is not a category alias', () => {
      const suggestions = resolveIngredientSuggestions('Tomaten', NAME_SUGGESTIONS, 'de')
      expect(suggestions.length).toBe(NAME_SUGGESTIONS.length)
      expect(suggestions).toContain('Basmatireis')
    })

    it('returns English category members for a non-German locale', () => {
      const suggestions = resolveIngredientSuggestions('Meat', NAME_SUGGESTIONS, 'en')
      expect(suggestions).toContain('Chicken breast')
      expect(suggestions).not.toContain('Hähnchenbrust')
    })
  })

  describe('localizedNameSuggestions', () => {
    it('returns German labels when locale is de', () => {
      const suggestions = localizedNameSuggestions(NAME_SUGGESTIONS, 'de')
      expect(suggestions).toContain('Hähnchenbrust')
      expect(suggestions).toContain('Lachsfilet')
      expect(suggestions).toContain('Garnelen')
      expect(suggestions).toContain('Griechischer Joghurt')
      expect(suggestions).toContain('Frischkäse')
      expect(suggestions).toContain('Sahne')
      expect(suggestions.length).toBe(NAME_SUGGESTIONS.length)
    })

    it('returns the original English list for en', () => {
      for (const locale of ['en']) {
        expect(localizedNameSuggestions(NAME_SUGGESTIONS, locale)).toEqual(NAME_SUGGESTIONS)
      }
    })

    it('locale de contains no untranslated English suggestion (no fallback to the raw NAME_SUGGESTIONS entry)', () => {
      // Every NAME_SUGGESTIONS entry must have its own German label — a "translation"
      // that is identical to the English source (e.g. pasta shape names that are the
      // same word in German) is fine, but silently falling back because a label is
      // simply missing from INGREDIENT_LABELS_DE is the exact bug this test guards against.
      const englishOnlyExamples = ['Milk rice', 'Kidney beans', 'Black beans', 'Chicken breast', 'Long grain rice', 'Short grain rice']
      const suggestions = localizedNameSuggestions(NAME_SUGGESTIONS, 'de')
      for (const example of englishOnlyExamples) {
        expect(suggestions).not.toContain(example)
      }
    })

    it('every NAME_SUGGESTIONS entry has an explicit German label', () => {
      const missing = NAME_SUGGESTIONS.filter(name => !(name in INGREDIENT_LABELS_DE))
      expect(missing).toEqual([])
    })

    it('locale de shows expected German translations (Milchreis, Schwarze Bohnen, Hähnchenbrust, ...)', () => {
      const suggestions = localizedNameSuggestions(NAME_SUGGESTIONS, 'de')
      expect(suggestions).toContain('Milchreis')
      expect(suggestions).toContain('Kidneybohnen')
      expect(suggestions).toContain('Schwarze Bohnen')
      expect(suggestions).toContain('Langkornreis')
      expect(suggestions).toContain('Rundkornreis')
      expect(suggestions).toContain('Hähnchenbrust')
      expect(suggestions).toContain('Sonnenblumenöl')
      expect(suggestions).toContain('Sojamilch')
    })
  })

  describe('localizedUnitOptions', () => {
    it('returns German unit labels (TL, EL, Tasse, Stück, Prise, Packung, Dose) when locale is de', () => {
      const units = localizedUnitOptions(STANDARD_UNITS, 'de')
      expect(units).toContain('TL')
      expect(units).toContain('EL')
      expect(units).toContain('Tasse')
      expect(units).toContain('Stück')
      expect(units).toContain('Prise')
      expect(units).toContain('Packung')
      expect(units).toContain('Dose')
      expect(units.length).toBe(STANDARD_UNITS.length)
    })

    it('returns the original STANDARD_UNITS codes for en', () => {
      for (const locale of ['en']) {
        expect(localizedUnitOptions(STANDARD_UNITS, locale)).toEqual(STANDARD_UNITS)
      }
    })
  })
})
