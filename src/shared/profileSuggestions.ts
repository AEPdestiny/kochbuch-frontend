import type { LocaleCode } from '@/i18n'

export type SuggestionEntry = {
  canonical: string
  matchTerms: string[]
  labels: Record<LocaleCode, string>
}

function getLabel(entry: SuggestionEntry, locale: string): string {
  return entry.labels[locale as LocaleCode] ?? entry.labels['de']
}

export function getSuggestions(entries: SuggestionEntry[], locale: string): string[] {
  return entries.map(e => getLabel(e, locale))
}

export function toCanonical(value: string, entries: SuggestionEntry[]): string {
  const lower = value.trim().toLowerCase()
  for (const entry of entries) {
    if (entry.canonical.toLowerCase() === lower) return entry.canonical
    for (const label of Object.values(entry.labels)) {
      if (label.toLowerCase() === lower) return entry.canonical
    }
  }
  return value
}

export function toLocaleLabel(value: string, entries: SuggestionEntry[], locale: string): string {
  const lower = value.trim().toLowerCase()
  const entry = entries.find(e => e.canonical.toLowerCase() === lower)
  return entry ? getLabel(entry, locale) : value
}

export function getMatchTerms(value: string, entries: SuggestionEntry[]): string[] {
  const lower = value.trim().toLowerCase()
  const entry = entries.find(e => e.canonical.toLowerCase() === lower)
  return entry ? entry.matchTerms : [lower]
}

// ─── EU Allergen list (14 major allergens) ───────────────────────────────────

export const ALLERGEN_ENTRIES: SuggestionEntry[] = [
  {
    canonical: 'Gluten',
    matchTerms: ['gluten', 'weizen', 'wheat'],
    labels: { de: 'Gluten', en: 'Gluten', tr: 'Gluten', pl: 'Gluten', ar: 'الغلوتين', zh: '麸质', ja: 'グルテン' },
  },
  {
    canonical: 'Krebstiere',
    matchTerms: ['krebstiere', 'shellfish', 'shrimp', 'garnele', 'krabbe', 'crab', 'lobster'],
    labels: { de: 'Krebstiere', en: 'Shellfish', tr: 'Kabuklu deniz ürünleri', pl: 'Skorupiaki', ar: 'القشريات', zh: '甲壳类', ja: '甲殻類' },
  },
  {
    canonical: 'Eier',
    matchTerms: ['eier', 'ei', 'egg', 'eggs'],
    labels: { de: 'Eier', en: 'Eggs', tr: 'Yumurta', pl: 'Jaja', ar: 'البيض', zh: '鸡蛋', ja: '卵' },
  },
  {
    canonical: 'Fisch',
    matchTerms: ['fisch', 'fish'],
    labels: { de: 'Fisch', en: 'Fish', tr: 'Balık', pl: 'Ryby', ar: 'الأسماك', zh: '鱼', ja: '魚' },
  },
  {
    canonical: 'Erdnüsse',
    matchTerms: ['erdnuss', 'erdnüsse', 'peanut', 'peanuts'],
    labels: { de: 'Erdnüsse', en: 'Peanuts', tr: 'Yer fıstığı', pl: 'Orzeszki ziemne', ar: 'الفول السوداني', zh: '花生', ja: 'ピーナッツ' },
  },
  {
    canonical: 'Soja',
    matchTerms: ['soja', 'soy', 'soybean', 'tofu'],
    labels: { de: 'Soja', en: 'Soy', tr: 'Soya', pl: 'Soja', ar: 'الصويا', zh: '大豆', ja: '大豆' },
  },
  {
    canonical: 'Milch',
    matchTerms: ['milch', 'milk', 'sahne', 'butter', 'cream', 'joghurt', 'yogurt', 'käse', 'cheese'],
    labels: { de: 'Milch', en: 'Milk', tr: 'Süt', pl: 'Mleko', ar: 'الحليب', zh: '牛奶', ja: '牛乳' },
  },
  {
    canonical: 'Schalenfrüchte',
    matchTerms: ['schalenfrüchte', 'nüsse', 'nuts', 'walnuss', 'mandel', 'haselnuss', 'cashew', 'walnut', 'almond', 'hazelnut'],
    labels: { de: 'Schalenfrüchte', en: 'Tree nuts', tr: 'Kabuklu yemişler', pl: 'Orzechy', ar: 'المكسرات', zh: '坚果', ja: '木の実' },
  },
  {
    canonical: 'Sellerie',
    matchTerms: ['sellerie', 'celery'],
    labels: { de: 'Sellerie', en: 'Celery', tr: 'Kereviz', pl: 'Seler', ar: 'الكرفس', zh: '芹菜', ja: 'セロリ' },
  },
  {
    canonical: 'Senf',
    matchTerms: ['senf', 'mustard'],
    labels: { de: 'Senf', en: 'Mustard', tr: 'Hardal', pl: 'Gorczyca', ar: 'الخردل', zh: '芥末', ja: 'マスタード' },
  },
  {
    canonical: 'Sesam',
    matchTerms: ['sesam', 'sesame'],
    labels: { de: 'Sesam', en: 'Sesame', tr: 'Susam', pl: 'Sezam', ar: 'السمسم', zh: '芝麻', ja: 'ごま' },
  },
  {
    canonical: 'Sulfite',
    matchTerms: ['sulfit', 'sulfite', 'sulfites'],
    labels: { de: 'Sulfite', en: 'Sulfites', tr: 'Sülfitler', pl: 'Siarczyny', ar: 'الكبريتيت', zh: '亚硫酸盐', ja: '亜硫酸塩' },
  },
  {
    canonical: 'Lupinen',
    matchTerms: ['lupine', 'lupinen', 'lupin'],
    labels: { de: 'Lupinen', en: 'Lupin', tr: 'Acı bakla', pl: 'Łubin', ar: 'الترمس', zh: '羽扇豆', ja: 'ルピナス' },
  },
  {
    canonical: 'Weichtiere',
    matchTerms: ['weichtiere', 'mollusc', 'mollusk', 'muschel', 'mussel', 'austern', 'oyster', 'tintenfisch', 'squid'],
    labels: { de: 'Weichtiere', en: 'Molluscs', tr: 'Yumuşakçalar', pl: 'Mięczaki', ar: 'الرخويات', zh: '软体动物', ja: '軟体動物' },
  },
]

