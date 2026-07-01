// Units recognized when stripping an embedded "quantity unit name" prefix from item.name.
// Covers German and English unit names commonly used in recipes.
const UNIT_RE =
  /^(g|kg|ml|l|el|tl|tbsp|tsp|cup|tasse|stück|stk|piece|can|pack|clove|pinch|scheibe|scheiben|dose|dosen|packung|packungen|zehe|zehen|prise|prisen|ei|eier)$/i

// "57 g Spargelstangen", "1/3 EL Zucker", "280 g Unagi Kabayaki, aufgetaut und in Streifen"
const THREE_PART = /^(\d+(?:[.,]\d+)?(?:\/\d+)?)\s+([^\s\d.,/]+)\s+(.+)$/u
// "2 Eier", "1/2 Gurke" (no recognized unit as second word)
const TWO_PART = /^(\d+(?:[.,]\d+)?(?:\/\d+)?)\s+(.+)$/u

type Extracted = { rawQuantity: string; unit: string; name: string }

function extractFromName(raw: string): Extracted | null {
  const m3 = raw.match(THREE_PART)
  if (m3 && UNIT_RE.test(m3[2]!)) {
    return { rawQuantity: m3[1]!, unit: m3[2]!, name: m3[3]! }
  }
  const m2 = raw.match(TWO_PART)
  if (m2) {
    return { rawQuantity: m2[1]!, unit: '', name: m2[2]! }
  }
  return null
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n)
  const s = n.toPrecision(6).replace(/\.?0+$/, '')
  return s === '' ? String(n) : s
}

export type DisplayShoppingItem = {
  displayName: string
  displayQuantity: string
  displayUnit: string
}

/**
 * Normalizes a shopping list item for display.
 * Strips any embedded "quantity unit" prefix from item.name and returns
 * clean displayName / displayQuantity / displayUnit for use in the UI.
 *
 * Safe: if parsing is uncertain, returns the original name unchanged.
 */
export function normalizeShoppingListItemDisplay(item: {
  name: string
  quantity?: number | null
  unit?: string | null
}): DisplayShoppingItem {
  const raw = (item.name ?? '').trim()
  const extracted = extractFromName(raw)

  if (item.quantity != null) {
    // Explicit quantity field exists — use it; strip any embedded prefix from the name.
    return {
      displayName: extracted?.name ?? raw,
      displayQuantity: formatNumber(item.quantity),
      displayUnit: item.unit ?? '',
    }
  }

  if (extracted) {
    return {
      displayName: extracted.name,
      displayQuantity: extracted.rawQuantity,
      displayUnit: extracted.unit,
    }
  }

  return {
    displayName: raw,
    displayQuantity: '',
    displayUnit: item.unit ?? '',
  }
}

export type EditShoppingItem = {
  name: string
  quantity: number | null
  unit: string
}

/**
 * Normalizes a shopping list item for the edit form.
 * Returns clean name / numeric quantity / unit for pre-populating the form fields.
 */
export function normalizeShoppingListItemForEdit(item: {
  name: string
  quantity?: number | null
  unit?: string | null
}): EditShoppingItem {
  const raw = (item.name ?? '').trim()
  const extracted = extractFromName(raw)

  if (item.quantity != null) {
    return {
      name: extracted?.name ?? raw,
      quantity: item.quantity,
      unit: item.unit ?? '',
    }
  }

  if (extracted) {
    return {
      name: extracted.name,
      quantity: parseRawQuantity(extracted.rawQuantity),
      unit: extracted.unit,
    }
  }

  return { name: raw, quantity: null, unit: item.unit ?? '' }
}

function parseRawQuantity(raw: string): number | null {
  const s = raw.trim().replace(',', '.')
  if (s.includes('/')) {
    const [a, b] = s.split('/')
    const num = parseFloat(a!), den = parseFloat(b!)
    if (isNaN(num) || isNaN(den) || den === 0) return null
    return Math.round((num / den) * 1000) / 1000
  }
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}
