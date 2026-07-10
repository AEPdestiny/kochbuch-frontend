import { describe, expect, it } from 'vitest'
import {
  normalizeShoppingListItemDisplay,
  normalizeShoppingListItemForEdit,
} from '@/shared/normalizeShoppingItem'

describe('normalizeShoppingListItemDisplay', () => {
  it('leaves a clean item untouched', () => {
    const result = normalizeShoppingListItemDisplay({ name: 'Tomaten', quantity: 3, unit: 'piece' })
    expect(result.displayName).toBe('Tomaten')
    expect(result.displayQuantity).toBe('3')
    expect(result.displayUnit).toBe('piece')
  })

  it('strips embedded "quantity unit" prefix when item has separate quantity field', () => {
    const result = normalizeShoppingListItemDisplay({ name: '57 g Spargelstangen', quantity: 57, unit: 'g' })
    expect(result.displayName).toBe('Spargelstangen')
    expect(result.displayQuantity).toBe('57')
    expect(result.displayUnit).toBe('g')
  })

  it('strips embedded prefix and uses explicit quantity even when they differ (explicit wins)', () => {
    const result = normalizeShoppingListItemDisplay({ name: '41 g Butter', quantity: 41, unit: 'g' })
    expect(result.displayName).toBe('Butter')
    expect(result.displayQuantity).toBe('41')
    expect(result.displayUnit).toBe('g')
  })

  it('parses "quantity unit name" from name when no separate quantity set', () => {
    const result = normalizeShoppingListItemDisplay({ name: '57 g Spargelstangen' })
    expect(result.displayName).toBe('Spargelstangen')
    expect(result.displayQuantity).toBe('57')
    expect(result.displayUnit).toBe('g')
  })

  it('parses fractional quantity "1/3 EL Zucker"', () => {
    const result = normalizeShoppingListItemDisplay({ name: '1/3 EL Zucker' })
    expect(result.displayName).toBe('Zucker')
    expect(result.displayQuantity).toBe('1/3')
    expect(result.displayUnit).toBe('EL')
  })

  it('parses decimal quantity "0.75 Tasse Wasser"', () => {
    const result = normalizeShoppingListItemDisplay({ name: '0.75 Tasse Wasser' })
    expect(result.displayName).toBe('Wasser')
    expect(result.displayQuantity).toBe('0.75')
    expect(result.displayUnit).toBe('Tasse')
  })

  it('parses long name with commas "280 g Unagi Kabayaki, aufgetaut und in Streifen"', () => {
    const result = normalizeShoppingListItemDisplay({ name: '280 g Unagi Kabayaki, aufgetaut und in Streifen' })
    expect(result.displayName).toBe('Unagi Kabayaki, aufgetaut und in Streifen')
    expect(result.displayQuantity).toBe('280')
    expect(result.displayUnit).toBe('g')
  })

  it('parses two-part "2 Eier" (quantity without recognized unit)', () => {
    const result = normalizeShoppingListItemDisplay({ name: '2 Eier' })
    expect(result.displayName).toBe('Eier')
    expect(result.displayQuantity).toBe('2')
    expect(result.displayUnit).toBe('')
  })

  it('leaves name unchanged when no numeric prefix', () => {
    const result = normalizeShoppingListItemDisplay({ name: 'Salz und Pfeffer' })
    expect(result.displayName).toBe('Salz und Pfeffer')
    expect(result.displayQuantity).toBe('')
    expect(result.displayUnit).toBe('')
  })

  it('uses item.unit fallback when name has no prefix', () => {
    const result = normalizeShoppingListItemDisplay({ name: 'Mehl', unit: 'g' })
    expect(result.displayName).toBe('Mehl')
    expect(result.displayQuantity).toBe('')
    expect(result.displayUnit).toBe('g')
  })

  it('shows integer quantity without decimals', () => {
    const result = normalizeShoppingListItemDisplay({ name: 'Äpfel', quantity: 3, unit: '' })
    expect(result.displayQuantity).toBe('3')
  })

  it('parses "cup" as recognized unit', () => {
    const result = normalizeShoppingListItemDisplay({ name: '2 cup Mehl' })
    expect(result.displayName).toBe('Mehl')
    expect(result.displayUnit).toBe('cup')
  })

  it('localizes stored German units for English display', () => {
    expect(normalizeShoppingListItemDisplay({ name: 'Öl', quantity: 1, unit: 'EL' }, 'en').displayUnit).toBe('tbsp')
    expect(normalizeShoppingListItemDisplay({ name: 'Mehl', quantity: 1, unit: 'Tasse' }, 'en').displayUnit).toBe('cup')
    expect(normalizeShoppingListItemDisplay({ name: 'Schinken', quantity: 2, unit: 'Scheiben' }, 'en').displayUnit).toBe('slices')
    expect(normalizeShoppingListItemDisplay({ name: 'Sauce', quantity: 1, unit: 'Packung' }, 'en').displayUnit).toBe('package')
    expect(normalizeShoppingListItemDisplay({ name: 'Essig', quantity: 1, unit: 'Teelöffel.' }, 'en').displayUnit).toBe('tsp')
  })

  it('localizes stored English units for German display', () => {
    expect(normalizeShoppingListItemDisplay({ name: 'oil', quantity: 1, unit: 'tbsp' }, 'de').displayUnit).toBe('EL')
    expect(normalizeShoppingListItemDisplay({ name: 'flour', quantity: 1, unit: 'cup' }, 'de').displayUnit).toBe('Tasse')
    expect(normalizeShoppingListItemDisplay({ name: 'ham', quantity: 2, unit: 'slices' }, 'de').displayUnit).toBe('Scheiben')
    expect(normalizeShoppingListItemDisplay({ name: 'sauce', quantity: 1, unit: 'package' }, 'de').displayUnit).toBe('Packung')
    expect(normalizeShoppingListItemDisplay({ name: 'vinegar', quantity: 1, unit: 'teaspoon' }, 'de').displayUnit).toBe('TL')
  })

  it('strips prefix when name duplicates the explicit quantity/unit fields', () => {
    const result = normalizeShoppingListItemDisplay({ name: '280 g Lachs', quantity: 280, unit: 'g' })
    expect(result.displayName).toBe('Lachs')
    expect(result.displayQuantity).toBe('280')
    expect(result.displayUnit).toBe('g')
  })
})

