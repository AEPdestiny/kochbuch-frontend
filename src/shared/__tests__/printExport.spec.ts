import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { printShoppingList, printPantry, openPrintWindow } from '@/shared/printExport'

const mockPrint = vi.fn()
const mockClose = vi.fn()
const mockFocus = vi.fn()
const mockWrite = vi.fn()

function mockWindow() {
  return {
    document: { write: mockWrite, close: mockClose },
    focus: mockFocus,
    print: mockPrint,
  }
}

describe('printExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('window', {
      ...window,
      open: vi.fn().mockReturnValue(mockWindow()),
    })
  })

  describe('openPrintWindow', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('opens a new window, writes html, and calls print after a short delay', () => {
      vi.useFakeTimers()
      openPrintWindow('<html>test</html>')

      expect(window.open).toHaveBeenCalledWith('', '_blank', expect.any(String))
      expect(mockWrite).toHaveBeenCalledWith('<html>test</html>')
      expect(mockClose).toHaveBeenCalled()
      expect(mockFocus).toHaveBeenCalled()
      // print is deferred — not called yet
      expect(mockPrint).not.toHaveBeenCalled()
      // advance timers — print fires
      vi.runAllTimers()
      expect(mockPrint).toHaveBeenCalled()
    })

    it('does nothing if window.open returns null (popup blocked)', () => {
      vi.mocked(window.open).mockReturnValue(null)

      expect(() => openPrintWindow('<html>test</html>')).not.toThrow()
      expect(mockPrint).not.toHaveBeenCalled()
    })
  })

  describe('printShoppingList', () => {
    const labels = {
      appTitle: 'Dishly',
      listTitle: 'Einkaufsliste',
      createdAt: 'Erstellt am: 01.01.2026',
      openSection: 'Noch zu kaufen',
      doneSection: 'Erledigt',
      quantityHeader: 'Menge',
      unitHeader: 'Einheit',
      emptyMessage: 'Keine Einträge',
    }

    it('calls openPrintWindow with HTML containing the list title', () => {
      printShoppingList(
        [{ name: 'Tomaten', quantity: 2, unit: 'kg', checked: false }],
        labels,
      )

      expect(mockWrite).toHaveBeenCalledTimes(1)
      const html = mockWrite.mock.calls[0]![0] as string
      expect(html).toContain('Einkaufsliste')
      expect(html).toContain('Dishly')
    })

    it('includes open items in the HTML', () => {
      printShoppingList(
        [
          { name: 'Milch', quantity: 1, unit: 'l', checked: false },
          { name: 'Brot', quantity: null, unit: null, checked: true },
        ],
        labels,
      )

      const html = mockWrite.mock.calls[0]![0] as string
      expect(html).toContain('Milch')
      expect(html).toContain('Brot')
    })

    it('includes done section when checked items exist', () => {
      printShoppingList(
        [
          { name: 'Mehl', quantity: 500, unit: 'g', checked: false },
          { name: 'Salz', quantity: null, unit: null, checked: true },
        ],
        labels,
      )

      const html = mockWrite.mock.calls[0]![0] as string
      expect(html).toContain('Erledigt')
      expect(html).toContain('Noch zu kaufen')
    })

    it('escapes HTML special characters in item names', () => {
      printShoppingList(
        [{ name: '<script>alert("xss")</script>', quantity: null, unit: null, checked: false }],
        labels,
      )

      const html = mockWrite.mock.calls[0]![0] as string
      expect(html).not.toContain('<script>')
      expect(html).toContain('&lt;script&gt;')
    })
  })

  describe('printPantry', () => {
    const labels = {
      appTitle: 'Dishly',
      listTitle: 'Vorrat',
      createdAt: 'Erstellt am: 01.01.2026',
      quantityHeader: 'Menge',
      unitHeader: 'Einheit',
      emptyMessage: 'Keine Einträge',
    }

    it('calls openPrintWindow with HTML containing the pantry title', () => {
      printPantry(
        [{ name: 'Reis', quantity: 1, unit: 'kg' }],
        labels,
      )

      const html = mockWrite.mock.calls[0]![0] as string
      expect(html).toContain('Vorrat')
      expect(html).toContain('Dishly')
    })

    it('includes all item names in the HTML', () => {
      printPantry(
        [
          { name: 'Olivenöl', quantity: 0.5, unit: 'l' },
          { name: 'Nudeln', quantity: 500, unit: 'g' },
        ],
        labels,
      )

      const html = mockWrite.mock.calls[0]![0] as string
      expect(html).toContain('Olivenöl')
      expect(html).toContain('Nudeln')
    })

    it('shows empty message when no items', () => {
      printPantry([], labels)

      const html = mockWrite.mock.calls[0]![0] as string
      expect(html).toContain('Keine Einträge')
    })

    it('escapes HTML special characters in item names', () => {
      printPantry(
        [{ name: '<b>bold</b>', quantity: null, unit: null }],
        labels,
      )

      const html = mockWrite.mock.calls[0]![0] as string
      expect(html).not.toContain('<b>')
      expect(html).toContain('&lt;b&gt;')
    })
  })
})