// ─── Likes suggestions ───────────────────────────────────────────────────────

export const LIKES_ENTRIES: SuggestionEntry[] = [
  {
    canonical: 'Pasta',
    matchTerms: ['pasta', 'nudel', 'noodle', 'spaghetti', 'penne'],
    labels: { de: 'Pasta', en: 'Pasta', tr: 'Makarna', pl: 'Makaron', ar: 'المكرونة', zh: '意面', ja: 'パスタ' },
  },
  {
    canonical: 'Sushi',
    matchTerms: ['sushi'],
    labels: { de: 'Sushi', en: 'Sushi', tr: 'Suşi', pl: 'Sushi', ar: 'السوشي', zh: '寿司', ja: '寿司' },
  },
  {
    canonical: 'Pizza',
    matchTerms: ['pizza'],
    labels: { de: 'Pizza', en: 'Pizza', tr: 'Pizza', pl: 'Pizza', ar: 'البيتزا', zh: '披萨', ja: 'ピザ' },
  },
  {
    canonical: 'Reis',
    matchTerms: ['reis', 'rice'],
    labels: { de: 'Reis', en: 'Rice', tr: 'Pirinç', pl: 'Ryż', ar: 'الأرز', zh: '米饭', ja: 'ご飯' },
  },
  {
    canonical: 'Hähnchen',
    matchTerms: ['hähnchen', 'huhn', 'chicken', 'poulet'],
    labels: { de: 'Hähnchen', en: 'Chicken', tr: 'Tavuk', pl: 'Kurczak', ar: 'الدجاج', zh: '鸡肉', ja: '鶏肉' },
  },
  {
    canonical: 'Lachs',
    matchTerms: ['lachs', 'salmon'],
    labels: { de: 'Lachs', en: 'Salmon', tr: 'Somon', pl: 'Łosoś', ar: 'السلمون', zh: '三文鱼', ja: 'サーモン' },
  },
  {
    canonical: 'Gemüse',
    matchTerms: ['gemüse', 'vegetable', 'vegetables', 'veggie'],
    labels: { de: 'Gemüse', en: 'Vegetables', tr: 'Sebze', pl: 'Warzywa', ar: 'الخضروات', zh: '蔬菜', ja: '野菜' },
  },
  {
    canonical: 'Kartoffeln',
    matchTerms: ['kartoffel', 'potato', 'potatoes'],
    labels: { de: 'Kartoffeln', en: 'Potatoes', tr: 'Patates', pl: 'Ziemniaki', ar: 'البطاطس', zh: '土豆', ja: 'じゃがいも' },
  },
  {
    canonical: 'Curry',
    matchTerms: ['curry'],
    labels: { de: 'Curry', en: 'Curry', tr: 'Köri', pl: 'Curry', ar: 'الكاري', zh: '咖喱', ja: 'カレー' },
  },
  {
    canonical: 'Salat',
    matchTerms: ['salat', 'salad'],
    labels: { de: 'Salat', en: 'Salad', tr: 'Salata', pl: 'Sałatka', ar: 'السلطة', zh: '沙拉', ja: 'サラダ' },
  },
  {
    canonical: 'Suppe',
    matchTerms: ['suppe', 'soup', 'eintopf', 'brühe'],
    labels: { de: 'Suppe', en: 'Soup', tr: 'Çorba', pl: 'Zupa', ar: 'الحساء', zh: '汤', ja: 'スープ' },
  },
  {
    canonical: 'Käse',
    matchTerms: ['käse', 'cheese'],
    labels: { de: 'Käse', en: 'Cheese', tr: 'Peynir', pl: 'Ser', ar: 'الجبن', zh: '奶酪', ja: 'チーズ' },
  },
  {
    canonical: 'Tomaten',
    matchTerms: ['tomate', 'tomaten', 'tomato', 'tomatoes'],
    labels: { de: 'Tomaten', en: 'Tomatoes', tr: 'Domates', pl: 'Pomidory', ar: 'الطماطم', zh: '番茄', ja: 'トマト' },
  },
  {
    canonical: 'Avocado',
    matchTerms: ['avocado'],
    labels: { de: 'Avocado', en: 'Avocado', tr: 'Avokado', pl: 'Awokado', ar: 'الأفوكادو', zh: '牛油果', ja: 'アボカド' },
  },
]