describe('normalizeShoppingListItemForEdit', () => {
  it('returns clean values for a clean item', () => {
    const result = normalizeShoppingListItemForEdit({ name: 'Tomaten', quantity: 3, unit: 'piece' })
    expect(result.name).toBe('Tomaten')
    expect(result.quantity).toBe(3)
    expect(result.unit).toBe('piece')
  })

  it('strips embedded prefix, returns separate numeric quantity and unit', () => {
    const result = normalizeShoppingListItemForEdit({ name: '57 g Spargelstangen' })
    expect(result.name).toBe('Spargelstangen')
    expect(result.quantity).toBe(57)
    expect(result.unit).toBe('g')
  })

  it('converts fraction "1/3" to numeric ~0.333 for edit', () => {
    const result = normalizeShoppingListItemForEdit({ name: '1/3 EL Zucker' })
    expect(result.name).toBe('Zucker')
    expect(result.quantity).toBeCloseTo(1 / 3, 2)
    expect(result.unit).toBe('EL')
  })

  it('returns null quantity for item with no numeric prefix', () => {
    const result = normalizeShoppingListItemForEdit({ name: 'Salz' })
    expect(result.name).toBe('Salz')
    expect(result.quantity).toBeNull()
  })

  it('strips embedded prefix when item also has explicit quantity', () => {
    const result = normalizeShoppingListItemForEdit({ name: '41 g Butter', quantity: 41, unit: 'g' })
    expect(result.name).toBe('Butter')
    expect(result.quantity).toBe(41)
    expect(result.unit).toBe('g')
  })
})
