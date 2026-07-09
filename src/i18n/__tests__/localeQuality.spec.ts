import { describe, expect, it } from 'vitest'

import de from '../locales/de.json'
import en from '../locales/en.json'

const locales = {
  de,
  en,
}

const globalForbiddenArtifacts = ['Ã', 'Â', '�', 'â˜']

const germanForbiddenArtifacts = [
  'Ã',
  'Â',
  '�',
  'â',
  'f?r',
  'ausw?hlen',
  'l?schen',
  'zur?ck',
  '?ber',
  '?nderungen',
]

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value]
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectStrings)
  }

  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(collectStrings)
  }

  return []
}

describe('locale quality', () => {
  it('keeps locale files free of common mojibake artifacts', () => {
    for (const [locale, messages] of Object.entries(locales)) {
      const texts = collectStrings(messages)

      for (const artifact of globalForbiddenArtifacts) {
        expect(texts, `${locale} must not contain ${artifact}`).not.toContainEqual(
          expect.stringContaining(artifact),
        )
      }
    }
  })

  it('keeps German translations free of common broken umlaut patterns', () => {
    const texts = collectStrings(de)

    for (const artifact of germanForbiddenArtifacts) {
      expect(texts, `de must not contain ${artifact}`).not.toContainEqual(
        expect.stringContaining(artifact),
      )
    }
  })

  it('uses real umlauts in Meal Plan texts', () => {
    expect(de.mealPlan.subtitle).toContain('für')
    expect(de.mealPlan.subtitle).not.toContain('f?r')
  })
})
