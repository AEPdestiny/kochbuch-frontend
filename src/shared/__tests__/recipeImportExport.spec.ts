import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { buildExportPayload, downloadJson, exportRecipe, validateDishlyImport } from '@/shared/recipeImportExport'
import type { Recipe } from '@/types/recipe'

const baseRecipe: Recipe = {
  id: 42,
  title: 'Cremige Tomatenpasta',
  ingredients: '400g Pasta, 200ml Sahne, 3 Tomaten',
  instructions: 'Pasta kochen. Sauce zubereiten. Alles vermengen.',
  prepTimeMinutes: 10,
  cookTimeMinutes: 20,
  servings: 2,
  difficulty: 'einfach',
  category: 'Italienisch',
  imageUrl: 'https://example.com/pasta.jpg',
  language: 'de',
  calories: 520,
  rating: 4.5,
  favorite: true,
  published: true,
}

describe('buildExportPayload', () => {
  it('includes sourceApp "Dishly" and exportVersion 1', () => {
    const payload = buildExportPayload(baseRecipe, '2026-01-01T00:00:00.000Z')
    expect(payload.sourceApp).toBe('Dishly')
    expect(payload.exportVersion).toBe(1)
  })

  it('includes exportedAt timestamp', () => {
    const payload = buildExportPayload(baseRecipe, '2026-06-30T12:00:00.000Z')
    expect(payload.exportedAt).toBe('2026-06-30T12:00:00.000Z')
  })

  it('includes title, ingredients, and instructions', () => {
    const payload = buildExportPayload(baseRecipe, '2026-01-01T00:00:00.000Z')
    expect(payload.recipe.title).toBe('Cremige Tomatenpasta')
    expect(payload.recipe.ingredients).toBe('400g Pasta, 200ml Sahne, 3 Tomaten')
    expect(payload.recipe.instructions).toBe('Pasta kochen. Sauce zubereiten. Alles vermengen.')
  })

  it('includes calories when present', () => {
    const payload = buildExportPayload(baseRecipe, '2026-01-01T00:00:00.000Z')
    expect(payload.recipe.calories).toBe(520)
  })

  it('sets calories to null when missing', () => {
    const recipe: Recipe = { ...baseRecipe, calories: undefined }
    const payload = buildExportPayload(recipe, '2026-01-01T00:00:00.000Z')
    expect(payload.recipe.calories).toBeNull()
  })

  it('does NOT include internal id in the export payload', () => {
    const payload = buildExportPayload(baseRecipe, '2026-01-01T00:00:00.000Z')
    expect(payload).not.toHaveProperty('id')
    expect(payload.recipe).not.toHaveProperty('id')
  })

  it('does NOT include favorite or published flags', () => {
    const payload = buildExportPayload(baseRecipe, '2026-01-01T00:00:00.000Z')
    expect(payload.recipe).not.toHaveProperty('favorite')
    expect(payload.recipe).not.toHaveProperty('published')
  })

  it('includes prepTimeMinutes, cookTimeMinutes, servings, difficulty, category', () => {
    const payload = buildExportPayload(baseRecipe, '2026-01-01T00:00:00.000Z')
    expect(payload.recipe.prepTimeMinutes).toBe(10)
    expect(payload.recipe.cookTimeMinutes).toBe(20)
    expect(payload.recipe.servings).toBe(2)
    expect(payload.recipe.difficulty).toBe('einfach')
    expect(payload.recipe.category).toBe('Italienisch')
  })
})