// ─── Dislikes suggestions ────────────────────────────────────────────────────

export const DISLIKES_ENTRIES: SuggestionEntry[] = [
  {
    canonical: 'Pilze',
    matchTerms: ['pilz', 'pilze', 'mushroom', 'mushrooms'],
    labels: { de: 'Pilze', en: 'Mushrooms', tr: 'Mantar', pl: 'Grzyby', ar: 'الفطر', zh: '蘑菇', ja: 'キノコ' },
  },
  {
    canonical: 'Oliven',
    matchTerms: ['olive', 'oliven', 'olives'],
    labels: { de: 'Oliven', en: 'Olives', tr: 'Zeytin', pl: 'Oliwki', ar: 'الزيتون', zh: '橄榄', ja: 'オリーブ' },
  },
  {
    canonical: 'Zwiebeln',
    matchTerms: ['zwiebel', 'zwiebeln', 'onion', 'onions'],
    labels: { de: 'Zwiebeln', en: 'Onions', tr: 'Soğan', pl: 'Cebula', ar: 'البصل', zh: '洋葱', ja: '玉ねぎ' },
  },
  {
    canonical: 'Knoblauch',
    matchTerms: ['knoblauch', 'garlic'],
    labels: { de: 'Knoblauch', en: 'Garlic', tr: 'Sarımsak', pl: 'Czosnek', ar: 'الثوم', zh: '大蒜', ja: 'にんにく' },
  },
  {
    canonical: 'Fisch',
    matchTerms: ['fisch', 'fish'],
    labels: { de: 'Fisch', en: 'Fish', tr: 'Balık', pl: 'Ryby', ar: 'الأسماك', zh: '鱼', ja: '魚' },
  },
  {
    canonical: 'Meeresfrüchte',
    matchTerms: ['meeresfrüchte', 'seafood', 'meeresfrüchten'],
    labels: { de: 'Meeresfrüchte', en: 'Seafood', tr: 'Deniz ürünleri', pl: 'Owoce morza', ar: 'المأكولات البحرية', zh: '海鲜', ja: '魚介類' },
  },
  {
    canonical: 'Brokkoli',
    matchTerms: ['brokkoli', 'broccoli'],
    labels: { de: 'Brokkoli', en: 'Broccoli', tr: 'Brokoli', pl: 'Brokuły', ar: 'البروكلي', zh: '西兰花', ja: 'ブロッコリー' },
  },
  {
    canonical: 'Spinat',
    matchTerms: ['spinat', 'spinach'],
    labels: { de: 'Spinat', en: 'Spinach', tr: 'Ispanak', pl: 'Szpinak', ar: 'السبانخ', zh: '菠菜', ja: 'ほうれん草' },
  },
  {
    canonical: 'Koriander',
    matchTerms: ['koriander', 'coriander', 'cilantro'],
    labels: { de: 'Koriander', en: 'Coriander', tr: 'Kişniş', pl: 'Kolendra', ar: 'الكزبرة', zh: '香菜', ja: 'コリアンダー' },
  },
  {
    canonical: 'Chili',
    matchTerms: ['chili', 'chilli', 'peperoni'],
    labels: { de: 'Chili', en: 'Chili', tr: 'Acı biber', pl: 'Chili', ar: 'الفلفل الحار', zh: '辣椒', ja: 'チリ' },
  },
  {
    canonical: 'Sellerie',
    matchTerms: ['sellerie', 'celery'],
    labels: { de: 'Sellerie', en: 'Celery', tr: 'Kereviz', pl: 'Seler', ar: 'الكرفس', zh: '芹菜', ja: 'セロリ' },
  },
]
