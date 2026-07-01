import { describe, expect, it } from 'vitest'
import { getRecommendationBadges, safeTermMatch } from '../recommendationBadges'
import type { UserPreferencesResponse } from '@/types/profile'

// ── Fixtures ──────────────────────────────────────────────────────────────

function recipe(overrides: Partial<Parameters<typeof getRecommendationBadges>[0]> = {}) {
  return {
    title: 'Test Recipe',
    ingredients: 'flour, water, salt',
    category: 'Main',
    calories: 400,
    prepTimeMinutes: 20,
    cookTimeMinutes: 15,
    vegan: false,
    vegetarian: false,
    glutenFree: false,
    dishTypes: null,
    diets: null,
    ...overrides,
  }
}

function profile(overrides: Partial<UserPreferencesResponse> = {}): UserPreferencesResponse {
  return {
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
    calorieGoal: null,
    dailyCalorieTarget: null,
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('getRecommendationBadges', () => {
  // ── No profile ──────────────────────────────────────────────────────────

  it('returns no badges when profile is null and no pantry match', () => {
    const badges = getRecommendationBadges(recipe(), null, [])
    expect(badges).toHaveLength(0)
  })

  it('returns no broken badges when profile is null', () => {
    const badges = getRecommendationBadges(recipe(), null, [])
    badges.forEach(b => {
      expect(b.key).toBeTruthy()
      expect(b.labelKey).toBeTruthy()
      expect(b.type).toBeTruthy()
    })
  })

  // ── Pantry ──────────────────────────────────────────────────────────────

  it('returns pantryRatio badge with matched/total when ingredients are parseable', () => {
    const badges = getRecommendationBadges(
      recipe({ title: 'Pasta Carbonara', ingredients: 'pasta, egg, guanciale' }),
      null,
      ['pasta', 'tomato'],
    )
    const pantryBadge = badges.find(b => b.key === 'pantry')
    expect(pantryBadge).toBeDefined()
    expect(pantryBadge?.labelKey).toBe('home.reasons.pantryRatio')
    expect(pantryBadge?.labelParams).toEqual({ matched: '1', total: '3' })
    expect(pantryBadge?.type).toBe('pantry')
  })

  it('returns pantryRatio with correct ratio when multiple pantry items match', () => {
    const badges = getRecommendationBadges(
      recipe({ ingredients: 'pasta, egg, guanciale, pecorino, pepper, garlic, olive oil, salt' }),
      null,
      ['pasta', 'egg', 'garlic'],
    )
    const pantryBadge = badges.find(b => b.key === 'pantry')
    expect(pantryBadge?.labelKey).toBe('home.reasons.pantryRatio')
    expect(pantryBadge?.labelParams).toEqual({ matched: '3', total: '8' })
  })

  it('returns pantryCountOne fallback when ingredients field is empty and 1 pantry match via title', () => {
    const badges = getRecommendationBadges(
      recipe({ title: 'Pasta Dish', ingredients: '' }),
      null,
      ['pasta'],
    )
    const pantryBadge = badges.find(b => b.key === 'pantry')
    expect(pantryBadge).toBeDefined()
    expect(pantryBadge?.labelKey).toBe('home.reasons.pantryCountOne')
  })

  it('returns pantryCount fallback when ingredients field is empty and multiple pantry matches via title', () => {
    const badges = getRecommendationBadges(
      recipe({ title: 'Pasta Egg Dish', ingredients: '' }),
      null,
      ['pasta', 'egg'],
    )
    const pantryBadge = badges.find(b => b.key === 'pantry')
    expect(pantryBadge?.labelKey).toBe('home.reasons.pantryCount')
    expect(pantryBadge?.labelParams?.count).toBe('2')
  })

  it('does not return pantry badge when no pantry match', () => {
    const badges = getRecommendationBadges(
      recipe({ title: 'Schnitzel', ingredients: 'veal, breadcrumbs' }),
      null,
      ['pasta', 'tomato'],
    )
    expect(badges.find(b => b.key === 'pantry')).toBeUndefined()
  })

  // ── Likes ───────────────────────────────────────────────────────────────

  it('returns likes badge when a liked term matches recipe title', () => {
    const badges = getRecommendationBadges(
      recipe({ title: 'Creamy Pasta Bake' }),
      profile({ likes: ['pasta'] }),
      [],
    )
    const likesBadge = badges.find(b => b.key === 'likes-pasta')
    expect(likesBadge).toBeDefined()
    expect(likesBadge?.labelKey).toBe('home.reasons.likes')
    expect(likesBadge?.labelParams).toEqual({ value: 'pasta' })
    expect(likesBadge?.type).toBe('likes')
  })

  it('returns at most one likes badge even with multiple matching likes', () => {
    const badges = getRecommendationBadges(
      recipe({ title: 'Pasta with chicken' }),
      profile({ likes: ['pasta', 'chicken'] }),
      [],
    )
    const likesBadges = badges.filter(b => b.type === 'likes')
    expect(likesBadges).toHaveLength(1)
  })

  it('does not return likes badge when no like matches', () => {
    const badges = getRecommendationBadges(
      recipe({ title: 'Beef Stew' }),
      profile({ likes: ['pasta'] }),
      [],
    )
    expect(badges.find(b => b.type === 'likes')).toBeUndefined()
  })

  // ── Diet badges ─────────────────────────────────────────────────────────

  it('returns vegan badge when profile is vegan and recipe is vegan', () => {
    const badges = getRecommendationBadges(
      recipe({ vegan: true }),
      profile({ vegan: true }),
      [],
    )
    const veganBadge = badges.find(b => b.key === 'vegan')
    expect(veganBadge).toBeDefined()
    expect(veganBadge?.labelKey).toBe('home.reasons.vegan')
    expect(veganBadge?.type).toBe('diet')
  })

  it('does not return vegan badge when recipe is not vegan', () => {
    const badges = getRecommendationBadges(
      recipe({ vegan: false }),
      profile({ vegan: true }),
      [],
    )
    expect(badges.find(b => b.key === 'vegan')).toBeUndefined()
  })

  it('does NOT return vegan badge for external recipe with no vegan data in flags or diets', () => {
    const badges = getRecommendationBadges(
      recipe({ vegan: false, diets: null }),
      profile({ vegan: true }),
      [],
      { isExternal: true },
    )
    expect(badges.find(b => b.key === 'vegan')).toBeUndefined()
  })

  it('returns vegan badge for external recipe when diets field confirms vegan', () => {
    const badges = getRecommendationBadges(
      recipe({ vegan: false, diets: 'gluten free, vegan' }),
      profile({ vegan: true }),
      [],
      { isExternal: true },
    )
    expect(badges.find(b => b.key === 'vegan')).toBeDefined()
  })

  it('returns glutenFree badge for external recipe when diets field confirms gluten free', () => {
    const badges = getRecommendationBadges(
      recipe({ glutenFree: false, diets: 'gluten free, dairy free' }),
      profile({ glutenFree: true }),
      [],
      { isExternal: true },
    )
    expect(badges.find(b => b.key === 'glutenFree')).toBeDefined()
  })

  it('returns vegetarian badge for external recipe when diets field confirms vegetarian', () => {
    const badges = getRecommendationBadges(
      recipe({ vegetarian: false, diets: 'lacto ovo vegetarian' }),
      profile({ vegetarian: true }),
      [],
      { isExternal: true },
    )
    expect(badges.find(b => b.key === 'vegetarian')).toBeDefined()
  })

  it('returns vegetarian badge when profile vegetarian and recipe vegetarian', () => {
    const badges = getRecommendationBadges(
      recipe({ vegetarian: true }),
      profile({ vegetarian: true }),
      [],
    )
    expect(badges.find(b => b.key === 'vegetarian')).toBeDefined()
  })

  it('does not return vegetarian badge when profile is vegan (vegan supersedes)', () => {
    const badges = getRecommendationBadges(
      recipe({ vegetarian: true }),
      profile({ vegan: true, vegetarian: true }),
      [],
    )
    expect(badges.find(b => b.key === 'vegetarian')).toBeUndefined()
  })

  it('returns glutenFree badge when profile glutenFree and recipe glutenFree', () => {
    const badges = getRecommendationBadges(
      recipe({ glutenFree: true }),
      profile({ glutenFree: true }),
      [],
    )
    const badge = badges.find(b => b.key === 'glutenFree')
    expect(badge).toBeDefined()
    expect(badge?.labelKey).toBe('home.reasons.glutenFree')
    expect(badge?.type).toBe('diet')
  })

  // ── Calorie goal ────────────────────────────────────────────────────────

  it('does not return underCalorieGoal badge (badge removed)', () => {
    const badges = getRecommendationBadges(
      recipe({ calories: 700 }),
      profile({ dailyCalorieTarget: 2000 }),
      [],
    )
    expect(badges.find(b => b.key === 'underCalorieGoal')).toBeUndefined()
  })

  it('returns calorieConscious badge when profile is calorieConscious and recipe.calories <= 650', () => {
    const badges = getRecommendationBadges(
      recipe({ calories: 600 }),
      profile({ calorieConscious: true }),
      [],
    )
    expect(badges.find(b => b.key === 'calorieConscious')).toBeDefined()
  })

  it('returns calorieConscious badge even when dailyCalorieTarget is set', () => {
    const badges = getRecommendationBadges(
      recipe({ calories: 500 }),
      profile({ calorieConscious: true, dailyCalorieTarget: 2000 }),
      [],
    )
    expect(badges.find(b => b.key === 'calorieConscious')).toBeDefined()
    expect(badges.find(b => b.key === 'underCalorieGoal')).toBeUndefined()
  })

  // ── Quick cook ──────────────────────────────────────────────────────────

  it('returns quickCook badge when total time <= 30 min', () => {
    const badges = getRecommendationBadges(
      recipe({ prepTimeMinutes: 10, cookTimeMinutes: 15 }),
      null,
      [],
    )
    const quickCook = badges.find(b => b.key === 'quickCook')
    expect(quickCook).toBeDefined()
    expect(quickCook?.type).toBe('time')
  })

  it('returns quickCook badge without any profile set', () => {
    const badges = getRecommendationBadges(
      recipe({ prepTimeMinutes: 5, cookTimeMinutes: 20 }),
      null,
      [],
    )
    expect(badges.find(b => b.key === 'quickCook')).toBeDefined()
  })

  it('does not return quickCook badge when total time > 30 min', () => {
    const badges = getRecommendationBadges(
      recipe({ prepTimeMinutes: 20, cookTimeMinutes: 15 }),
      null,
      [],
    )
    expect(badges.find(b => b.key === 'quickCook')).toBeUndefined()
  })

  it('does not return quickCook badge when totalTime is 0', () => {
    const badges = getRecommendationBadges(
      recipe({ prepTimeMinutes: 0, cookTimeMinutes: 0 }),
      null,
      [],
    )
    expect(badges.find(b => b.key === 'quickCook')).toBeUndefined()
  })

  // ── High protein badge ──────────────────────────────────────────────────

  it('highProtein badge matches German term "Hähnchenbrust"', () => {
    const badges = getRecommendationBadges(
      recipe({ ingredients: '200g Hähnchenbrust, Salz, Pfeffer' }),
      profile({ highProtein: true }),
      [],
    )
    expect(badges.find(b => b.key === 'highProtein')).toBeDefined()
  })

  it('highProtein badge matches German term "Lachs"', () => {
    const badges = getRecommendationBadges(
      recipe({ title: 'Gegrillter Lachs mit Zitrone' }),
      profile({ highProtein: true }),
      [],
    )
    expect(badges.find(b => b.key === 'highProtein')).toBeDefined()
  })

  it('highProtein badge matches German term "Kichererbsen"', () => {
    const badges = getRecommendationBadges(
      recipe({ ingredients: '300g Kichererbsen, Gewürze' }),
      profile({ highProtein: true }),
      [],
    )
    expect(badges.find(b => b.key === 'highProtein')).toBeDefined()
  })

  it('highProtein badge matches standalone "Ei" without false-positive on "Wein"', () => {
    const badgesWithWein = getRecommendationBadges(
      recipe({ ingredients: '200ml Weißwein, Butter' }),
      profile({ highProtein: true }),
      [],
    )
    expect(badgesWithWein.find(b => b.key === 'highProtein')).toBeUndefined()

    const badgesWithEi = getRecommendationBadges(
      recipe({ ingredients: '2 Ei, Mehl, Milch' }),
      profile({ highProtein: true }),
      [],
    )
    expect(badgesWithEi.find(b => b.key === 'highProtein')).toBeDefined()
  })

  it('highProtein badge not shown when profile.highProtein is false', () => {
    const badges = getRecommendationBadges(
      recipe({ ingredients: 'Hähnchen, Lachs, Quark' }),
      profile({ highProtein: false }),
      [],
    )
    expect(badges.find(b => b.key === 'highProtein')).toBeUndefined()
  })

  // ── Max badges ──────────────────────────────────────────────────────────

  it('returns at most 4 badges by default', () => {
    const badges = getRecommendationBadges(
      recipe({ title: 'pasta vegan glutenFree', vegan: true, glutenFree: true, calories: 400, prepTimeMinutes: 10, cookTimeMinutes: 10 }),
      profile({ vegan: true, glutenFree: true, calorieConscious: true, highProtein: true, likes: ['pasta'] }),
      ['pasta'],
    )
    expect(badges.length).toBeLessThanOrEqual(4)
  })

  it('respects custom maxBadges option', () => {
    const badges = getRecommendationBadges(
      recipe({ title: 'pasta vegan', vegan: true, calories: 300, prepTimeMinutes: 10, cookTimeMinutes: 10 }),
      profile({ vegan: true, calorieConscious: true, likes: ['pasta'] }),
      ['pasta'],
      { maxBadges: 2 },
    )
    expect(badges.length).toBeLessThanOrEqual(2)
  })

  // ── matchTermsFn ────────────────────────────────────────────────────────

  it('uses provided matchTermsFn for likes matching', () => {
    const badges = getRecommendationBadges(
      recipe({ title: 'Spaghetti Bolognese' }),
      profile({ likes: ['pasta'] }),
      [],
      { matchTermsFn: () => ['spaghetti', 'pasta'] },
    )
    expect(badges.find(b => b.type === 'likes')).toBeDefined()
  })
})

// ── safeTermMatch ──────────────────────────────────────────────────────────

describe('safeTermMatch', () => {
  // ── Pantry-style tests ───────────────────────────────────────────────────

  it('"Ei" matches "1 Ei" (standalone word)', () => {
    expect(safeTermMatch('Ei', '1 Ei')).toBe(true)
  })

  it('"Ei" does NOT match "Wein" (substring false-positive)', () => {
    expect(safeTermMatch('Ei', 'Wein')).toBe(false)
  })

  it('"Pasta" matches "Pasta Carbonara"', () => {
    expect(safeTermMatch('Pasta', 'Pasta Carbonara')).toBe(true)
  })

  it('"pasta" matches case-insensitively in "PASTA Carbonara"', () => {
    expect(safeTermMatch('pasta', 'PASTA Carbonara')).toBe(true)
  })

  it('"Tomate" matches "Tomaten" (German plural suffix)', () => {
    expect(safeTermMatch('Tomate', 'Tomaten, Zwiebeln')).toBe(true)
  })

  it('"Reis" does NOT match "Jasminreis" (compound word)', () => {
    expect(safeTermMatch('Reis', 'Jasminreis')).toBe(false)
  })

  it('"Ei" matches "Eier" (short suffix)', () => {
    expect(safeTermMatch('Ei', 'Eier')).toBe(true)
  })

  it('"Öl" matches "Öl, Salz" (standalone, with umlaut)', () => {
    expect(safeTermMatch('Öl', 'Öl, Salz')).toBe(true)
  })

  it('"chicken" does NOT match "chickpeas" (partial match inside word)', () => {
    expect(safeTermMatch('chicken', 'chickpeas')).toBe(false)
  })

  it('"chicken" matches "chicken breast"', () => {
    expect(safeTermMatch('chicken', 'chicken breast')).toBe(true)
  })

  it('multi-word "chicken breast" matches in text', () => {
    expect(safeTermMatch('chicken breast', 'rice, chicken breast, garlic')).toBe(true)
  })

  it('multi-word term with no match returns false', () => {
    expect(safeTermMatch('chicken breast', 'rice, tofu, garlic')).toBe(false)
  })

  it('returns false for empty term', () => {
    expect(safeTermMatch('', 'some text')).toBe(false)
  })

  it('returns false for single-character term (< 2 chars)', () => {
    expect(safeTermMatch('a', 'apple')).toBe(false)
  })

  it('"Salz" matches "Salz" at end of comma-separated list', () => {
    expect(safeTermMatch('Salz', 'Wasser, Mehl, Salz')).toBe(true)
  })
})
