export type ShoppingPrintItem = {
  name: string
  quantity?: number | string | null
  unit?: string | null
  checked: boolean
}

export type MealPlanPrintDay = {
  label: string
  date: string
  slots: Array<{
    slotLabel: string
    title: string
    calories?: number | null
  }>
  totalCalories?: number | null
}

export type MealPlanPrintLabels = {
  appTitle: string
  listTitle: string
  createdAt: string
  weekRange: string
  totalCalories: string
  emptyMessage: string
  kcalUnit: string
}

export type PantryPrintItem = {
  name: string
  quantity?: number | null
  unit?: string | null
}

export type ShoppingPrintLabels = {
  appTitle: string
  listTitle: string
  createdAt: string
  openSection: string
  doneSection: string
  quantityHeader: string
  unitHeader: string
  emptyMessage: string
}

export type PantryPrintLabels = {
  appTitle: string
  listTitle: string
  createdAt: string
  quantityHeader: string
  unitHeader: string
  emptyMessage: string
}

/**
 * Parses a raw ingredient string into quantity / unit / name parts for PDF display.
 * If the item already has quantity/unit fields set, those take priority.
 * Falls back to regex parsing of the name string for patterns like "85 g Spargel".
 */
export function parseShoppingItemForPrint(item: {
  name: string
  quantity?: number | null
  unit?: string | null
}): { name: string; quantity: string; unit: string } {
  if (item.quantity != null) {
    return {
      name: item.name,
      quantity: String(item.quantity),
      unit: item.unit ?? '',
    }
  }

  const raw = item.name.trim()

  // Match: <number or fraction> <word-unit> <rest-of-name>
  // e.g. "85 g Spargel", "2 Scheiben Bacon", "1/6 container Basilikumblätter"
  const threePartMatch = raw.match(
    /^(\d+(?:[.,]\d+)?(?:\/\d+)?)\s+([^\s\d.,/]+)\s+(.+)$/u,
  )
  if (threePartMatch) {
    return {
      quantity: threePartMatch[1]!,
      unit: threePartMatch[2]!,
      name: threePartMatch[3]!,
    }
  }

  // Match: <number or fraction> <rest-of-name> (no unit)
  // e.g. "1 Ei", "1/8 Gurke"
  const twoPartMatch = raw.match(/^(\d+(?:[.,]\d+)?(?:\/\d+)?)\s+(.+)$/u)
  if (twoPartMatch) {
    return {
      quantity: twoPartMatch[1]!,
      unit: item.unit ?? '',
      name: twoPartMatch[2]!,
    }
  }

  return { name: raw, quantity: '', unit: item.unit ?? '' }
}

