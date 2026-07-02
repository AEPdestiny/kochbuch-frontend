import type { LocaleCode } from '@/i18n'

/**
 * Groups related ingredient names under a category alias (e.g. "Pasta" / "Nudeln")
 * so search/suggestions can understand category words, not just literal ingredient
 * names. Follows the same shape as profileSuggestions.ts's SuggestionEntry for
 * consistency across the codebase.
 *
 * - matchTerms: German + English words that trigger this category when typed.
 * - members: canonical NAME_SUGGESTIONS entries belonging to this category, used
 *   both as Pantry/ShoppingList suggestions and as extra Tavily-style search terms.
 */
export type CategoryEntry = {
  canonical: string
  matchTerms: string[]
  members: string[]
  labels: Record<LocaleCode, string>
}

export const CATEGORY_ENTRIES: CategoryEntry[] = [
  {
    canonical: 'Pasta',
    // "nudel" (stem) is included alongside "nudeln" so compound words like
    // "Nudelauflauf"/"Nudelsalat" (which use the stem, not the inflected plural) still match.
    matchTerms: ['pasta', 'nudeln', 'nudel', 'noodle', 'noodles'],
    members: ['Spaghetti', 'Penne', 'Fusilli', 'Farfalle', 'Tagliatelle', 'Macaroni', 'Lasagna sheets', 'Udon', 'Rice noodles', 'Glass noodles', 'Tortellini', 'Gnocchi'],
    labels: { de: 'Pasta', en: 'Pasta', tr: 'Makarna', pl: 'Makaron', ar: 'المعكرونة', zh: '意面', ja: 'パスタ' },
  },
  {
    canonical: 'Meat',
    matchTerms: ['meat', 'fleisch'],
    members: ['Chicken breast', 'Chicken thighs', 'Turkey breast', 'Ground beef', 'Beef steak', 'Ground pork', 'Pork tenderloin', 'Bacon', 'Salami', 'Cooked ham'],
    labels: { de: 'Fleisch', en: 'Meat', tr: 'Et', pl: 'Mięso', ar: 'اللحوم', zh: '肉类', ja: '肉' },
  },
  {
    canonical: 'Fish',
    matchTerms: ['fish', 'fisch', 'seafood', 'meeresfrüchte', 'meeresfruechte'],
    members: ['Salmon fillet', 'Tuna', 'Cod', 'Pollock', 'Shrimp', 'Fish fingers', 'Smoked salmon', 'Sardines', 'Mackerel', 'Mussels'],
    labels: { de: 'Fisch', en: 'Fish', tr: 'Balık', pl: 'Ryba', ar: 'السمك', zh: '鱼类', ja: '魚' },
  },
  {
    canonical: 'Dairy',
    matchTerms: ['dairy', 'milchprodukte', 'käse', 'kaese', 'cheese'],
    members: ['Cream cheese', 'Cream', 'Greek yogurt', 'Quark', 'Mozzarella', 'Parmesan', 'Feta', 'Gouda'],
    labels: { de: 'Milchprodukte', en: 'Dairy', tr: 'Süt ürünleri', pl: 'Nabiał', ar: 'منتجات الألبان', zh: '乳制品', ja: '乳製品' },
  },
  {
    canonical: 'Rice',
    matchTerms: ['rice', 'reis'],
    members: ['Basmati rice', 'Jasmine rice', 'Long grain rice', 'Short grain rice', 'Brown rice', 'Wild rice', 'Risotto rice', 'Milk rice', 'Sushi rice', 'Parboiled rice'],
    labels: { de: 'Reis', en: 'Rice', tr: 'Pirinç', pl: 'Ryż', ar: 'الأرز', zh: '米饭', ja: '米' },
  },
]

const NORMALIZE_RE = /[\s-]+/g

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(NORMALIZE_RE, '')
}

/** Finds the category whose matchTerms include the given query, or null if none match. */
function findCategory(query: string): CategoryEntry | null {
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) return null
  return CATEGORY_ENTRIES.find(entry =>
    entry.matchTerms.some(term => normalize(term) === normalizedQuery),
  ) ?? null
}

/** True when the typed query is a recognized category alias (e.g. "Pasta", "Fleisch"). */
export function isRecognizedCategoryAlias(query: string): boolean {
  return findCategory(query) !== null
}

/**
 * Text-match for search filtering: always checks the literal query first (so a recipe
 * whose title/text literally says "Pasta" still matches), and for a recognized category
 * alias ALSO matches when the haystack contains any of the category's other match terms
 * (e.g. "nudeln", "spaghetti" for a "Pasta" query) or any of its member ingredient names
 * (e.g. "Spaghetti" as an ingredient) — so a German-language recipe found by the backend
 * via a different alias term still passes this frontend recheck.
 */
export function matchesCategoryAwareText(haystack: string, query: string): boolean {
  const lowerHaystack = haystack.toLowerCase()
  const lowerQuery = query.toLowerCase()
  if (lowerHaystack.includes(lowerQuery)) return true

  const category = findCategory(query)
  if (!category) return false
  return category.matchTerms.some(term => lowerHaystack.includes(term.toLowerCase()))
    || category.members.some(member => lowerHaystack.includes(member.toLowerCase()))
}

/**
 * Extra search terms to query the backend with when the typed text is a category alias
 * (e.g. "Pasta" → "pasta", "nudeln", "spaghetti"). The backend already does a proper
 * substring search over title/ingredients/category, so this fans out to the category's
 * matchTerms instead of guessing at a single broadened/unfiltered fetch — every result
 * comes from an explicit, real search rather than a random sample that might miss items.
 * Returns an empty array when the query isn't a recognized category.
 */
