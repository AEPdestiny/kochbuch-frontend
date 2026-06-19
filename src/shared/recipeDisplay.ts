const CATEGORY_LABELS_DE: Record<string, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snack',
  snacks: 'Snacks',
  dessert: 'Dessert',
  drink: 'Getränk',
  'main course': 'Hauptgericht',
  'side dish': 'Beilage',
  soup: 'Suppe',
  salad: 'Salat',
}

export function displayCategory(value?: string | null, language = 'de') {
  const category = value?.trim()
  if (!category) {
    return ''
  }
  const normalized = category.toLowerCase()
  if (language.toLowerCase().startsWith('de')) {
    return CATEGORY_LABELS_DE[normalized] ?? category
  }
  return category
}