describe('downloadJson', () => {
  let appendedAnchor: HTMLAnchorElement | null = null
  const mockCreateObjectURL = vi.fn(() => 'blob:test-url')
  const mockRevokeObjectURL = vi.fn()

  beforeEach(() => {
    appendedAnchor = null
    mockCreateObjectURL.mockClear()
    mockRevokeObjectURL.mockClear()
    vi.stubGlobal('URL', { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL })
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        appendedAnchor = { href: '', download: '', click: vi.fn() } as unknown as HTMLAnchorElement
        return appendedAnchor
      }
      return document.createElement.call(document, tag)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('creates a blob URL and triggers click', () => {
    downloadJson('test.json', { foo: 'bar' })
    expect(mockCreateObjectURL).toHaveBeenCalled()
    expect(appendedAnchor?.click).toHaveBeenCalled()
  })

  it('sets the filename correctly', () => {
    downloadJson('dishly_pasta.json', {})
    expect(appendedAnchor?.download).toBe('dishly_pasta.json')
  })

  it('revokes the object URL after click', () => {
    downloadJson('test.json', {})
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url')
  })
})

describe('exportRecipe', () => {
  const mockCreateObjectURL = vi.fn(() => 'blob:test-url')
  const mockRevokeObjectURL = vi.fn()

  beforeEach(() => {
    mockCreateObjectURL.mockClear()
    mockRevokeObjectURL.mockClear()
    vi.stubGlobal('URL', { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL })
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return { href: '', download: '', click: vi.fn() } as unknown as HTMLAnchorElement
      }
      return document.createElement.call(document, tag)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('triggers a download without throwing', () => {
    expect(() => exportRecipe(baseRecipe)).not.toThrow()
  })
})

describe('validateDishlyImport', () => {
  const validExport = {
    sourceApp: 'Dishly',
    exportVersion: 1,
    exportedAt: '2026-06-30T12:00:00.000Z',
    recipe: {
      title: 'Tomatenpasta',
      ingredients: '400g Pasta, 3 Tomaten',
      instructions: 'Alles kochen.',
      prepTimeMinutes: 10,
      cookTimeMinutes: 20,
      servings: 2,
      difficulty: 'einfach',
      category: 'Italienisch',
      imageUrl: 'https://example.com/pasta.jpg',
      language: 'de',
      calories: 450,
    },
  }

  it('accepts a valid Dishly export file', () => {
    const result = validateDishlyImport(validExport)
    expect(result.ok).toBe(true)
  })

  it('returns a RecipeRequest with correct data on valid input', () => {
    const result = validateDishlyImport(validExport)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.request.title).toBe('Tomatenpasta')
      expect(result.request.ingredients).toBe('400g Pasta, 3 Tomaten')
      expect(result.request.instructions).toBe('Alles kochen.')
      expect(result.request.calories).toBe(450)
    }
  })

  it('sets favorite=false and published=false regardless of import data', () => {
    const result = validateDishlyImport(validExport)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.request.favorite).toBe(false)
      expect(result.request.published).toBe(false)
    }
  })

  it('does not copy any id from the import file', () => {
    const withId = { ...validExport, recipe: { ...validExport.recipe, id: 99 } }
    const result = validateDishlyImport(withId)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.request).not.toHaveProperty('id')
    }
  })

  it('rejects non-object input', () => {
    const result = validateDishlyImport('not an object')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalidJson')
  })

  it('rejects null', () => {
    const result = validateDishlyImport(null)
    expect(result.ok).toBe(false)
  })

  it('rejects file with wrong sourceApp', () => {
    const result = validateDishlyImport({ ...validExport, sourceApp: 'OtherApp' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('notDishly')
  })

  it('rejects file without sourceApp', () => {
    const { sourceApp: _, ...without } = validExport
    const result = validateDishlyImport(without)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('notDishly')
  })

  it('rejects unsupported exportVersion', () => {
    const result = validateDishlyImport({ ...validExport, exportVersion: 2 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('unsupportedVersion')
  })

  it('rejects file with missing recipe field', () => {
    const { recipe: _, ...without } = validExport
    const result = validateDishlyImport(without)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missingRecipe')
  })

  it('rejects recipe with missing title', () => {
    const result = validateDishlyImport({
      ...validExport,
      recipe: { ...validExport.recipe, title: '' },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missingTitle')
  })

  it('rejects recipe with negative calories', () => {
    const result = validateDishlyImport({
      ...validExport,
      recipe: { ...validExport.recipe, calories: -100 },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('negativeCalories')
  })

  it('accepts null calories', () => {
    const result = validateDishlyImport({
      ...validExport,
      recipe: { ...validExport.recipe, calories: null },
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.request.calories).toBeNull()
  })

  it('accepts missing calories field (treated as null)', () => {
    const { calories: _, ...recipeWithoutCalories } = validExport.recipe
    const result = validateDishlyImport({ ...validExport, recipe: recipeWithoutCalories })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.request.calories).toBeNull()
  })

  it('accepts missing ingredients (defaults to empty string)', () => {
    const { ingredients: _, ...recipeWithout } = validExport.recipe
    const result = validateDishlyImport({ ...validExport, recipe: recipeWithout })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.request.ingredients).toBe('')
  })

  it('accepts missing instructions (defaults to empty string)', () => {
    const { instructions: _, ...recipeWithout } = validExport.recipe
    const result = validateDishlyImport({ ...validExport, recipe: recipeWithout })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.request.instructions).toBe('')
  })

  it('ignores extra unknown fields without crashing', () => {
    const result = validateDishlyImport({
      ...validExport,
      unknownTopLevel: true,
      recipe: { ...validExport.recipe, unknownField: 'should be ignored' },
    })
    expect(result.ok).toBe(true)
  })

  it('handles completely empty recipe object with only title', () => {
    const result = validateDishlyImport({
      sourceApp: 'Dishly',
      exportVersion: 1,
      recipe: { title: 'Minimal' },
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.request.title).toBe('Minimal')
      expect(result.request.calories).toBeNull()
    }
  })
})
