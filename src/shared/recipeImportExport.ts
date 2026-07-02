import type { RecipeRequest } from '@/types/recipe'

export type ExportableRecipeData = {
  title: string
  ingredients: string
  instructions: string
  prepTimeMinutes: number
  cookTimeMinutes: number
  servings: number
  difficulty: string
  category: string
  imageUrl: string
  language?: string | null
  calories?: number | null
}

export type DishlyExportFile = {
  sourceApp: 'Dishly'
  exportVersion: 1
  exportedAt: string
  recipe: DishlyExportRecipe
}

export type DishlyExportRecipe = {
  title: string
  ingredients: string
  instructions: string
  prepTimeMinutes: number
  cookTimeMinutes: number
  servings: number
  difficulty: string
  category: string
  imageUrl: string
  language: string
  calories: number | null
}

/**
 * Wraps a recipe in the versioned Dishly export envelope (sourceApp/exportVersion/
 * exportedAt) that validateDishlyImport() below expects on the way back in.
 */
export function buildExportPayload(recipe: ExportableRecipeData, now: string): DishlyExportFile {
  return {
    sourceApp: 'Dishly',
    exportVersion: 1,
    exportedAt: now,
    recipe: {
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      prepTimeMinutes: recipe.prepTimeMinutes,
      cookTimeMinutes: recipe.cookTimeMinutes,
      servings: recipe.servings,
      difficulty: recipe.difficulty,
      category: recipe.category,
      imageUrl: recipe.imageUrl,
      language: recipe.language ?? 'de',
      calories: typeof recipe.calories === 'number' ? recipe.calories : null,
    },
  }
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportRecipe(recipe: ExportableRecipeData): void {
  const payload = buildExportPayload(recipe, new Date().toISOString())
  const safeName = recipe.title.replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_').slice(0, 60)
  downloadJson(`dishly_${safeName}.json`, payload)
}

type ValidationFailure = { ok: false; reason: string }
type ValidationSuccess = { ok: true; request: RecipeRequest }
type ValidationResult = ValidationFailure | ValidationSuccess

/**
 * Validates a parsed JSON file as a Dishly recipe export before importing it.
 * Returns a `{ ok: false, reason }` result instead of throwing, so the caller can map
 * `reason` to a translated error message per failure case (invalid JSON, wrong app,
 * unsupported version, missing recipe/title, negative calories, ...). On success,
 * missing optional fields are defaulted (e.g. empty ingredients/instructions) rather
 * than rejected, so older or hand-edited export files still import.
 */
export function validateDishlyImport(raw: unknown): ValidationResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, reason: 'invalidJson' }
  }

  const data = raw as Record<string, unknown>

  if (data['sourceApp'] !== 'Dishly') {
    return { ok: false, reason: 'notDishly' }
  }

  if (data['exportVersion'] !== 1) {
    return { ok: false, reason: 'unsupportedVersion' }
  }

  const r = data['recipe']
  if (typeof r !== 'object' || r === null) {
    return { ok: false, reason: 'missingRecipe' }
  }

  const recipe = r as Record<string, unknown>

  if (typeof recipe['title'] !== 'string' || !recipe['title'].trim()) {
    return { ok: false, reason: 'missingTitle' }
  }

  const ingredients = typeof recipe['ingredients'] === 'string' ? recipe['ingredients'] : ''
  const instructions = typeof recipe['instructions'] === 'string' ? recipe['instructions'] : ''

  const prepTimeMinutes = toSafeNumber(recipe['prepTimeMinutes'], 0)
  const cookTimeMinutes = toSafeNumber(recipe['cookTimeMinutes'], 0)
  const servings = toSafeNumber(recipe['servings'], 0)

  const calories = recipe['calories'] === null || recipe['calories'] === undefined
    ? null
    : toSafeNumber(recipe['calories'], null)

  if (calories !== null && calories < 0) {
    return { ok: false, reason: 'negativeCalories' }
  }

  const request: RecipeRequest = {
    title: (recipe['title'] as string).trim(),
    ingredients,
    instructions,
    prepTimeMinutes,
    cookTimeMinutes,
    servings,
    difficulty: typeof recipe['difficulty'] === 'string' ? recipe['difficulty'] : '',
    category: typeof recipe['category'] === 'string' ? recipe['category'] : '',
    imageUrl: typeof recipe['imageUrl'] === 'string' ? recipe['imageUrl'] : '',
    language: typeof recipe['language'] === 'string' ? recipe['language'] : 'de',
    calories,
    rating: 0,
    favorite: false,
    published: false,
  }

  return { ok: true, request }
}

function toSafeNumber(value: unknown, fallback: number): number
function toSafeNumber(value: unknown, fallback: null): number | null
function toSafeNumber(value: unknown, fallback: number | null): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}