export function categorySearchTerms(query: string): string[] {
  const category = findCategory(query)
  return category ? category.matchTerms : []
}

// ─── German ingredient/unit label localization ──────────────────────────────

/**
 * English NAME_SUGGESTIONS entry → German display label. Only used when the
 * active locale is "de"; every other locale keeps the original English text.
 * Covers every entry in NAME_SUGGESTIONS (see ingredientConstants.ts) — German
 * locale must never fall back to an untranslated English suggestion.
 */
export const INGREDIENT_LABELS_DE: Record<string, string> = {
  // Rice
  'Basmati rice': 'Basmatireis',
  'Jasmine rice': 'Jasminreis',
  'Long grain rice': 'Langkornreis',
  'Short grain rice': 'Rundkornreis',
  'Brown rice': 'Naturreis',
  'Wild rice': 'Wildreis',
  'Risotto rice': 'Risottoreis',
  'Milk rice': 'Milchreis',
  'Sushi rice': 'Sushireis',
  'Parboiled rice': 'Parboiled-Reis',
  // Pasta & noodles
  'Spaghetti': 'Spaghetti',
  'Penne': 'Penne',
  'Fusilli': 'Fusilli',
  'Farfalle': 'Farfalle',
  'Tagliatelle': 'Tagliatelle',
  'Macaroni': 'Makkaroni',
  'Lasagna sheets': 'Lasagneblätter',
  'Udon': 'Udon-Nudeln',
  'Rice noodles': 'Reisnudeln',
  'Glass noodles': 'Glasnudeln',
  'Tortellini': 'Tortellini',
  'Gnocchi': 'Gnocchi',
  // Sugar
  'Brown sugar': 'Brauner Zucker',
  'Powdered sugar': 'Puderzucker',
  'Table sugar': 'Haushaltszucker',
  // Beans
  'White beans': 'Weiße Bohnen',
  'Kidney beans': 'Kidneybohnen',
  'Black beans': 'Schwarze Bohnen',
  'Soybeans': 'Sojabohnen',
  // Meat
  'Chicken breast': 'Hähnchenbrust',
  'Chicken thighs': 'Hähnchenschenkel',
  'Turkey breast': 'Putenbrust',
  'Ground beef': 'Rinderhackfleisch',
  'Beef steak': 'Rindersteak',
  'Ground pork': 'Schweinehackfleisch',
  'Pork tenderloin': 'Schweinefilet',
  'Bacon': 'Speck',
  'Salami': 'Salami',
  'Cooked ham': 'Kochschinken',
  // Fish & seafood
  'Salmon fillet': 'Lachsfilet',
  'Tuna': 'Thunfisch',
  'Cod': 'Kabeljau',
  'Pollock': 'Seelachs',
  'Shrimp': 'Garnelen',
  'Fish fingers': 'Fischstäbchen',
  'Smoked salmon': 'Räucherlachs',
  'Sardines': 'Sardinen',
  'Mackerel': 'Makrele',
  'Mussels': 'Miesmuscheln',
  // Milk
  'Oat milk': 'Hafermilch',
  'Almond milk': 'Mandelmilch',
  'Soy milk': 'Sojamilch',
  // Yogurt
  'Greek yogurt': 'Griechischer Joghurt',
  'Quark': 'Quark',
  // Dairy
  'Cream cheese': 'Frischkäse',
  'Cream': 'Sahne',
  'Butter': 'Butter',
  'Margarine': 'Margarine',
  // Cheese
  'Mozzarella': 'Mozzarella',
  'Parmesan': 'Parmesan',
  'Feta': 'Feta',
  'Gouda': 'Gouda',
  // Oil
  'Olive oil': 'Olivenöl',
  'Sunflower oil': 'Sonnenblumenöl',
  'Rapeseed oil': 'Rapsöl',
  'Sesame oil': 'Sesamöl',
  'Coconut oil': 'Kokosöl',
}

/** STANDARD_UNITS code → German display label. */
export const UNIT_LABELS_DE: Record<string, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
  tsp: 'TL',
  tbsp: 'EL',
  cup: 'Tasse',
  piece: 'Stück',
  pinch: 'Prise',
  pack: 'Packung',
  can: 'Dose',
  slice: 'Scheibe',
  clove: 'Zehe',
}

/**
 * Returns ingredient-name suggestions localized for the given locale: German labels
 * when locale is "de", the original English NAME_SUGGESTIONS list otherwise.
 */
export function localizedNameSuggestions(nameSuggestions: string[], locale: string): string[] {
  if (locale !== 'de') return nameSuggestions
  return nameSuggestions.map(name => INGREDIENT_LABELS_DE[name] ?? name)
}

/**
 * Returns unit suggestions localized for the given locale: German abbreviations
 * (TL, EL, Tasse, ...) when locale is "de", the original canonical codes otherwise.
 * Storing the German label is safe: backend unit parsing already recognizes these
 * German words case-insensitively (see MealPlanShoppingListService.canonicalUnit).
 */
export function localizedUnitOptions(standardUnits: string[], locale: string): string[] {
  if (locale !== 'de') return standardUnits
  return standardUnits.map(unit => UNIT_LABELS_DE[unit] ?? unit)
}

/**
 * Resolves what to show as Pantry/ShoppingList name suggestions for the current
 * input: if the input is a recognized category alias, returns that category's
 * member ingredients (localized); otherwise returns the full localized name list
 * unchanged, so normal substring suggestion behavior is preserved.
 */
export function resolveIngredientSuggestions(query: string, nameSuggestions: string[], locale: string): string[] {
  const category = findCategory(query)
  if (!category) return localizedNameSuggestions(nameSuggestions, locale)
  return localizedNameSuggestions(category.members, locale)
}
