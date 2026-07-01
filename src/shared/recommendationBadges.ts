import type { Recipe } from '@/types/recipe'
import type { UserPreferencesResponse } from '@/types/profile'

export type BadgeType = 'pantry' | 'likes' | 'diet' | 'calorie' | 'time'

export type RecommendationBadge = {
  key: string
  labelKey: string
  labelParams?: Record<string, string>
  type: BadgeType
}

type RecipeInput = Pick<
  Recipe,
  'title' | 'ingredients' | 'category' | 'calories' | 'prepTimeMinutes' | 'cookTimeMinutes'
> & {
  vegan?: boolean | null
  vegetarian?: boolean | null
  glutenFree?: boolean | null
  dishTypes?: string | null
  diets?: string | null
}

/**
 * Word-boundary-safe matching that avoids substring false-positives like
 * "Ei" matching inside "Wein".
 *
 * Single-word terms: tokenizes text on non-letter characters and checks
 * whether any token equals the term (allowing up to 3 chars of inflection
 * suffix for common German plurals, e.g. "Tomate" → "Tomaten").
 *
 * Multi-word phrases: falls back to simple includes() — phrase specificity
 * is sufficient to avoid false positives.
 */
export function safeTermMatch(term: string, text: string): boolean {
  if (!term || !text) return false
  const normalizedTerm = term.toLowerCase().trim()
  if (normalizedTerm.length < 2) return false

  // Multi-word phrase: phrase specificity makes includes() safe enough
  if (normalizedTerm.includes(' ')) {
    return text.toLowerCase().includes(normalizedTerm)
  }

  // Single-word: split on anything that is not a letter (including umlauts/ß)
  const tokens = text.toLowerCase().split(/[^a-zäöüßàáâãèéêëìíîïòóôõùúûý]+/)
  return tokens.some(token => {
    if (!token || token.length < normalizedTerm.length) return false
    if (token === normalizedTerm) return true
    // Allow short inflection suffix (-s, -n, -en, -e, -er, -em, etc.)
    const suffixLen = token.length - normalizedTerm.length
    return suffixLen >= 1 && suffixLen <= 3 && token.startsWith(normalizedTerm)
  })
}

function countIngredients(ingredients: string | null | undefined): number | null {
  if (!ingredients?.trim()) return null
  const parts = ingredients.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean)
  return parts.length > 0 ? parts.length : null
}

/**
 * Checks whether a recipe's diet metadata (boolean flags + diets text field)
 * confirms a specific diet type. Used to avoid showing Vegan/Vegetarian/
 * Gluten-free badges when the data is absent or inconclusive.
 */
function confirmsDiet(
  recipe: RecipeInput,
  diet: 'vegan' | 'vegetarian' | 'glutenFree',
): boolean {
  // Boolean flag always wins (set by both internal and Spoonacular)
  if (recipe[diet] === true) return true

  // Also check the free-text diets field provided by external APIs
  const dietsText = (recipe.diets ?? '').toLowerCase()
  if (!dietsText) return false

  if (diet === 'vegan') return /(?:^|[\s,])vegan(?:[\s,]|$)/.test(dietsText)
  if (diet === 'vegetarian') return /vegetarian/.test(dietsText)
  if (diet === 'glutenFree') return /gluten.?free/.test(dietsText)
  return false
}

export function getRecommendationBadges(
  recipe: RecipeInput,
  profile: UserPreferencesResponse | null,
  pantryIngredients: string[],
  opts: {
    matchTermsFn?: (term: string) => string[]
    /** @deprecated No longer used — diet badges now require confirmed recipe data */
    isExternal?: boolean
    maxBadges?: number
  } = {},
): RecommendationBadge[] {
  const { matchTermsFn = (t: string) => [t], maxBadges = 4 } = opts
  const badges: RecommendationBadge[] = []
  const text = [
    recipe.title ?? '',
    recipe.ingredients ?? '',
    recipe.category ?? '',
    recipe.dishTypes ?? '',
    recipe.diets ?? '',
  ].join(' ').toLowerCase()

  // 1. Pantry — ratio badge showing how many ingredients are covered
  const matchedPantryItems = [...new Set(pantryIngredients.filter(ing => safeTermMatch(ing, text)))]
  const matchedCount = matchedPantryItems.length
  if (matchedCount > 0) {
    const total = countIngredients(recipe.ingredients)
    if (total && matchedCount <= total) {
      badges.push({
        key: 'pantry',
        labelKey: 'home.reasons.pantryRatio',
        labelParams: { matched: String(matchedCount), total: String(total) },
        type: 'pantry',
      })
    } else {
      badges.push({
        key: 'pantry',
        labelKey: matchedCount === 1 ? 'home.reasons.pantryCountOne' : 'home.reasons.pantryCount',
        labelParams: { count: String(matchedCount) },
        type: 'pantry',
      })
    }
  }

  if (profile) {
    // 2. Likes match — first matching term only, using safe word-boundary matching
    for (const term of profile.likes ?? []) {
      if (!term) continue
      const terms = matchTermsFn(term)
      if (terms.some(t => safeTermMatch(t, text))) {
        badges.push({
          key: `likes-${term}`,
          labelKey: 'home.reasons.likes',
          labelParams: { value: term },
          type: 'likes',
        })
        break
      }
    }

    // 3. Diet badges — only when recipe data actually confirms the diet
    if (confirmsDiet(recipe, 'vegan') && profile.vegan) {
      badges.push({ key: 'vegan', labelKey: 'home.reasons.vegan', type: 'diet' })
    }
    if (confirmsDiet(recipe, 'vegetarian') && !profile.vegan && profile.vegetarian) {
      badges.push({ key: 'vegetarian', labelKey: 'home.reasons.vegetarian', type: 'diet' })
    }
    if (confirmsDiet(recipe, 'glutenFree') && profile.glutenFree) {
      badges.push({ key: 'glutenFree', labelKey: 'home.reasons.glutenFree', type: 'diet' })
    }

    // 4. Calorie badge
    if (profile.calorieConscious && recipe.calories && recipe.calories <= 650) {
      badges.push({ key: 'calorieConscious', labelKey: 'home.reasons.calorieConscious', type: 'calorie' })
    }

    // 5. High protein (keyword-based heuristic)
    if (profile.highProtein && /(protein|chicken|egg|fish|tofu|beans)/.test(text)) {
      badges.push({ key: 'highProtein', labelKey: 'home.reasons.highProtein', type: 'calorie' })
    }
  }

  // 6. Quick cook (generic, no profile needed)
  const totalTime = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0)
  if (totalTime > 0 && totalTime <= 30) {
    badges.push({ key: 'quickCook', labelKey: 'home.reasons.quickCook', type: 'time' })
  }

  return badges.slice(0, maxBadges)
}
