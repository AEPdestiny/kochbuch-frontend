// "57 g Spargelstangen", "1/3 EL Zucker", "280 g Unagi Kabayaki, aufgetaut und in Streifen"
const THREE_PART = /^(\d+(?:[.,]\d+)?(?:\/\d+)?)\s+([^\s\d,/]+)\s+(.+)$/u
// "2 Eier", "1/2 Gurke" (no recognized unit as second word)
const TWO_PART = /^(\d+(?:[.,]\d+)?(?:\/\d+)?)\s+(.+)$/u

type Extracted = { rawQuantity: string; unit: string; name: string }

function extractFromName(raw: string): Extracted | null {
  const normalizedRaw = normalizeQuantityGlyphs(raw)
  const m3 = normalizedRaw.match(THREE_PART)
  if (m3 && canonicalUnit(m3[2]!)) {
    return { rawQuantity: m3[1]!, unit: m3[2]!, name: m3[3]! }
  }
  const m2 = normalizedRaw.match(TWO_PART)
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
}, locale?: string): DisplayShoppingItem {
  const raw = (item.name ?? '').trim()
  const extracted = extractFromName(raw)

  if (item.quantity != null) {
    // Explicit quantity field exists — use it; strip any embedded prefix from the name.
    return {
      displayName: extracted?.name ?? raw,
      displayQuantity: formatNumber(item.quantity),
      displayUnit: displayUnitForLocale(item.unit ?? '', locale),
    }
  }

  if (extracted) {
    return {
      displayName: extracted.name,
      displayQuantity: extracted.rawQuantity,
      displayUnit: displayUnitForLocale(extracted.unit, locale),
    }
  }

  return {
    displayName: raw,
    displayQuantity: '',
    displayUnit: displayUnitForLocale(item.unit ?? '', locale),
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

/**
 * Normalizes a name/unit for duplicate-merge comparison: trims, collapses internal
 * whitespace, and lowercases so "Basmatireis" and " basmatireis  " are treated as equal.
 */
export function normalizeForMergeComparison(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function parseRawQuantity(raw: string): number | null {
  const s = normalizeQuantityGlyphs(raw).trim().replace(',', '.')
  if (s.includes('/')) {
    const [a, b] = s.split('/')
    const num = parseFloat(a!), den = parseFloat(b!)
    if (isNaN(num) || isNaN(den) || den === 0) return null
    return Math.round((num / den) * 1000) / 1000
  }
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function normalizeQuantityGlyphs(value: string): string {
  return value
    .replace(/\u00BC/g, '1/4')
    .replace(/\u00BD/g, '1/2')
    .replace(/\u00BE/g, '3/4')
    .replace(/\u2153/g, '1/3')
    .replace(/\u2154/g, '2/3')
}

export function displayUnitForLocale(unit: string | null | undefined, locale?: string): string {
  const raw = unit?.trim() ?? ''
  if (!raw) return ''
  const canonical = canonicalUnit(raw)
  if (!canonical || !locale) return raw
  return locale.startsWith('de') ? UNIT_LABELS_DE[canonical] ?? raw : UNIT_LABELS_EN[canonical] ?? raw
}

function canonicalUnit(unit: string | null | undefined): string | null {
  const raw = unit?.trim() ?? ''
  if (!raw) return null
  if (raw === 'T') return 'tbsp'
  if (raw === 't') return 'tsp'
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace('ß', 'ss')
    .replace(/[.]/g, '')
  return UNIT_ALIASES[normalized] ?? null
}

const UNIT_ALIASES: Record<string, string> = {
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
  liter: 'l',
  liters: 'l',
  litre: 'l',
  litres: 'l',
  tl: 'tsp',
  teeloffel: 'tsp',
  teeloeffel: 'tsp',
  tsp: 'tsp',
  tsps: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  el: 'tbsp',
  essloffel: 'tbsp',
  essloeffel: 'tbsp',
  tbsp: 'tbsp',
  tbsps: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tasse: 'cup',
  tassen: 'cup',
  cup: 'cup',
  cups: 'cup',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  unze: 'oz',
  unzen: 'oz',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  pfund: 'lb',
  packung: 'package',
  packungen: 'package',
  paket: 'package',
  pakete: 'package',
  package: 'package',
  packages: 'package',
  pack: 'package',
  packs: 'package',
  stueck: 'piece',
  stuck: 'piece',
  stk: 'piece',
  piece: 'piece',
  pieces: 'piece',
  scheibe: 'slice',
  scheiben: 'slice',
  slice: 'slice',
  slices: 'slice',
  zehe: 'clove',
  zehen: 'clove',
  clove: 'clove',
  cloves: 'clove',
  bund: 'bunch',
  bunch: 'bunch',
  bunches: 'bunch',
  stiel: 'stalk',
  stiele: 'stalk',
  stalk: 'stalk',
  stalks: 'stalk',
  prise: 'pinch',
  prisen: 'pinch',
  pinch: 'pinch',
  pinches: 'pinch',
  dose: 'can',
  dosen: 'can',
  can: 'can',
  cans: 'can',
}

const UNIT_LABELS_DE: Record<string, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
  tsp: 'TL',
  tbsp: 'EL',
  cup: 'Tasse',
  oz: 'oz',
  lb: 'lb',
  package: 'Packung',
  slice: 'Scheiben',
  piece: 'Stück',
  clove: 'Zehe',
  bunch: 'Bund',
  stalk: 'Stiel',
  pinch: 'Prise',
  can: 'Dose',
}

const UNIT_LABELS_EN: Record<string, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
  tsp: 'tsp',
  tbsp: 'tbsp',
  cup: 'cup',
  oz: 'oz',
  lb: 'lb',
  package: 'package',
  slice: 'slices',
  piece: 'pieces',
  clove: 'cloves',
  bunch: 'bunch',
  stalk: 'stalks',
  pinch: 'pinch',
  can: 'can',
}