function esc(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a2e2b; padding: 32px; font-size: 13px; }
  .print-header { border-bottom: 2px solid #2f8f7b; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: baseline; }
  .print-header h1 { font-size: 22px; color: #2f8f7b; font-weight: 800; letter-spacing: 0.5px; }
  .print-header .date { font-size: 11px; color: #486b68; }
  h2 { font-size: 16px; font-weight: 700; color: #1a2e2b; margin-bottom: 12px; }
  h3 { font-size: 13px; font-weight: 700; color: #2f8f7b; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: 0.4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { text-align: left; font-size: 11px; font-weight: 600; color: #486b68; border-bottom: 1px solid #c7ded8; padding: 4px 6px; text-transform: uppercase; letter-spacing: 0.3px; }
  td { padding: 5px 6px; border-bottom: 1px solid #eef5f3; vertical-align: middle; }
  .col-qty { width: 70px; text-align: right; }
  .col-unit { width: 70px; }
  .row-done td { color: #8aada9; text-decoration: line-through; }
  .empty { color: #8aada9; font-style: italic; margin-top: 8px; }
  @media print { body { padding: 16px; } button { display: none; } }
`

function tableRows(items: ShoppingPrintItem[] | PantryPrintItem[], qtyHeader: string, unitHeader: string): string {
  const header = `<tr><th>${esc(qtyHeader)}</th><th>${esc(unitHeader)}</th><th></th></tr>`
  const rows = items.map(item => {
    const isDone = 'checked' in item && (item as ShoppingPrintItem).checked
    const rowClass = isDone ? ' class="row-done"' : ''
    const qty = item.quantity != null ? String(item.quantity) : ''
    const unit = item.unit ? esc(item.unit) : ''
    return `<tr${rowClass}><td class="col-qty">${esc(qty)}</td><td class="col-unit">${unit}</td><td>${esc(item.name)}</td></tr>`
  }).join('')
  return `<table><thead>${header}</thead><tbody>${rows}</tbody></table>`
}

export function printShoppingList(items: ShoppingPrintItem[], labels: ShoppingPrintLabels): void {
  const open = items.filter(i => !i.checked)
  const done = items.filter(i => i.checked)

  const openHtml = open.length > 0
    ? tableRows(open, labels.quantityHeader, labels.unitHeader)
    : `<p class="empty">${esc(labels.emptyMessage)}</p>`

  const doneHtml = done.length > 0
    ? `<h3>${esc(labels.doneSection)}</h3>${tableRows(done, labels.quantityHeader, labels.unitHeader)}`
    : ''

  const html = buildPrintDocument(
    labels.appTitle,
    labels.listTitle,
    labels.createdAt,
    `<h3>${esc(labels.openSection)}</h3>${openHtml}${doneHtml}`,
  )

  openPrintWindow(html)
}

export function printPantry(items: PantryPrintItem[], labels: PantryPrintLabels): void {
  const body = items.length > 0
    ? tableRows(items, labels.quantityHeader, labels.unitHeader)
    : `<p class="empty">${esc(labels.emptyMessage)}</p>`

  const html = buildPrintDocument(labels.appTitle, labels.listTitle, labels.createdAt, body)
  openPrintWindow(html)
}

function buildPrintDocument(appTitle: string, listTitle: string, createdAt: string, body: string, extraCss = ''): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>${esc(listTitle)} – ${esc(appTitle)}</title>
  <style>${PRINT_CSS}${extraCss}</style>
</head>
<body>
  <header class="print-header">
    <h1>${esc(appTitle)}</h1>
    <span class="date">${esc(createdAt)}</span>
  </header>
  <h2>${esc(listTitle)}</h2>
  ${body}
</body>
</html>`
}

export function printMealPlan(
  days: MealPlanPrintDay[],
  totalCalories: number | null | undefined,
  labels: MealPlanPrintLabels,
): void {
  const hasAnyEntry = days.some(d => d.slots.length > 0)

  const daysHtml = days.map(day => {
    if (day.slots.length === 0) return ''
    const slotsHtml = day.slots.map(slot => {
      const cal = slot.calories != null ? ` <span class="kcal">${slot.calories} ${esc(labels.kcalUnit)}</span>` : ''
      return `<tr><td class="col-slot">${esc(slot.slotLabel)}</td><td>${esc(slot.title)}${cal}</td></tr>`
    }).join('')
    const dayCal = day.totalCalories != null
      ? `<tr class="day-cal"><td>${esc(labels.totalCalories)}:</td><td><strong>${day.totalCalories} ${esc(labels.kcalUnit)}</strong></td></tr>`
      : ''
    return `
      <h3>${esc(day.label)} <span class="date-label">${esc(day.date)}</span></h3>
      <table><tbody>${slotsHtml}${dayCal}</tbody></table>`
  }).join('')

  const totalHtml = totalCalories != null
    ? `<p class="week-total">${esc(labels.totalCalories)}: <strong>${totalCalories} ${esc(labels.kcalUnit)}</strong></p>`
    : ''

  const body = hasAnyEntry
    ? `${daysHtml}${totalHtml}`
    : `<p class="empty">${esc(labels.emptyMessage)}</p>`

  const extraCss = `
    .col-slot { width: 120px; color: #486b68; font-size: 0.85rem; }
    .kcal { color: #2f8f7b; font-size: 0.85rem; margin-left: 6px; }
    .date-label { font-size: 0.85rem; color: #486b68; font-weight: 400; margin-left: 6px; }
    .day-cal td { border-top: 1px solid #c7ded8; padding-top: 4px; color: #486b68; font-size: 0.85rem; }
    .week-total { margin-top: 16px; padding-top: 12px; border-top: 2px solid #2f8f7b; color: #1a2e2b; }
  `

  const html = buildPrintDocument(
    labels.appTitle,
    `${labels.listTitle}${labels.weekRange ? ' – ' + labels.weekRange : ''}`,
    labels.createdAt,
    body,
    extraCss,
  )
  openPrintWindow(html)
}

export function openPrintWindow(html: string): void {
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  // Delay print so the calling view can render toasts before the dialog blocks the UI
  setTimeout(() => win.print(), 80)
}
